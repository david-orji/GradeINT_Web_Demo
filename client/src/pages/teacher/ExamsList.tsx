import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Plus, MoreHorizontal, Search, FileText, Pencil, Trash2 } from "lucide-react";
import { useExams, useCreateExam, usePublishExam, useUpdateExam, useDeleteExam, useExamQuestions } from "@/hooks/use-exams";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertExamSchema } from "@shared/schema";
import { z } from "zod";
import { useLocation } from "wouter";

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subject: z.string().min(1, "Subject is required"),
  description: z.string().optional(),
  durationMinutes: z.number().min(1),
  questions: z.array(z.object({
    text: z.string().min(1, "Question text is required"),
    type: z.enum(["multiple_choice", "short_answer", "essay"]),
    points: z.number().min(1),
    options: z.array(z.string()).optional(),
    correctAnswer: z.string().optional(),
    rubric: z.string().optional(),
  })).min(1, "At least one question is required")
});

type CreateForm = z.infer<typeof createSchema>;

export default function ExamsList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: exams, isLoading } = useExams(user?.id);
  const createExam = useCreateExam();
  const updateExam = useUpdateExam();
  const deleteExam = useDeleteExam();
  const publishMutation = usePublishExam();
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") === "true") {
      setIsOpen(true);
    }
  }, [location]);

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      durationMinutes: 60,
      questions: [{ text: "", type: "short_answer", points: 1 }]
    }
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "questions"
  });

  const handleEdit = async (exam: any) => {
    if (exam.status !== "draft") {
      toast({ title: "Cannot edit", description: "Only draft exams can be edited.", variant: "destructive" });
      return;
    }
    setEditingExam(exam);
    
    // Fetch questions for this exam
    try {
      const url = buildUrl(api.questions.list.path, { examId: exam.id });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch questions");
      const questions = await res.json();
      
      form.reset({
        title: exam.title,
        subject: exam.subject,
        description: exam.description || "",
        durationMinutes: exam.durationMinutes,
        questions: questions.length > 0 ? questions.map((q: any) => ({
          text: q.text,
          type: q.type,
          points: q.points,
          options: q.options || [],
          rubric: q.rubric || ""
        })) : [{ text: "", type: "short_answer", points: 1 }]
      });
    } catch (error) {
      console.error("Error fetching questions:", error);
      form.reset({
        title: exam.title,
        subject: exam.subject,
        description: exam.description || "",
        durationMinutes: exam.durationMinutes,
        questions: [{ text: "", type: "short_answer", points: 1 }]
      });
    }
    
    setIsOpen(true);
  };

  const onSubmit = (data: CreateForm) => {
    if (!user) return;
    const { questions: questionsData, ...examData } = data;
    
    if (editingExam) {
      updateExam.mutate({
        id: editingExam.id,
        ...examData,
        questions: questionsData
      } as any, {
        onSuccess: () => {
          setIsOpen(false);
          setEditingExam(null);
          form.reset();
        }
      });
    } else {
      createExam.mutate({
        ...examData,
        teacherId: user.id,
        status: "draft",
        questions: questionsData // Ensure questions are passed to create as well
      } as any, {
        onSuccess: (newExam) => {
          toast({ title: "Success", description: "Exam and questions have been saved." });
          setIsOpen(false);
          form.reset();
        }
      });
    }
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
            
            <Dialog open={isOpen} onOpenChange={(open) => {
              setIsOpen(open);
              if (!open) {
                setEditingExam(null);
                form.reset({
                  durationMinutes: 60,
                  questions: [{ text: "", type: "short_answer", points: 1 }]
                });
              }
            }}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/10">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Exam
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingExam ? "Edit Exam" : "Create New Exam"}</DialogTitle>
                  <DialogDescription>Define your assessment structure and grading criteria.</DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Exam Title</Label>
                      <Input id="title" {...form.register("title")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input id="subject" {...form.register("subject")} />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration (mins)</Label>
                      <Input id="duration" type="number" {...form.register("durationMinutes", { valueAsNumber: true })} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label className="text-base font-semibold">Questions</Label>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => append({ text: "", type: "short_answer", points: 1 })}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Question
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {fields.map((field, index) => (
                        <div key={field.id} className="p-4 border border-slate-200 rounded-lg space-y-4 relative bg-slate-50/50">
                          <button 
                            type="button"
                            onClick={() => remove(index)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-red-500"
                          >
                            <Plus className="w-4 h-4 rotate-45" />
                          </button>

                          <div className="space-y-2">
                            <Label>Question {index + 1}</Label>
                            <Input {...form.register(`questions.${index}.text` as const)} placeholder="Enter question text..." />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Type</Label>
                              <select 
                                {...form.register(`questions.${index}.type` as const)}
                                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                              >
                                <option value="short_answer">Short Answer</option>
                                <option value="multiple_choice">Multiple Choice</option>
                                <option value="essay">Essay</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <Label>Points</Label>
                              <Input type="number" {...form.register(`questions.${index}.points` as const, { valueAsNumber: true })} />
                            </div>
                          </div>

                          {form.watch(`questions.${index}.type`) === "multiple_choice" && (
                            <div className="space-y-2">
                              <Label>Options (comma separated)</Label>
                              <Input 
                                placeholder="Option A, Option B, Option C"
                                onChange={(e) => {
                                  const options = e.target.value.split(",").map(s => s.trim());
                                  form.setValue(`questions.${index}.options`, options);
                                }}
                              />
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label>Grading Rubric / Key</Label>
                            <Textarea 
                              {...form.register(`questions.${index}.rubric` as const)}
                              placeholder="Describe ideal answer or criteria for AI grading..."
                              className="h-20"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => {
                      setIsOpen(false);
                      setEditingExam(null);
                    }}>Cancel</Button>
                    <Button type="submit" disabled={createExam.isPending || updateExam.isPending}>
                      {createExam.isPending || updateExam.isPending ? "Saving..." : "Save Exam"}
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
              <div className="col-span-4">Exam Details</div>
              <div className="col-span-2">Subject</div>
              <div className="col-span-2">Access Code</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right">Actions</div>
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
                  <div 
                    key={exam.id} 
                    className="grid grid-cols-12 px-6 py-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                    onDoubleClick={() => handleEdit(exam)}
                  >
                    <div className="col-span-4 pr-4">
                      <div className="font-medium text-slate-900">{exam.title}</div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">{exam.description || "No description provided."}</div>
                    </div>
                    <div className="col-span-2 text-sm text-slate-600">
                      {exam.subject}
                    </div>
                    <div className="col-span-2 font-mono text-sm font-bold text-blue-600">
                      {exam.accessCode}
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
                    <div className="col-span-2 text-right flex justify-end gap-2">
                      {exam.status === "draft" && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            publishMutation.mutate(exam.id);
                          }}
                          disabled={publishMutation.isPending}
                        >
                          Publish
                        </Button>
                      )}
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-blue-600"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(exam)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600 focus:text-red-600"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this exam?")) {
                                deleteExam.mutate(exam.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
