import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Play, Clock, CheckCircle, FileText, BookOpen } from "lucide-react";
import { useState, useMemo } from "react";
import { useSessions } from "@/hooks/use-sessions";
import { useLocation } from "wouter";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [accessCode, setAccessCode] = useState("");
  const { data: sessions } = useSessions();
  const { data: submissions } = useQuery<any[]>({
    queryKey: ["/api/submissions/student", user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/submissions/student/${user?.id}`);
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },
    enabled: !!user?.id
  });
  const { data: exams } = useQuery<any[]>({
    queryKey: ["/api/exams"]
  });
  const [error, setError] = useState("");

  // Fetch questions for each graded exam to compute real total points
  const gradedExamIds = useMemo(() => {
    const ids = (submissions ?? [])
      .filter(s => s.status === "graded")
      .map(s => s.examId as number);
    return Array.from(new Set(ids));
  }, [submissions]);

  const questionResults = useQueries({
    queries: gradedExamIds.map(examId => ({
      queryKey: ["examQuestions", examId],
      queryFn: async () => {
        const res = await fetch(`/api/exams/${examId}/questions`);
        if (!res.ok) throw new Error("Failed to fetch questions");
        return res.json() as Promise<any[]>;
      },
      staleTime: 5 * 60 * 1000, // 5 min — closed exam questions never change
    }))
  });

  const examTotalPointsMap = useMemo(() => {
    const map: Record<number, number> = {};
    gradedExamIds.forEach((examId, idx) => {
      const qs: any[] = questionResults[idx]?.data ?? [];
      map[examId] = qs.reduce((sum, q) => sum + (q.points || 0), 0);
    });
    return map;
  }, [gradedExamIds, questionResults]);

  const handleJoin = () => {
    const session = sessions?.find(s => s.accessCode === accessCode && s.status === "active");
    if (!session) {
      setError("Invalid or inactive session code.");
      return;
    }

    const exam = exams?.find(e => e.id === session.examId);
    if (exam?.status === "closed") {
      setError("This examination has been closed and is no longer accepting submissions.");
      return;
    }

    // Check if already submitted
    const alreadySubmitted = submissions?.some(s => s.examId === session.examId);
    if (alreadySubmitted) {
      setError("You have already submitted an entry for this examination.");
      return;
    }

    setLocation(`/student/session/${session.id}`);
  };

  const getExamTitle = (examId: number) => {
    return exams?.find(e => e.id === examId)?.title || `Exam #${examId}`;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Student Nav */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-lg">G</span>
          </div>
          <span className="font-display font-bold text-slate-900 text-lg">GradeINT Student</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600" data-testid="text-username">{user?.name}</span>
          <Button variant="outline" size="sm" onClick={() => setLocation("/student/teachers")} className="gap-1.5">
            <BookOpen className="w-4 h-4" /> My Teachers
          </Button>
          <Button variant="outline" size="sm" onClick={logout} data-testid="button-sign-out">Sign Out</Button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Join Exam Card */}
          <Card className="shadow-lg border-blue-100 shadow-blue-900/5 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5 text-blue-600" />
                Join Examination
              </CardTitle>
              <CardDescription>Enter the access code provided by your invigilator.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Enter 8-character code"
                  className="text-center text-2xl tracking-widest uppercase font-mono h-14"
                  maxLength={8}
                  value={accessCode}
                  data-testid="input-access-code"
                  onChange={(e) => {
                    setAccessCode(e.target.value.toUpperCase());
                    setError("");
                  }}
                />
                {error && <p className="text-sm text-red-500 text-center font-medium">{error}</p>}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-lg"
                onClick={handleJoin}
                disabled={accessCode.length < 8}
                data-testid="button-start-exam"
              >
                Start Exam
              </Button>
            </CardFooter>
          </Card>

          {/* Submissions List Card */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Submissions
              </CardTitle>
              <CardDescription>View your ungraded submissions and their status.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {!submissions || submissions.filter(s => s.status !== "graded").length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No ungraded submissions found.</p>
                  </div>
                ) : (
                  submissions
                    .filter(s => s.status !== "graded")
                    .sort((a, b) => new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime())
                    .map((submission) => {
                      return (
                        <div key={submission.id} className="flex justify-between items-center p-4 rounded-lg bg-white border border-slate-100 shadow-sm">
                          <div className="space-y-1">
                            <h4 className="font-semibold text-slate-900 leading-none">{getExamTitle(submission.examId)}</h4>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Clock className="w-3 h-3" />
                              {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              }) : "N/A"}
                            </div>
                          </div>
                          <div>
                            <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-100 uppercase text-[10px] font-bold tracking-wider">
                              Pending Review
                            </Badge>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Previous Results Card */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Your Grades
              </CardTitle>
              <CardDescription>View your scores and feedback from completed exams.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {!submissions || submissions.filter(s => s.status === "graded").length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No graded exams found yet.</p>
                  </div>
                ) : (
                  submissions
                    .filter(s => s.status === "graded")
                    .sort((a, b) => {
                      const tA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
                      const tB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
                      return tB !== tA ? tB - tA : b.id - a.id;
                    })
                    .map((submission) => {
                      const totalPoints = examTotalPointsMap[submission.examId] || 0;
                      return (
                        <div key={submission.id} className="flex justify-between items-center p-4 rounded-lg bg-white border border-slate-100 shadow-sm">
                          <div className="space-y-1">
                            <h4 className="font-semibold text-slate-900 leading-none">{getExamTitle(submission.examId)}</h4>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-100 uppercase text-[10px] font-bold tracking-wider">Graded</Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-slate-900">
                              {submission.totalScore}
                              <span className="text-xs text-slate-400 font-normal ml-0.5">
                                / {totalPoints || "--"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">View Detailed Feedback</Button>
            </CardFooter>
          </Card>

        </div>

        <div className="mt-12 text-center text-slate-400 text-sm">
          <p>Exams are monitored for integrity purposes.</p>
        </div>
      </main>
    </div>
  );
}
