import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow, isAfter, subMonths } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatSubmissionTime(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  
  // Anything more than a month ago
  if (!isAfter(d, subMonths(now, 1))) {
    return format(d, "MMM d, yyyy");
  }
  
  // More than 24 hours ago but less than a month
  const diffInHours = Math.abs(now.getTime() - d.getTime()) / 36e5;
  if (diffInHours > 24) {
    return formatDistanceToNow(d, { addSuffix: true });
  }
  
  // Less than 24 hours ago
  const diffInMinutes = Math.abs(now.getTime() - d.getTime()) / 60000;
  if (diffInMinutes < 60) {
    return formatDistanceToNow(d, { addSuffix: true });
  }
  
  // Within the last 24 hours but more than 1 hour
  return format(d, "HH:mm");
}
