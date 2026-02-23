import { Sidebar } from "@/components/layout/Sidebar";
import { useExams } from "@/hooks/use-exams";
import { CheckCircle, Clock, AlertCircle, FileText, ChevronRight, Brain, Shield, User, Check, X } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { useAuth } from "@/hooks/use-auth";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { formatSubmissionTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function GradingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: exams } = useExams(user?.id);
  const { data: users } = useQuery({
    queryKey: [api.users.list.path],
    queryFn: async () => {
      const res = await fetch(api.users.list.path);
      if (!res.ok) throw new Error("Failed to fetch users");
      return await res.json();
    }
  });

  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [viewingSubmissionId, setViewingSubmissionId] = useState<number | null>(null);

  // Helper — true if submission has any AI grade still pending
  const hasPendingGrades = (sub: any) =>
    sub?.grades && Object.values(sub.grades).some((g: any) => g.pending === true);

  // Auto-poll every 4 s while any visible submission is still being AI-graded
  const { data: submissions, isLoading } = useQuery<any[]>({
    queryKey: [api.submissions.listByExam.path, selectedExamId],
    enabled: !!selectedExamId,
    queryFn: async () => {
      const res = await fetch(`/api/submissions/exam/${selectedExamId}`);
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },
    refetchInterval: (data) => {
      const list = data?.state?.data as any[] | undefined;
      return list?.some(hasPendingGrades) ? 4000 : false;
    },
  });

  const { data: sessions } = useQuery<any[]>({
    queryKey: [api.sessions.list.path],
    queryFn: async () => {
      const res = await fetch(api.sessions.list.path);
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return await res.json();
    }
  });

  const updateSubmissionMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number, updates: any }) => {
      const res = await apiRequest("PATCH", `/api/submissions/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.submissions.listByExam.path, selectedExamId] });
    }
  });

  const gradeMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      const res = await apiRequest("POST", `/api/submissions/${submissionId}/grade`, {});
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Grading failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.submissions.listByExam.path, selectedExamId] });
      const pending = hasPendingGrades(data);
      toast({
        title: pending ? "MCQ graded — AI in progress" : "Grading complete",
        description: pending
          ? "Multiple choice questions are done. Open-ended responses are being AI-graded in the background."
          : "All questions have been graded successfully.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Grading failed", description: err.message, variant: "destructive" });
    }
  });

  const userMap = useMemo(() => {
    const map = new Map();
    users?.forEach((u: any) => map.set(u.id, u.name));
    return map;
  }, [users]);

  const selectedExam = exams?.find(e => e.id === selectedExamId);
  const { data: questions } = useQuery<any[]>({
    queryKey: [api.questions.list.path, selectedExam?.id],
    enabled: !!selectedExam?.id,
    queryFn: async () => {
      const res = await fetch(`/api/exams/${selectedExam?.id}/questions`);
      if (!res.ok) throw new Error("Failed to fetch questions");
      return await res.json();
    }
  });

  const viewingSubmission = submissions?.find(s => s.id === viewingSubmissionId);

  const awaitingGradingCount = submissions?.filter(s => s.status === "submitted").length || 0;

  const totalPossiblePoints = useMemo(() => {
    return questions?.reduce((acc: number, q: any) => acc + (q.points || 0), 0) || 0;
  }, [questions]);

  const handleToggleGrade = (questionId: string, currentScore: number, maxPoints: number) => {
    if (!viewingSubmission) return;

    const newGrades = { ...(viewingSubmission.grades || {}) };
    const newScore = currentScore === maxPoints ? 0 : maxPoints;

    newGrades[questionId] = {
      ...newGrades[questionId],
      score: newScore,
      feedback: newGrades[questionId]?.feedback || (newScore === maxPoints ? "Manual Override: Pass" : "Manual Override: Fail")
    };

    // Recalculate total score
    const totalScore = Object.values(newGrades).reduce((acc: number, g: any) => acc + (g.score || 0), 0);

    updateSubmissionMutation.mutate({
      id: viewingSubmission.id,
      updates: { grades: newGrades, totalScore }
    });
  };

  if (viewingSubmissionId && viewingSubmission && selectedExam) {
    return (
      <div className="flex h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-8 py-8 pb-24">
            <header className="flex items-center gap-4 mb-8">
              <Button variant="ghost" size="sm" onClick={() => setViewingSubmissionId(null)}>
                Back to List
              </Button>
              <Separator orientation="vertical" className="h-4" />
              <div>
                <h1 className="text-xl font-bold text-slate-900">Reviewing Submission</h1>
                <p className="text-sm text-slate-500">{userMap.get(viewingSubmission.studentId) || `Student #${viewingSubmission.studentId}`} • {selectedExam.title}</p>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-3 space-y-6">
                <Card className="border-l-4 border-l-blue-600">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Brain className="w-4 h-4 text-blue-600" />
                      AI Grading Preview
                    </CardTitle>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-bold">LIVE AI</span>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      This submission has been analysed against your rubric.
                      {viewingSubmission.status !== "graded"
                        ? " You can manually override any individual grade using the toggle buttons below."
                        : " Grading has been finalised. Manual overrides are locked."}
                    </p>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Responses & Evaluation</h3>
                  {questions?.map((q, idx) => {
                    const qId = q.id.toString();
                    const response = viewingSubmission.responses?.[qId];
                    const grade = viewingSubmission.grades?.[qId];
                    const isPassed = (grade?.score || 0) > 0;

                    return (
                      <Card key={qId} className="hover-elevate transition-all border-slate-200">
                        <CardContent className="pt-6">
                          <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                              {idx + 1}
                            </div>
                            <div className="flex-1 space-y-4">
                              <div className="space-y-1">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">Question Preview</p>
                                <p className="text-sm font-medium text-slate-700">{q.text}</p>
                              </div>

                              <Separator className="opacity-50" />

                              <div className="flex justify-between items-start gap-4">
                                <div className="space-y-1 flex-1">
                                  <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">Student Response</p>
                                  <p className="text-slate-900 font-medium">{response || "No response provided."}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant={isPassed ? "default" : "outline"}
                                  className={isPassed ? "bg-green-600 hover:bg-green-700 text-white" : "text-red-600 border-red-200 hover:bg-red-50"}
                                  disabled={viewingSubmission.status === "graded"}
                                  title={viewingSubmission.status === "graded" ? "Grading is finalised — overrides are locked" : undefined}
                                  onClick={() => handleToggleGrade(qId, grade?.score || 0, q.points || 1)}
                                >
                                  {isPassed ? <Check className="w-4 h-4 mr-1" /> : <X className="w-4 h-4 mr-1" />}
                                  {isPassed ? "Pass" : "Fail"}
                                </Button>
                              </div>

                              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                                    <Shield className="w-3 h-3" />
                                    GRADEINT AI INSIGHT
                                  </span>
                                  {grade?.score !== undefined && (
                                    <span className={`text-xs font-bold ${isPassed ? "text-green-600" : "text-red-600"}`}>
                                      Score: {grade.score} / {q.points}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-slate-600 italic">
                                  {grade?.feedback || "AI is analyzing this response..."}
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="sticky top-8 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Integrity Score</span>
                          <span className="text-green-600 font-bold">100%</span>
                        </div>
                        <Progress value={100} className="h-1" />
                      </div>
                      <div className="pt-4 border-t border-slate-100">
                        <div className="text-center">
                          <div className="text-3xl font-display font-bold text-slate-900">
                            {viewingSubmission.totalScore || 0} / {totalPossiblePoints}
                          </div>
                          <p className="text-xs text-slate-500 mt-1 uppercase tracking-tighter font-bold">
                            {viewingSubmission.status === "graded" ? "Finalized" : "Draft Grade"}
                          </p>
                        </div>
                      </div>
                      {viewingSubmission.status !== "graded" && (
                        <Button
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => gradeMutation.mutate(viewingSubmission.id)}
                          disabled={gradeMutation.isPending}
                        >
                          {gradeMutation.isPending ? "Grading..." : "▶ Run Grading"}
                        </Button>
                      )}
                      <Button
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/10"
                        onClick={() => updateSubmissionMutation.mutate({
                          id: viewingSubmission.id,
                          updates: { status: "graded" }
                        })}
                        disabled={updateSubmissionMutation.isPending || viewingSubmission.status === "graded" || !viewingSubmission.grades}
                      >
                        {viewingSubmission.status === "graded" ? "Graded" : "Confirm Grading"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <header className="mb-8">
            <h1 className="text-2xl font-display font-bold text-slate-900">Grading & Results</h1>
            <p className="text-slate-500 mt-1">Review and validate students` submissions.</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCard
              title="Awaiting Review"
              value={awaitingGradingCount}
              icon={Clock}
              colorClass="bg-amber-100 text-amber-700"
            />
            <StatCard
              title="Graded This Week"
              value="24"
              icon={CheckCircle}
              colorClass="bg-green-100 text-green-700"
            />
            <StatCard
              title="Integrity Flags"
              value="0"
              icon={AlertCircle}
              colorClass="bg-blue-100 text-blue-700"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Exam Selection List */}
            <div className="lg:col-span-1 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 font-semibold text-slate-800">
                Select Exam
              </div>
              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {exams?.filter(e => e.status === "closed").map(exam => (
                  <button
                    key={exam.id}
                    onClick={() => {
                      setSelectedExamId(exam.id);
                      setViewingSubmissionId(null);
                    }}
                    className={`w-full text-left px-6 py-4 hover:bg-slate-50 transition-colors ${selectedExamId === exam.id ? "bg-blue-50 border-r-2 border-blue-500" : ""}`}
                  >
                    <div className="font-medium text-slate-900">{exam.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5 font-mono">{exam.accessCode}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Submissions List */}
            <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 font-semibold text-slate-800 flex justify-between">
                <span>Student Submissions</span>
                {selectedExamId && submissions && (
                  <span className="text-xs font-normal text-slate-500">{submissions.length} total</span>
                )}
              </div>
              <div className="divide-y divide-slate-100">
                {!selectedExamId ? (
                  <div className="p-20 text-center text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>Select an exam to view submissions</p>
                  </div>
                ) : isLoading ? (
                  <div className="p-12 text-center text-slate-400">Loading submissions...</div>
                ) : submissions?.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">No submissions found for this exam.</div>
                ) : (
                  submissions?.map(submission => {
                    const isPending = hasPendingGrades(submission);
                    return (
                      <div key={submission.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                            <User className="w-4 h-4 text-slate-400" />
                          </div>
                          <div>
                            <h4 className="font-medium text-slate-900">
                              {userMap.get(submission.studentId) || `Student #${submission.studentId}`}
                            </h4>
                            <p className="text-xs text-slate-500">
                              Submitted {submission.submittedAt ? formatSubmissionTime(submission.submittedAt) : "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {/* Status badge */}
                          {isPending ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-amber-50 text-amber-700 border-amber-200 animate-pulse">
                              AI grading…
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${submission.status === "graded"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}>
                              {submission.status}
                            </span>
                          )}

                          {/* Review button — disabled while AI is still running */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 flex items-center gap-1 group disabled:opacity-40 disabled:cursor-not-allowed"
                            disabled={isPending}
                            title={isPending ? "Grading still in progress — please wait" : undefined}
                            onClick={() => {
                              const sub = submissions?.find(s => s.id === submission.id);
                              const session = sessions?.find(s => s.id === sub?.sessionId);
                              if (session && session.status === "active") {
                                toast({
                                  title: "Cannot Grade",
                                  description: "Please, close this exam before grading",
                                  variant: "destructive"
                                });
                                return;
                              }
                              setViewingSubmissionId(submission.id);
                            }}
                          >
                            {isPending ? "Grading in progress" : "Review"}
                            {!isPending && <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
                          </Button>

                          {/* Grade button — only shown when neither graded nor AI-pending */}
                          {submission.status !== "graded" && !isPending && (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3"
                              disabled={gradeMutation.isPending && gradeMutation.variables === submission.id}
                              onClick={() => {
                                const sub = submissions?.find(s => s.id === submission.id);
                                const session = sessions?.find(s => s.id === sub?.sessionId);
                                if (session && session.status === "active") {
                                  toast({
                                    title: "Cannot Grade",
                                    description: "Please, close exam before grading",
                                    variant: "destructive"
                                  });
                                  return;
                                }
                                gradeMutation.mutate(submission.id);
                              }}
                            >
                              {gradeMutation.isPending && gradeMutation.variables === submission.id
                                ? "Grading..."
                                : "Grade"}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })

                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
