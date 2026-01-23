import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth, useUsers } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { data: users, isLoading } = useUsers();
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const handleLogin = () => {
    const user = users?.find(u => u.id.toString() === selectedUserId);
    if (!user) return;

    login(user);

    // Redirect based on role
    if (user.role === "student") {
      setLocation("/student/dashboard");
    } else if (user.role === "admin") {
      setLocation("/admin");
    } else {
      setLocation("/teacher");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      {/* Decorative background element */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-slate-900/5 skew-y-3 transform origin-top-left -z-10" />

      <div className="mb-8 text-center">
        <div className="mx-auto w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4 shadow-lg shadow-blue-600/20">
          <ShieldCheck className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-3xl font-display font-bold text-slate-900">GradeINT</h1>
        <p className="text-slate-500 mt-2">Enterprise Examination Platform</p>
      </div>

      <Card className="w-full max-w-md shadow-xl border-slate-200">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-semibold text-center">Sign in</CardTitle>
          <CardDescription className="text-center">
            Select a demo account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Select User Role</label>
            <Select onValueChange={setSelectedUserId} value={selectedUserId}>
              <SelectTrigger className="w-full h-11 bg-white border-slate-200">
                <SelectValue placeholder="Choose a user..." />
              </SelectTrigger>
              <SelectContent>
                {isLoading ? (
                  <div className="p-2 text-sm text-slate-500">Loading users...</div>
                ) : (
                  users?.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      <span className="font-medium">{user.name}</span>
                      <span className="ml-2 text-xs text-slate-500 capitalize">({user.role})</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full h-11 text-base bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/10" 
            onClick={handleLogin}
            disabled={!selectedUserId}
          >
            Access Dashboard
          </Button>
        </CardFooter>
      </Card>
      
      <p className="mt-8 text-xs text-slate-400 text-center max-w-xs">
        &copy; 2024 GradeINT Inc. secure examination environment.
      </p>
    </div>
  );
}
