import React, { useState } from "react";
import { Server, User, LogIn, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { LocalAPIClient, ConnectionState } from "../lib/local-api";

interface ConnectProps {
  onConnected: (state: ConnectionState) => void;
}

export function Connect({ onConnected }: ConnectProps) {
  const [serverIp, setServerIp] = useState("192.168.");
  const [sessionCode, setSessionCode] = useState("");
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!serverIp || !sessionCode || !studentId) {
        throw new Error("All fields are required.");
      }

      const client = new LocalAPIClient(serverIp);
      const { sessionId } = await client.joinSession(sessionCode, studentId);
      
      onConnected({
        serverIp,
        sessionCode,
        studentId,
        submissionId: sessionId
      });
    } catch (err: any) {
      setError(err.message || "Failed to connect to the exam server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9F9F7] p-8 font-sans">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-100 p-12 space-y-10 relative overflow-hidden">
        {/* Decorative element */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 opacity-50" />
        
        <div className="text-center space-y-4">
          <div className="h-16 w-16 bg-[#1E1E1E] text-white rounded-[1.25rem] flex items-center justify-center mx-auto mb-6 shadow-xl rotate-3">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tighter text-slate-800">Secure Entry</h1>
          <p className="text-sm text-slate-500 font-medium uppercase tracking-widest px-4">
            GradeINT Examination Cloud
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-medium flex items-center gap-3 animate-shake uppercase tracking-wider">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleConnect} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-1">Network Host</label>
            <div className="relative">
              <Server className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={serverIp}
                onChange={(e) => setServerIp(e.target.value)}
                placeholder="e.g. 192.168.1.50"
                className="w-full bg-[#F9F9F7] border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-[1.25rem] py-4 pl-12 pr-4 text-slate-800 font-medium placeholder:text-slate-300 transition-all outline-none"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 font-sans">Exam Access Code</label>
            <input
              type="text"
              placeholder="e.g. PO7KUV8U"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
              className="w-full px-6 py-4 rounded-2xl bg-[#F9F9F7] border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all text-xl font-semibold tracking-widest font-mono uppercase"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-1">Candidate ID</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Student ID"
                className="w-full bg-[#F9F9F7] border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-[1.25rem] py-4 pl-12 pr-4 text-slate-800 font-medium placeholder:text-slate-300 transition-all outline-none"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-5 rounded-[1.25rem] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-8 shadow-xl shadow-blue-600/20 active:scale-[0.98]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            {loading ? "AUTHENTICATING..." : "ENTER ASSESSMENT"}
          </button>
        </form>
        
        <p className="text-center text-[10px] text-slate-400 font-normal uppercase tracking-widest pt-4">
          GradeINT V1.2 • Distributed via Tauri
        </p>
      </div>
    </div>
  );
}
