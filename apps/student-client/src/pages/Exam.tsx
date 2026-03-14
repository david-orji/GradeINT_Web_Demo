import React, { useState, useEffect } from "react";
import { ExamPackage, Question } from "@gradeint/shared-types";
import { ConnectionState } from "../lib/local-api";
import { Clock, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";

export interface AnswerState {
  questionId: string;
  selectedOptionIds?: string[];
  textAnswer?: string;
  lastModifiedAt: string;
}

interface ExamProps {
  exam: ExamPackage;
  connection: ConnectionState;
  initialAnswers?: AnswerState[];
  onAutosave: (answers: AnswerState[]) => void;
  onSubmit: (answers: AnswerState[]) => void;
}

export function Exam({ exam, connection, initialAnswers = [], onAutosave, onSubmit }: ExamProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Hydrate initial answers into record lookup
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

  const currentQuestion = exam.questions[currentIndex];

  const handleAnswer = (questionId: string, value: string | string[]) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        questionId,
        ...(Array.isArray(value) ? { selectedOptionIds: value } : { textAnswer: value }),
        lastModifiedAt: new Date().toISOString()
      }
    }));
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isAnswered = (qId: string) => {
    const ans = answers[qId];
    if (!ans) return false;
    if (ans.selectedOptionIds && ans.selectedOptionIds.length > 0) return true;
    if (ans.textAnswer && ans.textAnswer.trim().length > 0) return true;
    return false;
  };

  const answeredCount = exam.questions.filter(q => isAnswered(q.questionId)).length;
  const progressPercent = (answeredCount / exam.questions.length) * 100;

  if (showConfirm) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full p-8 border border-slate-200 rounded-xl bg-white shadow-xl text-center space-y-6">
          <AlertCircle className="w-12 h-12 text-blue-500 mx-auto" />
          <h2 className="text-2xl font-bold text-slate-900">Submit Exam?</h2>
          <p className="text-slate-600">
            You have answered {answeredCount} out of {exam.questions.length} questions.
            Once submitted, you cannot change your answers.
          </p>
          <div className="flex gap-4 mt-6">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium border border-slate-200"
            >
              Return to Exam
            </button>
            <button
              onClick={() => onSubmit(Object.values(answers))}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2 shadow-sm"
            >
              <CheckCircle2 className="w-5 h-5" />
              Final Submit
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Header Pipeline */}
      <header className="fixed top-0 inset-x-0 h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md z-50 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold border border-blue-100">
            G
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-900">{exam.title}</h1>
            <p className="text-xs text-slate-500 font-medium">Candidate: {connection.studentId}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 shadow-sm">
            <Clock className={`w-4 h-4 ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-slate-500'}`} />
            <span className={`font-mono text-sm font-bold ${timeLeft < 300 ? 'text-red-600' : 'text-slate-700'}`}>
              {formatTime(timeLeft)}
            </span>
          </div>
          
          <button 
            onClick={() => setShowConfirm(true)}
            className="px-4 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-medium rounded-lg transition-colors text-sm shadow-sm"
          >
            Finish Attempt
          </button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="fixed top-16 inset-x-0 h-1 bg-slate-100 z-50">
        <div 
          className="h-full bg-blue-600 transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <main className="flex-1 mx-auto w-full max-w-5xl mt-24 mb-24 px-4 flex gap-8">
        {/* Left Side: Question Navigation Map */}
        <div className="w-64 hidden md:block shrink-0">
          <div className="sticky top-28 border border-slate-200 bg-white rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 mb-4 px-1 uppercase tracking-wider">Questions</h3>
            <div className="grid grid-cols-5 gap-2">
              {exam.questions.map((q, idx) => {
                const answered = isAnswered(q.questionId);
                const active = idx === currentIndex;
                return (
                  <button
                    key={q.questionId}
                    onClick={() => setCurrentIndex(idx)}
                    className={`
                      aspect-square rounded-md text-sm font-semibold transition-all duration-200
                      flex items-center justify-center border shadow-sm
                      ${active 
                        ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-600/20 shadow-blue-100 max-h-12' 
                        : answered 
                          ? 'border-blue-200 bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100' 
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:border-slate-300'}
                    `}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Active Question */}
        <div className="flex-1">
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8 min-h-[400px]">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-xl font-bold font-mono text-slate-400">Q{currentIndex + 1}.</span>
              <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-600 text-xs font-bold tracking-wide uppercase border border-slate-200">
                {currentQuestion.type === 'mcq' ? 'Multiple Choice' : 'Written Response'}
              </span>
              <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold tracking-wide uppercase border border-blue-100 ml-auto flex items-center gap-1">
                {currentQuestion.points} Points
              </span>
            </div>

            <p className="text-lg text-slate-800 leading-relaxed mb-8 font-medium">
              {currentQuestion.text}
            </p>

            {/* Answer Input Area */}
            {currentQuestion.type === 'mcq' && currentQuestion.options ? (
              <div className="space-y-3">
                {currentQuestion.options.map(opt => {
                  const isSelected = answers[currentQuestion.questionId]?.selectedOptionIds?.includes(opt.optionId);
                  return (
                    <button
                      key={opt.optionId}
                      onClick={() => handleAnswer(currentQuestion.questionId, [opt.optionId])}
                      className={`
                        w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 bg-white shadow-sm
                        ${isSelected
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}
                      `}
                    >
                      <div className={`
                        w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                        ${isSelected ? 'border-blue-600' : 'border-slate-300'}
                      `}>
                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                      </div>
                      <span className={`text-base font-medium ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                        {opt.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <textarea
                value={answers[currentQuestion.questionId]?.textAnswer || ""}
                onChange={(e) => handleAnswer(currentQuestion.questionId, e.target.value)}
                placeholder="Type your answer here..."
                className="w-full h-48 bg-white border-2 border-slate-200 rounded-xl p-4 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 resize-none text-base leading-relaxed shadow-sm transition-all duration-200"
              />
            )}
          </div>
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="fixed bottom-0 inset-x-0 h-20 border-t border-slate-200 bg-white/95 backdrop-blur-md flex items-center justify-center gap-6 px-6 z-50 shadow-sm">
        <button
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className="flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-700 bg-white border border-slate-200 shadow-sm"
        >
          <ChevronLeft className="w-5 h-5" />
          Previous
        </button>

        <span className="text-slate-500 font-bold bg-slate-100 px-4 py-2 rounded-lg border border-slate-200 shadow-inner">
          {currentIndex + 1} / {exam.questions.length}
        </span>

        {currentIndex === exam.questions.length - 1 ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors shadow-sm ring-1 ring-blue-700"
          >
            Review & Submit
            <CheckCircle2 className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => setCurrentIndex(prev => Math.min(exam.questions.length - 1, prev + 1))}
            className="flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-colors hover:bg-slate-100 text-slate-700 bg-white border border-slate-200 shadow-sm"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </footer>
    </div>
  );
}
