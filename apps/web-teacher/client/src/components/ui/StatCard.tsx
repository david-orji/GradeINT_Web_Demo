import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
  colorClass?: string;
}

export function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendUp, 
  className,
  colorClass = "bg-blue-50 text-blue-600" 
}: StatCardProps) {
  return (
    <div className={cn(
      "bg-white rounded-lg p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow",
      className
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
          {trend && (
            <p className={cn(
              "text-xs font-medium mt-1 flex items-center gap-1",
              trendUp ? "text-green-600" : "text-red-600"
            )}>
              {trendUp ? "↑" : "↓"} {trend}
            </p>
          )}
        </div>
        <div className={cn("p-2 rounded-lg", colorClass)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
