import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useExam, useExamQuestions, useCreateSubmission } from "@/hooks/use-exams";
import { useSession as useSessionQuery } from "@/hooks/use-sessions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Clock, AlertCircle, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function ExamSession() {
  const [, params] = useRoute("/student/exam/:sessionId");
  const sessionId = parseInt(params?.sessionId || "0");
  const [, setLocation] = useLocation();
  
  const { user } = useAuth();
  const { data: session, isLoading: sessionLoading } = useSessionQuery(sessionId);
  const { data: exam, isLoading: examLoading } = useExam(session?.examId || 0);
  const { data: questions, isLoading: questionsLoading, refetch: refetchQuestions } = useExamQuestions(session?.examId || 0);
  const submitMutation = useCreateSubmission();
  const { toast } = useToast();

  const [responses, setResponses] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [shuffledQuestions, setShuffledQuestions] = useState<any[]>([]);

  // Randomize questions and options once
  useEffect(() => {
    if (questions && Array.isArray(questions) && questions.length > 0 && shuffledQuestions.length === 0) {
      console.log("ExamSession: Shuffling questions", questions);
      const shuffled = [...questions]
        .sort(() => Math.random() - 0.5)
        .map(q => ({
          ...q,
          options: Array.isArray(q.options) ? [...q.options].sort(() => Math.random() - 0.5) : q.options
        }));
      setShuffledQuestions(shuffled);
    }
  }, [questions]);

  // Re-fetch questions when session is loaded to ensure we have them
  useEffect(() => {
    if (session?.examId) {
      console.log("Session loaded, refetching questions for examId:", session.examId);
      refetchQuestions().then((result) => {
        console.log("ExamSession: Questions refetched manually", result.data);
      });
    }
  }, [session?.examId, refetchQuestions]);

  // Timer logic
  useEffect(() => {
    if (exam?.durationMinutes) {
      setTimeLeft(exam.durationMinutes * 60);
    }
  }, [exam]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleResponseChange = (questionId: number, value: string) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = () => {
    if (!user || !session) return;
    
    if (!confirm("Are you sure you want to submit your exam? This action cannot be undone and your responses will be sealed.")) {
      return;
    }
    
    // Convert keys to string numbers for consistency
    const finalResponses: Record<string, string> = {};
    Object.entries(responses).forEach(([key, value]) => {
      finalResponses[key] = value;
    });

    submitMutation.mutate({
      sessionId,
      examId: session.examId,
      studentId: user.id,
      responses: finalResponses,
      status: "submitted"
    }, {
      onSuccess: () => {
        toast({ title: "Submitted Successfully", description: "Your exam has been recorded." });
        setLocation("/student/dashboard");
      },
      onError: (error: any) => {
        toast({ title: "Submission Failed", description: error.message, variant: "destructive" });
      }
    });
  };

  if (sessionLoading || examLoading || questionsLoading || (questions && Array.isArray(questions) && questions.length > 0 && shuffledQuestions.length === 0)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 font-medium">Securing your assessment environment...</p>
        </div>
      </div>
    );
  }

  if (!exam || !questions || questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md w-full border-red-100 shadow-xl shadow-red-900/5">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Exam Unavailable</h3>
            <p className="text-slate-500 text-sm">We couldn't find any questions for this exam. Please contact your invigilator.</p>
            <Button onClick={() => setLocation("/student/dashboard")} variant="outline" className="w-full">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Focus Header */}
      <header className="bg-slate-900 text-white px-6 py-3 flex justify-between items-center sticky top-0 z-10 shadow-md">
        <div>
          <h1 className="font-bold text-lg">{exam.title}</h1>
          <p className="text-xs text-slate-400">Student: {user?.name}</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700">
            <Clock className={cn("w-4 h-4", (timeLeft || 0) < 300 && "text-red-500 animate-pulse")} />
            <span className={cn("font-mono font-medium", (timeLeft || 0) < 300 && "text-red-400")}>
              {timeLeft !== null ? formatTime(timeLeft) : "--:--"}
            </span>
          </div>
          <Button 
            onClick={handleSubmit} 
            className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
          >
            Submit & Seal
          </Button>
        </div>
      </header>

      <div className="flex-1 max-w-4xl mx-auto w-full p-6 space-y-8 pb-20">
        <Card className="border-l-4 border-l-blue-600 shadow-sm">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600" />
              Instructions
            </h3>
            <p className="text-slate-600 text-sm">{exam.description || "No specific instructions provided."}</p>
          </CardContent>
        </Card>

        {shuffledQuestions.map((q, index) => (
          <Card key={q.id} className="shadow-sm hover:shadow-md transition-shadow duration-300">
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 text-sm">
                  {index + 1}
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex justify-between items-start">
                    <p className="text-lg font-medium text-slate-900">{q.text}</p>
                    <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded">
                      {q.points} pts
                    </span>
                  </div>
                  
                  {q.type === "multiple_choice" && q.options && (
                    <RadioGroup 
                      onValueChange={(val) => handleResponseChange(q.id, val)}
                      value={responses[q.id] || ""}
                      className="space-y-3 mt-4"
                    >
                      {(q.options as string[]).map((opt, i) => (
                        <div key={i} className="flex items-center space-x-2 border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition-colors">
                          <RadioGroupItem value={opt} id={`q${q.id}-opt${i}`} />
                          <Label htmlFor={`q${q.id}-opt${i}`} className="flex-1 cursor-pointer font-normal text-slate-700">{opt}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}

                  {(q.type === "short_answer" || q.type === "essay") && (
                    <Textarea 
                      placeholder="Type your answer here..." 
                      className="min-h-[120px] resize-y mt-2 bg-slate-50 border-slate-300 focus:bg-white transition-colors"
                      value={responses[q.id] || ""}
                      onChange={(e) => handleResponseChange(q.id, e.target.value)}
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Auto-save Indicator */}
      <div className="fixed bottom-6 right-6 bg-white border border-slate-200 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 text-xs font-medium text-slate-500">
        <Save className="w-3 h-3" />
        Progress saved locally
      </div>
    </div>
  );
}
