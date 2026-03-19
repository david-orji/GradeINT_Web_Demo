import { useState, useEffect, useRef } from "react";
import { ExamPackage } from "@gradeint/shared-types";
import { ConnectionState } from "../lib/local-api";
import { 
  CheckCircle2, 
  AlertCircle, 
  User as UserIcon, 
  Check, 
  Flag,
  RotateCcw,
  ChevronDown
} from "lucide-react";

export interface AnswerState {
  questionId: string;
  selectedOptionIds?: string[];
  textAnswer?: string;
  lastModifiedAt: string;
  isFlagged?: boolean;
}

interface ExamProps {
  exam: ExamPackage;
  connection: ConnectionState;
  initialAnswers?: AnswerState[];
  onAutosave: (answers: AnswerState[]) => void;
  onSubmit: (answers: AnswerState[]) => void;
}

export function Exam({ exam, connection, initialAnswers = [], onAutosave, onSubmit }: ExamProps) {
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(() => {
    const record: Record<string, AnswerState> = {};
    for (const ans of initialAnswers) {
      if (ans && ans.questionId) {
        record[ans.questionId] = ans;
      }
    }
    return record;
  });
  const [timeLeft, setTimeLeft] = useState(exam.duration);
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState<string>(exam.questions[0]?.questionId || "");
  
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Timer logic
  useEffect(() => {
    if (timeLeft <= 0) {
      onSubmit(Object.values(answers));
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, answers, onSubmit]);

  // Periodic autosave (every 30 seconds)
  useEffect(() => {
    const autosaveTimer = setInterval(() => {
      onAutosave(Object.values(answers));
    }, 30000);
    return () => clearInterval(autosaveTimer);
  }, [answers, onAutosave]);

  // Intersection Observer to track active question while scrolling
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            setActiveQuestionId(entry.target.id);
          }
        });
      },
      { threshold: 0.5, rootMargin: "-80px 0px -50% 0px" }
    );

    Object.values(questionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [exam.questions]);

  const handleAnswer = (questionId: string, value: string | string[]) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        questionId,
        ...(Array.isArray(value) ? { selectedOptionIds: value } : { textAnswer: value }),
        lastModifiedAt: new Date().toISOString()
      }
    }));
  };

  const toggleFlag = (questionId: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        questionId,
        isFlagged: !prev[questionId]?.isFlagged,
        lastModifiedAt: new Date().toISOString()
      }
    }));
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isAnswered = (qId: string) => {
    const ans = answers[qId];
    if (!ans) return false;
    if (ans.selectedOptionIds && ans.selectedOptionIds.length > 0) return true;
    if (ans.textAnswer && ans.textAnswer.trim().length > 0) return true;
    return false;
  };

  const scrollToQuestion = (qId: string) => {
    const element = questionRefs.current[qId];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const answeredCount = exam.questions.filter(q => isAnswered(q.questionId)).length;

  if (showConfirm) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9F9F7] p-4 font-sans">
        <div className="max-w-md w-full p-10 bg-white rounded-3xl shadow-2xl text-center space-y-8 border border-slate-100">
          <div className="h-20 w-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <AlertCircle className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold text-slate-800 tracking-tight">Hand in Exam?</h2>
            <p className="text-slate-500 font-normal">
              You have completed <span className="text-slate-800 font-medium">{answeredCount}</span> of <span className="text-slate-800 font-medium">{exam.questions.length}</span> questions.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => onSubmit(Object.values(answers))}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all font-semibold text-lg shadow-lg shadow-blue-600/20 active:scale-[0.98]"
            >
              Confirm and Submit
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all font-semibold border border-slate-200"
            >
              Keep Reviewing
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#F9F9F7] text-[#1E1E1E] flex flex-col font-sans overflow-hidden">
      {/* Premium Sticky Header */}
      <header className="h-20 border-b border-[#E5E5E0] bg-white/90 backdrop-blur-xl z-50 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 pr-4 border-r border-[#E5E5E0]">
            <div className="h-9 w-9 bg-[#1E1E1E] text-white rounded-xl flex items-center justify-center font-medium">
              G
            </div>
            <span className="text-xl font-semibold tracking-tighter">GradeINT</span>
          </div>
          <div className="pl-2">
            <h1 className="text-sm font-medium text-[#1E1E1E]">{exam.title}</h1>
            <p className="text-[11px] text-[#8C8C85] font-medium uppercase tracking-widest mt-0.5">Grade Level 5 • English Literature</p>
          </div>
        </div>
        
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="text-3xl font-semibold tabular-nums tracking-tight">
            {formatTime(timeLeft)}
          </div>
        </div>
        
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F0FDF4] border border-[#DCFCE7] text-[#166534] text-[11px] font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            All answers saved
          </div>
          
          <div className="flex items-center gap-3 pl-5 border-l border-[#E5E5E0]">
            <div className="text-right">
              <p className="text-xs font-medium">{connection.studentId || "Jane Doe"}</p>
              <p className="text-[10px] text-green-600 font-medium flex items-center justify-end gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Online
              </p>
            </div>
            <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200 shadow-sm">
              <UserIcon className="w-5 h-5 text-slate-500" />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Detailed Navigation */}
        <aside className="w-[280px] border-r border-[#E5E5E0] bg-white flex flex-col shrink-0">
          <div className="p-6 space-y-6">
            <div className="space-y-1">
              <p className="text-2xl font-semibold tracking-tight">{answeredCount} of {exam.questions.length}</p>
              <p className="text-xs text-[#8C8C85] font-medium uppercase tracking-wider">Questions answered</p>
            </div>

            <div className="space-y-3 pb-6 border-b border-[#F2F2EF]">
              <div className="flex items-center gap-3 text-xs font-medium text-[#4D4D48]">
                <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-200">
                  <Check className="w-3.5 h-3.5" />
                </div>
                Answered
              </div>
              <div className="flex items-center gap-3 text-xs font-medium text-[#4D4D48]">
                <div className="w-5 h-5 rounded-md bg-white border border-[#D9D9D1] shadow-sm" />
                Unanswered
              </div>
              <div className="flex items-center gap-3 text-xs font-medium text-[#4D4D48]">
                <div className="w-5 h-5 rounded-md bg-blue-100 border border-blue-400 ring-4 ring-blue-50" />
                Current
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {exam.questions.map((q, idx) => {
                const answered = isAnswered(q.questionId);
                const active = q.questionId === activeQuestionId;
                const flagged = answers[q.questionId]?.isFlagged;
                return (
                  <button
                    key={q.questionId}
                    onClick={() => scrollToQuestion(q.questionId)}
                    className={`
                      aspect-square rounded-lg text-xs font-medium transition-all duration-200 relative
                      flex items-center justify-center border
                      ${active 
                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-4 ring-blue-50 z-10' 
                        : answered 
                          ? 'border-transparent bg-blue-600 text-white shadow-lg shadow-blue-100' 
                          : 'border-[#D9D9D1] bg-white text-[#8C8C85] hover:border-slate-400'}
                    `}
                  >
                    {idx + 1}
                    {flagged && (
                      <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white shadow-sm" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main Content Area: Scrollable Question Feed */}
        <main 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-12 py-10 space-y-6 bg-[#F9F9F7]"
        >
          <div className="max-w-3xl mx-auto space-y-8">
            {exam.questions.map((q, idx) => {
              const answered = isAnswered(q.questionId);
              const flagged = answers[q.questionId]?.isFlagged;
              
              return (
                <div 
                  key={q.questionId}
                  id={q.questionId}
                  ref={(el) => { questionRefs.current[q.questionId] = el; }}
                  className={`
                    bg-white border transition-all duration-300 rounded-[2rem] p-10 
                    ${q.questionId === activeQuestionId 
                      ? 'border-blue-200 shadow-xl shadow-blue-900/5 ring-1 ring-blue-100 scale-[1.01]' 
                      : 'border-[#E5E5E0] shadow-sm hover:shadow-md'}
                  `}
                >
                  <div className="flex items-center gap-3 mb-8">
                    <span className="text-sm font-medium text-slate-800">Question {idx + 1}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[#8C8C85] text-[10px] font-medium uppercase tracking-wider border border-slate-200">
                      Required
                    </span>
                    {answered && (
                      <div className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-[10px] font-medium uppercase tracking-wider rounded-full border border-green-100">
                        <Check className="w-3 h-3" />
                        Saved
                      </div>
                    )}
                  </div>

                  <h3 className="text-xl font-medium leading-relaxed mb-10 text-slate-800">
                    {q.text}
                  </h3>

                  {/* MCQ Template */}
                  {q.type === 'mcq' && q.options ? (
                    <div className="grid gap-3">
                      {q.options.map((opt, oIdx) => {
                        const isSelected = answers[q.questionId]?.selectedOptionIds?.includes(opt.optionId);
                        const label = String.fromCharCode(65 + oIdx);
                        return (
                          <button
                            key={opt.optionId}
                            onClick={() => handleAnswer(q.questionId, [opt.optionId])}
                            className={`
                              group w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 flex items-center gap-5
                              ${isSelected
                                ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                                : 'border-[#F2F2EF] bg-white hover:border-slate-300 hover:bg-[#F9F9F7]'}
                            `}
                          >
                            <div className={`
                              w-10 h-10 rounded-xl border-2 flex items-center justify-center shrink-0 font-medium transition-all
                              ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-[#F9F9F7] border-[#E5E5E0] text-[#1E1E1E] group-hover:bg-white'}
                            `}>
                              {label}
                            </div>
                            <span className={`text-base font-medium transition-colors ${isSelected ? 'text-blue-900' : 'text-slate-600'}`}>
                              {opt.text}
                            </span>
                            {isSelected && <Check className="ml-auto w-5 h-5 text-blue-600" />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="relative">
                      <textarea
                        value={answers[q.questionId]?.textAnswer || ""}
                        onChange={(e) => handleAnswer(q.questionId, e.target.value)}
                        placeholder="Type your answer here..."
                        className="w-full h-56 bg-[#F9F9F7] border-2 border-[#E5E5E0] rounded-[1.5rem] p-6 text-slate-800 font-medium placeholder:text-[#8C8C85] focus:outline-none focus:border-blue-500 focus:bg-white transition-all resize-none shadow-inner"
                      />
                    </div>
                  )}

                  <div className="mt-8 pt-8 border-t border-[#F2F2EF] flex items-center justify-between">
                    <button 
                      onClick={() => toggleFlag(q.questionId)}
                      className={`flex items-center gap-2 text-xs font-medium uppercase tracking-wider transition-colors ${flagged ? 'text-amber-500' : 'text-[#8C8C85] hover:text-slate-600'}`}
                    >
                      <Flag className={`w-4 h-4 ${flagged ? 'fill-current' : ''}`} />
                      Mark for review
                    </button>
                    
                    <button className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#8C8C85] hover:text-slate-600">
                      <RotateCcw className="w-4 h-4" />
                      Clear selection
                    </button>
                  </div>
                </div>
              );
            })}
            
            {/* Bottom spacer */}
            <div className="h-20" />
          </div>
        </main>
      </div>

      {/* Global Action Footer */}
      <footer className="h-24 border-t border-[#E5E5E0] bg-white z-[60] flex items-center justify-between px-10 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] shrink-0">
        <div className="text-xs font-medium text-[#8C8C85] flex items-center gap-2">
          <ChevronDown className="w-4 h-4" />
          Scroll to view all questions
        </div>

        <div className="flex gap-4">
          <button 
            className="px-8 h-12 bg-white border border-[#D9D9D1] text-[#4D4D48] text-sm font-medium rounded-full hover:bg-slate-50 transition-colors shadow-sm"
            onClick={() => {
              const firstUnanswered = exam.questions.find(q => !isAnswered(q.questionId));
              if (firstUnanswered) scrollToQuestion(firstUnanswered.questionId);
            }}
          >
            Review unanswered questions
          </button>
          
          <button 
            onClick={() => setShowConfirm(true)}
            className="px-10 h-12 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] flex items-center gap-2"
          >
            Submit Exam
            <CheckCircle2 className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
