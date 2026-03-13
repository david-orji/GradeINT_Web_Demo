/**
 * AddTeacherDialog – opened from Student Dashboard.
 * Student enters a teacher profile code → preview teacher info → send request.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Search, UserCheck, Building2 } from "lucide-react";
import type { SafeUser } from "@shared/schema";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function AddTeacherDialog({ open, onOpenChange }: Props) {
    const queryClient = useQueryClient();
    const [code, setCode] = useState("");
    const [lookupCode, setLookupCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const { data: teacher, isFetching, isError } = useQuery<SafeUser | null>({
        queryKey: ["teacher-by-code", lookupCode],
        queryFn: async () => {
            if (!lookupCode) return null;
            const res = await fetch(`/api/teacher/by-code/${encodeURIComponent(lookupCode)}`, { credentials: "include" });
            if (!res.ok) return null;
            return res.json();
        },
        enabled: !!lookupCode,
        retry: false,
    });

    const requestMutation = useMutation({
        mutationFn: async (teacherId: number) => {
            const res = await fetch("/api/links/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teacherId }),
                credentials: "include",
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message ?? "Request failed");
            return data;
        },
        onSuccess: () => {
            setSuccess(true);
            queryClient.invalidateQueries({ queryKey: ["links", "my-teachers"] });
            setTimeout(() => {
                setSuccess(false);
                setCode("");
                setLookupCode("");
                onOpenChange(false);
            }, 2000);
        },
        onError: (err: any) => {
            setError(err.message ?? "Request failed");
        },
    });

    const handleLookup = () => {
        setError(null);
        setLookupCode(code.trim().toUpperCase());
    };

    const handleSendRequest = () => {
        if (!teacher) return;
        setError(null);
        requestMutation.mutate(teacher.id);
    };

    const handleClose = (open: boolean) => {
        if (!open) {
            setCode("");
            setLookupCode("");
            setError(null);
            setSuccess(false);
        }
        onOpenChange(open);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add a Teacher</DialogTitle>
                    <DialogDescription>
                        Enter the profile code shared by your teacher to send them a link request.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {success ? (
                        <div className="flex flex-col items-center py-6 gap-3 text-center">
                            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                                <UserCheck className="w-7 h-7 text-green-600" />
                            </div>
                            <p className="font-semibold text-slate-900">Request Sent!</p>
                            <p className="text-sm text-slate-500">Waiting for your teacher to accept.</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="teacher-code">Teacher Profile Code</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="teacher-code"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                                        placeholder="e.g. TCH-A7F2K1"
                                        className="h-10 font-mono tracking-wider uppercase"
                                        onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                                    />
                                    <Button
                                        variant="outline"
                                        className="gap-1.5 flex-shrink-0"
                                        onClick={handleLookup}
                                        disabled={!code.trim() || isFetching}
                                    >
                                        {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                        Find
                                    </Button>
                                </div>
                            </div>

                            {lookupCode && !isFetching && (
                                teacher ? (
                                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0">
                                            <span className="text-blue-800 font-bold">{teacher.name.charAt(0)}</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-slate-900">{teacher.name}</p>
                                            {teacher.institution && (
                                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                    <Building2 className="w-3 h-3" /> {teacher.institution}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <Alert variant="destructive">
                                        <AlertDescription>No teacher found with that code. Check and try again.</AlertDescription>
                                    </Alert>
                                )
                            )}

                            {error && (
                                <Alert variant="destructive">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                        </>
                    )}
                </div>

                {!success && (
                    <DialogFooter>
                        <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
                        <Button
                            onClick={handleSendRequest}
                            disabled={!teacher || requestMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {requestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Send Request
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
