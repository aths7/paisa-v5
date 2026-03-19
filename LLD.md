# Low Level Design: Paisa-v5 Feature Set

> Status: **Pending Review** — Do not implement until approved.
> Last updated: 2026-03-19

---

## Table of Contents

1. [Wallet Types](#1-wallet-types)
2. [Home Screen Redesign](#2-home-screen-redesign)
3. [Month Filter on Home Screen](#3-month-filter-on-home-screen)
4. [File Change Summary](#4-file-change-summary)

---

## 1. Wallet Types

### 1.1 Schema Changes — `types.ts`

**Updated `WalletType`:**

```typescript
export type WalletType = {
  id?: string;
  name: string;
  walletType: 'CC' | 'BA' | 'UPI' | 'C';  // NEW — required, locked after creation

  // Existing fields
  amount?: number;         // For CC: current outstanding bill amount
  totalIncome?: number;
  totalExpenses?: number;
  image: any;
  uid?: string;
  created?: Date;

  // CC-only fields (undefined for non-CC wallets)
  cardLimit?: number;      // Total credit limit on the card
  billingDate?: number;    // Day of month the bill generates (1–28)
  isBillPaid?: boolean;    // Whether current cycle bill has been cleared

  // All other wallet types can use amount as opening/current balance
};
```

**Encryption:** `cardLimit` will be encrypted alongside `amount`, `totalIncome`, `totalExpenses`, and `name`. `billingDate` and `isBillPaid` are not sensitive and will be stored as plaintext.

---

### 1.2 Wallet Modal — `app/(modals)/walletModal.tsx`

#### Create Mode

**Step 1 — Wallet Type Selector** (always shown first, no default selection):

```
┌──────────────────────────────────────────────┐
│  What type of wallet is this?                │
│                                              │
│  [💳 Credit Card] [🏦 Bank] [📱 UPI] [💵 Cash] │
└──────────────────────────────────────────────┘
```

Tapping a type reveals the relevant fields below. Type is **locked after creation** — no change allowed during edit.

**Conditional Fields by Type:**

```
walletType === 'CC' (Credit Card):
  ├── Wallet Name          (text, required, e.g. "HDFC Regalia")
  ├── Icon                 (emoji/image, optional, default: 💳)
  ├── Card Limit           (numeric, required, e.g. 50000)
  └── Billing Date         (day picker 1–28, required, e.g. "15th of every month")

walletType === 'BA' (Bank Account):
  ├── Wallet Name          (text, required, e.g. "SBI Savings")
  ├── Icon                 (emoji/image, optional, default: 🏦)
  └── Current Balance      (numeric, optional — "won't count as income")

walletType === 'UPI' (UPI Lite):
  ├── Wallet Name          (text, required, e.g. "PhonePe")
  ├── Icon                 (emoji/image, optional, default: 📱)
  └── Opening Balance      (numeric, optional — "won't count as income")

walletType === 'C' (Cash):
  ├── Wallet Name          (text, required, e.g. "Wallet Cash")
  ├── Icon                 (emoji/image, optional, default: 💵)
  └── Opening Balance      (numeric, optional — "won't count as income")
```

#### Edit Mode

- **Wallet type pill is shown but disabled** (greyed out, non-tappable, with tooltip "Type cannot be changed after creation")
- **CC edit** shows: name, icon, card limit (editable), billing date (editable)
- **CC edit** also shows a dedicated **"Mark Bill as Paid"** button (red/orange CTA)
- **BA/UPI/C edit** shows: name, icon (no balance editing — same as current behavior)

#### Mark Bill as Paid — Bottom Sheet Flow

When the user taps "Mark Bill as Paid" on a CC wallet, a bottom sheet appears:

```
┌─────────────────────────────────────────────┐
│  Pay Credit Card Bill                        │
│                                              │
│  Outstanding: ₹12,450                        │
│                                              │
│  Pay from which account?                    │
│  ┌──────────────────────────────────────┐   │
│  │  🏦 SBI Savings        ₹45,200  ›   │   │
│  │  🏦 HDFC Account       ₹12,000  ›   │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  Amount to Pay: [₹12,450     ]  (editable)  │
│                                              │
│  [  Cancel  ]  [  Confirm Payment  ]         │
└─────────────────────────────────────────────┘
```

**On Confirm:**
1. Create a new `expense` transaction on the **source BA wallet** (deducting the paid amount from bank balance)
2. Reset the **CC wallet**: `amount = 0`, `isBillPaid = true`
   - `totalExpenses` and `totalIncome` are **NOT reset** — historical totals are preserved
3. The transaction is auto-categorized as `"Credit Card Payment"` with a reference to the CC wallet name in description

---

### 1.3 Wallet Service — `services/walletService.ts`

**New function: `markCreditCardBillPaid(ccWalletId, sourceWalletId, paidAmount, userId)`**

```
1. Fetch & decrypt CC wallet → read current amount
2. Create expense transaction on sourceWallet:
   - type: 'expense'
   - amount: paidAmount
   - walletId: sourceWalletId
   - category: 'Credit Card Payment'  (new category to add)
   - description: `Bill payment for ${ccWalletName}`
3. Update sourceWallet:
   - amount -= paidAmount
   - totalExpenses += paidAmount
4. Update CC wallet:
   - amount = 0
   - isBillPaid = true
   - (totalExpenses and totalIncome unchanged)
5. Return ResponseType
```

**Updated `createOrUpdateWallet`:**
- Persist `walletType`, `cardLimit`, `billingDate`, `isBillPaid` in Firestore
- Encrypt `cardLimit` alongside existing encrypted fields

---

### 1.4 Encryption Service — `services/encryptionService.ts`

Add `cardLimit` to the encrypted field list for wallets:

```typescript
const WALLET_ENCRYPTED_FIELDS = ['name', 'amount', 'totalIncome', 'totalExpenses', 'cardLimit'];
```

---

### 1.5 Wallet List Screen — `app/(tabs)/wallet.tsx`

**Display changes in `WalletListItem` component:**

```
For BA / UPI / C:
┌──────────────────────────────────────────┐
│  🏦  SBI Savings          [BA]           │
│      ₹45,200                             │
└──────────────────────────────────────────┘

For CC:
┌──────────────────────────────────────────┐
│  💳  HDFC Regalia         [CC]           │
│      ₹12,450 spent of ₹50,000 limit      │
│      ████████░░░░  24% used              │
│      Bills on 15th                       │
└──────────────────────────────────────────┘
```

- Type badge (`[CC]`, `[BA]`, `[UPI]`, `[C]`) shown next to wallet name
- CC: progress bar showing `amount / cardLimit` usage percentage
- CC: billing date reminder text

---

### 1.6 Transaction Modal — `app/(modals)/transactionModal.tsx`

The wallet picker already works via `walletId`. Minor additions:
- Show wallet type badge next to each wallet name in the picker list
- CC wallets support both `income` (refunds) and `expense` transactions — no restriction

---

### 1.7 New Category — `constants/categories.ts` (or wherever categories are defined)

Add: `{ label: 'Credit Card Payment', icon: '💳', value: 'creditCardPayment' }`

---

## 2. Home Screen Redesign

### 2.1 HomeCard — `components/HomeCard.tsx`

**Current:** Single metric — Total Balance across all wallets.
**New:** Three-metric card layout.

```
┌─────────────────────────────────────────────┐
│  March 2026                                  │
│                                              │
│  Total Spent This Month                      │
│  ₹18,200                                    │
│                                              │
│  ┌──────────────┐  ┌──────────────────────┐ │
│  │ 💵 In Hand   │  │ 💳 Borrowed Power    │ │
│  │  ₹57,200     │  │   ₹37,550 available  │ │
│  └──────────────┘  └──────────────────────┘ │
│                                              │
│  ⚡ Spend Capacity: ₹94,750                  │
└─────────────────────────────────────────────┘
```

**Metric Definitions:**

| Metric | Label | Calculation |
|--------|-------|-------------|
| Total Spent This Month | Primary, large | Sum of all `expense` transactions in selected month |
| In Hand | Secondary | Sum of `amount` for all `BA` + `UPI` + `C` wallets |
| Borrowed Power | Secondary | Sum of `(cardLimit - amount)` for all `CC` wallets (available credit) |
| Overall Spend Capacity | Footer | In Hand + Borrowed Power |

---

### 2.2 Data Logic — `app/(tabs)/index.tsx`

All calculations are **client-side** on the already-subscribed real-time data — no new Firestore queries.

```typescript
// Monthly expense (reacts to selectedMonth filter)
const monthlyExpense = filteredTransactions
  .filter(t => t.type === 'expense')
  .reduce((sum, t) => sum + t.amount, 0);

// In Hand (not month-filtered — always current state)
const inHand = wallets
  .filter(w => w.walletType === 'BA' || w.walletType === 'UPI' || w.walletType === 'C')
  .reduce((sum, w) => sum + (w.amount ?? 0), 0);

// Borrowed Power (available credit across all CC wallets)
const borrowedPower = wallets
  .filter(w => w.walletType === 'CC')
  .reduce((sum, w) => sum + ((w.cardLimit ?? 0) - (w.amount ?? 0)), 0);

// Overall Spend Capacity
const spendCapacity = inHand + borrowedPower;
```

---

## 3. Month Filter on Home Screen

### 3.1 Filter UI — `app/(tabs)/index.tsx`

A horizontally scrollable month pill strip, rendered between the HomeCard and the transaction list:

```
← [Jan] [Feb] [Mar ●] [Apr] [May] [Jun] →
```

- Defaults to the **current month** on load
- Selected month has a filled/highlighted style
- Strip shows all months of the current year; scrolls to selected on mount
- Tapping a month updates `selectedMonth` state → HomeCard totals and transaction list both update reactively

### 3.2 Filter State & Logic

```typescript
// State
const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));

// Derived filtered list (transactions already decrypted via useDecryptedData)
const filteredTransactions = useMemo(() =>
  transactions.filter(t => {
    const d = new Date(t.date);
    return d >= startOfMonth(selectedMonth) && d <= endOfMonth(selectedMonth);
  }),
  [transactions, selectedMonth]
);
```

Date helpers (`startOfMonth`, `endOfMonth`) — use `date-fns` if already in the project, otherwise implement inline (no new dependency needed).

---

## 4. File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `types.ts` | Modify | Add `walletType`, `cardLimit`, `billingDate`, `isBillPaid` to `WalletType` |
| `services/walletService.ts` | Modify | Add `markCreditCardBillPaid()` function; encrypt `cardLimit` |
| `services/encryptionService.ts` | Modify | Add `cardLimit` to wallet encrypted fields list |
| `app/(modals)/walletModal.tsx` | Modify | Type selector UI + conditional fields + Mark Bill Paid flow |
| `app/(tabs)/wallet.tsx` | Modify | Pass type data to list items |
| `components/WalletListItem.tsx` | Modify | Type badge, CC usage bar, billing date |
| `components/HomeCard.tsx` | Modify | Three-metric layout (monthly spend, in-hand, borrowed power, spend capacity) |
| `app/(tabs)/index.tsx` | Modify | Month filter strip, filtered transaction list, pass metrics to HomeCard |
| `constants/categories.ts` (or equivalent) | Modify | Add `Credit Card Payment` category |

---

## 5. Decisions Locked In

| Question | Decision |
|----------|----------|
| CC bill reset scope | Only `amount → 0` and `isBillPaid → true`. `totalExpenses`/`totalIncome` preserved. |
| Bill payment flow | Bottom sheet asks which BA wallet to pay from → auto-creates expense transaction on that BA wallet |
| Month filter scope | Home screen only (not Statistics screen, for now) |
| Wallet type mutability | Locked after creation, no edit allowed |
| CC transaction types | Both income (refunds) and expense allowed |
| UPI/Cash opening balance | Optional field, same as BA — "won't count as income" |
| Home card balance display | Removed; replaced with In Hand + Borrowed Power + Spend Capacity |
