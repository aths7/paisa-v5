# Low Level Design: Streak Gamification Module

> Status: **Pending Review** — Do not implement until approved.
> Last updated: 2026-03-25

---

## Table of Contents

1. [Scope](#1-scope)
2. [Goals and Rules](#2-goals-and-rules)
3. [Data Model](#3-data-model)
4. [Encryption Plan](#4-encryption-plan)
5. [Firestore Security Rules](#5-firestore-security-rules)
6. [Service Layer](#6-service-layer)
7. [Entry Creation Flow](#7-entry-creation-flow)
8. [UI Surfaces](#8-ui-surfaces)
9. [State and Event Flow](#9-state-and-event-flow)
10. [Edge Cases](#10-edge-cases)
11. [Account Deletion Cleanup](#11-account-deletion-cleanup)
12. [File Change Summary](#12-file-change-summary)
13. [Testing Plan](#13-testing-plan)
14. [Open Decisions](#14-open-decisions)
15. [Implementation Order](#15-implementation-order)

---

## 1. Scope

Add a V1 gamification module centered on a daily streak:

- A streak increments when the user adds their first new entry of the calendar day.
- Any additional entries on the same day should still trigger success delight (`confetti` + `haptic`) but must not increment the streak again.
- If the user misses one or more days, the next qualifying day starts a new streak at `1`.
- Keep history for the last `2` completed streaks.
- Show a streak home card on Home that links to a dedicated streak details modal.
- Show a dedicated streak celebration modal only for the first qualifying entry of the day.
- Preserve the app's current encryption model for any sensitive streak data persisted in Firestore.

This LLD is for architecture and implementation planning only. It assumes the UI views will be built from Stitch-generated screen references, but there is no Stitch runtime integration in the current repo.

---

## 2. Goals and Rules

### 2.1 Product Rules

**Definition of entry**

For V1, an "entry" means a newly created transaction saved through `createOrUpdateTransaction()` from `services/transactionService.ts`.

Edits to an existing transaction do not count as a new entry.

Deletes do not retroactively recalculate streak history in V1.

### 2.2 Streak Rules

Let `entryDayKey` be the user-local calendar day in `YYYY-MM-DD` format.

Rules:

1. If no previous streak activity exists, the first successful new entry sets:
   - `currentStreak = 1`
   - `lastEntryDayKey = today`
   - `longestStreak = 1`
   - `streakStartDate = today`

2. If `lastEntryDayKey === today`:
   - streak does not increment
   - success delight still runs (confetti + haptic)
   - streak celebration modal does not show

3. If `lastEntryDayKey === yesterday`:
   - `currentStreak += 1`
   - `lastEntryDayKey = today`
   - `longestStreak = max(longestStreak, currentStreak)`
   - streak celebration modal shows with continuation copy

4. If the gap is `>= 2` days:
   - previous streak is archived into history
   - `currentStreak = 1`
   - `lastEntryDayKey = today`
   - `streakStartDate = today`
   - streak celebration modal shows with restart copy, not continuation copy

5. Store at most the last `2` completed streaks in reverse chronological order.

### 2.3 Reward / Milestone Rules

Rewards are display-only in V1. No wallet credit, badge unlock persistence, or redemption flow is included.

Milestone days:

- Day 7 — "Week Warrior"
- Day 14 — "Fortnight Focus"
- Day 21 — "Habit Maker"
- Day 30 — "Monthly Master"
- Day 60 — "Diamond Discipline"
- Day 90 — "Quarter Champion"

These live in a local constant (`constants/milestones.ts`) so the Home streak card, streak details modal, and celebration modal are all driven by the same config.

---

## 3. Data Model

### 3.1 Type Additions — `types.ts`

Add new types:

```ts
export type StreakHistoryEntry = {
  streak: number;
  endedOn: string; // "YYYY-MM-DD"
};

export type MilestoneConfig = {
  days: number;
  label: string;
  icon: string; // phosphor-react-native icon name
  description: string;
};

export type StreakType = {
  currentStreak: number;
  longestStreak: number;
  lastEntryDate: string; // "YYYY-MM-DD"
  streakStartDate: string; // "YYYY-MM-DD"
  history: StreakHistoryEntry[]; // max 2, newest first
  updatedAt?: any;
};

export type StreakUpdateResult = {
  action: "first_entry" | "continued" | "restarted";
  newStreak: number;
  isFirstToday: boolean; // false = already logged today, suppress modal
};
```

### 3.2 Firestore Shape

Path: `users/{uid}/streaks/current`

This is a single fixed-ID document per user.

Reasoning:

- Streak is a user-level aggregate, not a transaction.
- A fixed document ID avoids query complexity and fits the single-doc-per-feature pattern.
- This avoids polluting the `users/{uid}` root doc with streak fields.
- Consistent with collection-per-feature patterns used by `wallets` and `transactions`.

### 3.3 Persisted Document

```json
{
  "currentStreak": "<encrypted>",
  "longestStreak": "<encrypted>",
  "lastEntryDate": "<encrypted>",
  "streakStartDate": "<encrypted>",
  "history": "<encrypted>",
  "updatedAt": "2026-03-25T10:30:00.000Z"
}
```

`updatedAt` remains a plaintext server timestamp, consistent with existing operational fields.

### 3.4 Why streak fields should be encrypted

The repo already encrypts user names, wallet balances, transaction amounts, categories, and descriptions in `services/encryptionService.ts`. A streak record reveals behavioral cadence — how often a user opens the app and logs financial data. This is user activity metadata. It is not needed for cross-user querying or server-side filtering in V1, so it should stay encrypted at rest.

This includes `lastEntryDate` and `streakStartDate`. Although dates alone may seem non-sensitive, in context they reveal exactly when a user was financially active, which is behavioral data the app's privacy model is designed to protect.

---

## 4. Encryption Plan

### 4.1 Service Placement

Current encryption helpers are field-list driven and optimized for flat documents:

- `services/encryptionService.ts`
- `hooks/useDecryptedData.ts`

Because `history` is a JSON array, it cannot go through the generic `encryptDocument()` helper unchanged. The streak service will handle its own encrypt/decrypt.

### 4.2 Approach

Add dedicated helpers in `services/streakService.ts`:

```ts
encryptStreakDoc(streak: StreakType, key: string): object
decryptStreakDoc(raw: object, key: string): StreakType
```

These helpers should:

- Use `encryptField()` from `encryptionService.ts` for scalar fields
- Serialize `history` array as `JSON.stringify(arr)`, then encrypt the entire string as one field
- On decrypt, use `decryptField()` then `JSON.parse()` with a fallback to `[]`
- Use `decryptNumber()` for numeric fields (`currentStreak`, `longestStreak`)
- Leave `updatedAt` plaintext

### 4.3 Fields to Encrypt

Encrypt:

- `currentStreak` — `encryptField(String(n), key)`
- `longestStreak` — `encryptField(String(n), key)`
- `lastEntryDate` — `encryptField(dateString, key)`
- `streakStartDate` — `encryptField(dateString, key)`
- `history` — `encryptField(JSON.stringify(arr), key)`

Do not encrypt:

- `updatedAt`

### 4.4 Migration

No migration is required for existing users because this is a new document.

The service should lazily create the doc on first qualifying entry if it does not exist.

---

## 5. Firestore Security Rules

Add rules for the new `streaks` subcollection:

```javascript
match /users/{uid}/streaks/{docId} {
  // Only the authenticated user can read/write their own streak data
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

Key constraints:

- `{docId}` will always be `current` in V1, but the rule is written generically for the subcollection.
- No admin or cross-user access is needed — streak data is purely user-scoped.
- This is consistent with the existing security rules pattern used for `wallets` and `transactions` subcollections.
- Encrypted fields provide defense-in-depth even if rules are misconfigured.

These rules should be added to `firestore.rules` alongside existing user subcollection rules.

---

## 6. Service Layer

### 6.1 New Service — `services/streakService.ts`

This service owns all streak math so the modal/UI layer stays thin.

**Imports:**

```ts
import { deriveKey, encryptField, decryptField, decryptNumber, isEncrypted } from "@/services/encryptionService";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { firestore } from "@/config/firebase";
```

**Date helpers (local timezone — critical):**

```ts
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
```

Do not use `toISOString().split("T")[0]` — that returns UTC which would shift the day boundary for users in negative UTC offsets.

### 6.2 Internal Helpers

```ts
encryptStreakDoc(streak: StreakType, key: string): object
```

Encrypts `currentStreak`, `longestStreak`, `lastEntryDate`, `streakStartDate`, and `history` (as JSON string). Leaves `updatedAt` plain.

```ts
decryptStreakDoc(raw: object, key: string): StreakType
```

Decrypts the same fields. Safe-parses history JSON with fallback `[]`.

```ts
getStreakData(uid: string): Promise<StreakType | null>
```

Calls `getDoc` on `users/{uid}/streaks/current`. Returns `null` if doc doesn't exist. Decrypts and returns `StreakType` otherwise.

### 6.3 Core Function — `updateStreakOnEntry`

```ts
export const updateStreakOnEntry = async (uid: string): Promise<StreakUpdateResult>
```

Called after every successful new transaction (not edits).

**Algorithm:**

```
1. today = getTodayString()
2. yesterday = getYesterdayString()
3. derive encryption key from user context
4. getDoc users/{uid}/streaks/current

Case A — no doc exists:
  create {
    currentStreak: 1,
    longestStreak: 1,
    lastEntryDate: today,
    streakStartDate: today,
    history: []
  }
  encrypt and setDoc (merge: false)
  return { action: "first_entry", newStreak: 1, isFirstToday: true }

Case B — lastEntryDate === today:
  return { action: existing action, newStreak: existing.currentStreak, isFirstToday: false }
  // Caller skips confetti, haptic, and modal

Case C — lastEntryDate === yesterday:
  newCount = currentStreak + 1
  update {
    currentStreak: newCount,
    longestStreak: max(newCount, existing.longestStreak),
    lastEntryDate: today
  }
  encrypt and setDoc (merge: true)
  return { action: "continued", newStreak: newCount, isFirstToday: true }

Case D — gap > 1 day (streak broken):
  brokenEntry = { streak: currentStreak, endedOn: lastEntryDate }
  updatedHistory = [brokenEntry, ...existing.history].slice(0, 2)
  reset to {
    currentStreak: 1,
    longestStreak: existing.longestStreak, // never decreases
    streakStartDate: today,
    lastEntryDate: today,
    history: updatedHistory
  }
  encrypt and setDoc (merge: false) // full replace to clear stale streakStartDate
  return { action: "restarted", newStreak: 1, isFirstToday: true }
```

**Error handling:** Function never throws. All errors caught internally. On first failure, retry the streak update once. If the retry also fails, return `{ action: "first_entry", newStreak: 0, isFirstToday: false }` to silently skip the celebration modal. The transaction is already saved — streak failure is non-critical.

```ts
// Retry pattern inside updateStreakOnEntry:
const attemptStreakUpdate = async (): Promise<StreakUpdateResult> => {
  // ... core streak logic
};

try {
  return await attemptStreakUpdate();
} catch (firstError) {
  console.warn("Streak update failed, retrying once:", firstError);
  try {
    return await attemptStreakUpdate();
  } catch (retryError) {
    console.error("Streak update retry failed:", retryError);
    return { action: "first_entry", newStreak: 0, isFirstToday: false };
  }
}
```

### 6.4 Why This Must Be Service-Driven

The current transaction save path already centralizes create/update behavior in `services/transactionService.ts`. Streak evaluation must happen there, after a successful new transaction write, otherwise:

- Duplicate submissions could inflate streaks
- Future transaction entry surfaces would each need to duplicate logic
- The UI would not have a single source of truth for first-entry-of-day detection
- Encryption, persistence, history retention, and idempotency all stay in one place

---

## 7. Entry Creation Flow

### 7.1 Integration Point — `services/transactionService.ts`

Current flow:

1. Validate transaction
2. Update affected wallet totals
3. Upload image if present
4. Encrypt transaction
5. `setDoc(transactionRef, encryptedTransaction, { merge: true })`
6. Return success

### 7.2 Updated Flow

For new transactions only (`!id`):

```ts
1. save transaction successfully
2. call evaluateEntryForStreak — updateStreakOnEntry(uid)
3. return both:
   - transaction payload
   - streak result payload
```

Recommended response shape:

```ts
return {
  success: true,
  data: {
    ...transactionData,
    id: transactionRef.id,
    streak: streakResult, // StreakUpdateResult
  },
};
```

For updates (`id` present):

- Do not call streak evaluation
- Editing old dates must not modify streak state in V1

For deletes:

- No streak rollback in V1
- Document this explicitly in code comments

### 7.3 Failure Handling

If transaction save succeeds but streak update fails:

- Keep transaction success
- Log streak failure via `console.error`
- Return `streak` with `isFirstToday: false` so the UI silently skips celebration
- Do not block the user or roll back the transaction

Reasoning:

- Transaction creation is the primary action
- Current code does not use Firestore transactions/batches across wallet + transaction writes either
- This matches the repo's pragmatic consistency model

---

## 8. UI Surfaces

### 8.1 Package Addition

Add: `react-native-confetti-cannon`

Pure JS + Reanimated — works on New Arch without native build steps. Reanimated (~4.1.1) already in project dependencies.

```bash
npx expo install react-native-confetti-cannon
```

### 8.2 Milestone Constants — `constants/milestones.ts`

```ts
export type MilestoneConfig = {
  days: number;
  label: string;
  icon: string; // phosphor-react-native icon name (dynamic lookup)
  description: string;
};

export const MILESTONES: MilestoneConfig[] = [
  { days: 7, label: "Week Warrior", icon: "Lightning", description: "7 days in a row" },
  { days: 14, label: "Fortnight Focus", icon: "Target", description: "14 days in a row" },
  { days: 21, label: "Habit Maker", icon: "Brain", description: "21 days in a row" },
  { days: 30, label: "Monthly Master", icon: "Medal", description: "30 days in a row" },
  { days: 60, label: "Diamond Discipline", icon: "Diamond", description: "60 days in a row" },
  { days: 90, label: "Quarter Champion", icon: "Trophy", description: "90 days in a row" },
];

export const getMilestoneForStreak = (n: number): MilestoneConfig | null =>
  MILESTONES.find((m) => m.days === n) ?? null;

export const getNextMilestone = (n: number): MilestoneConfig | null =>
  MILESTONES.find((m) => m.days > n) ?? null;
```

Icon rendering uses the same pattern as the rest of the codebase:

```ts
const IconComponent = (Icons as any)[milestone.icon];
```

via `import * as Icons from "phosphor-react-native"`.

### 8.3 Transaction Modal Changes — `app/(modals)/transactionModal.tsx`

**New imports:**

```ts
import * as Haptics from "expo-haptics";
import ConfettiCannon from "react-native-confetti-cannon";
import { updateStreakOnEntry } from "@/services/streakService";
```

**New state:**

```ts
const [showConfetti, setShowConfetti] = useState(false);
```

**Detect edit vs new:**

```ts
const isEdit = Boolean(oldTransaction?.id);
```

**Replace onSubmit success block** (currently `if (res.success) { router.back(); }`):

```ts
if (res.success) {
  if (!isEdit) {
    // 1. Immediate haptic (success notification weight)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // 2. Trigger confetti overlay
    setShowConfetti(true);

    // 3. Streak update (non-blocking — transaction already saved)
    try {
      const streakResult = await updateStreakOnEntry(user!.uid!);
      if (streakResult.isFirstToday) {
        setTimeout(() => {
          router.replace({
            pathname: "/(modals)/streakCelebrationModal",
            params: {
              streakCount: String(streakResult.newStreak),
              action: streakResult.action,
            },
          });
        }, 150); // brief delay so confetti starts before navigation
        return;
      }
    } catch (e) {
      console.error("Streak update failed (non-critical):", e);
    }

    // Already logged today or streak update failed — just go back
    router.back();
  } else {
    router.back(); // edits: no streak/confetti
  }
}
```

Why `router.replace`: Replaces transaction form in the stack so back-swipe from celebration returns to home tab, not to the already-submitted form.

**Add ConfettiCannon JSX** — last child of `<ModalWrapper>` (renders above all content):

```tsx
{showConfetti && (
  <ConfettiCannon
    count={120}
    origin={{ x: Dimensions.get("window").width / 2, y: -20 }}
    autoStart={true}
    fadeOut={true}
    colors={[colors.primary, "#ffffff", "#fbbf24", "#f97316"]}
    onAnimationEnd={() => setShowConfetti(false)}
    fallSpeed={3000}
    explosionSpeed={350}
  />
)}
```

### 8.4 Streak Celebration Modal — `app/(modals)/streakCelebrationModal.tsx`

**Registration in `_layout.tsx`:**

```tsx
<Stack.Screen
  name="(modals)/streakCelebrationModal"
  options={{
    presentation: "fullScreenModal",
    gestureEnabled: false,
    animation: "fade",
    headerShown: false,
  }}
/>
```

`fullScreenModal` + `gestureEnabled: false` prevents accidental swipe-dismiss of the celebration.

**Params:**

```ts
type CelebrationParams = { streakCount: string; action: string };
const { streakCount, action } = useLocalSearchParams<CelebrationParams>();
const count = Number(streakCount);
```

**Content layout** (full-screen `colors.neutral900` bg):

- `ConfettiCannon` — fires once on mount
- Centered vertical layout — `flex: 1, alignItems: center, justifyContent: center`
- 🔥 large flame icon — phosphor `Flame` weight="fill" color="#f97316" size=72
- `Typo size=80 fontWeight="800" color=primary` → `{count}`
- `Typo size=24` → `"Day Streak!"`
- Subtitle — conditional on `action`:
  - `"first_entry"` → `"You started your streak. Keep going!"`
  - `"continued"` → `"You're on a roll. Keep the momentum!"`
  - `"restarted"` → `"Fresh start! You've got this."`
- Milestone badge — if `getMilestoneForStreak(count) !== null`:
  - pill: `"🏆 Milestone Unlocked: {milestone.label}"`
- Spacer
- Button `"Done"` fullWidth primary bg → `onPress: Haptics.Medium + router.back()`
- `TouchableOpacity` `"View all milestones"` → `router.push("/(modals)/streakDetailsModal")`

### 8.5 Streak Details Modal — `app/(modals)/streakDetailsModal.tsx`

**Registration in `_layout.tsx`:**

```tsx
<Stack.Screen
  name="(modals)/streakDetailsModal"
  options={{ presentation: "modal", headerShown: false }}
/>
```

**Data fetching:**

One-time `getDoc` via `getStreakData(uid)` in a `useEffect` — not `onSnapshot`, because the existing `useFetchData` hook targets collections, not single docs, and real-time reactivity is unnecessary here.

```ts
const [streakData, setStreakData] = useState<StreakType | null>(null);
useEffect(() => {
  if (!user?.uid) return;
  getStreakData(user.uid).then(setStreakData);
}, []);
```

**Sections inside `<ModalWrapper>` → `<ScrollView>`:**

**Section 1 — Hero card** (`neutral800` bg, rounded):

- Flame icon + large streak number (primary) + "day streak" label
- "Started {streakStartDate}" in `neutral400`
- "Personal best: {longestStreak} days" (only if `longestStreak > currentStreak`)

**Section 2 — Milestones grid** (3 columns, `flexWrap: "wrap"`):

Each `MilestoneBadge`:

- Unlocked (`currentStreak >= milestone.days`): primary border, white text, colored icon
- Locked: `neutral700` border, `neutral600` text, lock icon overlay
- Shows: milestone icon, day count ("7 Days"), label ("Week Warrior")

**Section 3 — Streak History:**

Header: "Past Streaks"

- If `history.length === 0`: `<Typo color={neutral500}>No completed streaks yet.</Typo>`
- Else: map over history (max 2), show "{h.streak} day streak" + "ended {formatDate(h.endedOn)}"

### 8.6 Streak Home Card — `components/StreakHomeCard.tsx`

**Props:**

```ts
type Props = {
  currentStreak: number;
  onPress: () => void;
};
```

**Layout** (`TouchableOpacity` wrapping card — `neutral800` bg, `neutral700` border, `radius._20`):

```
[Row — space-between, alignItems: center]
  [Left]
    [Row] 🔥 (phosphor Flame fill amber) + [Typo neutral400 size=13] "Streak"
    [Row baseline] [Typo size=32 bold primary] {currentStreak} [Typo neutral400] " days"
  [Right] ArrowRight icon neutral600

[Typo size=12 neutral500 marginTop=4]
  currentStreak === 0
    → "Log a transaction to start your streak"
  getNextMilestone(currentStreak) !== null
    → "{next.days - currentStreak} days to {next.label}"
  else
    → "All milestones unlocked! 🏆"
```

### 8.7 Home Screen Integration — `app/(tabs)/index.tsx`

**New imports:**

```ts
import StreakHomeCard from "@/components/StreakHomeCard";
import { getStreakData } from "@/services/streakService";
import { StreakType } from "@/types";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
```

**New state inside Home component:**

```ts
const [streakData, setStreakData] = useState<StreakType | null>(null);

useFocusEffect(
  useCallback(() => {
    if (!user?.uid) return;
    getStreakData(user.uid).then(setStreakData);
  }, [user?.uid])
);
```

This re-fetches streak data every time the home tab gains focus (e.g. after dismissing the transaction modal or celebration modal), ensuring the `StreakHomeCard` always shows the latest streak count without maintaining a persistent Firestore listener.

**Insertion point in JSX** — between `HomeCard` and `showSetupCard`:

```tsx
{/* HomeCard already exists */}

{/* Streak Home Card — only after first transaction */}
{streakData !== null && (
  <StreakHomeCard
    currentStreak={streakData.currentStreak}
    onPress={() => router.push("/(modals)/streakDetailsModal")}
  />
)}

{/* Getting started card already exists */}
{showSetupCard && ( ... )}
```

`streakData !== null` guard: new users with no streak doc see nothing. Card appears after their first transaction creates the streak doc (celebration modal shows first, then home refreshes on next visit).

---

## 9. State and Event Flow

### 9.1 Event Flow Summary

```text
TransactionModal submit
  → transactionService.createOrUpdateTransaction
    → save transaction
    → if new transaction: streakService.updateStreakOnEntry(uid)
    → return transaction + streak result

  → TransactionModal success handling
    → if edit: router.back() (no streak/confetti)
    → if new transaction:
      → haptic (notificationAsync Success)
      → confetti overlay
      → if isFirstToday:
        → 150ms delay
        → router.replace to streakCelebrationModal with params
      → else: router.back()

Home screen
  → useFocusEffect → getStreakData(uid) on every tab focus
  → render StreakHomeCard if data exists
  → StreakHomeCard onPress → router.push to streakDetailsModal
```

### 9.2 Home Data Loading

Current home screen subscribes to decrypted `transactions` and `wallets`. Streak data is loaded via `getDoc` inside a `useFocusEffect` hook — not `onSnapshot` — so it re-fetches every time the home tab gains focus without maintaining a persistent Firestore listener.

Reasoning: streak data changes at most once per day, and is updated by the transaction modal flow. Re-fetching on tab focus guarantees the `StreakHomeCard` is fresh after returning from the transaction or celebration modal, without the overhead of a realtime subscription.

---

## 10. Edge Cases

### 10.1 Backdated Entries

User can currently choose any date up to today in the transaction modal.

**Decision for V1:** Streak evaluation uses `today` (device-local), not the selected transaction date.

That means:

- Selected historical dates remain valid for financial logging
- They do not affect streak state
- Users cannot game the streak by backfilling missed days

This is enforced in `updateStreakOnEntry()` which always uses `getTodayString()`.

### 10.2 Duplicate Tap / Rapid Submit

`loading` state in the modal already reduces duplicate writes, but streak logic must still be idempotent per day:

- Multiple successful saves on the same day cap streak increment at 1
- Case B in the algorithm (`lastEntryDate === today`) handles this

### 10.3 Offline / Delayed Sync

If Firestore write completion is delayed, streak celebration should only happen after the transaction save promise resolves successfully. The streak service call is `await`ed inside the success handler.

### 10.4 Timezone Travel

Because streak is based on device-local day keys, a user crossing timezones may observe day boundary changes sooner or later than before. This is acceptable for V1 and simpler than server-time normalization.

### 10.5 Delete and Edit Semantics

V1 does not recompute streaks when:

- Editing a transaction date
- Deleting a transaction

This should be documented in code comments and QA notes to avoid hidden inconsistency expectations.

### 10.6 Second Transaction Same Day

`isFirstToday: false` → skip confetti, haptic, and modal; `router.back()` as normal.

### 10.7 New User — No Streak Doc

`StreakHomeCard` hidden (`streakData === null`). Doc is created on first transaction. Celebration modal shows first, then home refreshes on next visit.

---

## 11. Account Deletion Cleanup

When a user deletes their account, the streak document must be deleted alongside other user data.

### 11.1 Modification — `services/userService.ts`

In the account deletion flow (wherever user subcollection data is cleaned up), add deletion of the streak document:

```ts
// Delete streak data
const streakRef = doc(firestore, "users", uid, "streaks", "current");
await deleteDoc(streakRef);
```

This should be added alongside the existing deletion of `wallets`, `transactions`, and any other subcollection documents.

### 11.2 Ordering

Streak deletion is non-critical relative to financial data deletion. It should happen:

- After the primary user document and financial data are deleted
- Before the Firebase Auth account is deleted
- Inside the same try/catch block as other subcollection cleanups

If streak deletion fails, it should be logged but should not block the overall account deletion flow.

---

## 12. File Change Summary

| File | Action | Purpose |
|------|--------|---------|
| `types.ts` | Modify | Add `StreakHistoryEntry`, `StreakType`, `StreakUpdateResult`, `MilestoneConfig` |
| `constants/milestones.ts` | Add | Milestone config array, `getMilestoneForStreak()`, `getNextMilestone()` |
| `services/streakService.ts` | Add | Streak fetch, encrypt/decrypt, `updateStreakOnEntry()`, `getStreakData()` |
| `services/transactionService.ts` | Modify | Call `updateStreakOnEntry()` after successful new transaction, return streak result |
| `services/userService.ts` | Modify | Delete streak doc during account deletion |
| `components/StreakHomeCard.tsx` | Add | Compact home card showing current streak + next milestone |
| `app/(tabs)/index.tsx` | Modify | Add streak state, render `StreakHomeCard` between `HomeCard` and setup card |
| `app/(modals)/transactionModal.tsx` | Modify | Add confetti state, haptic, streak call, navigation to celebration modal |
| `app/(modals)/streakCelebrationModal.tsx` | Add | Full-screen celebration with confetti, streak count, milestone badge, conditional copy |
| `app/(modals)/streakDetailsModal.tsx` | Add | Hero card, milestone grid (locked/unlocked), streak history |
| `app/_layout.tsx` | Modify | Register 2 new modal Stack.Screen entries |
| `firestore.rules` | Modify | Add read/write rules for `users/{uid}/streaks/{docId}` |
| `services/encryptionService.ts` | No change | Existing `encryptField`, `decryptField`, `decryptNumber`, `isEncrypted` exports are sufficient |

---

## 13. Testing Plan

### 13.1 Service Tests

Validate:

- First ever entry creates streak `1` with `action: "first_entry"`
- Second entry same day returns `isFirstToday: false` and does not increment
- Next-day entry increments streak and returns `action: "continued"`
- Two-day gap archives previous streak, restarts at `1`, returns `action: "restarted"`
- History is trimmed to last `2` entries
- `longestStreak` updates correctly and never decreases on restart
- Encrypted fields decrypt back to original values
- Error in streak service returns safe fallback, never throws

### 13.2 UI Tests / Manual QA

Validate:

- New transaction success fires haptic + confetti
- First entry today navigates to `streakCelebrationModal` with correct params
- Second entry today skips celebration modal, fires `router.back()`
- Celebration modal shows correct copy for `first_entry`, `continued`, `restarted`
- Milestone badge pill appears when streak hits a milestone day
- "View all milestones" navigates to `streakDetailsModal`
- `streakDetailsModal` shows hero card, locked/unlocked milestones, history
- `StreakHomeCard` shows correct streak count and next milestone text
- `StreakHomeCard` hidden for new users with no streak doc
- Editing a transaction does not trigger streak/confetti logic
- Deleting a transaction does not trigger streak changes

### 13.3 Regression Checks

Validate existing flows still work:

- Add transaction with image
- Edit transaction
- Delete transaction
- Wallet aggregates still update correctly
- Home month filtering remains unaffected

### 13.4 Encryption Verification

Inspect Firestore console:

- `users/{uid}/streaks/current` doc shows ciphertext for `currentStreak`, `longestStreak`, `lastEntryDate`, `streakStartDate`, `history`
- `updatedAt` is plain timestamp
- Decrypted data in-app matches expected values

### 13.5 Account Deletion Verification

- Delete account → confirm `users/{uid}/streaks/current` doc is removed
- Streak deletion failure does not block account deletion

---

## 14. Open Decisions

1. **Success overlay orchestration**
   Recommended: `router.replace` with 150ms delay. Fall back to local fullscreen overlay if modal-to-modal navigation feels brittle during testing.

2. **Confetti library choice**
   Recommended: `react-native-confetti-cannon` (pure JS + Reanimated). Verify compatibility with Expo RN 0.81 / SDK 54 before finalizing.

3. **Stitch MCP usage**
   During implementation, generate screens using `mcp__stitch__generate_screen_from_text` for:
   - `streakCelebrationModal` — dark bg, large streak count, flame icon, milestone badge, confetti, Done button
   - `streakDetailsModal` — scrollable, hero card + milestone grid + history section
   - `StreakHomeCard` — compact card for home screen
   
   Use the generated designs as the visual reference for styling, adapting to `constants/theme.ts` colors.

---

## 15. Implementation Order

| Step | File | Action |
|------|------|--------|
| 1 | `package.json` | `npx expo install react-native-confetti-cannon` |
| 2 | `types.ts` | Add `StreakHistoryEntry`, `StreakType`, `StreakUpdateResult`, `MilestoneConfig` |
| 3 | `constants/milestones.ts` | Create new file |
| 4 | `services/streakService.ts` | Create new file with encrypt/decrypt, `getStreakData`, `updateStreakOnEntry` |
| 5 | `firestore.rules` | Add streak subcollection rules |
| 6 | `services/transactionService.ts` | Wire streak evaluation into new transaction creation |
| 7 | `app/_layout.tsx` | Register 2 new modals |
| 8 | `app/(modals)/transactionModal.tsx` | Add confetti state, haptic, streak call, navigation logic |
| 9 | `app/(modals)/streakCelebrationModal.tsx` | Create new file (use Stitch MCP for design) |
| 10 | `app/(modals)/streakDetailsModal.tsx` | Create new file (use Stitch MCP for design) |
| 11 | `components/StreakHomeCard.tsx` | Create new file (use Stitch MCP for design) |
| 12 | `app/(tabs)/index.tsx` | Add streak state + `StreakHomeCard` |
| 13 | `services/userService.ts` | Add streak doc deletion to account cleanup |

---

## Key Architecture Principle

Do not model streak updates in the UI layer. The durable integration point is `transactionService.ts`. The UI should react to a returned `StreakUpdateResult`, not compute streak transitions itself. That keeps encryption, persistence, history retention, and first-entry-of-day idempotency in one place.
