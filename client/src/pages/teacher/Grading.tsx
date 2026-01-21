import { Sidebar } from "@/components/layout/Sidebar";
import { useExams, useSubmissionsByExam } from "@/hooks/use-exams";
import { CheckCircle, Clock, AlertCircle, FileText } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";

export default function GradingPage() {
  const { user } = useAuth();
  const { data: exams } = useExams(user?.id);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const { data: submissions, isLoading } = useSubmissionsByExam(selectedExamId || 0);

  const awaitingGradingCount = submissions?.filter(s => s.status === "submitted").length || 0;

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
                    onClick={() => setSelectedExamId(exam.id)}
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
                      <div>
                        <h4 className="font-medium text-slate-900">Student ID: {submission.studentId}</h4>
                        <p className="text-xs text-slate-500">Submitted on {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : "N/A"}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          submission.status === "graded" ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {submission.status}
                        </span>
                        <button className="text-sm font-medium text-blue-600 hover:text-blue-700">Review</button>
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
