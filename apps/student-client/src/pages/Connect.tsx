import React, { useState } from "react";
import { Server, KeyRound, User, LogIn, Loader2, AlertCircle } from "lucide-react";
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
      const { submissionId } = await client.joinSession(sessionCode, studentId);
      
      onConnected({
        serverIp,
        sessionCode,
        studentId,
        submissionId
      });
    } catch (err: any) {
      setError(err.message || "Failed to connect to the exam server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="max-w-md w-full p-8 border border-slate-200 rounded-2xl bg-white shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm">
            <Server className="w-6 h-6 leading-none" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Join Exam Network</h1>
          <p className="text-sm text-slate-500 font-medium pb-2">
            Enter the details provided by your invigilator to connect to the local exam server.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold flex items-center gap-2 shadow-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleConnect} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Server IP Address</label>
            <div className="relative">
              <Server className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={serverIp}
                onChange={(e) => setServerIp(e.target.value)}
                placeholder="e.g. 192.168.1.50"
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Session Access Code</label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                placeholder="e.g. PO7KUV8U"
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all uppercase shadow-sm"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Candidate ID / Index</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Enter your student ID"
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6 shadow-md shadow-blue-600/20"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            {loading ? "Connecting..." : "Connect Securely"}
          </button>
        </form>
      </div>
    </div>
  );
}
