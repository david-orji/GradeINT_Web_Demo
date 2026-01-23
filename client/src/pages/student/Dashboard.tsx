import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Play, Clock, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useSessions } from "@/hooks/use-sessions";
import { useLocation } from "wouter";

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [accessCode, setAccessCode] = useState("");
  const { data: sessions } = useSessions();
  const [error, setError] = useState("");

  const handleJoin = () => {
    const session = sessions?.find(s => s.accessCode === accessCode && s.status === "active");
    if (session) {
      setLocation(`/student/exam/${session.id}`);
    } else {
      setError("Invalid or inactive session code.");
    }
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
          <Card className="shadow-lg border-blue-100 shadow-blue-900/5">
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
                {error && <p className="text-sm text-red-500 text-center">{error}</p>}
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
                Recent Results
              </CardTitle>
              <CardDescription>View your grades and feedback.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div>
                    <h4 className="font-medium text-slate-900">Calculus Midterm</h4>
                    <p className="text-xs text-slate-500">Oct 12, 2024</p>
                  </div>
                  <span className="text-lg font-bold text-green-700">88%</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div>
                    <h4 className="font-medium text-slate-900">Physics 101</h4>
                    <p className="text-xs text-slate-500">Sep 28, 2024</p>
                  </div>
                  <span className="text-lg font-bold text-blue-700">92%</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">View All History</Button>
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
