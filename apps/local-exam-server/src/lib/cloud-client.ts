import { ExamPackage } from "@gradeint/shared-types";
import { verifyChecksum } from "@gradeint/shared-utils";

// In production, this would be an environment variable or a configuration setting.
// For MVP Phase 3 testing, we hardcode the local development cloud server address.
const CLOUD_URL = "http://127.0.0.1:5000";

export class CloudClient {
  /**
   * Login as a teacher to authorize the local server.
   */
  static async login(username: string, password: string): Promise<boolean> {
    const res = await fetch(`${CLOUD_URL}/api/lan/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    
    if (!res.ok) {
      throw new Error("Invalid operator credentials");
    }
    
    return true;
  }

  /**
   * Download an ExamPackage by its access code and verify its integrity.
   */
  static async downloadExamPackage(accessCode: string): Promise<ExamPackage> {
    const res = await fetch(`${CLOUD_URL}/api/lan/exams/${accessCode}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to download exam package");
    }

    const pkg: ExamPackage = await res.json();

    // Verify cryptographic integrity
    const isValid = await verifyChecksum(pkg as unknown as Record<string, unknown>);
    if (!isValid) {
      throw new Error("Exam Package integrity check failed. Data may be corrupted.");
    }

    return pkg;
  }
}
