/**
 * StudentRequestsPanel – shown on the Teacher Dashboard.
 * Lists incoming link requests with Accept / Decline buttons.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Users } from "lucide-react";
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
    if (!res.ok) throw new Error("Failed");
    return res.json();
}

async function respondToLink(id: number, status: "accepted" | "declined") {
    const res = await fetch(`/api/links/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
    });
    if (!res.ok) throw new Error("Failed");
    return res.json();
}

export default function StudentRequestsPanel() {
    const queryClient = useQueryClient();

    const { data: links = [], isLoading } = useQuery({
        queryKey: ["links", "incoming"],
        queryFn: fetchIncoming,
        refetchInterval: 15_000,
    });

    const respondMutation = useMutation({
        mutationFn: ({ id, status }: { id: number; status: "accepted" | "declined" }) =>
            respondToLink(id, status),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["links", "incoming"] }),
    });

    const pending = links.filter((l) => l.status === "pending");
    const history = links.filter((l) => l.status !== "pending").slice(0, 5);

    return (
        <Card className="border-slate-200">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-700 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Student Link Requests
                    {pending.length > 0 && (
                        <Badge className="ml-1 bg-blue-600">{pending.length}</Badge>
                    )}
                </CardTitle>
                <CardDescription>
                    Students who have requested to link with you via your profile code.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8 text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
                    </div>
                ) : pending.length === 0 && history.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">No student requests yet.</p>
                    </div>
                ) : (
                    <>
                        {pending.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending</p>
                                {pending.map((link) => (
                                    <div
                                        key={link.id}
                                        className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white"
                                    >
                                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                            <span className="text-blue-700 font-bold text-sm">
                                                {link.student?.name?.charAt(0)?.toUpperCase() ?? "?"}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-slate-800 truncate">{link.student?.name ?? "Unknown"}</p>
                                            <p className="text-xs text-slate-400 truncate">{link.student?.email}</p>
                                        </div>
                                        <div className="flex gap-1.5 flex-shrink-0">
                                            <Button
                                                size="sm"
                                                className="bg-green-600 hover:bg-green-700 h-8 px-2.5 gap-1"
                                                onClick={() => respondMutation.mutate({ id: link.id, status: "accepted" })}
                                                disabled={respondMutation.isPending}
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Accept
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-red-600 border-red-200 hover:bg-red-50 h-8 px-2.5 gap-1"
                                                onClick={() => respondMutation.mutate({ id: link.id, status: "declined" })}
                                                disabled={respondMutation.isPending}
                                            >
                                                <XCircle className="w-3.5 h-3.5" /> Decline
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {history.length > 0 && (
                            <div className="space-y-2 pt-1">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Recent</p>
                                {history.map((link) => (
                                    <div key={link.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 opacity-75">
                                        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                                            <span className="text-slate-600 font-bold text-sm">
                                                {link.student?.name?.charAt(0)?.toUpperCase() ?? "?"}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-slate-700 truncate">{link.student?.name ?? "Unknown"}</p>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className={
                                                link.status === "accepted"
                                                    ? "text-green-700 border-green-200 bg-green-50"
                                                    : "text-red-600 border-red-200 bg-red-50"
                                            }
                                        >
                                            {link.status}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
