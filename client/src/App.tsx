import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";

import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import TeacherDashboard from "@/pages/teacher/Dashboard";
import TeacherStudents from "@/pages/teacher/Students";
import ExamsList from "@/pages/teacher/ExamsList";
import Grading from "@/pages/teacher/Grading";
import ScoreSheet from "@/pages/teacher/ScoreSheet";
import StudentDashboard from "@/pages/student/Dashboard";
import ExamSession from "@/pages/student/ExamSession";
import AdminDashboard from "@/pages/admin/Dashboard";
import StudentTeachers from "@/pages/student/Teachers";
import NotFound from "@/pages/not-found";

// Protected Route Component
function ProtectedRoute({ component: Component, allowedRoles }: { component: React.ComponentType, allowedRoles: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="flex h-screen items-center justify-center text-slate-500">Authenticating...</div>;

  if (!user) return <Redirect to="/login" />;

  if (!allowedRoles.includes(user.role)) {
    return <div className="flex h-screen items-center justify-center text-red-500">Access Denied</div>;
  }

  return <Component />;
}

function Router() {
  const { user } = useAuth();

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />

      {/* Root redirect */}
      <Route path="/">
        {() => {
          if (!user) return <Redirect to="/login" />;
          if (user.role === "student") return <Redirect to="/student/dashboard" />;
          if (user.role === "admin") return <Redirect to="/admin" />;
          return <Redirect to="/teacher" />;
        }}
      </Route>

      {/* Admin Routes */}
      <Route path="/admin">
        <ProtectedRoute component={AdminDashboard} allowedRoles={["admin"]} />
      </Route>

      {/* Teacher Routes */}
      <Route path="/teacher">
        <ProtectedRoute component={TeacherDashboard} allowedRoles={["teacher", "admin"]} />
      </Route>
      <Route path="/teacher/students">
        <ProtectedRoute component={TeacherStudents} allowedRoles={["teacher", "admin"]} />
      </Route>
      <Route path="/teacher/exams">
        <ProtectedRoute component={ExamsList} allowedRoles={["teacher", "admin"]} />
      </Route>
      <Route path="/teacher/grading">
        <ProtectedRoute component={Grading} allowedRoles={["teacher", "admin"]} />
      </Route>
      <Route path="/teacher/scoresheet">
        <ProtectedRoute component={ScoreSheet} allowedRoles={["teacher", "admin"]} />
      </Route>

      {/* Student Routes */}
      <Route path="/student/dashboard">
        <ProtectedRoute component={StudentDashboard} allowedRoles={["student"]} />
      </Route>
      <Route path="/student/teachers">
        <ProtectedRoute component={StudentTeachers} allowedRoles={["student"]} />
      </Route>
      <Route path="/student/exam/:sessionId">
        <ProtectedRoute component={ExamSession} allowedRoles={["student"]} />
      </Route>
      <Route path="/student/session/:sessionId">
        <ProtectedRoute component={ExamSession} allowedRoles={["student"]} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
