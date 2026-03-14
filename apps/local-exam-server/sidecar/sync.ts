import { db } from "./server.js";
import * as schema from "./schema.js";
import { eq } from "drizzle-orm";
import { SubmissionEnvelope } from "@gradeint/shared-types";
import { checksumObject } from "@gradeint/shared-utils";

const CLOUD_URL = "http://localhost:5000";

/**
 * Periodically attempts to sync unsynced submissions to the Cloud Web App.
 */
export function startCloudSyncWorker() {
  const SYNC_INTERVAL_MS = 15000; // Try sweeping every 15s

  setInterval(async () => {
    try {
      // Find submissions that are 'in_progress' or 'sealed' that haven't been synced in the last X seconds 
      // OR just continuously push updates.
      // For MVP, we will grab all submissions from active/closed sessions.
      
      const subs = await db.select().from(schema.submissions);
      if (subs.length === 0) return;

      const envelopes: SubmissionEnvelope[] = [];

      for (const sub of subs) {
        // Find associated session to get exam accessCode
        const session = await db.select().from(schema.sessions).where(eq(schema.sessions.id, sub.sessionId)).get();
        if (!session) continue;
        
        const exam = await db.select().from(schema.exams).where(eq(schema.exams.id, session.examId)).get();
        if (!exam) continue;

        // Parse local stringified answers
        const answers = JSON.parse(sub.answersData);

        const envelope: SubmissionEnvelope = {
          examId: parseInt(exam.cloudExamId), // The cloud's primary ID mapped dynamically
          studentId: sub.studentId,
          submissionState: sub.status === "sealed" ? "submitted" : "in_progress", // Map local state to cloud state
          answers,
          checksum: ""
        };

        // Cryptographically sign the envelope
        envelope.checksum = await checksumObject(envelope);
        envelopes.push(envelope);
      }

      if (envelopes.length === 0) return;

      // POST to cloud sync endpoint
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
        if (data.synced === 0) {
           console.log(`[SYNC DEBUG] Cloud echo received:`, JSON.stringify(data, null, 2));
        }
      }

    } catch (err: any) {
      console.warn(`[SYNC] Network offline or Cloud unreachable... Will retry next window. (${err.message})`);
    }
  }, SYNC_INTERVAL_MS);
}
