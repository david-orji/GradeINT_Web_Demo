import { db } from "./server.js";
import * as schema from "./schema.js";
import { eq } from "drizzle-orm";
import { SubmissionEnvelope } from "@gradeint/shared-types";
import { checksumObject } from "@gradeint/shared-utils";

const CLOUD_URL = process.env.CLOUD_URL || "http://localhost:5000";

/**
 * Periodically attempts to sync unsynced submissions to the Cloud Web App.
 */
export function startCloudSyncWorker() {
  const SYNC_INTERVAL_MS = 15000; // Try sweeping every 15s

  setInterval(async () => {
    try {
      // Grab all submissions using synchronous better-sqlite3
      const subs = db.select().from(schema.submissions).all();
      if (subs.length === 0) return;

      const envelopes: SubmissionEnvelope[] = [];

      for (const sub of subs) {
        const session = db.select().from(schema.sessions).where(eq(schema.sessions.id, sub.sessionId)).get();
        if (!session) continue;

        const exam = db.select().from(schema.exams).where(eq(schema.exams.id, session.examId)).get();
        if (!exam) continue;

        const answers = JSON.parse(sub.answersData);

        const envelope: SubmissionEnvelope = {
          examId: parseInt(exam.cloudExamId),
          studentId: sub.studentId,
          submissionState: sub.status === "sealed" ? "submitted" : "in_progress",
          answers,
          checksum: ""
        };

        envelope.checksum = await checksumObject(envelope);
        envelopes.push(envelope);
      }

      if (envelopes.length === 0) return;

      const res = await fetch(`${CLOUD_URL}/api/lan/sync/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(envelopes)
      });

      if (!res.ok) {
        console.warn(`[SYNC] Rejection from Cloud: Status ${res.status}`);
      } else {
        const data = await res.json();
        console.log(`[SYNC] Successfully synced ${data.synced} submissions to Cloud.`);
      }

    } catch (err: any) {
      console.warn(`[SYNC] Network offline or Cloud unreachable... Will retry next window. (${err.message})`);
    }
  }, SYNC_INTERVAL_MS);
}
