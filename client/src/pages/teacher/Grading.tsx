import { Sidebar } from "@/components/layout/Sidebar";
import { useExams, useSubmissionsByExam } from "@/hooks/use-exams";
import { CheckCircle, Clock, AlertCircle, FileText, ChevronRight, Brain, Shield, User } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { useAuth } from "@/hooks/use-auth";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

export default function GradingPage() {
  const { user } = useAuth();
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
  const { data: submissions, isLoading } = useSubmissionsByExam(selectedExamId || 0);

  const userMap = useMemo(() => {
    const map = new Map();
    users?.forEach((u: any) => map.set(u.id, u.name));
    return map;
  }, [users]);

  const selectedExam = exams?.find(e => e.id === selectedExamId);
  const viewingSubmission = submissions?.find(s => s.id === viewingSubmissionId);

  const awaitingGradingCount = submissions?.filter(s => s.status === "submitted").length || 0;

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
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-bold">SIMULATED</span>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Our explainable AI model has analyzed this submission against your rubric. 
                      Each response is cross-referenced with your criteria to ensure objective assessment.
                    </p>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Responses & Evaluation</h3>
                  {Object.entries(viewingSubmission.responses || {}).map(([qId, response], idx) => (
                    <Card key={qId} className="hover-elevate transition-all border-slate-200">
                      <CardContent className="pt-6">
                        <div className="flex gap-4">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                            {idx + 1}
                          </div>
                          <div className="flex-1 space-y-4">
                            <div>
                              <p className="text-slate-900 font-medium">{response as string}</p>
                            </div>
                            
                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                                  <Shield className="w-3 h-3" />
                                  GRADEINT AI INSIGHT
                                </span>
                                <span className="text-xs font-bold text-green-600">95% Match</span>
                              </div>
                              <p className="text-sm text-slate-600 italic">
                                "The student correctly identifies the core principles. Evidence from the text supports the claim regarding mechanics..."
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
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
                          <div className="text-3xl font-display font-bold text-slate-900">-- / --</div>
                          <p className="text-xs text-slate-500 mt-1 uppercase tracking-tighter font-bold">Pending Finalization</p>
                        </div>
                      </div>
                      <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/10">
                        Confirm Grading
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
            <p className="text-slate-500 mt-1">Review and validate student submissions.</p>
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
                {exams?.filter(e => e.status === "published").map(exam => (
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
                  submissions?.map(submission => (
                    <div key={submission.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-slate-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-slate-900">
                            {userMap.get(submission.studentId) || `Student #${submission.studentId}`}
                          </h4>
                          <p className="text-xs text-slate-500">Submitted on {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : "N/A"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          submission.status === "graded" ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {submission.status}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-blue-600 hover:text-blue-700 flex items-center gap-1 group"
                          onClick={() => setViewingSubmissionId(submission.id)}
                        >
                          Review
                          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
