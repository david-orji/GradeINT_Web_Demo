import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Play, Clock, CheckCircle, FileText, BadgeInfo } from "lucide-react";
import { useState } from "react";
import { useSessions } from "@/hooks/use-sessions";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [accessCode, setAccessCode] = useState("");
  const { data: sessions } = useSessions();
  const { data: submissions } = useQuery<any[]>({
    queryKey: [`/api/submissions/student/${user?.id}`],
    enabled: !!user?.id
  });
  const { data: exams } = useQuery<any[]>({
    queryKey: ["/api/exams"]
  });
  const [error, setError] = useState("");

  const handleJoin = () => {
    const session = sessions?.find(s => s.accessCode === accessCode && s.status === "active");
    if (!session) {
      setError("Invalid or inactive session code.");
      return;
    }

    // Check if already submitted
    const alreadySubmitted = submissions?.some(s => s.examId === session.examId);
    if (alreadySubmitted) {
      setError("You have already submitted an entry for this examination.");
      return;
    }

    setLocation(`/student/exam/${session.id}`);
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
          <span className="text-sm text-slate-600">{user?.name}</span>
          <Button variant="outline" size="sm" onClick={logout}>Sign Out</Button>
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
                  onChange={(e) => {
                    setAccessCode(e.target.value.toUpperCase());
                    setError("");
                  }}
                />
                {error && <p className="text-sm text-red-500 text-center font-medium">{error}</p>}
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-lg" onClick={handleJoin} disabled={accessCode.length < 8}>
                Start Exam
              </Button>
            </CardFooter>
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
                {!submissions || submissions.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No exam history found.</p>
                  </div>
                ) : (
                  submissions.map((submission) => (
                    <div key={submission.id} className="flex justify-between items-center p-4 rounded-lg bg-white border border-slate-100 shadow-sm">
                      <div className="space-y-1">
                        <h4 className="font-semibold text-slate-900 leading-none">{getExamTitle(submission.examId)}</h4>
                        <div className="flex items-center gap-2">
                          {submission.status === "graded" ? (
                            <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-100">Graded</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-100">Not graded yet</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {submission.status === "graded" ? (
                          <div className="text-xl font-bold text-slate-900">
                            {submission.totalScore}<span className="text-xs text-slate-400 font-normal ml-0.5">pts</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">--</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">View Detailed Feedback</Button>
            </CardFooter>
          </Card>

        </div>

        <div className="mt-12 text-center text-slate-400 text-sm">
          <p>Please ensure you have a stable internet connection before starting.</p>
          <p>Exams are monitored for integrity purposes.</p>
        </div>
      </main>
    </div>
  );
}
