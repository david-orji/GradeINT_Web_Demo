import { useState, useEffect } from "react";
import { CloudClient, CLOUD_URL } from "../lib/cloud-client";
import { type ExamPackage } from "@gradeint/shared-types";
import { 
  ShieldAlert, 
  DownloadCloud, 
  Play, 
  CheckCircle, 
  Activity, 
  Monitor, 
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
  Users
} from "lucide-react";
import { Sidebar } from "../components/layout/Sidebar";
import { cn } from "../lib/utils";

export function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [accessCode, setAccessCode] = useState("");
  const [exam, setExam] = useState<ExamPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [synced, setSynced] = useState(false);
  const [lanIp, setLanIp] = useState<string>("Detecting...");
  // sidecarStatus: 'starting' | 'ready' | 'error:...' | null (null = browser/dev mode)
  const [sidecarStatus, setSidecarStatus] = useState<string | null>(
    typeof window !== "undefined" && (window as any).__TAURI__ ? "starting" : null
  );

  // Listen for the sidecar-status event emitted by lib.rs
  // Dynamic import avoids top-level await (invalid in es2020 target)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const { invoke } = await import("@tauri-apps/api/core");

        // Fetch LAN IP
        const ip = await invoke<string>("get_lan_ip");
        setLanIp(ip);

        // 1. Check current status immediately (in case we missed the boot event)
        const currentStatus = await invoke<string>("get_sidecar_status");
        setSidecarStatus(currentStatus);
        if (currentStatus.startsWith("error")) {
          setError(`Sidecar failed: ${currentStatus.replace("error: ", "")}`);
        }

        // 2. Listen for future updates
        unlisten = await listen<string>("sidecar-status", (e) => {
          setSidecarStatus(e.payload);
          if (e.payload.startsWith("error")) {
            setError(`Sidecar failed: ${e.payload.replace("error: ", "")}`);
          } else if (e.payload === "ready") {
            setError(null);
          }
        });
      } catch { /* running in browser/dev mode — Tauri API not available */ }
    })();
    return () => { unlisten?.(); };
  }, []);

  // Live student data from Sidecar
  const [students, setStudents] = useState<Array<{ id: string; name: string; status: string; time?: string; }>>([]);

  useEffect(() => {
    if (!synced || !accessCode) return;
    
    let active = true;
    const fetchStudents = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const res = await invoke<{ students: any[] }>("call_sidecar", {
          method: "GET",
          path: `/api/internal/students?sessionCode=${accessCode.trim().toUpperCase()}`,
          body: null
        });
        if (active && res.students) {
          setStudents(res.students);
        }
      } catch (err) {
        // silently fail and retry later
      }
    };
    
    fetchStudents();
    const interval = setInterval(fetchStudents, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [synced, accessCode]);

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCode.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      await CloudClient.login("teacher", "teacher123");
      const pkg = await CloudClient.downloadExamPackage(accessCode.toUpperCase());
      setExam(pkg);
    } catch (err: any) {
      setError(err.message || "Failed to download exam package.");
    } finally {
      setLoading(false);
    }
  };  const startLocalServer = async () => {
    if (!exam) return;
    setError(null);
    setLoading(true);

    const { invoke } = await import("@tauri-apps/api/core");

    try {
      // ── Step 1: Wait for sidecar to be ready (up to 15s) ──
      let ready = sidecarStatus === "ready";
      if (!ready) {
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 500));
          const s = await invoke<string>("get_sidecar_status");
          setSidecarStatus(s);
          if (s === "ready") { ready = true; break; }
          if (s.startsWith("error")) {
            throw new Error(`Sidecar failed to start: ${s.replace("error: ", "")}`);
          }
        }
      }
      if (!ready) throw new Error("Sidecar did not become ready in time. Check that port 4000 is not blocked.");

      // ── Step 2: Health check ──
      await invoke("call_sidecar", { method: "GET", path: "/api/health", body: null });

      // ── Step 3: Activate session (pass accessCode and cloudUrl so sidecar can sync) ──
      await invoke("call_sidecar", {
        method: "POST",
        path: "/api/internal/activate",
        body: { 
          exam, 
          accessCode: accessCode.trim().toUpperCase(),
          cloudUrl: CLOUD_URL
        },
      });

      setSynced(true);
    } catch (err: any) {
      setError(`Broadcast failed: ${err?.message ?? err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#F9F9F7] font-sans overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} sidecarStatus={sidecarStatus} />
      
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 border-b border-[#E5E5E0] bg-white px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#8C8C85] uppercase tracking-widest">Local Exam Server</span>
            <ChevronRight className="w-4 h-4 text-[#D9D9D1]" />
            <span className="text-sm font-medium text-[#1E1E1E] capitalize">{activeTab}</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-[#F9F9F7] rounded-lg text-[#8C8C85] transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="h-4 w-px bg-[#E5E5E0]" />
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${
              sidecarStatus === 'ready'
                ? 'bg-green-50 border border-green-100 text-green-600'
                : sidecarStatus?.startsWith('error')
                ? 'bg-red-50 border border-red-100 text-red-500'
                : 'bg-amber-50 border border-amber-100 text-amber-500'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                sidecarStatus === 'ready' ? 'bg-green-500 animate-pulse' :
                sidecarStatus?.startsWith('error') ? 'bg-red-500' : 'bg-amber-400 animate-pulse'
              }`} />
              {sidecarStatus === 'ready' ? 'Sidecar Online' : sidecarStatus?.startsWith('error') ? 'Sidecar Error' : 'Sidecar Starting…'}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-10 max-w-6xl w-full mx-auto space-y-10">
          
          {activeTab === "overview" && (
            <>
              {/* Quick Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-8 rounded-[1.5rem] border border-[#E5E5E0] shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                      <Monitor className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-green-300 uppercase tracking-widest flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Live
                    </span>
                  </div>
                  <div>
                    <h3 className="text-[11px] font-medium text-[#8C8C85] uppercase tracking-[0.15em] mb-1">LAN Status</h3>
                    <p className="text-xl font-semibold text-[#1E1E1E]">{synced ? "Broadcasting" : "Idle"}</p>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[1.5rem] border border-[#E5E5E0] shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-[11px] font-medium text-[#8C8C85] uppercase tracking-[0.15em] mb-1">Connected</h3>
                    <p className="text-xl font-semibold text-[#1E1E1E]">{students.length} Candidates</p>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[1.5rem] border border-[#E5E5E0] shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                      <Activity className="w-5 h-5" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-[11px] font-medium text-[#8C8C85] uppercase tracking-[0.15em] mb-1">Server Latency</h3>
                    <p className="text-xl font-semibold text-[#1E1E1E]">12ms <span className="text-[10px] font-medium text-slate-400">Avg</span></p>
                  </div>
                </div>
              </div>

              {/* Main Actions Area */}
              {!exam ? (
                <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200 border border-slate-100 p-12 space-y-10">
                  <div className="max-w-md">
                    <h2 className="text-3xl font-semibold text-slate-800 tracking-tighter mb-4">Provision Assessment</h2>
                    <p className="text-slate-500 font-normal leading-relaxed">
                      Download the encrypted exam package from the cloud server to begin the local broadcast.
                    </p>
                  </div>
                  
                  <form onSubmit={handleDownload} className="max-w-md space-y-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-1 font-sans">Access Code</label>
                      <input
                        type="text"
                        placeholder="e.g. PO7KUV8U"
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value)}
                        className="w-full px-6 py-4 rounded-2xl bg-[#F9F9F7] border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all text-xl font-semibold tracking-widest font-mono uppercase"
                        autoComplete="off"
                        disabled={loading}
                      />
                    </div>

                    {error && (
                      <div className="p-4 rounded-2xl bg-red-50 text-red-600 text-xs font-medium flex items-start gap-3 border border-red-100 animate-shake">
                        <ShieldAlert className="w-4 h-4 shrink-0" />
                        <p className="uppercase tracking-wider leading-relaxed">{error}</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading || !accessCode}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-5 px-4 rounded-2xl transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98] flex items-center justify-center gap-3"
                    >
                      {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <DownloadCloud className="w-5 h-5" />}
                      {loading ? "INITIALIZING SECURE LINK..." : "DOWNLOAD PACKAGE"}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white rounded-[2rem] p-10 border border-slate-100 shadow-xl shadow-slate-200 border-t-8 border-t-blue-600 space-y-8">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="text-[10px] font-medium text-blue-600 uppercase tracking-[0.2em]">Verified Assets</div>
                        <h2 className="text-3xl font-semibold text-slate-800 tracking-tighter">{exam.title}</h2>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center border border-green-100 text-green-600 shadow-inner">
                        <CheckCircle className="w-6 h-6" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-5 rounded-2xl bg-[#F9F9F7] border border-[#E5E5E0]">
                        <p className="text-[10px] text-[#8C8C85] font-medium uppercase tracking-widest mb-1">Time Limit</p>
                        <p className="text-lg font-semibold text-[#1E1E1E]">{exam.duration / 60}m</p>
                      </div>
                      <div className="p-5 rounded-2xl bg-[#F9F9F7] border border-[#E5E5E0]">
                        <p className="text-[10px] text-[#8C8C85] font-medium uppercase tracking-widest mb-1">Questions</p>
                        <p className="text-lg font-semibold text-[#1E1E1E]">{exam.questions.length}</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[9px] text-slate-400 font-medium uppercase font-mono break-all leading-tight">
                        Checksum: {exam.checksum}
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#1E1E1E] text-white rounded-[2rem] p-10 shadow-2xl space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600 rounded-full -mr-24 -mt-24 opacity-20 blur-3xl" />
                    
                    <div className="relative z-10 space-y-6">
                      <div>
                        <h3 className="text-2xl font-semibold tracking-tighter mb-2">Network Control</h3>
                        <p className="text-slate-400 text-sm font-normal leading-relaxed">
                          Local database is synchronized. You are ready to open the gates to the student intake.
                        </p>
                      </div>
                      
                      {error && (
                        <div className="p-4 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20">
                          {error}
                        </div>
                      )}
                      
                      <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10 mt-6 shadow-inner">
                        <Monitor className="w-5 h-5 text-blue-400" />
                        <div>
                          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Client Connect IP</p>
                          <p className="text-sm font-semibold text-blue-400 tracking-wider font-mono">{lanIp}</p>
                          <p className="text-[9px] text-slate-500 mt-0.5">Port 4000 — type only the IP above</p>
                        </div>
                      </div>
                      
                      {!synced ? (
                        <button
                          onClick={startLocalServer}
                          disabled={loading || sidecarStatus === "starting"}
                          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-6 px-4 rounded-2xl transition-all shadow-xl shadow-emerald-500/30 active:scale-[0.98] flex items-center justify-center gap-3"
                        >
                          <Play className="w-6 h-6 fill-current" />
                          {loading
                            ? "Connecting to Sidecar..."
                            : sidecarStatus === "starting"
                            ? "Sidecar Booting..."
                            : "BROADCAST TO LAN"}
                        </button>
                      ) : (
                        <div className="space-y-4">
                          <div className="p-8 bg-black/40 rounded-3xl border border-white/10 text-center">
                            <div className="w-3 h-3 bg-emerald-500 rounded-full mx-auto mb-4 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse" />
                            <p className="font-semibold text-2xl tracking-tighter">LISTENING</p>
                            <p className="text-xs text-slate-400 font-medium mt-2 uppercase tracking-widest">Active on port 4000</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "students" && (
            <div className="bg-white rounded-[2rem] border border-[#E5E5E0] shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-500">
              <div className="p-8 border-b border-[#F2F2EF] flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-2xl font-semibold text-slate-800 tracking-tighter">Active Connections</h2>
                  <p className="text-xs text-[#8C8C85] font-medium uppercase tracking-wider">Monitoring Local Intake</p>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8C85]" />
                    <input type="text" placeholder="Search..." className="pl-9 pr-4 py-2 bg-[#F9F9F7] rounded-full text-xs font-bold border-transparent focus:border-[#E5E5E0] outline-none" />
                  </div>
                  <button className="p-2 bg-[#F9F9F7] rounded-lg border border-[#E5E5E0] text-[#8C8C85]"><Filter className="w-4 h-4" /></button>
                </div>
              </div>
              
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F9F9F7] text-[10px] font-medium text-[#8C8C85] uppercase tracking-[0.2em]">
                  <tr>
                    <th className="px-8 py-4">Candidate</th>
                    <th className="px-8 py-4 text-right">Submission State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F2EF] text-sm font-bold text-[#4D4D48]">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-8 py-10 text-center text-slate-400 font-medium">
                        Listening for incoming connections...
                      </td>
                    </tr>
                  ) : (
                    students.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-400">
                              {s.name.slice(0,2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-slate-800 font-semibold">{s.name}</p>
                              <p className="text-[10px] text-slate-400">{s.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider inline-flex items-center gap-1.5",
                            s.status === "Connected" 
                              ? "bg-amber-50 text-amber-600 border border-amber-100" 
                              : "bg-green-50 text-green-600 border border-green-100"
                          )}>
                            {s.status === "Connected" && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                            {s.status === "Submitted" && <CheckCircle className="w-3 h-3" />}
                            {s.status}
                          </span>
                          {s.status === "Submitted" && s.time && (
                            <span className="block mt-1 text-[9px] text-slate-400 font-medium">at {s.time}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="p-6 bg-[#F9F9F7] border-t border-[#F2F2EF] text-center">
                <p className="text-[10px] text-[#8C8C85] font-bold uppercase tracking-[0.2em]">Auto-syncing every 3s via LAN</p>
              </div>
            </div>
          )}

          {activeTab === "exams" && (
            exam ? (
              <div className="bg-white rounded-[2rem] border border-[#E5E5E0] shadow-sm overflow-hidden">
                <div className="p-8 border-b border-[#F2F2EF]">
                  <h2 className="text-xl font-semibold text-[#1E1E1E] tracking-tighter">Cached Packages</h2>
                  <p className="text-xs text-[#8C8C85] font-medium mt-1">1 package loaded in memory this session</p>
                </div>
                <div className="p-8">
                  <div className="flex items-center gap-6 p-6 rounded-2xl bg-[#F9F9F7] border border-[#E5E5E0]">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#1E1E1E] truncate">{exam.title}</p>
                      <p className="text-xs text-[#8C8C85] font-medium mt-0.5">
                        {exam.questions.length} questions · {exam.duration / 60}m · ID: <span className="font-mono">{exam.examId.slice(0,8)}</span>
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider shrink-0 ${
                      synced ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                    }`}>
                      {synced ? 'Broadcasting' : 'Ready'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-[2rem] border border-[#E5E5E0] shadow-sm">
                <DownloadCloud className="w-12 h-12 text-[#D9D9D1] mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-[#1E1E1E] tracking-tighter">No Cached Packages</h2>
                <p className="text-sm text-[#8C8C85] font-medium mt-2">Download a new package from the overview tab.</p>
              </div>
            )
          )}

          {activeTab === "settings" && (
            <div className="bg-white rounded-[2rem] border border-[#E5E5E0] shadow-sm p-10 space-y-10">
              <h2 className="text-2xl font-bold text-[#1E1E1E] tracking-tighter underline decoration-blue-500 underline-offset-8">Server Configuration</h2>
              <div className="space-y-6 max-w-xl">
                 <div className="space-y-3">
                   <p className="text-[11px] font-bold text-[#8C8C85] uppercase tracking-widest">Network Interface</p>
                   <p className="text-[11px] font-medium text-[#8C8C85] uppercase tracking-widest">Network Interface</p>
                   <select className="w-full px-4 py-3 bg-[#F9F9F7] border border-[#E5E5E0] rounded-xl text-sm font-medium">
                     <option>0.0.0.0 (All Addresses)</option>
                     <option>127.0.0.1 (Localhost)</option>
                   </select>
                 </div>
                 <div className="space-y-3">
                   <p className="text-[11px] font-medium text-[#8C8C85] uppercase tracking-widest">Port Selection</p>
                   <input type="text" value="4000" readOnly className="w-full px-4 py-3 bg-[#F9F9F7] border border-[#E5E5E0] rounded-xl text-sm font-medium " />
                 </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
