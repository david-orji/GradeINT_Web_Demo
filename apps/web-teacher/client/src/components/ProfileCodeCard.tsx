/**
 * ProfileCodeCard – displays a teacher's unique profile code (or a locked
 * state if the account is still pending admin approval).
 *
 * Usage (inside Teacher Dashboard):
 *   import ProfileCodeCard from "@/components/ProfileCodeCard";
 *   <ProfileCodeCard user={user} />
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Lock } from "lucide-react";
import type { SafeUser } from "@shared/schema";

interface Props {
    user: SafeUser;
}

export default function ProfileCodeCard({ user }: Props) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (!user.profileCode) return;
        navigator.clipboard.writeText(user.profileCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Card className="border-slate-200">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-700">Your Profile Code</CardTitle>
            </CardHeader>
            <CardContent>
                {user.profileCode ? (
                    <div className="flex items-center gap-3">
                        <div className="flex-1 bg-slate-100 rounded-lg px-4 py-3 font-mono text-2xl font-bold tracking-widest text-slate-900 select-all">
                            {user.profileCode}
                        </div>
                        <Button
                            size="icon"
                            variant="outline"
                            onClick={handleCopy}
                            className="flex-shrink-0 h-12 w-12"
                            title="Copy code"
                        >
                            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                        <Lock className="w-5 h-5 text-amber-400 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-amber-800">Account Pending Approval</p>
                            <p className="text-xs text-amber-600 mt-0.5">
                                Your profile code will appear here once a System Administrator validates your account.
                            </p>
                        </div>
                    </div>
                )}
                {user.profileCode && (
                    <p className="text-xs text-slate-500 mt-2">
                        Share this code with students so they can send you a link request.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
