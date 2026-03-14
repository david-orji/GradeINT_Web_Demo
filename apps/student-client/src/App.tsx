import { useState, useEffect } from "react";
import "./App.css";
import { Connect } from "./pages/Connect";
import { ConnectionState, LocalAPIClient } from "./lib/local-api";
import { LocalStore, StorageKeys, saveExamPackage, getExamPackage, saveAnswers, getAnswers } from "./lib/db";
import { Loader2, CheckCircle2 } from "lucide-react";
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
      // SQLite local persistence
      await saveAnswers(answers);
      // Network push
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
      // Ensure final local state is captured
      await saveAnswers(answers);
      // Send final submission request to Sidecar API
      const client = new LocalAPIClient(connection.serverIp);
      await client.autosave(connection.studentId, answers); // Final sync
      const res = await client.submitExam(connection.studentId);
      
      // If success, clear local DB tracking and show receipt
      await LocalStore.remove(StorageKeys.SUBMISSION_STATE);
      await LocalStore.remove(StorageKeys.CONNECTION_DATA);
      await LocalStore.remove(StorageKeys.EXAM_PACKAGE);
      setInExam(false);
      
      // Store local receipt payload for rendering
      setReceipt({ message: res.message, timestamp: new Date() });

    } catch (err: any) {
      setError("Submission Failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="p-6 bg-white border border-red-200 rounded-xl text-center space-y-4 shadow-sm">
          <p className="text-red-600 font-medium">{error}</p>
          <button 
            onClick={() => { setError(null); setConnection(null); setInExam(false); }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium border border-slate-200"
          >
            Start Over
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 font-sans text-center">
        <div className="max-w-md w-full p-8 border-t-4 border-green-500 bg-white rounded-2xl shadow-xl space-y-6">
          <div className="h-16 w-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-100 shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Submission Perfect!</h1>
          
          <div className="space-y-4 bg-slate-50 p-6 rounded-xl border border-slate-200 text-left">
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Candidate</p>
              <p className="text-lg font-bold text-slate-900">{connection.studentId}</p>
            </div>
            <div className="h-px w-full bg-slate-200" />
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Server Response</p>
              <p className="text-sm font-medium text-green-700 bg-green-100 px-3 py-1.5 rounded-lg inline-block mt-1">{receipt.message}</p>
            </div>
            <div className="h-px w-full bg-slate-200" />
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Timestamp</p>
              <p className="text-sm font-mono text-slate-700">{receipt.timestamp.toLocaleString()}</p>
            </div>
          </div>
          
          <p className="text-sm text-slate-500 font-medium pt-2">
            You may now safely close this window.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center font-sans">
      <h1 className="text-3xl font-extrabold text-slate-900 mb-2">{exam.title}</h1>
      <p className="text-slate-600 mb-8 whitespace-pre-wrap max-w-2xl font-medium">{exam.instructions}</p>
      
      <div className="p-8 border border-blue-100 bg-white rounded-2xl w-full max-w-2xl shadow-xl">
        <h2 className="text-2xl text-blue-700 font-bold">Ready to Begin</h2>
        <p className="text-slate-600 mt-3 font-medium">
          You are securely connected to the local exam network as <span className="text-blue-900 font-bold bg-blue-50 px-2 py-1 rounded">{connection.studentId}</span>.
        </p>
        <div className="flex justify-center gap-4 mt-8">
          <div className="py-2 px-4 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-sm text-slate-500 font-bold uppercase tracking-wider">Duration</p>
            <p className="text-lg text-slate-900 font-bold">{exam.duration / 60} minutes</p>
          </div>
          <div className="py-2 px-4 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-sm text-slate-500 font-bold uppercase tracking-wider">Questions</p>
            <p className="text-lg text-slate-900 font-bold">{exam.questions.length}</p>
          </div>
        </div>
        <button 
          onClick={() => setInExam(true)}
          className="mt-8 w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-xl transition-colors shadow-md shadow-blue-600/20"
        >
          Start Assessment
        </button>
      </div>
    </div>
  );
}

export default App;
