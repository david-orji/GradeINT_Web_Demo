import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ShieldCheck, Eye, EyeOff, Loader2, GraduationCap, BookOpen, Clock } from "lucide-react";

type Role = "teacher" | "student";

export default function Signup() {
    const [, setLocation] = useLocation();
    const { login, isLoggingIn } = useAuth();

    const [role, setRole] = useState<Role>("student");
    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [institution, setInstitution] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingApproval, setPendingApproval] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        if (password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, username, email, password, role, institution: role === "teacher" ? institution : undefined }),
                credentials: "include",
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.message ?? "Registration failed");
                return;
            }

            if (data.status === "pending") {
                // Teacher — show pending screen
                setPendingApproval(true);
                return;
            }

            // Student — log them in automatically
            const user = await login({ username, password });
            setLocation("/student/dashboard");
        } catch (err: any) {
            setError(err.message ?? "Registration failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Pending approval screen for teachers
    if (pendingApproval) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <div className="absolute top-0 left-0 w-full h-1/2 bg-slate-900/5 skew-y-3 transform origin-top-left -z-10" />
                <div className="mb-8 text-center">
                    <div className="mx-auto w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4 shadow-lg shadow-blue-600/20">
                        <ShieldCheck className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-3xl font-display font-bold text-slate-900">GradeINT</h1>
                </div>
                <Card className="w-full max-w-md shadow-xl border-slate-200 text-center">
                    <CardContent className="pt-8 pb-8 space-y-4">
                        <div className="mx-auto w-16 h-16 bg-amber-50 border-2 border-amber-200 rounded-full flex items-center justify-center">
                            <Clock className="w-8 h-8 text-amber-500" />
                        </div>
                        <h2 className="text-xl font-semibold text-slate-900">Pending Approval</h2>
                        <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
                            Your teacher account has been created and is awaiting verification by a System Administrator.
                            <br /><br />
                            You'll be able to create exams and access your profile code once approved.
                        </p>
                        <Button
                            variant="outline"
                            className="mt-4"
                            onClick={() => setLocation("/login")}
                        >
                            Back to Sign In
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 py-12">
            <div className="absolute top-0 left-0 w-full h-1/2 bg-slate-900/5 skew-y-3 transform origin-top-left -z-10" />

            <div className="mb-8 text-center">
                <div className="mx-auto w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4 shadow-lg shadow-blue-600/20">
                    <ShieldCheck className="w-7 h-7 text-white" />
                </div>
                <h1 className="text-3xl font-display font-bold text-slate-900">GradeINT</h1>
                <p className="text-slate-500 mt-2">Create your account</p>
            </div>

            <Card className="w-full max-w-md shadow-xl border-slate-200">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-semibold text-center">Sign Up</CardTitle>
                    <CardDescription className="text-center">
                        Choose your role and fill in your details
                    </CardDescription>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {/* Role selector */}
                        <div className="space-y-2">
                            <Label>I am a…</Label>
                            <RadioGroup
                                value={role}
                                onValueChange={(v) => setRole(v as Role)}
                                className="grid grid-cols-2 gap-3 pt-1"
                            >
                                {[
                                    { value: "student", label: "Student", icon: GraduationCap },
                                    { value: "teacher", label: "Teacher", icon: BookOpen },
                                ].map(({ value, label, icon: Icon }) => (
                                    <Label
                                        key={value}
                                        htmlFor={`role-${value}`}
                                        className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${role === value
                                                ? "border-blue-600 bg-blue-50 text-blue-700"
                                                : "border-slate-200 hover:border-slate-300 text-slate-600"
                                            }`}
                                    >
                                        <RadioGroupItem value={value} id={`role-${value}`} className="sr-only" />
                                        <Icon className="w-4 h-4" />
                                        <span className="font-medium text-sm">{label}</span>
                                    </Label>
                                ))}
                            </RadioGroup>
                        </div>

                        {role === "teacher" && (
                            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                                Teacher accounts require admin approval before you can create exams or share your profile code.
                            </p>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" required className="h-11" />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required className="h-11" />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="reg-username">Username</Label>
                            <Input id="reg-username" value={username} onChange={e => setUsername(e.target.value)} placeholder="Choose a username" required minLength={3} className="h-11" autoComplete="username" />
                        </div>

                        {role === "teacher" && (
                            <div className="space-y-2">
                                <Label htmlFor="institution">Institution <span className="text-slate-400 font-normal">(optional)</span></Label>
                                <Input id="institution" value={institution} onChange={e => setInstitution(e.target.value)} placeholder="e.g. University of Lagos" className="h-11" />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="reg-password">Password</Label>
                            <div className="relative">
                                <Input
                                    id="reg-password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="At least 8 characters"
                                    required
                                    minLength={8}
                                    className="h-11 pr-10"
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm Password</Label>
                            <Input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="Repeat your password"
                                required
                                className="h-11"
                                autoComplete="new-password"
                            />
                        </div>
                    </CardContent>

                    <CardFooter className="flex flex-col gap-3">
                        <Button
                            type="submit"
                            className="w-full h-11 text-base bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/10"
                            disabled={isSubmitting || isLoggingIn}
                        >
                            {(isSubmitting || isLoggingIn) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Create Account
                        </Button>

                        <p className="text-sm text-center text-slate-500">
                            Already have an account?{" "}
                            <button
                                type="button"
                                onClick={() => setLocation("/login")}
                                className="text-blue-600 hover:underline font-medium"
                            >
                                Sign in
                            </button>
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
