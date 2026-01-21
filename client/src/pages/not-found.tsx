import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
      <Card className="w-full max-w-md mx-4 text-center p-6 shadow-lg border-slate-200">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 justify-center text-slate-400">
            <AlertCircle className="h-12 w-12 text-slate-900" />
          </div>

          <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">404</h1>
          <p className="text-slate-500 mb-6">Page not found</p>
          
          <Link href="/">
            <Button className="bg-slate-900 text-white hover:bg-slate-800">
              Return Home
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
