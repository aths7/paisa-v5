# Low Level Design: Streak Gamification Module

> Status: **Pending Review** — Do not implement until approved.
> Last updated: 2026-03-25

---

## Table of Contents

1. [Scope](#1-scope)
2. [Goals and Rules](#2-goals-and-rules)
3. [Data Model](#3-data-model)
4. [Encryption Plan](#4-encryption-plan)
5. [Service Layer](#5-service-layer)
6. [Entry Creation Flow](#6-entry-creation-flow)
7. [UI Surfaces](#7-ui-surfaces)
8. [State and Event Flow](#8-state-and-event-flow)
9. [Edge Cases](#9-edge-cases)
10. [File Change Summary](#10-file-change-summary)
11. [Testing Plan](#11-testing-plan)
12. [Open Decisions](#12-open-decisions)

---

## 1. Scope

Add a V1 gamification module centered on a daily streak:

- A streak increments when the user adds their first new entry of the calendar day.
- Any additional entries on the same day should still trigger success delight (`confetti` + `haptic`) but must not increment the streak again.
- If the user misses one or more days, the next qualifying day starts a new streak at `1`.
- Keep history for the last `2` completed streaks.
- Show a streak section on Home with current streak and locked upcoming rewards.
- Show a dedicated streak increase success screen only for the first qualifying entry of the day.
- Preserve the app’s current encryption model for any sensitive streak data persisted in Firestore.

This LLD is for architecture and implementation planning only. It assumes the UI views will be built from Stitch-generated screen references, but there is no Stitch runtime integration in the current repo.

---

## 2. Goals and Rules

### 2.1 Product Rules

**Definition of entry**

For V1, an "entry" means a newly created transaction saved through `createOrUpdateTransaction()` from [services/transactionService.ts](/Users/atharvawankhede/Desktop/Coding/paisa-v5/services/transactionService.ts).

Edits to an existing transaction do not count as a new entry.

Deletes do not retroactively recalculate streak history in V1.

### 2.2 Streak Rules

Let `entryDayKey` be the user-local calendar day in `YYYY-MM-DD` format.

Rules:

1. If no previous streak activity exists, the first successful new entry sets:
   - `currentStreak = 1`
   - `lastEntryDayKey = today`
   - `longestStreak = 1`

2. If `lastEntryDayKey === today`:
   - streak does not increment
   - success delight still runs
   - streak increase screen does not show

3. If `lastEntryDayKey === yesterday`:
   - `currentStreak += 1`
   - `lastEntryDayKey = today`
   - streak increase screen shows

4. If the gap is `>= 2` days:
   - previous streak is archived into history
   - `currentStreak = 1`
   - `lastEntryDayKey = today`
   - streak increase screen shows with restart copy, not continuation copy

5. Store at most the last `2` completed streaks in reverse chronological order.

### 2.3 Reward Rules

Rewards are display-only in V1. No wallet credit, badge unlock persistence, or redemption flow is included.

Example reward milestones:

- Day 3
- Day 7
- Day 14
- Day 30

These should live in a local constant so the Home streak section and success screen are driven by the same config.

---

## 3. Data Model

### 3.1 Type Additions — `types.ts`

Add new types:

```ts
export type StreakHistoryItem = {
  streakCount: number;
  startedOnDayKey: string;
  endedOnDayKey: string;
  completedAt?: Date | Timestamp | string;
};

export type StreakRewardType = {
  day: number;
  title: string;
  subtitle: string;
  icon: string;
};

export type UserStreakType = {
  id?: string; // singleton doc, recommend "summary"
  uid?: string;
  currentStreak: number;
  longestStreak: number;
  lastEntryDayKey?: string;
  currentStreakStartedOnDayKey?: string;
  streakHistory: StreakHistoryItem[];
  totalFirstEntryDays?: number;
  updatedAt?: Date | Timestamp | string;
  createdAt?: Date | Timestamp | string;
};
```

### 3.2 Firestore Shape

Recommended path:

`users/{uid}/meta/streakSummary`

Reasoning:

- Streak is a user-level aggregate, not a transaction.
- This avoids polluting the `users/{uid}` root doc with a nested encrypted blob.
- This fits current collection-per-feature patterns already used by `wallets` and `transactions`.

Alternative acceptable path:

`users/{uid}/gamification/streak`

Either is fine; the important part is keeping it as a single user-scoped document.

### 3.3 Persisted Document

```json
{
  "uid": "abc123",
  "currentStreak": "<encrypted>",
  "longestStreak": "<encrypted>",
  "lastEntryDayKey": "<encrypted>",
  "currentStreakStartedOnDayKey": "<encrypted>",
  "streakHistory": [
    {
      "streakCount": "<encrypted>",
      "startedOnDayKey": "<encrypted>",
      "endedOnDayKey": "<encrypted>",
      "completedAt": "2026-03-25T10:30:00.000Z"
    }
  ],
  "totalFirstEntryDays": "<encrypted>",
  "updatedAt": "2026-03-25T10:30:00.000Z",
  "createdAt": "2026-03-25T10:30:00.000Z"
}
```

`updatedAt` and `createdAt` remain plaintext timestamps, consistent with current operational fields such as transaction `date`.

### 3.4 Why the day key should be encrypted

The repo already encrypts user names, wallet balances, transaction amounts, categories, and descriptions in [services/encryptionService.ts](/Users/atharvawankhede/Desktop/Coding/paisa-v5/services/encryptionService.ts). A streak record reveals behavioral cadence, which is user activity metadata. It is not needed for cross-user querying or server-side filtering in V1, so it should stay encrypted at rest.

---

## 4. Encryption Plan

### 4.1 Service Placement

Current encryption helpers are field-list driven and optimized for flat documents:

- [services/encryptionService.ts](/Users/atharvawankhede/Desktop/Coding/paisa-v5/services/encryptionService.ts)
- [hooks/useDecryptedData.ts](/Users/atharvawankhede/Desktop/Coding/paisa-v5/hooks/useDecryptedData.ts)

Because `streakHistory` is an array of nested objects, V1 should not try to force it through the generic `encryptDocument()` helper unchanged.

### 4.2 Recommended Approach

Add dedicated helpers in `services/streakService.ts`:

```ts
encryptStreakSummary(summary: UserStreakType, key: string): UserStreakType
decryptStreakSummary(summary: UserStreakType, key: string): UserStreakType
```

These helpers should:

- encrypt flat scalar streak fields
- map over `streakHistory`
- encrypt nested item fields individually
- leave timestamps plaintext

### 4.3 Fields to Encrypt

Encrypt:

- `currentStreak`
- `longestStreak`
- `lastEntryDayKey`
- `currentStreakStartedOnDayKey`
- `totalFirstEntryDays`
- `streakHistory[].streakCount`
- `streakHistory[].startedOnDayKey`
- `streakHistory[].endedOnDayKey`

Do not encrypt:

- `uid`
- `createdAt`
- `updatedAt`
- `streakHistory[].completedAt`

### 4.4 Migration

No migration is required for existing users because this is a new document.

The service should lazily create the doc on first read/write if it does not exist.

---

## 5. Service Layer

### 5.1 New Service — `services/streakService.ts`

Add a dedicated streak service. This should own all streak math so the modal/UI layer stays thin.

Proposed API:

```ts
type StreakEvaluationResult = {
  success: boolean;
  streakUpdated?: boolean;
  firstEntryToday?: boolean;
  restarted?: boolean;
  previousStreakCount?: number;
  currentStreak?: number;
  nextRewardDay?: number | null;
  streakSummary?: UserStreakType;
  msg?: string;
};

export const getOrCreateStreakSummary = async (): Promise<ResponseType>;
export const evaluateEntryForStreak = async (entryDate: Date): Promise<StreakEvaluationResult>;
export const fetchStreakSummary = async (): Promise<ResponseType>;
```

### 5.2 Core Algorithm

`evaluateEntryForStreak(entryDate)`

```ts
1. derive uid and key
2. fetch streak summary doc
3. if absent, create empty summary in memory
4. normalize entryDate into dayKey using device local time
5. if lastEntryDayKey === dayKey:
   return success with firstEntryToday=false and no write
6. compute yesterdayDayKey relative to entryDate
7. if no lastEntryDayKey:
   create streak=1
8. else if lastEntryDayKey === yesterdayDayKey:
   increment currentStreak
9. else:
   archive prior streak into history if currentStreak > 0
   restart at 1
10. trim streakHistory to length 2
11. update longestStreak = max(longestStreak, currentStreak)
12. increment totalFirstEntryDays
13. encrypt summary and persist with merge
14. return UI-facing flags for success overlay
```

### 5.3 Date Normalization Helper

Add a helper in the streak service:

```ts
const getLocalDayKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
```

Do not use `toISOString().split("T")[0]` for streak state, because that would make the day boundary UTC-based instead of user-local.

### 5.4 Why this must be service-driven

The current transaction save path already centralizes create/update behavior in [services/transactionService.ts](/Users/atharvawankhede/Desktop/Coding/paisa-v5/services/transactionService.ts). Streak evaluation must happen there, after a successful new transaction write, otherwise:

- duplicate submissions could inflate streaks
- future transaction entry surfaces would each need to duplicate logic
- the UI would not have a single source of truth for first-entry-of-day detection

---

## 6. Entry Creation Flow

### 6.1 Integration Point — `services/transactionService.ts`

Current flow in [services/transactionService.ts](/Users/atharvawankhede/Desktop/Coding/paisa-v5/services/transactionService.ts):

1. validate transaction
2. update affected wallet totals
3. upload image if present
4. encrypt transaction
5. `setDoc(transactionRef, encryptedTransaction, { merge: true })`
6. return success

### 6.2 Updated Flow

For new transactions only (`!id`):

```ts
1. save transaction successfully
2. call evaluateEntryForStreak(transactionDate)
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
    streak: streakResult,
  },
};
```

For updates (`id` present):

- do not call streak evaluation
- editing old dates must not modify streak state in V1

For deletes:

- no streak rollback in V1
- document this explicitly to avoid hidden recomputation complexity

### 6.3 Failure Handling

If transaction save succeeds but streak update fails:

- keep transaction success
- log streak failure
- return `streak.success = false`
- do not block the user or roll back the transaction

Reasoning:

- transaction creation is the primary action
- current code does not use Firestore transactions/batches across wallet + transaction writes either
- this matches the repo’s pragmatic consistency model

---

## 7. UI Surfaces

### 7.1 Home Screen Streak Section — `app/(tabs)/index.tsx`

Add a streak section below `HomeCard` and above the transaction list / setup card.

The section should show:

- current streak count
- short status copy:
  - `Add an entry today to keep it alive`
  - or `Streak updated today`
- upcoming locked rewards
- optional mini history strip for last 2 completed streaks

Suggested layout:

```text
┌─────────────────────────────────────────────┐
│  Streak                                     │
│  6 days                                     │
│  You already checked in today               │
│                                             │
│  Upcoming rewards                           │
│  [Day 7 Locked] [Day 14 Locked] [Day 30]    │
│                                             │
│  Previous streaks                           │
│  12 days   4 days                           │
└─────────────────────────────────────────────┘
```

The exact visual treatment should follow Stitch-generated screen specs, but the data contract should remain local to this LLD.

### 7.2 Success Overlay / Screen

Add a dedicated screen or modal route for the first successful entry of the day.

Recommended route:

`app/(modals)/streakCelebrationModal.tsx`

Behavior:

- shown only after a successful new transaction whose streak result has `firstEntryToday === true`
- if `restarted === false` and `currentStreak > 1`, copy should celebrate continuation
- if `restarted === true`, copy should acknowledge restart cleanly, not pretend continuation
- screen dismisses manually via CTA or automatically after a short delay if desired

Copy examples:

- Continuation: `Day 5 streak`
- Restart: `Streak restarted. Day 1`

### 7.3 Confetti and Haptics

Every successful new transaction should trigger:

- `expo-haptics`
- confetti

This includes:

- first entry of day
- second, third, nth entry of same day

But only the first entry of day gets the streak increase screen.

Current repo state:

- `expo-haptics` already exists in [package.json](/Users/atharvawankhede/Desktop/Coding/paisa-v5/package.json)
- light impact is already used in [components/CustomTabs.tsx](/Users/atharvawankhede/Desktop/Coding/paisa-v5/components/CustomTabs.tsx)
- no confetti library currently exists

Recommendation:

- add `react-native-confetti-cannon` or `react-native-fast-confetti`
- encapsulate this in a reusable `EntrySuccessCelebration` component

### 7.4 Transaction Modal Hook-in — `app/(modals)/transactionModal.tsx`

Current modal behavior in [app/(modals)/transactionModal.tsx](/Users/atharvawankhede/Desktop/Coding/paisa-v5/app/(modals)/transactionModal.tsx):

- submits transaction
- on success immediately `router.back()`

Updated behavior:

1. call `createOrUpdateTransaction()`
2. if edit: keep current flow
3. if new transaction:
   - trigger generic success haptic + confetti
   - inspect `res.data.streak`
   - if `firstEntryToday === true`, navigate to streak celebration modal with streak payload
   - otherwise return to previous screen

If the overlay is modal-based, it can sit on top of the transaction modal dismissal flow:

```ts
router.back();
router.push({
  pathname: "/(modals)/streakCelebrationModal",
  params: { ...streakPayload }
});
```

If navigation timing is awkward with stacked modals, the safer alternative is a local fullscreen overlay mounted inside `transactionModal.tsx` before dismiss.

### 7.5 Reward Section Component

Create a dedicated component:

`components/StreakSection.tsx`

Responsibilities:

- render current streak
- render reward milestones
- render last 2 streaks
- remain presentation-only

Inputs:

```ts
type StreakSectionProps = {
  streak: UserStreakType | null;
  rewards: StreakRewardType[];
  loading?: boolean;
  todayCompleted?: boolean;
};
```

---

## 8. State and Event Flow

### 8.1 Home Data Loading

Current home screen already subscribes to:

- decrypted `transactions`
- decrypted `wallets`

Add one more subscription path for streak summary. Because the generic `useDecryptedData()` hook is flat-field oriented, streak summary should use either:

1. a specialized `useStreakSummary()` hook, recommended
2. or a one-off `onSnapshot` inside `index.tsx`, not preferred

Recommended new hook:

`hooks/useStreakSummary.ts`

Responsibilities:

- subscribe to the streak summary singleton doc
- derive key from `authContext`
- decrypt nested structure via `decryptStreakSummary()`
- return `{ data, loading, error }`

### 8.2 Event Flow Summary

```text
TransactionModal submit
  -> transactionService.createOrUpdateTransaction
    -> save transaction
    -> if new transaction: streakService.evaluateEntryForStreak
    -> return transaction + streak metadata
  -> TransactionModal success handling
    -> always haptic + confetti for new transaction
    -> firstEntryToday ? show streak celebration : close modal

Home screen
  -> useStreakSummary subscription
  -> render StreakSection with current streak, rewards, history
```

---

## 9. Edge Cases

### 9.1 Backdated entries

User can currently choose any date up to today in [app/(modals)/transactionModal.tsx](/Users/atharvawankhede/Desktop/Coding/paisa-v5/app/(modals)/transactionModal.tsx).

Decision for V1:

- streak evaluation uses the selected transaction date, not the save timestamp

Implication:

- adding an entry for yesterday today can count for yesterday, not today

Risk:

- users can game the streak by backfilling missed days

Recommended product decision:

- V1 should count only if `entryDayKey === local today`

That means:

- selected historical dates remain valid for financial logging
- they do not affect streak state

This is the safer default and should be enforced in `evaluateEntryForStreak()`.

### 9.2 Duplicate tap / rapid submit

`loading` state in the modal already reduces duplicate writes, but streak logic must still be idempotent per day:

- multiple successful saves on same day must still cap streak increment at 1

### 9.3 Offline / delayed sync

If Firestore write completion is delayed, streak celebration should only happen after the transaction save promise resolves successfully.

### 9.4 Timezone travel

Because streak is based on device-local day keys, a user crossing timezones may observe day boundary changes sooner or later than before. This is acceptable for V1 and simpler than server-time normalization.

### 9.5 Delete and edit semantics

V1 does not recompute streaks when:

- editing a transaction date
- deleting a transaction

This should be documented in code comments and QA notes to avoid hidden inconsistency expectations.

---

## 10. File Change Summary

| File | Action | Purpose |
|------|--------|---------|
| [types.ts](/Users/atharvawankhede/Desktop/Coding/paisa-v5/types.ts) | Modify | Add streak summary, history, reward types |
| `services/streakService.ts` | Add | Own streak fetch, encryption, evaluation, history trim |
| [services/transactionService.ts](/Users/atharvawankhede/Desktop/Coding/paisa-v5/services/transactionService.ts) | Modify | Invoke streak evaluation after successful new transaction |
| `hooks/useStreakSummary.ts` | Add | Subscribe to and decrypt streak summary doc |
| `constants/streakRewards.ts` | Add | Single reward milestone source |
| `components/StreakSection.tsx` | Add | Home streak card / rewards / history presentation |
| `components/EntrySuccessCelebration.tsx` | Add | Reusable confetti + haptic wrapper |
| [app/(tabs)/index.tsx](/Users/atharvawankhede/Desktop/Coding/paisa-v5/app/(tabs)/index.tsx) | Modify | Render streak section on Home |
| [app/(modals)/transactionModal.tsx](/Users/atharvawankhede/Desktop/Coding/paisa-v5/app/(modals)/transactionModal.tsx) | Modify | Trigger success delight and streak screen after create |
| `app/(modals)/streakCelebrationModal.tsx` | Add | First-entry-of-day streak increase screen |
| [services/encryptionService.ts](/Users/atharvawankhede/Desktop/Coding/paisa-v5/services/encryptionService.ts) | Optional minor modify | Export reusable helpers if streak service wants to reuse lower-level encrypt/decrypt primitives only |
| [services/userService.ts](/Users/atharvawankhede/Desktop/Coding/paisa-v5/services/userService.ts) | Optional modify | Delete streak summary doc during account deletion if stored outside root user doc |

---

## 11. Testing Plan

### 11.1 Service Tests

Validate:

- first ever entry creates streak `1`
- second entry same day does not increment
- next-day entry increments
- two-day gap archives previous streak and restarts at `1`
- history is trimmed to last `2`
- longest streak updates correctly
- encrypted fields decrypt back to original values

### 11.2 UI Tests / Manual QA

Validate:

- new transaction success always gives haptic + confetti
- first entry today shows streak celebration screen
- second entry today skips streak celebration screen
- Home streak section updates live after dismissing modal
- reward cards show locked upcoming milestones
- previous two streaks display correctly
- editing a transaction does not trigger streak changes
- deleting a transaction does not trigger streak changes

### 11.3 Regression Checks

Validate existing flows still work:

- add transaction with image
- edit transaction
- delete transaction
- wallet aggregates still update
- Home month filtering remains unaffected

---

## 12. Open Decisions

1. **Backdated entry policy**
   Recommended: only entries dated `today` count toward streak.

2. **Success overlay orchestration**
   Recommended: local overlay first if modal-to-modal navigation feels brittle.

3. **Reward copy and art**
   Recommended: store rewards in config and plug Stitch-generated UI around that data contract.

4. **Confetti library choice**
   Recommended: choose a lightweight library compatible with Expo RN 0.81 / SDK 54.

5. **History presentation**
   Recommended: show previous two streak counts only in V1; detailed calendar history can wait.

---

## Recommended Implementation Order

1. Add types, reward constants, and `streakService.ts`.
2. Wire streak evaluation into transaction creation.
3. Add `useStreakSummary()` and Home streak section.
4. Add celebration component and transaction modal success flow.
5. Add dedicated streak celebration modal using Stitch-derived screen structure.

---

## Key Recommendation

Do not model streak updates in the UI layer. In this codebase, the durable integration point is the transaction service. The UI should react to a returned streak result, not compute streak transitions itself. That keeps encryption, persistence, history retention, and first-entry-of-day idempotency in one place.
