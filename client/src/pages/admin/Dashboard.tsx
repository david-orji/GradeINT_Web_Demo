import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, CheckCircle2, XCircle, Loader2, LogOut, Users, Building2, Calendar } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { SafeUser } from "@shared/schema";

async function getPendingTeachers(): Promise<SafeUser[]> {
    const res = await fetch("/api/admin/pending-teachers", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch pending teachers");
    return res.json();
}

async function getApprovedTeachers(): Promise<SafeUser[]> {
    const res = await fetch("/api/admin/approved-teachers", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch approved teachers");
    return res.json();
}

export default function AdminDashboard() {
    const { user, logout } = useAuth();
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const [actionMessage, setActionMessage] = useState<{ id: number; text: string; type: "success" | "error" } | null>(null);

    const { data: teachers = [], isLoading: isLoadingPending, error: pendingError } = useQuery({
        queryKey: ["admin", "pending-teachers"],
        queryFn: getPendingTeachers,
        refetchInterval: 30_000,
    });

    const { data: approvedTeachers = [], isLoading: isLoadingApproved, error: approvedError } = useQuery({
        queryKey: ["admin", "approved-teachers"],
        queryFn: getApprovedTeachers,
        refetchInterval: 30_000,
    });

    const validateMutation = useMutation({
        mutationFn: async ({ id, approve }: { id: number; approve: boolean }) => {
            const res = await fetch(`/api/admin/teachers/${id}/validate`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ approve }),
                credentials: "include",
            });
            if (!res.ok) throw new Error("Action failed");
            return res.json();
        },
        onSuccess: (_, { id, approve }) => {
            setActionMessage({ id, text: approve ? "Teacher approved!" : "Teacher rejected.", type: "success" });
            queryClient.invalidateQueries({ queryKey: ["admin", "pending-teachers"] });
            queryClient.invalidateQueries({ queryKey: ["admin", "approved-teachers"] });
            setTimeout(() => setActionMessage(null), 3000);
        },
        onError: (_, { id }) => {
            setActionMessage({ id, text: "Action failed. Please try again.", type: "error" });
        },
    });

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">GradeINT Admin</h1>
                        <p className="text-xs text-slate-500">System Administrator Dashboard</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-600">{user?.name}</span>
                    <Button variant="outline" size="sm" onClick={logout} className="gap-2">
                        <LogOut className="w-4 h-4" /> Sign Out
                    </Button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="pt-6 flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                                <Users className="w-6 h-6 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{teachers.length}</p>
                                <p className="text-sm text-slate-500">Pending Approvals</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6 flex items-center gap-4">
                            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                                <Users className="w-6 h-6 text-green-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">{approvedTeachers.length}</p>
                                <p className="text-sm text-slate-500">Approved Teachers</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6 flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                                <ShieldCheck className="w-6 h-6 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-slate-900">Active</p>
                                <p className="text-sm text-slate-500">System Status</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Teacher Management */}
                <Card>
                    <CardHeader>
                        <CardTitle>Teacher Management</CardTitle>
                        <CardDescription>
                            Review and validate teacher accounts, and view approved instructors in your institution.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="pending" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-6">
                                <TabsTrigger value="pending" className="flex items-center justify-center gap-2">
                                    Pending Approvals
                                    {teachers.length > 0 && (
                                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 rounded-full px-2 py-0.5 text-xs font-semibold">
                                            {teachers.length}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger value="approved" className="flex items-center justify-center gap-2">
                                    Approved Teachers
                                    {approvedTeachers.length > 0 && (
                                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 text-xs font-semibold">
                                            {approvedTeachers.length}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="pending" className="space-y-4 outline-none focus:outline-none">
                                {isLoadingPending ? (
                                    <div className="flex items-center justify-center py-12 text-slate-400">
                                        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
                                    </div>
                                ) : pendingError ? (
                                    <Alert variant="destructive">
                                        <AlertDescription>Failed to load pending teachers.</AlertDescription>
                                    </Alert>
                                ) : teachers.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                        <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-400" />
                                        <p className="font-medium text-slate-600">All caught up!</p>
                                        <p className="text-sm mt-1">No pending teacher approvals at this time.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {teachers.map((teacher) => (
                                            <div
                                                key={teacher.id}
                                                className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-sm"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-blue-700 font-bold text-sm">
                                                        {teacher.name.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-slate-900 truncate">{teacher.name}</p>
                                                    <p className="text-sm text-slate-500 truncate">{teacher.email}</p>
                                                    {teacher.institution && (
                                                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                                            <Building2 className="w-3 h-3" /> {teacher.institution}
                                                        </p>
                                                    )}
                                                </div>
                                                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 flex-shrink-0">
                                                    Pending
                                                </Badge>

                                                {actionMessage?.id === teacher.id ? (
                                                    <p className={`text-sm font-medium ${actionMessage.type === "success" ? "text-green-600" : "text-red-500"}`}>
                                                        {actionMessage.text}
                                                    </p>
                                                ) : (
                                                    <div className="flex gap-2 flex-shrink-0">
                                                        <Button
                                                            size="sm"
                                                            className="bg-green-600 hover:bg-green-700 gap-1.5"
                                                            onClick={() => validateMutation.mutate({ id: teacher.id, approve: true })}
                                                            disabled={validateMutation.isPending}
                                                        >
                                                            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
                                                            onClick={() => validateMutation.mutate({ id: teacher.id, approve: false })}
                                                            disabled={validateMutation.isPending}
                                                        >
                                                            <XCircle className="w-3.5 h-3.5" /> Reject
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="approved" className="space-y-4 outline-none focus:outline-none">
                                {isLoadingApproved ? (
                                    <div className="flex items-center justify-center py-12 text-slate-400">
                                        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
                                    </div>
                                ) : approvedError ? (
                                    <Alert variant="destructive">
                                        <AlertDescription>Failed to load approved teachers.</AlertDescription>
                                    </Alert>
                                ) : approvedTeachers.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                        <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                                        <p className="font-medium text-slate-600">No approved teachers yet</p>
                                        <p className="text-sm mt-1">Approve pending requests to populate this list.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {approvedTeachers.map((teacher) => (
                                            <div
                                                key={teacher.id}
                                                className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-sm"
                                            >
                                                <div className="flex items-center gap-4 min-w-0">
                                                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-green-700 font-bold text-sm">
                                                            {teacher.name.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-semibold text-slate-900 truncate">{teacher.name}</p>
                                                            {teacher.profileCode && (
                                                                <code className="text-xs bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 font-mono">
                                                                    {teacher.profileCode}
                                                                </code>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-slate-500 truncate">{teacher.email}</p>
                                                        {teacher.institution && (
                                                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                                                <Building2 className="w-3 h-3" /> {teacher.institution}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                                        Active
                                                    </Badge>
                                                    {teacher.validatedAt && (
                                                        <p className="text-xs text-slate-400 flex items-center gap-1">
                                                            <Calendar className="w-3 h-3 text-slate-300" />
                                                            Approved: {new Date(teacher.validatedAt).toLocaleDateString(undefined, {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric'
                                                            })}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
