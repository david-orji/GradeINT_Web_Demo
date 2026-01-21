import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal, Search, FileText } from "lucide-react";
import { useExams, useCreateExam } from "@/hooks/use-exams";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertExamSchema } from "@shared/schema";
import { z } from "zod";

const createSchema = insertExamSchema.pick({ 
  title: true, 
  subject: true, 
  description: true, 
  durationMinutes: true 
});

type CreateForm = z.infer<typeof createSchema>;

export default function ExamsList() {
  const { user } = useAuth();
  const { data: exams, isLoading } = useExams(user?.id);
  const createExam = useCreateExam();
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      durationMinutes: 60,
    }
  });

  const onSubmit = (data: CreateForm) => {
    if (!user) return;
    createExam.mutate({
      ...data,
      teacherId: user.id,
      status: "draft"
    }, {
      onSuccess: () => {
        setIsOpen(false);
        form.reset();
      }
    });
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-display font-bold text-slate-900">Exams Library</h1>
              <p className="text-slate-500 mt-1">Manage your assessments and question banks.</p>
            </div>
            
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/10">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Exam
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create New Exam</DialogTitle>
                  <DialogDescription>Setup the basic details. You can add questions later.</DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Exam Title</Label>
                    <Input id="title" placeholder="e.g. Midterm Physics 101" {...form.register("title")} />
                    {form.formState.errors.title && <span className="text-xs text-red-500">{form.formState.errors.title.message}</span>}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input id="subject" placeholder="e.g. Physics" {...form.register("subject")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration (mins)</Label>
                      <Input id="duration" type="number" {...form.register("durationMinutes", { valueAsNumber: true })} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Instructions / Description</Label>
                    <Textarea id="description" placeholder="Exam rules and guidelines..." {...form.register("description")} />
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createExam.isPending}>
                      {createExam.isPending ? "Creating..." : "Create Draft"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-200 flex items-center gap-4 bg-slate-50/50">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input className="pl-9 bg-white" placeholder="Search exams..." />
              </div>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm">Filter</Button>
                <Button variant="outline" size="sm">Sort</Button>
              </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <div className="col-span-5">Exam Details</div>
              <div className="col-span-2">Subject</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Last Updated</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-slate-100">
              {isLoading ? (
                <div className="p-12 text-center text-slate-400">Loading exams...</div>
              ) : exams?.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center text-slate-500">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                    <FileText className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900">No exams yet</h3>
                  <p className="text-sm mt-1">Create your first exam to get started.</p>
                </div>
              ) : (
                exams?.map((exam) => (
                  <div key={exam.id} className="grid grid-cols-12 px-6 py-4 items-center hover:bg-slate-50 transition-colors group">
                    <div className="col-span-5 pr-4">
                      <div className="font-medium text-slate-900">{exam.title}</div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">{exam.description || "No description provided."}</div>
                    </div>
                    <div className="col-span-2 text-sm text-slate-600">
                      {exam.subject}
                    </div>
                    <div className="col-span-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                        exam.status === "published" ? "bg-green-50 text-green-700 border-green-200" :
                        exam.status === "draft" ? "bg-slate-100 text-slate-600 border-slate-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                        {exam.status}
                      </span>
                    </div>
                    <div className="col-span-2 text-sm text-slate-500">
                      {new Date().toLocaleDateString()} {/* Mock date for now */}
                    </div>
                    <div className="col-span-1 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
