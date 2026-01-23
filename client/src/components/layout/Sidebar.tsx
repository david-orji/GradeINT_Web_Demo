import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  Settings, 
  LogOut,
  GraduationCap
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const teacherLinks = [
    { href: "/teacher", icon: LayoutDashboard, label: "Overview" },
    { href: "/teacher/exams", icon: BookOpen, label: "Exams" },
    { href: "/teacher/grading", icon: GraduationCap, label: "Grading" },
  ];

  const adminLinks = [
    { href: "/admin", icon: LayoutDashboard, label: "System Health" },
    { href: "/admin/users", icon: Users, label: "Users" },
    { href: "/admin/settings", icon: Settings, label: "Configuration" },
  ];

  const links = user?.role === "admin" ? adminLinks : teacherLinks;

  return (
    <div className={cn("flex flex-col h-screen w-64 bg-slate-900 text-white border-r border-slate-800", className)}>
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
            <span className="text-white font-bold text-lg">G</span>
          </div>
          <span className="font-display tracking-tight">GradeINT</span>
        </h1>
        <p className="mt-2 text-xs text-slate-400 uppercase tracking-wider font-medium">
          {user?.role === "admin" ? "Administration" : "Educator Portal"}
        </p>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1">
        {links.map((link) => {
          const isActive = location === link.href;
          return (
            <Link key={link.href} href={link.href} className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
              isActive 
                ? "bg-blue-600 text-white shadow-sm" 
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            )}>
              <link.icon className="w-5 h-5" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold border border-slate-600">
            {user?.name?.[0] || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate capitalize">{user?.role}</p>
          </div>
        </div>
        <button 
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
