import { useState } from "react";
import { cn } from "../../lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  DownloadCloud, 
  Settings, 
  Activity,
  Server,
  LogOut,
  Loader2
} from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

interface SidebarProps {
  className?: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  sidecarStatus?: string | null;
}

export function Sidebar({ className, activeTab, onTabChange, sidecarStatus }: SidebarProps) {
  const [closing, setClosing] = useState(false);

  const handleClose = async () => {
    if (closing) return;
    setClosing(true);
    try {
      // Signal sidecar to exit gracefully
      await fetch("http://127.0.0.1:4000/api/internal/shutdown", { method: "POST" })
        .catch(() => { /* sidecar may already be gone, that's fine */ });
    } catch (e) {
      console.warn("[Sidebar] Shutdown fetch error:", e);
    } finally {
      try {
        // Close the Tauri window
        const win = getCurrentWebviewWindow();
        await win.close();
      } catch (e) {
        console.error("[Sidebar] Tauri close failed, falling back to window.close():", e);
        window.close();
      }
    }
  };

  const menuItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "students", label: "Connected Students", icon: Users },
    { id: "exams", label: "Exam Packages", icon: DownloadCloud },
    { id: "settings", label: "Configuration", icon: Settings },
  ];

  return (
    <div className={cn("flex flex-col h-screen w-64 bg-[#1E1E1E] text-white border-r border-[#2A2A2A]", className)}>
      <div className="p-6 border-b border-[#2A2A2A]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Server className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-medium tracking-tight leading-none text-white">LocalServer</h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-[0.2em] mt-1.5 font-sans">Node Sidecar</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-8 px-4 space-y-1.5">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "text-slate-400 hover:bg-[#2A2A2A] hover:text-white"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-slate-500")} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-6 border-t border-[#2A2A2A] bg-[#1E1E1E]/50">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 rounded-full bg-[#2A2A2A] flex items-center justify-center border border-[#333333] shadow-inner">
            <Activity className="w-5 h-5 text-green-500 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white uppercase tracking-wider">System Status</p>
            <p className={cn(
              "text-[11px] font-medium uppercase",
              sidecarStatus === 'ready' ? "text-green-500" : 
              sidecarStatus?.startsWith('error') ? "text-red-500" : "text-amber-400"
            )}>
              {sidecarStatus === 'ready' ? "Online & Listening" : 
               sidecarStatus?.startsWith('error') ? "Sidecar Error" : "Sidecar Booting..."}
            </p>
          </div>
        </div>
        
        <button
          onClick={handleClose}
          disabled={closing}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-medium text-slate-400 hover:text-white hover:bg-red-900/30 hover:border-red-800 rounded-xl border border-[#2A2A2A] transition-all uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
          {closing ? "Closing..." : "Close Console"}
        </button>
      </div>
    </div>
  );
}
