import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AddTeacherDialog from "@/components/AddTeacherDialog";
import {
    ArrowLeft,
    UserPlus,
    BookOpen,
    Building2,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
} from "lucide-react";
import type { SafeUser } from "@shared/schema";

type LinkWithTeacher = {
    id: number;
    teacherId: number;
    studentId: number;
    status: "pending" | "accepted" | "declined";
    requestedAt: string;
    respondedAt: string | null;
    teacher: SafeUser | null;
};

async function fetchMyTeachers(): Promise<LinkWithTeacher[]> {
    const res = await fetch("/api/links/my-teachers", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
}

function StatusBadge({ status }: { status: LinkWithTeacher["status"] }) {
    if (status === "accepted") {
        return (
            <Badge className="bg-green-50 text-green-700 border border-green-200 gap-1">
                <CheckCircle2 className="w-3 h-3" /> Linked
            </Badge>
        );
    }
    if (status === "pending") {
        return (
            <Badge className="bg-amber-50 text-amber-700 border border-amber-200 gap-1">
                <Clock className="w-3 h-3" /> Pending
            </Badge>
        );
    }
    return (
        <Badge className="bg-red-50 text-red-600 border border-red-200 gap-1">
            <XCircle className="w-3 h-3" /> Declined
        </Badge>
    );
}

export default function StudentTeachers() {
    const { user } = useAuth();
    const [, setLocation] = useLocation();
    const [addTeacherOpen, setAddTeacherOpen] = useState(false);

    const { data: links = [], isLoading } = useQuery({
        queryKey: ["links", "my-teachers"],
        queryFn: fetchMyTeachers,
        refetchInterval: 20_000,
    });

    const accepted = links.filter((l) => l.status === "accepted");
    const pending = links.filter((l) => l.status === "pending");
    const declined = links.filter((l) => l.status === "declined");

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Nav */}
            <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                        <span className="text-white font-bold text-lg">G</span>
                    </div>
                    <span className="font-display font-bold text-slate-900 text-lg">GradeINT Student</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-600">{user?.name}</span>
                </div>
            </nav>

            <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLocation("/student/dashboard")}
                            className="text-slate-500 hover:text-slate-900"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">My Teachers</h1>
                            <p className="text-sm text-slate-500 mt-0.5">
                                Teachers you've linked with via their profile codes
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={() => setAddTeacherOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 gap-2"
                    >
                        <UserPlus className="w-4 h-4" />
                        Add Teacher
                    </Button>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-20 text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
                    </div>
                ) : links.length === 0 ? (
                    <Card className="border-dashed border-2 border-slate-200">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
                            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                                <BookOpen className="w-8 h-8 text-blue-400" />
                            </div>
                            <div>
                                <p className="font-semibold text-slate-700 text-lg">No teachers yet</p>
                                <p className="text-sm text-slate-500 mt-1 max-w-xs">
                                    Ask your teacher for their profile code and tap "Add Teacher" to send a link request.
                                </p>
                            </div>
                            <Button
                                onClick={() => setAddTeacherOpen(true)}
                                className="bg-blue-600 hover:bg-blue-700 gap-2 mt-2"
                            >
                                <UserPlus className="w-4 h-4" />
                                Add a Teacher
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {/* Accepted */}
                        {accepted.length > 0 && (
                            <section className="space-y-3">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    Linked ({accepted.length})
                                </h2>
                                {accepted.map((link) => (
                                    <TeacherCard key={link.id} link={link} />
                                ))}
                            </section>
                        )}

                        {/* Pending */}
                        {pending.length > 0 && (
                            <section className="space-y-3">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    Awaiting Response ({pending.length})
                                </h2>
                                {pending.map((link) => (
                                    <TeacherCard key={link.id} link={link} />
                                ))}
                            </section>
                        )}

                        {/* Declined */}
                        {declined.length > 0 && (
                            <section className="space-y-3">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    Declined ({declined.length})
                                </h2>
                                {declined.map((link) => (
                                    <TeacherCard key={link.id} link={link} />
                                ))}
                            </section>
                        )}
                    </div>
                )}
            </main>

            <AddTeacherDialog open={addTeacherOpen} onOpenChange={setAddTeacherOpen} />
        </div>
    );
}

function TeacherCard({ link }: { link: LinkWithTeacher }) {
    const teacher = link.teacher;
    const initials = teacher?.name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) ?? "?";

    return (
        <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-base">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{teacher?.name ?? "Unknown Teacher"}</p>
                {teacher?.institution && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{teacher.institution}</span>
                    </p>
                )}
                <p className="text-xs text-slate-400 mt-0.5">
                    Requested {new Date(link.requestedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </p>
            </div>
            <StatusBadge status={link.status} />
        </div>
    );
}
