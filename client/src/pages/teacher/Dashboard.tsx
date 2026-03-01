import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { StatCard } from "@/components/ui/StatCard";
import { Users, FileText, CheckCircle, Clock } from "lucide-react";
import { useExams } from "@/hooks/use-exams";
import { useSessions } from "@/hooks/use-sessions";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: exams } = useExams(user?.id);
  const { data: sessions } = useSessions();

  const activeSessions = sessions?.filter(s => s.status === "active").length || 0;
  const draftExams = exams?.filter(e => e.status === "draft").length || 0;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <header className="mb-8">
            <h1 className="text-2xl font-display font-bold text-slate-900">Dashboard Overview</h1>
            <p className="text-slate-500 mt-1">Welcome back, {user?.name ?? "Professor"}.</p>
          </header>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Active Sessions"
              value={activeSessions}
              icon={Clock}
              colorClass="bg-green-100 text-green-700"
              trend="+2"
              trendUp={true}
            />
            <StatCard
              title="Total Exams"
              value={exams?.length || 0}
              icon={FileText}
              colorClass="bg-blue-100 text-blue-700"
            />
            <StatCard
              title="Pending Drafts"
              value={draftExams}
              icon={FileText}
              colorClass="bg-amber-100 text-amber-700"
            />
            <StatCard
              title="Students Graded"
              value="142"
              icon={CheckCircle}
              colorClass="bg-purple-100 text-purple-700"
            />
          </div>

          {/* Recent Activity Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Exams Card */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-semibold text-slate-800">Recent Exams</h3>
                <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 font-medium">View All</Button>
              </div>
              <div className="divide-y divide-slate-100">
                {exams?.slice(0, 4).map(exam => (
                  <div key={exam.id} className="px-6 py-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                    <div>
                      <h4 className="font-medium text-slate-900">{exam.title}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{exam.subject} • {exam.durationMinutes} mins</p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${exam.status === "published" ? "bg-green-50 text-green-700 border-green-200" :
                      exam.status === "draft" ? "bg-slate-100 text-slate-600 border-slate-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                      {exam.status}
                    </span>
                  </div>
                ))}
                {(!exams || exams.length === 0) && (
                  <div className="p-8 text-center text-slate-500 text-sm">No exams created yet.</div>
                )}
              </div>
            </div>

            {/* Quick Actions / System Status */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h3 className="font-semibold text-slate-800 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="ghost"
                  onClick={() => setLocation("/teacher/exams?create=true")}
                  className="flex flex-col items-center justify-center p-4 h-auto border border-dashed border-slate-300 rounded-lg hover:bg-slate-50 hover:border-blue-300 hover:text-blue-600 transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:bg-blue-100">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium">Create New Exam</span>
                </Button>
                <Button
                  variant="ghost"
                  className="flex flex-col items-center justify-center p-4 h-auto border border-dashed border-slate-300 rounded-lg hover:bg-slate-50 hover:border-purple-300 hover:text-purple-600 transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mb-2 group-hover:bg-purple-100">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium">Schedule Session</span>
                </Button>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">System Health</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Database Connection</span>
                    <span className="flex items-center text-green-600 gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      Operational
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">AI Grading Engine</span>
                    <span className="flex items-center text-green-600 gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                      Ready
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
