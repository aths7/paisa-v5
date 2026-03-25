import {
  deriveKey,
  encryptField,
  decryptField,
  decryptNumber,
  isEncrypted,
} from "@/services/encryptionService";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { firestore } from "@/config/firebase";
import { StreakType, StreakHistoryEntry, StreakUpdateResult } from "@/types";

// ---------------------------------------------------------------------------
// Date helpers — always use LOCAL date components, never toISOString() which
// returns UTC and would shift the day boundary for users in UTC+ offsets.
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");

const getTodayString = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const getYesterdayString = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// ---------------------------------------------------------------------------
// Encrypt / decrypt helpers for the streak doc
// All scalar fields and history JSON are encrypted.
// Only updatedAt (server timestamp) stays plaintext.
// ---------------------------------------------------------------------------

const encryptStreakDoc = (streak: StreakType, key: string): object => ({
  currentStreak: encryptField(streak.currentStreak, key),
  longestStreak: encryptField(streak.longestStreak, key),
  lastEntryDate: encryptField(streak.lastEntryDate, key),
  streakStartDate: encryptField(streak.streakStartDate, key),
  history: encryptField(JSON.stringify(streak.history), key),
  updatedAt: serverTimestamp(),
});

const decryptStreakDoc = (raw: any, key: string): StreakType => {
  let currentStreak = 0;
  let longestStreak = 0;
  let history: StreakHistoryEntry[] = [];
  let lastEntryDate = "";
  let streakStartDate = "";

  if (raw.currentStreak) {
    currentStreak = isEncrypted(raw.currentStreak)
      ? decryptNumber(raw.currentStreak, key)
      : Number(raw.currentStreak);
  }

  if (raw.longestStreak) {
    longestStreak = isEncrypted(raw.longestStreak)
      ? decryptNumber(raw.longestStreak, key)
      : Number(raw.longestStreak);
  }

  if (raw.lastEntryDate) {
    lastEntryDate = isEncrypted(raw.lastEntryDate)
      ? decryptField(raw.lastEntryDate, key)
      : raw.lastEntryDate;
  }

  if (raw.streakStartDate) {
    streakStartDate = isEncrypted(raw.streakStartDate)
      ? decryptField(raw.streakStartDate, key)
      : raw.streakStartDate;
  }

  if (raw.history) {
    try {
      const historyJson = isEncrypted(raw.history)
        ? decryptField(raw.history, key)
        : raw.history;
      history = JSON.parse(historyJson);
    } catch {
      history = [];
    }
  }

  return {
    currentStreak,
    longestStreak,
    lastEntryDate,
    streakStartDate,
    history,
    updatedAt: raw.updatedAt,
  };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches and decrypts streak data for a given user.
 * Returns null if no streak doc exists yet (new user).
 */
export const getStreakData = async (uid: string): Promise<StreakType | null> => {
  try {
    const key = deriveKey(uid);
    const streakRef = doc(firestore, "users", uid, "streaks", "current");
    const snap = await getDoc(streakRef);
    if (!snap.exists()) return null;
    return decryptStreakDoc(snap.data(), key);
  } catch (error) {
    console.error("Error fetching streak data:", error);
    return null;
  }
};

/**
 * Evaluates and persists the streak for a new transaction entry.
 * Must only be called for new transactions — never for edits.
 *
 * Returns a StreakUpdateResult:
 *  - isFirstToday: false → already logged today, caller should skip modal
 *  - action: "first_entry" | "continued" | "restarted"
 *
 * Never throws — streak failure is non-critical. On persistent failure returns
 * a safe fallback so the UI silently skips celebration.
 */
export const updateStreakOnEntry = async (uid: string): Promise<StreakUpdateResult> => {
  const attemptUpdate = async (): Promise<StreakUpdateResult> => {
    const key = deriveKey(uid);
    const today = getTodayString();
    const yesterday = getYesterdayString();

    const streakRef = doc(firestore, "users", uid, "streaks", "current");
    const snap = await getDoc(streakRef);

    // Case A — no streak doc yet (first ever transaction)
    if (!snap.exists()) {
      const newStreak: StreakType = {
        currentStreak: 1,
        longestStreak: 1,
        lastEntryDate: today,
        streakStartDate: today,
        history: [],
      };
      await setDoc(streakRef, encryptStreakDoc(newStreak, key), { merge: false });
      return { action: "first_entry", newStreak: 1, isFirstToday: true };
    }

    const existing = decryptStreakDoc(snap.data(), key);

    // Case B — already logged today, no change
    if (existing.lastEntryDate === today) {
      return {
        action: existing.currentStreak === 1 && existing.streakStartDate === today
          ? "first_entry"
          : "continued",
        newStreak: existing.currentStreak,
        isFirstToday: false,
      };
    }

    // Case C — logged yesterday, streak continues
    if (existing.lastEntryDate === yesterday) {
      const newCount = existing.currentStreak + 1;
      const updated: StreakType = {
        ...existing,
        currentStreak: newCount,
        longestStreak: Math.max(newCount, existing.longestStreak),
        lastEntryDate: today,
      };
      await setDoc(streakRef, encryptStreakDoc(updated, key), { merge: true });
      return { action: "continued", newStreak: newCount, isFirstToday: true };
    }

    // Case D — gap > 1 day (streak broken), quiet restart
    const brokenEntry: StreakHistoryEntry = {
      streak: existing.currentStreak,
      endedOn: existing.lastEntryDate,
    };
    const updatedHistory = [brokenEntry, ...existing.history].slice(0, 2);

    const restarted: StreakType = {
      currentStreak: 1,
      longestStreak: existing.longestStreak, // longestStreak never decreases
      lastEntryDate: today,
      streakStartDate: today,
      history: updatedHistory,
    };
    // merge: false to fully replace — prevents stale streakStartDate from surviving
    await setDoc(streakRef, encryptStreakDoc(restarted, key), { merge: false });
    return { action: "restarted", newStreak: 1, isFirstToday: true };
  };

  try {
    return await attemptUpdate();
  } catch (firstError) {
    console.warn("Streak update failed, retrying once:", firstError);
    try {
      return await attemptUpdate();
    } catch (retryError) {
      console.error("Streak update retry failed:", retryError);
      return { action: "first_entry", newStreak: 0, isFirstToday: false };
    }
  }
};
