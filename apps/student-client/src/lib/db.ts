import { ExamPackage } from "@gradeint/shared-types";

const DB_NAME = "GradeINT_StudentDB";
const STORE_NAME = "keyval";

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const LocalStore = {
  async set(key: string, val: any): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(val, key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async get<T>(key: string): Promise<T | null> {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(key);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  },

  async clear(): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async remove(key: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};

// Typed Helpers
export const StorageKeys = {
  EXAM_PACKAGE: "exam_package",
  SUBMISSION_STATE: "submission_state",
  CONNECTION_DATA: "connection_data"
};

export async function saveExamPackage(pkg: ExamPackage) {
  await LocalStore.set(StorageKeys.EXAM_PACKAGE, pkg);
}

export async function getExamPackage(): Promise<ExamPackage | null> {
  return LocalStore.get<ExamPackage>(StorageKeys.EXAM_PACKAGE);
}

// Any type here to avoid circular dep with Exam.tsx, but it will be AnswerState[]
export async function saveAnswers(answers: any[]) {
  await LocalStore.set(StorageKeys.SUBMISSION_STATE, answers);
}

export async function getAnswers(): Promise<any[] | null> {
  return LocalStore.get<any[]>(StorageKeys.SUBMISSION_STATE);
}
