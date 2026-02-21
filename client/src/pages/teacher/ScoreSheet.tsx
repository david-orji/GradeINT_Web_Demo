import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { useExams, useSubmissionsByExam } from "@/hooks/use-exams";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { Button } from "@/components/ui/button";
import {
  FileSpreadsheet,
  FileDown,
  ClipboardList,
  User,
  ChevronRight,
  Trophy,
  BookOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── helpers ──────────────────────────────────────────────────────────────────

function percentage(score: number, total: number): string {
  if (!total) return "–";
  return `${Math.round((score / total) * 100)}%`;
}

function gradeLetter(score: number, total: number): string {
  if (!total) return "–";
  const pct = (score / total) * 100;
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

function gradeColor(letter: string): string {
  switch (letter) {
    case "A": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "B": return "bg-blue-50 text-blue-700 border-blue-200";
    case "C": return "bg-amber-50 text-amber-700 border-amber-200";
    case "D": return "bg-orange-50 text-orange-700 border-orange-200";
    case "F": return "bg-red-50 text-red-700 border-red-200";
    default:   return "bg-slate-100 text-slate-500 border-slate-200";
  }
}

// ── export helpers ────────────────────────────────────────────────────────────

interface ScoreRow {
  studentName: string;
  score: number | string;
  totalPossible: number;
  percent: string;
  grade: string;
}

function buildCSV(examTitle: string, rows: ScoreRow[]): string {
  const header = ["Student Name", "Score", "Total Possible", "Percentage", "Grade"].join(",");
  const body = rows
    .map((r) =>
      [
        `"${r.studentName}"`,
        r.score,
        r.totalPossible,
        r.percent,
        r.grade,
      ].join(",")
    )
    .join("\n");
  return `Exam: "${examTitle}"\n${header}\n${body}`;
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Minimal xlsx export using dynamic import of SheetJS (resolves from node_modules if installed) */
async function exportXLSX(examTitle: string, rows: ScoreRow[]) {
  // Dynamic import – works as long as 'xlsx' is in node_modules
  const XLSX = await import("xlsx").catch(() => null);
  if (!XLSX) {
    // Fallback: export as CSV with .xlsx extension (opens in Excel)
    const csv = buildCSV(examTitle, rows);
    downloadBlob(csv, `${examTitle}-scoresheet.xlsx`, "text/csv");
    return;
  }

  const wsData = [
    [`Exam: ${examTitle}`],
    [],
    ["Student Name", "Score", "Total Possible", "Percentage", "Grade"],
    ...rows.map((r) => [r.studentName, r.score, r.totalPossible, r.percent, r.grade]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Score Sheet");

  // Column widths
  ws["!cols"] = [{ wch: 28 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 8 }];

  XLSX.writeFile(wb, `${examTitle}-scoresheet.xlsx`);
}

// ── component ─────────────────────────────────────────────────────────────────

export default function ScoreSheet() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: exams } = useExams(user?.id);

  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);

  // Closed exams only
  const closedExams = useMemo(
    () => (exams ?? []).filter((e) => e.status === "closed"),
    [exams]
  );

  const selectedExam = closedExams.find((e) => e.id === selectedExamId) ?? null;

  // Fetch submissions for the selected exam
  const { data: submissions, isLoading: loadingSubs } = useSubmissionsByExam(
    selectedExamId ?? 0
  );

  // Fetch all users for name resolution
  const { data: users } = useQuery<any[]>({
    queryKey: [api.users.list.path],
    queryFn: async () => {
      const res = await fetch(api.users.list.path);
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  // Fetch questions for the selected exam (to compute max score)
  const { data: questions } = useQuery<any[]>({
    queryKey: ["examQuestions", selectedExamId],
    enabled: !!selectedExamId,
    queryFn: async () => {
      const res = await fetch(`/api/exams/${selectedExamId}/questions`);
      if (!res.ok) throw new Error("Failed to fetch questions");
      return res.json();
    },
  });

  const userMap = useMemo(() => {
    const m = new Map<number, string>();
    users?.forEach((u: any) => m.set(u.id, u.name));
    return m;
  }, [users]);

  const totalPossible = useMemo(
    () => (questions ?? []).reduce((acc: number, q: any) => acc + (q.points || 0), 0),
    [questions]
  );

  // Build score rows (only graded submissions)
  const scoreRows = useMemo<ScoreRow[]>(() => {
    if (!submissions) return [];
    return submissions
      .filter((s) => s.status === "graded" || s.totalScore !== null)
      .map((s) => {
        const name = userMap.get(s.studentId) || `Student #${s.studentId}`;
        const score = s.totalScore ?? 0;
        const letter = gradeLetter(score, totalPossible);
        return {
          studentName: name,
          score,
          totalPossible,
          percent: percentage(score, totalPossible),
          grade: letter,
        };
      })
      .sort((a, b) => (b.score as number) - (a.score as number));
  }, [submissions, userMap, totalPossible]);

  const handleExportCSV = () => {
    if (!selectedExam || scoreRows.length === 0) {
      toast({ title: "Nothing to export", description: "Select an exam with graded students.", variant: "destructive" });
      return;
    }
    const csv = buildCSV(selectedExam.title, scoreRows);
    downloadBlob(csv, `${selectedExam.title}-scoresheet.csv`, "text/csv");
    toast({ title: "CSV Downloaded", description: "Score sheet exported successfully." });
  };

  const handleExportXLSX = async () => {
    if (!selectedExam || scoreRows.length === 0) {
      toast({ title: "Nothing to export", description: "Select an exam with graded students.", variant: "destructive" });
      return;
    }
    try {
      await exportXLSX(selectedExam.title, scoreRows);
      toast({ title: "Excel File Downloaded", description: "Score sheet exported as .xlsx." });
    } catch {
      toast({ title: "Export Failed", description: "Could not generate the Excel file.", variant: "destructive" });
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />

      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-200 bg-white flex-shrink-0">
          <h1 className="text-2xl font-display font-bold text-slate-900">Score Sheet</h1>
          <p className="text-slate-500 mt-1 text-sm">
            View student scores for every closed exam. Export as Excel or CSV.
          </p>
        </div>

        {/* Two-column split */}
        <div className="flex-1 overflow-hidden grid grid-cols-[340px_1fr] divide-x divide-slate-200">

          {/* ── Left column: closed exams ─────────────────────────────────── */}
          <div className="overflow-y-auto bg-white flex flex-col">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 sticky top-0 z-10">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Closed Exams ({closedExams.length})
              </p>
            </div>

            {closedExams.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <BookOpen className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-700">No closed exams yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Close a published exam to see its score sheet here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {closedExams.map((exam) => {
                  const isActive = exam.id === selectedExamId;
                  return (
                    <button
                      key={exam.id}
                      onClick={() => setSelectedExamId(exam.id)}
                      className={`w-full text-left px-5 py-4 flex items-center gap-3 transition-colors group ${
                        isActive
                          ? "bg-blue-50 border-r-[3px] border-blue-500"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isActive
                            ? "bg-blue-100 text-blue-600"
                            : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                        }`}
                      >
                        <ClipboardList className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-semibold truncate ${
                            isActive ? "text-blue-700" : "text-slate-800"
                          }`}
                        >
                          {exam.title}
                        </p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {exam.subject} • {exam.durationMinutes} min
                        </p>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 flex-shrink-0 transition-transform ${
                          isActive
                            ? "text-blue-400 translate-x-0.5"
                            : "text-slate-300 group-hover:text-slate-400"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Right column: score table ─────────────────────────────────── */}
          <div className="overflow-y-auto flex flex-col">
            {!selectedExam ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-16">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <Trophy className="w-9 h-9 text-slate-300" />
                </div>
                <h3 className="text-base font-semibold text-slate-600">Select a closed exam</h3>
                <p className="text-sm text-slate-400 mt-1 max-w-xs">
                  Choose an exam from the left panel to view its full student score sheet.
                </p>
              </div>
            ) : (
              <>
                {/* Score sheet header */}
                <div className="px-8 py-5 border-b border-slate-200 bg-white flex items-start justify-between gap-4 flex-shrink-0 sticky top-0 z-10 shadow-sm">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-slate-900 truncate">{selectedExam.title}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {selectedExam.subject} &nbsp;·&nbsp; Max score:{" "}
                      <span className="font-semibold text-slate-700">{totalPossible} pts</span>
                      &nbsp;·&nbsp;
                      <span className="font-semibold text-slate-700">{scoreRows.length}</span> student
                      {scoreRows.length !== 1 ? "s" : ""} graded
                    </p>
                  </div>

                  {/* Export buttons */}
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      onClick={handleExportXLSX}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Export .xlsx
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                      onClick={handleExportCSV}
                    >
                      <FileDown className="w-4 h-4" />
                      Export .csv
                    </Button>
                  </div>
                </div>

                {/* Table */}
                <div className="flex-1 px-8 py-6">
                  {loadingSubs ? (
                    <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
                      Loading scores…
                    </div>
                  ) : scoreRows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-center">
                      <User className="w-10 h-10 text-slate-200 mb-3" />
                      <p className="text-sm text-slate-500 font-medium">No graded submissions yet</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Run AI grading on student submissions first.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                      {/* Table header */}
                      <div className="grid grid-cols-12 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <div className="col-span-1 text-center">#</div>
                        <div className="col-span-5">Student</div>
                        <div className="col-span-2 text-center">Score</div>
                        <div className="col-span-2 text-center">Percentage</div>
                        <div className="col-span-2 text-center">Grade</div>
                      </div>

                      {/* Table rows */}
                      <div className="divide-y divide-slate-100">
                        {scoreRows.map((row, idx) => {
                          const letter = row.grade;
                          const scoreNum = row.score as number;
                          const pctNum = totalPossible
                            ? Math.round((scoreNum / totalPossible) * 100)
                            : 0;

                          return (
                            <div
                              key={idx}
                              className="grid grid-cols-12 px-6 py-4 items-center hover:bg-slate-50 transition-colors"
                            >
                              {/* Rank */}
                              <div className="col-span-1 text-center">
                                {idx === 0 ? (
                                  <span className="text-amber-500 text-base">🥇</span>
                                ) : idx === 1 ? (
                                  <span className="text-slate-400 text-base">🥈</span>
                                ) : idx === 2 ? (
                                  <span className="text-amber-700 text-base">🥉</span>
                                ) : (
                                  <span className="text-xs text-slate-400 font-medium">{idx + 1}</span>
                                )}
                              </div>

                              {/* Student name */}
                              <div className="col-span-5 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                                  {row.studentName[0]?.toUpperCase()}
                                </div>
                                <span className="font-medium text-slate-800 text-sm">{row.studentName}</span>
                              </div>

                              {/* Score */}
                              <div className="col-span-2 text-center">
                                <span className="font-bold text-slate-900 text-sm">
                                  {scoreNum}
                                </span>
                                <span className="text-slate-400 text-xs"> / {totalPossible}</span>
                              </div>

                              {/* Percentage bar */}
                              <div className="col-span-2 text-center">
                                <div className="inline-flex flex-col items-center gap-1 w-full">
                                  <span className="text-sm font-semibold text-slate-700">{row.percent}</span>
                                  <div className="w-full max-w-[80px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        pctNum >= 90
                                          ? "bg-emerald-500"
                                          : pctNum >= 70
                                          ? "bg-blue-500"
                                          : pctNum >= 60
                                          ? "bg-amber-500"
                                          : "bg-red-500"
                                      }`}
                                      style={{ width: `${pctNum}%` }}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Grade badge */}
                              <div className="col-span-2 flex justify-center">
                                <span
                                  className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${gradeColor(letter)}`}
                                >
                                  {letter}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer summary */}
                      <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-6 text-xs text-slate-500">
                        <span>
                          Class average:{" "}
                          <strong className="text-slate-700">
                            {scoreRows.length > 0
                              ? `${Math.round(
                                  scoreRows.reduce((a, r) => a + (r.score as number), 0) /
                                    scoreRows.length
                                )} / ${totalPossible}`
                              : "–"}
                          </strong>
                        </span>
                        <span>
                          Avg %:{" "}
                          <strong className="text-slate-700">
                            {scoreRows.length > 0
                              ? percentage(
                                  Math.round(
                                    scoreRows.reduce((a, r) => a + (r.score as number), 0) /
                                      scoreRows.length
                                  ),
                                  totalPossible
                                )
                              : "–"}
                          </strong>
                        </span>
                        <span>
                          Highest:{" "}
                          <strong className="text-slate-700">
                            {scoreRows[0]?.studentName ?? "–"}
                          </strong>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
