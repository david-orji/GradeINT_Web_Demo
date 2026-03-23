// =============================================================================
// GradeINT — Shared Utilities
// Hashing, timestamps, ID generation
// =============================================================================

/**
 * Provides a cross-environment `crypto` object.
 * Safely evaluates require to bypass browser bundlers.
 */
function getCrypto(): Crypto {
  const g = globalThis as any;
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) return crypto;
  if (g.crypto && g.crypto.randomUUID) return g.crypto as Crypto;

  try {
    // A Vite-compatible way to dynamically require native Node modules in pkg
    // @ts-ignore
    const req = typeof module !== 'undefined' && module.require ? module.require : require;
    const c = req('crypto');
    if (c && c.webcrypto) return c.webcrypto;
    return c;
  } catch (e) {
    // ignore
  }
  
  throw new Error("crypto is not defined. Ensure you are on Node 19+ or a modern browser.");
}

/**
 * Generate a version-4 UUID.
 * Works in both Node.js (>=19) and browser environments.
 */
export function generateId(): string {
  const c = getCrypto();
  return c.randomUUID();
}

/**
 * Return the current time as an ISO 8601 string.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Compute a SHA-256 hash of the given string and return it as a hex string.
 * Works in both Node.js and browser (via Web Crypto API).
 */
export async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const c = getCrypto();
  const hashBuffer = await c.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Produce a canonical, deterministic JSON string from an object.
 * Sorts keys alphabetically so the same object always produces the same string.
 */
export function canonicalJson(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as Record<string, unknown>).sort());
}

/**
 * Compute the SHA-256 checksum of a plain object (e.g. an ExamPackage or
 * SubmissionEnvelope) by first serialising it to canonical JSON.
 */
export async function checksumObject(
  obj: unknown,
  excludeKeys: string[] = ['checksum'],
): Promise<string> {
  // Remove excluded keys before hashing
  const clone = { ...(obj as Record<string, unknown>) };
  for (const key of excludeKeys) {
    delete clone[key];
  }
  return sha256Hex(canonicalJson(clone));
}

/**
 * Verifies that the checksum field on an object matches a freshly-computed hash.
 */
export async function verifyChecksum(
  obj: Record<string, unknown>,
  checksumField = 'checksum',
): Promise<boolean> {
  const expected = obj[checksumField] as string;
  const actual = await checksumObject(obj, [checksumField]);
  return expected === actual;
}

/**
 * Generate a short human-readable session code (e.g. "EXAM-7842").
 */
export function generateSessionCode(prefix = 'EXAM'): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
}
