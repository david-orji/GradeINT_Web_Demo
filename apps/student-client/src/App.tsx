import { useState, useEffect } from "react";
import "./App.css";
import { Connect } from "./pages/Connect";
import { ConnectionState, LocalAPIClient } from "./lib/local-api";
import { LocalStore, StorageKeys, saveExamPackage, getExamPackage, saveAnswers, getAnswers } from "./lib/db";
import { CheckCircle2, FileText, Clock, UserIcon, ArrowRight, LogOut, AlertTriangle } from "lucide-react";
import { ExamPackage } from "@gradeint/shared-types";
import { Exam } from "./pages/Exam";

function App() {
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [exam, setExam] = useState<ExamPackage | null>(null);
  const [inProgressAnswers, setInProgressAnswers] = useState<any[]>([]);
  const [receipt, setReceipt] = useState<{ message: string; timestamp: Date } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inExam, setInExam] = useState(false);

  // Attempt to restore session on boot
  useEffect(() => {
    async function restore() {
      try {
        const conn = await LocalStore.get<ConnectionState>(StorageKeys.CONNECTION_DATA);
        const pkg = await getExamPackage();
        const savedAnswers = await getAnswers();
        
        if (conn) setConnection(conn);
        if (pkg) setExam(pkg);
        if (savedAnswers) setInProgressAnswers(savedAnswers);
      } catch (err) {
        console.error("Failed to restore session", err);
      } finally {
        setLoading(false);
      }
    }
    restore();
  }, []);

  const handleConnected = async (state: ConnectionState) => {
    try {
      setLoading(true);
      setError(null);
      setConnection(state);
      await LocalStore.set(StorageKeys.CONNECTION_DATA, state);
      
      const client = new LocalAPIClient(state.serverIp);
      const pkg = await client.fetchExamPackage(state.sessionCode);
      await saveExamPackage(pkg);
      setExam(pkg);
    } catch (err: any) {
      setError(err.message || "Failed to download exam package.");
      setConnection(null);
      await LocalStore.remove(StorageKeys.CONNECTION_DATA);
    } finally {
      setLoading(false);
    }
  };

  const handleAutosave = async (answers: any[]) => {
    try {
      if (!connection) return;
      await saveAnswers(answers);
      const client = new LocalAPIClient(connection.serverIp);
      await client.autosave(connection.studentId, answers);
    } catch (err) {
      console.error("Autosave failed in background:", err);
    }
  };

  const handleSubmit = async (answers: any[]) => {
    try {
      if (!connection) return;
      setLoading(true);
      await saveAnswers(answers);
      const client = new LocalAPIClient(connection.serverIp);
      await client.autosave(connection.studentId, answers);
      const res = await client.submitExam(connection.studentId);
      
      await LocalStore.remove(StorageKeys.SUBMISSION_STATE);
      await LocalStore.remove(StorageKeys.CONNECTION_DATA);
      await LocalStore.remove(StorageKeys.EXAM_PACKAGE);
      setInExam(false);
      setReceipt({ message: res.message, timestamp: new Date() });
    } catch (err: any) {
      setError("Submission Failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9F9F7] gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-[6px] border-blue-100 border-t-blue-600 rounded-full animate-spin" />
        </div>
        <p className="text-sm font-medium text-slate-400 uppercase tracking-widest animate-pulse">Initializing Environment</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F9F7] p-8">
        <div className="max-w-md w-full bg-white rounded-[2rem] p-10 shadow-2xl border border-red-100 text-center space-y-6">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-800">System Interruption</h2>
          <p className="text-slate-500 font-medium leading-relaxed">{error}</p>
          <button 
            onClick={() => { setError(null); setConnection(null); setInExam(false); }}
            className="w-full py-4 bg-[#1E1E1E] hover:bg-black text-white rounded-2xl font-semibold tracking-widest transition-all"
          >
            RETRY CONNECTION
          </button>
        </div>
      </div>
    );
  }

  if (!connection || !exam) {
    return <Connect onConnected={handleConnected} />;
  }

  if (inExam) {
    return (
      <Exam 
        exam={exam} 
        connection={connection}
        initialAnswers={inProgressAnswers} 
        onAutosave={handleAutosave} 
        onSubmit={handleSubmit} 
      />
    );
  }

  if (receipt) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9F9F7] p-8 font-sans">
        <div className="max-w-lg w-full bg-white rounded-[3rem] shadow-2xl border border-slate-100 p-12 space-y-10 relative">
          <div className="text-center space-y-4">
            <div className="h-20 w-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto border border-green-100 shadow-sm">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-semibold tracking-tighter text-slate-800">Submission Perfect!</h1>
            <p className="text-sm text-slate-400 font-medium uppercase tracking-[0.2em]">Official Digital Receipt</p>
          </div>
          
          <div className="bg-[#F9F9F7] rounded-[2rem] p-8 space-y-6 border border-slate-100">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-[0.15em] mb-1">Candidate</p>
                <p className="text-lg font-semibold text-slate-800">{connection.studentId}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-[0.15em] mb-1">Status</p>
                <p className="text-sm font-medium text-green-600 bg-green-100 px-3 py-1 rounded-full inline-block">SEALED</p>
              </div>
            </div>
            
            <div className="h-px bg-slate-200" />
            
            <div>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-[0.15em] mb-1">Confirmation Message</p>
              <p className="text-sm font-medium text-slate-700 leading-relaxed italic">"{receipt.message}"</p>
            </div>

            <div className="h-px bg-slate-200" />

            <div className="flex justify-between items-center text-[11px] font-medium text-slate-400">
              <span>{receipt.timestamp.toLocaleDateString()}</span>
              <span>{receipt.timestamp.toLocaleTimeString()}</span>
            </div>
          </div>
          
          <p className="text-center text-xs text-slate-500 font-normal max-w-xs mx-auto">
            You may now safely close this window. Your script has been encrypted and synced to the cloud.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9F9F7] p-8 font-sans">
      <div className="max-w-3xl w-full grid grid-cols-1 md:grid-cols-5 gap-8 items-center">
        <div className="md:col-span-2 space-y-6">
          <div className="h-12 w-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-medium shadow-xl shadow-blue-600/30">
            G
          </div>
          <h1 className="text-5xl font-semibold tracking-tighter text-slate-800 leading-[0.9]">Assessment Ready.</h1>
          <p className="text-slate-500 font-normal text-lg leading-relaxed">
            You are securely linked to the <span className="text-slate-800">School Local Network</span>. Proceed with academic integrity.
          </p>
        </div>

        <div className="md:col-span-3 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-10 space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-slate-800">{exam.title}</h2>
            <div className="flex items-center gap-4 text-xs font-medium text-slate-400 tracking-wider">
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {exam.duration / 60} MINS</span>
              <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> {exam.questions.length} QUESTIONS</span>
            </div>
          </div>

          <div className="bg-[#F9F9F7] rounded-2xl p-6 border border-slate-100 space-y-4">
            <p className="text-sm text-slate-500 leading-relaxed font-medium">
              {exam.instructions || "Read each question carefully before submitting your final answer."}
            </p>
          </div>

          <div className="flex items-center gap-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
            <UserIcon className="w-5 h-5 text-blue-600" />
            <div className="flex-1">
              <p className="text-[10px] text-blue-400 font-medium uppercase tracking-widest">Logged in As</p>
              <p className="text-sm font-medium text-blue-900">{connection.studentId}</p>
            </div>
            <button 
              onClick={() => { setConnection(null); LocalStore.remove(StorageKeys.CONNECTION_DATA); }}
              className="p-2 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <button 
            onClick={() => setInExam(true)}
            className="w-full flex items-center justify-center gap-3 bg-[#1E1E1E] hover:bg-black text-white font-semibold py-5 rounded-[1.25rem] transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98]"
          >
            START ASSESSMENT
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
