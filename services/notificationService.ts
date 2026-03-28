import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOTIFICATION_ID = "daily-entry-reminder";
const REMINDER_HOUR = 21; // 9 PM local time
const BATCH_SIZE = 7;
const BATCH_REFILL_THRESHOLD = 2;

// AsyncStorage keys
const BATCH_KEY = "@paisa/notification_batch"; // string[] of AI-generated messages
const DAILY_MSG_KEY = "@paisa/notification_daily_msg"; // { date: string; body: string }
const SUPPRESSED_KEY = "@paisa/notification_suppressed"; // "YYYY-MM-DD" when already logged today

// Fallback messages used when the AI batch is empty or the API is unreachable
const FALLBACK_MESSAGES = [
  "How did today's spending go? Worth a quick log.",
  "A minute to track today keeps the mystery away.",
  "Your future self will thank you for logging today.",
  "Anything worth buying is worth remembering. Log it?",
  "Quick check-in — today's expenses won't track themselves.",
  "Small entries add up to big clarity. Log today?",
  "Today's spending, captured. Tomorrow's you will appreciate it.",
];

// ---------------------------------------------------------------------------
// Configure how notifications are presented when the app is in the foreground.
// This runs at module-load time so it is always set before any notification fires.
// ---------------------------------------------------------------------------
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const toDateStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Pop the next message off the stored batch.  Falls back to a random static message. */
const popFromBatch = async (): Promise<string> => {
  try {
    const raw = await AsyncStorage.getItem(BATCH_KEY);
    if (raw) {
      const msgs: string[] = JSON.parse(raw);
      if (msgs.length > 0) {
        const [next, ...rest] = msgs;
        await AsyncStorage.setItem(BATCH_KEY, JSON.stringify(rest));
        return next;
      }
    }
  } catch {
    // Fall through to fallback
  }
  return FALLBACK_MESSAGES[Math.floor(Math.random() * FALLBACK_MESSAGES.length)];
};

/**
 * Returns today's notification body.
 * Reuses the same message for the entire day so multiple reschedule calls
 * don't burn through the batch unnecessarily.
 */
const getTodayMessage = async (): Promise<string> => {
  const today = toDateStr();
  try {
    const raw = await AsyncStorage.getItem(DAILY_MSG_KEY);
    if (raw) {
      const saved: { date: string; body: string } = JSON.parse(raw);
      if (saved.date === today) return saved.body;
    }
    const msg = await popFromBatch();
    await AsyncStorage.setItem(DAILY_MSG_KEY, JSON.stringify({ date: today, body: msg }));
    return msg;
  } catch {
    return FALLBACK_MESSAGES[0];
  }
};

/** Schedule a one-time notification for tomorrow at REMINDER_HOUR. */
const scheduleTomorrow = async (body: string): Promise<void> => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(REMINDER_HOUR, 0, 0, 0);
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: { title: "Paisa", body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: tomorrow,
    },
  });
};

/** Schedule a daily repeating notification at REMINDER_HOUR every day. */
const scheduleDaily = async (body: string): Promise<void> => {
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: { title: "Paisa", body, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: REMINDER_HOUR,
      minute: 0,
    },
  });
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Request local notification permissions.
 * Safe to call on every app launch — shows the system dialog only once.
 * Returns true if permission is granted.
 */
export const requestPermissions = async (): Promise<boolean> => {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch (err) {
    console.warn("[notificationService] requestPermissions failed:", err);
    return false;
  }
};

/**
 * Fetch a fresh batch of AI-generated notification messages from the
 * Anthropic API and store them in AsyncStorage.
 *
 * Only runs when the batch is running low (fewer than BATCH_REFILL_THRESHOLD).
 * Call this in the foreground (e.g. on app startup or after a transaction is
 * saved) — never at notification trigger time.
 */
export const refreshMessageBatch = async (): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(BATCH_KEY);
    const existing: string[] = raw ? JSON.parse(raw) : [];
    if (existing.length >= BATCH_REFILL_THRESHOLD) return;

    const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn("[notificationService] EXPO_PUBLIC_ANTHROPIC_API_KEY is not set — skipping batch refresh");
      return;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        messages: [
          {
            role: "user",
            content:
              `You are writing push notification messages for "Paisa", a personal finance tracking app. ` +
              `The user has not yet logged any expenses today and the notification is a gentle evening nudge.\n\n` +
              `Generate exactly ${BATCH_SIZE} short notification body messages.\n\n` +
              `Rules:\n` +
              `- Each message must be under 100 characters\n` +
              `- Warm, non-guilt-tripping, and human — never make the user feel bad\n` +
              `- No emojis\n` +
              `- Rotate between these tones across the ${BATCH_SIZE} messages: gentle humor, encouragement, curiosity, warmth\n` +
              `- One message per line\n` +
              `- No numbering, no bullet points, no quotes, no prefixes — just the plain message text\n\n` +
              `Output exactly ${BATCH_SIZE} lines and nothing else.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.warn("[notificationService] Anthropic API error:", response.status);
      return;
    }

    const data = await response.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const newMessages = text
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l.length > 0 && l.length <= 100)
      .slice(0, BATCH_SIZE);

    if (newMessages.length === 0) return;

    await AsyncStorage.setItem(BATCH_KEY, JSON.stringify([...existing, ...newMessages]));
  } catch (err) {
    // Non-critical — fallback messages will be used
    console.warn("[notificationService] refreshMessageBatch failed:", err);
  }
};

/**
 * Set up (or restore) the daily 9 PM reminder.
 *
 * - If the user already logged a transaction today the reminder is pushed to
 *   tomorrow so it doesn't fire today.
 * - Call this on every authenticated app launch to keep the schedule fresh.
 */
export const rescheduleReminders = async (): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID).catch(() => {});

    const suppressed = await AsyncStorage.getItem(SUPPRESSED_KEY);
    const message = await getTodayMessage();

    if (suppressed === toDateStr()) {
      // Already logged today — schedule one-time for tomorrow
      await scheduleTomorrow(message);
    } else {
      // Normal cadence — daily repeating trigger
      await scheduleDaily(message);
    }
  } catch (err) {
    console.warn("[notificationService] rescheduleReminders failed:", err);
  }
};

/**
 * Cancel today's 9 PM reminder and push it to tomorrow.
 *
 * Call this whenever a new transaction is saved for the current day.
 * The suppressed date is stored so that if the user reopens the app before
 * 9 PM the reminder is not accidentally restored for today.
 */
export const suppressTodayReminder = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(SUPPRESSED_KEY, toDateStr());
    await rescheduleReminders();
  } catch (err) {
    console.warn("[notificationService] suppressTodayReminder failed:", err);
  }
};

/**
 * Cancel all scheduled reminders (e.g. from a settings toggle).
 * Call `rescheduleReminders()` to re-enable.
 */
export const cancelAllReminders = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.warn("[notificationService] cancelAllReminders failed:", err);
  }
};
