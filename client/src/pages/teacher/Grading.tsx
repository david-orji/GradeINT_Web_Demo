import { Sidebar } from "@/components/layout/Sidebar";
import { useSessions } from "@/hooks/use-sessions";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";

export default function GradingPage() {
  const { data: sessions, isLoading } = useSessions();
  const completedSessions = sessions?.filter(s => s.status === "completed") || [];

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
              value={completedSessions.length} 
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

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="p-6 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Completed Sessions</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {isLoading ? (
                <div className="p-8 text-center text-slate-400">Loading sessions...</div>
              ) : completedSessions.length === 0 ? (
                <div className="p-12 text-center text-slate-500">No completed sessions awaiting grading.</div>
              ) : (
                completedSessions.map(session => (
                  <div key={session.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer">
                    <div>
                      <h4 className="font-medium text-slate-900">Session #{session.accessCode}</h4>
                      <p className="text-sm text-slate-500">Completed on {new Date(session.endTime || "").toLocaleDateString()}</p>
                    </div>
                    <button className="text-sm font-medium text-blue-600 hover:text-blue-700">Open Gradebook</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
