import { ExamPackage } from "@gradeint/shared-types";

export interface ConnectionState {
  serverIp: string;
  sessionCode: string;
  studentId: string;
  submissionId: string | null;
}

/**
 * Handles communication with the Local School Exam Server
 */
export class LocalAPIClient {
  private baseUrl: string;

  constructor(serverIp: string) {
    this.baseUrl = `http://${serverIp}:4000/api/student`;
  }

  /**
   * Ping the local server to verify connection and session validity.
   */
  async joinSession(accessCode: string, studentId: string): Promise<{ sessionId: string }> {
    const res = await fetch(`${this.baseUrl}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Sidecar expects studentName, we'll send studentId as name for now
      body: JSON.stringify({ sessionCode: accessCode, studentId, studentName: studentId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || "Failed to join session. Check IP and Access Code.");
    }

    return res.json();
  }

  /**
   * Fetch the exam package cached on the local server.
   */
  async fetchExamPackage(sessionCode: string): Promise<ExamPackage> {
    const res = await fetch(`${this.baseUrl}/exam/${sessionCode}`);
    if (!res.ok) {
      throw new Error("Failed to download exam package from local server.");
    }
    return res.json();
  }

  /**
   * Periodically push the latest answers state to the local server
   */
  async autosave(sessionCode: string, studentId: string, answers: any[]): Promise<void> {
    const res = await fetch(`${this.baseUrl}/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionCode, studentId, studentName: studentId, answers }),
    });
    if (!res.ok) throw new Error("Autosave sync failed");
  }

  /**
   * Tell the local server the candidate is done, seal the exam and receive a receipt
   */
  async submitExam(sessionCode: string, studentId: string): Promise<{ success: boolean, receipt: string }> {
    const res = await fetch(`${this.baseUrl}/submissions/seal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionCode, studentId }),
    });
    
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to finalize submission");
    }
    return res.json();
  }
}
