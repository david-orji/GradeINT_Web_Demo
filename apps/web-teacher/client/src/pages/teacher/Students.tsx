import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ProfileCodeCard from "@/components/ProfileCodeCard";
import {
    CheckCircle2,
    Clock,
    XCircle,
    Loader2,
    Search,
    Users,
    UserCheck,
} from "lucide-react";
import type { SafeUser } from "@shared/schema";

type LinkWithStudent = {
    id: number;
    teacherId: number;
    studentId: number;
    status: "pending" | "accepted" | "declined";
    requestedAt: string;
    respondedAt: string | null;
    student: SafeUser | null;
};

async function fetchIncoming(): Promise<LinkWithStudent[]> {
    const res = await fetch("/api/links/incoming", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
}

function StatusBadge({ status }: { status: LinkWithStudent["status"] }) {
    if (status === "accepted")
        return (
            <Badge className="bg-green-50 text-green-700 border border-green-200 gap-1 font-medium">
                <CheckCircle2 className="w-3 h-3" /> Accepted
            </Badge>
        );
    if (status === "pending")
        return (
            <Badge className="bg-amber-50 text-amber-700 border border-amber-200 gap-1 font-medium">
                <Clock className="w-3 h-3" /> Pending
            </Badge>
        );
    return (
        <Badge className="bg-red-50 text-red-600 border border-red-200 gap-1 font-medium">
            <XCircle className="w-3 h-3" /> Declined
        </Badge>
    );
}

export default function TeacherStudents() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");

    const { data: links = [], isLoading } = useQuery({
        queryKey: ["links", "incoming"],
        queryFn: fetchIncoming,
        refetchInterval: 20_000,
    });

    const respondMutation = useMutation({
        mutationFn: async ({ id, status }: { id: number; status: "accepted" | "declined" }) => {
            const res = await fetch(`/api/links/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
                credentials: "include",
            });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["links", "incoming"] }),
    });

    const filtered = links.filter((l: LinkWithStudent) => {
        const q = search.toLowerCase();
        if (!q) return true;
        return (
            l.student?.name?.toLowerCase().includes(q) ||
            l.student?.email?.toLowerCase().includes(q)
        );
    });

    const accepted = filtered.filter((l: LinkWithStudent) => l.status === "accepted");
    const pending = filtered.filter((l: LinkWithStudent) => l.status === "pending");
    const declined = filtered.filter((l: LinkWithStudent) => l.status === "declined");

    const totalStudents = links.filter((l: LinkWithStudent) => l.status === "accepted").length;
    const totalPending = links.filter((l: LinkWithStudent) => l.status === "pending").length;

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar />

            <main className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-8 py-8">
                    {/* Header */}
                    <header className="mb-8">
                        <h1 className="text-2xl font-display font-bold text-slate-900">Students</h1>
                        <p className="text-slate-500 mt-1">
                            Students who have requested to link with you via your profile code.
                        </p>
                    </header>

                    {/* Profile Code */}
                    <div className="mb-8">
                        <ProfileCodeCard user={user!} />
                    </div>

                    {/* Summary stats */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        {[
                            { label: "Linked Students", value: totalStudents, color: "text-green-600", bg: "bg-green-50", icon: UserCheck },
                            { label: "Pending Requests", value: totalPending, color: "text-amber-600", bg: "bg-amber-50", icon: Clock },
                            { label: "Total Requests", value: links.length, color: "text-blue-600", bg: "bg-blue-50", icon: Users },
                        ].map(({ label, value, color, bg, icon: Icon }) => (
                            <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
                                <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                                    <Icon className={`w-5 h-5 ${color}`} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-slate-900">{value}</p>
                                    <p className="text-xs text-slate-500">{label}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative mb-6">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Search by name or email…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-10 bg-white"
                        />
                    </div>

                    {/* Table */}
                    {isLoading ? (
                        <div className="flex items-center justify-center py-20 text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
                        </div>
                    ) : links.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                            <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                            <p className="font-semibold text-slate-600">No students yet</p>
                            <p className="text-sm text-slate-400 mt-1">
                                Share your profile code above so students can send you link requests.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="text-left px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Student</th>
                                        <th className="text-left px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider hidden sm:table-cell">Email</th>
                                        <th className="text-left px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider hidden md:table-cell">Requested</th>
                                        <th className="text-left px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                                        <th className="px-5 py-3" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {[...pending, ...accepted, ...declined].map((link: LinkWithStudent) => {
                                        const initials = link.student?.name
                                            ?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?";

                                        return (
                                            <tr key={link.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                                                            <span className="text-white text-xs font-bold">{initials}</span>
                                                        </div>
                                                        <span className="font-medium text-slate-900 truncate max-w-[140px]">
                                                            {link.student?.name ?? "Unknown"}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5 text-slate-500 hidden sm:table-cell truncate max-w-[180px]">
                                                    {link.student?.email ?? "—"}
                                                </td>
                                                <td className="px-5 py-3.5 text-slate-400 hidden md:table-cell whitespace-nowrap">
                                                    {new Date(link.requestedAt).toLocaleDateString(undefined, {
                                                        month: "short", day: "numeric", year: "numeric",
                                                    })}
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <StatusBadge status={link.status} />
                                                </td>
                                                <td className="px-5 py-3.5 text-right">
                                                    {link.status === "pending" && (
                                                        <div className="flex gap-1.5 justify-end">
                                                            <Button
                                                                size="sm"
                                                                className="bg-green-600 hover:bg-green-700 h-7 px-2.5 gap-1 text-xs"
                                                                onClick={() => respondMutation.mutate({ id: link.id, status: "accepted" })}
                                                                disabled={respondMutation.isPending}
                                                            >
                                                                <CheckCircle2 className="w-3 h-3" /> Accept
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-red-600 border-red-200 hover:bg-red-50 h-7 px-2.5 gap-1 text-xs"
                                                                onClick={() => respondMutation.mutate({ id: link.id, status: "declined" })}
                                                                disabled={respondMutation.isPending}
                                                            >
                                                                <XCircle className="w-3 h-3" /> Decline
                                                            </Button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {filtered.length === 0 && (
                                <div className="text-center py-10 text-slate-400 text-sm">
                                    No results for "{search}"
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
