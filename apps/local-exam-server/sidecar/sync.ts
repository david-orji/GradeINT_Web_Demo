import { db, log } from "./server.js";
import * as schema from "./schema.js";
import { eq } from "drizzle-orm";
import { SubmissionEnvelope } from "@gradeint/shared-types";
import { checksumObject } from "@gradeint/shared-utils";

let currentCloudUrl = process.env.CLOUD_URL || "http://localhost:5000";

/**
 * Updates the Cloud URL used by the sync worker.
 */
export function setCloudUrl(url: string) {
  if (!url) return;
  // Normalize: ensure no trailing slash
  currentCloudUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  log(`[SYNC] Target Cloud updated to: ${currentCloudUrl}`);
}

/**
 * Periodically attempts to sync unsynced submissions to the Cloud Web App.
 */
export function startCloudSyncWorker() {
  const SYNC_INTERVAL_MS = 15000; // Try sweeping every 15s
  log(`[SYNC] Worker started. Initial Target: ${currentCloudUrl}`);

  setInterval(async () => {
    try {
      // Grab all submissions using synchronous better-sqlite3
      const subs = db.select().from(schema.submissions).all();
      if (subs.length === 0) return;

      const envelopes: { id: number; envelope: SubmissionEnvelope }[] = [];

      for (const sub of subs) {
        // Skip already synced
        if (sub.synced_at) continue;

        const session = db.select().from(schema.sessions).where(eq(schema.sessions.id, sub.session_id)).get();
        if (!session) continue;

        const exam = db.select().from(schema.exams).where(eq(schema.exams.id, session.exam_id)).get();
        if (!exam) continue;

        const answers = JSON.parse(sub.answers);

        // Map local state to standard SubmissionEnvelope state
        // The cloud specifically checks for 'sealed' to mark it as a final 'submitted' record in its DB.
        const state = sub.sealed_at ? "sealed" : "in_progress";

        const envelope: SubmissionEnvelope = {
          submissionId: `local-${sub.id}-${sub.student_id}`, // temporary stable ID
          sessionId: session.session_code,
          examId: exam.cloud_exam_id,
          studentId: sub.student_id,
          submissionState: state,
          answers,
          checksum: "",
          // optional fields for MVP
          deviceId: "LAN-CLIENT",
          sessionToken: "LAN-AUTH",
          attemptNumber: 1,
          examStartedAt: new Date(session.activated_at! * 1000).toISOString(),
          lastAutosavedAt: new Date().toISOString(),
        };

        envelope.checksum = await checksumObject(envelope);
        envelopes.push({ id: sub.id, envelope });
      }

      if (envelopes.length === 0) return;

      log(`[SYNC] Attempting to push ${envelopes.length} submissions to Cloud...`);

      // Extract just the envelopes for the payload
      const payload = envelopes.map(e => e.envelope);

      const res = await fetch(`${currentCloudUrl}/api/lan/sync/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "Unknown error");
        log(`[SYNC] Rejection from Cloud: Status ${res.status} - ${errorText}`);
      } else {
        const data = await res.json();
        log(`[SYNC] Successfully synced ${data.synced} submissions to Cloud.`);
        
        // Mark as synced locally
        const now = Math.floor(Date.now() / 1000);
        for (const { id } of envelopes) {
          db.update(schema.submissions)
            .set({ synced_at: now })
            .where(eq(schema.submissions.id, id))
            .run();
        }
      }

    } catch (err: any) {
      log(`[SYNC] Network offline or Cloud unreachable... Will retry next window. (${err.message})`);
    }
  }, SYNC_INTERVAL_MS);
}
