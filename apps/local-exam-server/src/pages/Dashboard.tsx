import { useState } from "react";
import { CloudClient } from "../lib/cloud-client";
import { type ExamPackage } from "@gradeint/shared-types";
import { ShieldAlert, DownloadCloud, Play, ServerCog, CheckCircle } from "lucide-react";

export function Dashboard() {
  const [accessCode, setAccessCode] = useState("");
  const [exam, setExam] = useState<ExamPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      // MVP: Simulated Teacher login to authorize the download
      await CloudClient.login("teacher", "teacher123");
      
      const pkg = await CloudClient.downloadExamPackage(accessCode.toUpperCase());
      setExam(pkg);
    } catch (err: any) {
      setError(err.message || "Failed to download exam package.");
    } finally {
      setLoading(false);
    }
  };

  const startLocalServer = async () => {
    if (!exam) return;
    try {
      const res = await fetch("http://127.0.0.1:4000/api/internal/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exam })
      });
      if (!res.ok) throw new Error("Failed to activate local session");
      
      setSynced(true);
    } catch (err) {
      setError("Local database error. Ensure Sidecar is running.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <ServerCog className="w-8 h-8 text-blue-600" />
              Local Exam Server
            </h1>
            <p className="text-slate-500 mt-2 font-medium">Offline runtime for GradeINT</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-bold border border-green-200">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            System Online
          </div>
        </header>

        {/* Main Content Area */}
        {!exam ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <DownloadCloud className="w-5 h-5 text-slate-400" />
              Download Exam Package
            </h2>
            
            <form onSubmit={handleDownload} className="max-w-md space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-1">
                  Secure Access Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. PO7KUV8U"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow text-lg tracking-wider font-mono uppercase"
                  autoComplete="off"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="p-4 rounded-lg bg-red-50 text-red-700 text-sm flex items-start gap-2 border border-red-100">
                  <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !accessCode}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading ? "Verifying Checksum..." : "Authenticate & Download"}
              </button>
            </form>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm border-t-4 border-t-blue-600">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="text-xs font-bold tracking-widest text-blue-600 uppercase mb-1">Package Verified</div>
                  <h2 className="text-2xl font-bold text-slate-900">{exam.title}</h2>
                </div>
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </div>
              
              <div className="space-y-4 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Subject</span>
                  <span className="font-semibold text-slate-900">{/* Mapped correctly but not in MVP Shared-Type yet */}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Duration</span>
                  <span className="font-semibold text-slate-900">{exam.duration / 60} Minutes</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Questions Loaded</span>
                  <span className="font-semibold text-slate-900">{exam.questions.length}</span>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-xs text-slate-400 font-mono break-all " title="Cryptographic Checksum">
                    SHA-256: {exam.checksum}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Network Control</h3>
              <p className="text-sm text-slate-500 mb-8">
                The local database is populated. You may now expose the server to the student LAN.
              </p>
              
              {error && (
                <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 text-sm flex items-start gap-2 border border-red-100">
                  <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
              
              {!synced ? (
                <button
                  onClick={startLocalServer}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-4 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Start Local Network Broadcast
                </button>
              ) : (
                <div className="text-center p-6 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping mx-auto mb-4" />
                  <p className="font-bold text-slate-900 text-lg">Listening on 0.0.0.0:4000</p>
                  <p className="text-sm text-slate-500 mt-1">Ready for student connections.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
