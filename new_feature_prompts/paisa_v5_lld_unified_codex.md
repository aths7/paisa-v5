# Low Level Design v3: Wallet Types + Home Month View

**Status:** Draft for approval
**Scope:** Wallet type support, credit-card semantics, bill payment flow, Home redesign, month filter, migration, validation, rollout.
This version uses typed wallet semantics (`currentBalance`, `pendingAmount`) instead of overloading one shared `amount` field, and preserves bill-payment history through linked transactions.

---

## 1. Goals

The feature set introduces:

- wallet types: `credit_card`, `bank_account`, `upi_lite`, `cash`
- wallet-type-aware transaction math
- credit-card bill payment from a bank account
- Home metrics based on selected month
- prevention of double-counting on card bill settlement
- migration path for existing wallet and transaction data.

---

## 2. Final decisions locked in

1. Wallet type is required at creation and cannot be edited later.
2. Credit cards use `creditLimit` + `pendingAmount`, not shared `amount`.
3. Bank/UPI/Cash use `currentBalance`.
4. Bill payment creates **two linked transactions**: one on the card, one on the bank account.
5. `Monthly Spend` excludes `credit_card_bill_payment` records.
6. Home month filter affects only Home, not Statistics.
7. V1 blocks bill payment if selected bank account has insufficient balance.
8. Opening balances do not count as income. UI copy remains consistent with current expectation.

---

## 3. Data model

### 3.1 Wallet model

```ts
export type WalletKind = "credit_card" | "bank_account" | "upi_lite" | "cash";

export type WalletType = {
  id?: string;
  name: string;
  walletType: WalletKind;
  image: any;
  uid?: string;
  created?: Date | Timestamp | string;

  totalIncome?: number;
  totalExpenses?: number;

  // For bank_account, upi_lite, cash
  currentBalance?: number;

  // Credit-card only
  creditLimit?: number;
  billingDay?: number; // 1-28
  pendingAmount?: number;
  lastBillPaidAt?: Date | Timestamp | string;
};
```

This resolves the ambiguity in the older shared-`amount` approach and gives each wallet type a clear financial meaning.

### 3.2 Transaction model

```ts
export type TransactionType = {
  id?: string;
  type: "income" | "expense";
  amount: number;
  category?: string;
  date: Date | Timestamp | string;
  description?: string;
  image?: any;
  uid?: string;

  walletId: string;
  walletType?: WalletKind;

  transactionSource?: "manual" | "credit_card_bill_payment";
  linkedWalletId?: string;
};
```

Keeping `walletType` and bill-payment linkage on the transaction avoids extra wallet lookups and preserves historical context.

---

## 4. Wallet semantics

### 4.1 Bank account / UPI Lite / Cash

These wallets use `currentBalance`.

Rules:

- `income` → `currentBalance += amount`
- `expense` → `currentBalance -= amount`
- `totalIncome += amount` for income
- `totalExpenses += amount` for expense.

### 4.2 Credit card

Credit cards use:

- `creditLimit`
- `pendingAmount`

Rules:

- `expense` → `pendingAmount += amount`
- `income` → `pendingAmount = max(pendingAmount - amount, 0)`
- `totalExpenses += amount` for expense
- `totalIncome += amount` for income

Available credit:

```ts
availableCredit = max(creditLimit - pendingAmount, 0);
```

This matches credit-card usage semantics better than treating the card like a normal balance wallet.

---

## 5. Wallet creation and edit UX

### 5.1 Wallet create

Wallet type selector appears first, with no default selection. Supported options:

- Credit Card
- Bank
- UPI Lite
- Cash.

### 5.2 Conditional fields

#### Credit Card

- Wallet Name
- Icon
- Card Limit
- Billing Day
- initialize `pendingAmount = 0`.

#### Bank Account

- Wallet Name
- Icon
- Current Balance optional.

#### UPI Lite

- Wallet Name
- Icon
- Current Balance optional.

#### Cash

- Wallet Name
- Icon
- Current Balance optional.

### 5.3 Edit mode

- Type is visible but disabled
- Name editable
- Image editable
- Type-specific fields editable
- Credit-card edit view shows `Mark Bill as Paid` CTA.

---

## 6. Transaction behavior

### 6.1 Standard manual transaction flow

On transaction creation/update:

1. Fetch wallet
2. Apply wallet-type-specific math
3. Stamp `walletType` on transaction
4. Persist wallet + transaction atomically where possible.

### 6.2 Credit-card income meaning

For credit cards, `income` means a reduction in due amount, such as:

- refund
- reversal
- cashback credit
- settlement-side credit record.

---

## 7. Credit-card bill payment flow

This is a wallet action launched from a credit-card wallet, not a normal manual transaction entry flow.

### 7.1 UX flow

1. User opens a credit-card wallet
2. Taps `Mark Bill as Paid`
3. Bottom sheet/modal shows:
   - card name
   - pending amount
   - available bank accounts only
   - payment date defaulted to today
   - amount to pay, default = full pending amount

4. User confirms.

### 7.2 V1 validation

- selected source wallet must be `bank_account`
- pending amount must be `> 0`
- at least one bank account must exist
- paid amount must be `> 0`
- paid amount must be `<= pendingAmount`
- bank balance must be sufficient in V1.

### 7.3 Service behavior

```ts
markCreditCardBillPaid(
  creditCardId: string,
  bankAccountId: string,
  paidAmount: number,
  paymentDate?: Date
)
```

On confirm:

1. fetch card and bank wallet
2. validate types and balances
3. update bank account:
   - `currentBalance -= paidAmount`
   - `totalExpenses += paidAmount`

4. update credit card:
   - `pendingAmount = max(pendingAmount - paidAmount, 0)`
   - if full payment, pending becomes `0`
   - `lastBillPaidAt = now/paymentDate`
   - `totalIncome += paidAmount`

5. create two linked transaction records.

### 7.4 Linked transaction records

#### Credit card side

```ts
{
  type: "income",
  amount: paidAmount,
  walletId: creditCardId,
  walletType: "credit_card",
  transactionSource: "credit_card_bill_payment",
  linkedWalletId: bankAccountId,
  description: `Bill paid via ${bankAccountName}`
}
```

#### Bank account side

```ts
{
  type: "expense",
  amount: paidAmount,
  walletId: bankAccountId,
  walletType: "bank_account",
  transactionSource: "credit_card_bill_payment",
  linkedWalletId: creditCardId,
  category: "Credit Card Payment",
  description: `Credit card bill payment for ${creditCardName}`
}
```

This preserves both the bank outflow and the credit-card settlement trail.

---

## 8. Accounting rule for Home

Bill payment is a money movement, not a new purchase.

Therefore:

```ts
MonthlySpend =
  sum(expense transactions in selected month)
  excluding transactions where transactionSource === "credit_card_bill_payment"
```

Without this exclusion, a card purchase gets counted once at purchase time and again at bill payment time.

---

## 9. Home redesign

### 9.1 Controls

Home gets a selected-month control, defaulting to current month, initially supporting the last 12 months or current-year visible pills depending on UI implementation. Both source docs agree Home becomes month-aware; the lightweight pill-strip interaction from `LLD.md` can be used on top of the month-bounded logic from `WALLET_TYPES_HOME_LLD.md`.

### 9.2 Metrics

#### Monthly Spend

Expense transactions in selected month excluding bill-settlement expense records.

#### In Hand

```ts
inHand = sum(currentBalance of bank_account + upi_lite + cash)
```

#### Borrowed Power

```ts
borrowedPower = sum(max(creditLimit - pendingAmount, 0) for all credit cards)
```

#### Overall Spend Capacity

```ts
overallSpendCapacity = inHand + borrowedPower;
```

### 9.3 Home transaction list

- filtered by selected month
- ordered by date desc
- empty state reflects selected month.

### 9.4 Query strategy

Preferred architecture is month-bounded query/service abstraction. If current code already subscribes to all transactions and dataset size is small, V1 may use client-side filtering temporarily, but the canonical design should use start/end month boundaries at the service layer.

---

## 10. Validation rules

### 10.1 Wallet validation

For credit cards:

- `creditLimit > 0`
- `billingDay` in allowed range.

For bank/UPI/cash:

- `currentBalance >= 0` at initial setup.

### 10.2 Transaction validation

- wallet required
- amount must be `> 0`
- wallet type determines math
- credit-card income cannot drive pending below zero; service clamps to zero
- bill payment only from bank account.

---

## 11. Edge cases

1. User taps `Mark Bill as Paid` when pending is zero → block with message.
2. No bank accounts exist → disable CTA or prompt to create bank account first.
3. Bank balance lower than due amount → block in V1.
4. Credit-card income greater than pending → clamp to zero.
5. Linked wallet later deleted → historical transaction remains valid because transaction stores type/link metadata.
6. Partial bill payment → supported by `paidAmount <= pendingAmount`; remaining pending stays open. This is an inference from the editable amount flow in `LLD.md` combined with the typed pending model.

---

## 12. Encryption and storage

### 12.1 Wallet fields

Keep plaintext:

- `walletType`
- `billingDay`
  These are structural/non-sensitive enough and useful for filtering/UI. `LLD.md` already kept `billingDate` plaintext, while `WALLET_TYPES_HOME_LLD.md` recommended encrypting `billingDay`; for v3, plaintext is the cleaner operational choice.

Encrypt:

- `name`
- `currentBalance`
- `totalIncome`
- `totalExpenses`
- `creditLimit`
- `pendingAmount`.

### 12.2 Transaction fields

Encrypt:

- `amount`
- `category`
- `description`

Keep plaintext:

- `walletId`
- `walletType`
- `transactionSource`
- `linkedWalletId`
- `date`.
  This follows the structural-metadata approach from the stronger LLD.

---

## 13. Migration

### 13.1 Wallet migration

For existing wallet docs:

- set `walletType = "bank_account"` by default
- map old `amount -> currentBalance`
- preserve `totalIncome`, `totalExpenses`
- leave credit-card-only fields absent.

### 13.2 Transaction migration

For existing transactions:

- backfill `walletType` using referenced wallet if available
- if wallet no longer exists, leave undefined and handle gracefully in UI.

### 13.3 Backward compatibility

During transition:

- read adapters may still accept legacy `amount`
- write path should always emit v3 shape.
  This is an implementation recommendation to reduce migration risk, based on the mismatch between old and new wallet schema.

---

## 14. Service-layer changes

### 14.1 Wallet service

Add or refactor:

- `createOrUpdateWallet()`
- `markCreditCardBillPaid()`
- `getWalletDisplayMetrics()`
- `applyTransactionToWallet()`
- `revertTransactionFromWallet()`.

Responsibilities:

- validate required fields by wallet type
- initialize type-specific fields
- prevent wallet type mutation
- preserve existing type-specific values on partial updates.

### 14.2 Transaction service

Responsibilities:

- fetch wallet before applying transaction
- branch by wallet type
- stamp `walletType`
- handle linked settlement records
- prevent `pendingAmount < 0`.

### 14.3 Home data service

Either:

- add a Home-specific data service, or
- extend transaction service with month-bounded reads and metric aggregation.

---

## 15. UI/file change summary

| File                                | Change                                                             |
| ----------------------------------- | ------------------------------------------------------------------ |
| `types.ts`                          | Replace generic wallet semantics with v3 typed schema              |
| `services/walletService.ts`         | Add wallet-type-aware create/update and `markCreditCardBillPaid()` |
| `services/transactionService.ts`    | Add wallet-type-aware apply/revert logic                           |
| `services/encryptionService.ts`     | Update encrypted field lists                                       |
| `app/(modals)/walletModal.tsx`      | Type selector + conditional inputs + locked type                   |
| `app/(modals)/transactionModal.tsx` | Wallet labels include type; CC allows income/expense               |
| `app/(tabs)/wallet.tsx`             | Pass wallet type data to list items                                |
| `components/WalletListItem.tsx`     | Type badge, CC usage view, billing reminder                        |
| `components/HomeCard.tsx`           | Monthly Spend, In Hand, Borrowed Power, Spend Capacity             |
| `app/(tabs)/index.tsx`              | Month selector + month-filtered transactions                       |
| `constants/categories.ts`           | Add `Credit Card Payment` category                                 |

This file map merges the implementation clarity from `LLD.md` with the stronger typed-service design from `WALLET_TYPES_HOME_LLD.md`.

---

## 16. Implementation phases

### Phase 1

- type updates
- schema updates
- encryption updates
- migration utilities.

### Phase 2

- wallet modal
- wallet list
- transaction modal
- service-layer branching by wallet type.
  This phase grouping is inferred from the UI/service split across both docs.

### Phase 3

- bill payment flow
- linked transaction creation
- validation and edge-case handling.

### Phase 4

- Home month selector
- month-filtered reads
- metric aggregation
- QA on double-count prevention.

---

## 17. Risks

1. **Double-counted spend** if settlement records are not excluded from Monthly Spend.
2. **Broken historical math** if old `amount` data is not migrated carefully to `currentBalance`.
3. **Incorrect card ledger** if bill payment only resets card state without writing the card-side transaction.
4. **UI inconsistency** if wallet type is changeable after creation.
5. **Performance drift** if Home continues loading all transactions indefinitely instead of month-bounded reads as data grows.

---

## 18. Approval checklist

Approve only if all below are accepted:

- typed wallet schema
- linked bill payment records
- spend double-count prevention
- wallet type lock after creation
- migration approach
- plaintext vs encrypted field split
- Home month filter limited to Home
- V1 insufficient-balance blocking behavior.

---

# Wallet + Home LLD v3 (Engineering Spec)

## 1. Firestore Schema

### 1.1 Wallet Document

```json
wallets/{walletId}
{
  "uid": "user_id",
  "name": "HDFC Credit Card",
  "walletType": "credit_card", // credit_card | bank_account | upi_lite | cash
  "image": "...",
  "created": "timestamp",

  "totalIncome": 0,
  "totalExpenses": 0,

  // non-CC
  "currentBalance": 25000,

  // CC only
  "creditLimit": 100000,
  "billingDay": 5,
  "pendingAmount": 20000,
  "lastBillPaidAt": "timestamp"
}
```

---

### 1.2 Transaction Document

```json
transactions/{txnId}
{
  "uid": "user_id",
  "walletId": "wallet_id",
  "walletType": "credit_card",

  "type": "expense", // income | expense
  "amount": 500,
  "category": "Food",
  "description": "Dinner",
  "date": "timestamp",

  "transactionSource": "manual", // manual | credit_card_bill_payment
  "linkedWalletId": "other_wallet_id"
}
```

---

## 2. Core Service Logic

---

### 2.1 Apply Transaction

```ts
applyTransaction(wallet, txn) {
  if (wallet.walletType === "credit_card") {
    if (txn.type === "expense") {
      wallet.pendingAmount += txn.amount;
      wallet.totalExpenses += txn.amount;
    } else {
      wallet.pendingAmount = Math.max(wallet.pendingAmount - txn.amount, 0);
      wallet.totalIncome += txn.amount;
    }
  } else {
    if (txn.type === "expense") {
      wallet.currentBalance -= txn.amount;
      wallet.totalExpenses += txn.amount;
    } else {
      wallet.currentBalance += txn.amount;
      wallet.totalIncome += txn.amount;
    }
  }
}
```

---

### 2.2 Revert Transaction

```ts
revertTransaction(wallet, txn) {
  // exact reverse of applyTransaction
}
```

---

### 2.3 Credit Card Bill Payment

```ts
markCreditCardBillPaid(cardId, bankId, amount) {
  const card = getWallet(cardId);
  const bank = getWallet(bankId);

  assert(card.walletType === "credit_card");
  assert(bank.walletType === "bank_account");
  assert(amount > 0);
  assert(amount <= card.pendingAmount);
  assert(bank.currentBalance >= amount);

  // update bank
  bank.currentBalance -= amount;
  bank.totalExpenses += amount;

  // update card
  card.pendingAmount = Math.max(card.pendingAmount - amount, 0);
  card.totalIncome += amount;
  card.lastBillPaidAt = now();

  // create transactions
  createTxn({
    walletId: bankId,
    walletType: "bank_account",
    type: "expense",
    amount,
    category: "Credit Card Payment",
    transactionSource: "credit_card_bill_payment",
    linkedWalletId: cardId
  });

  createTxn({
    walletId: cardId,
    walletType: "credit_card",
    type: "income",
    amount,
    transactionSource: "credit_card_bill_payment",
    linkedWalletId: bankId
  });
}
```

---

## 3. Home Aggregation Logic

---

### 3.1 Monthly Spend

```ts
monthlySpend =
  sum(txn.amount where
    txn.type === "expense" &&
    txn.transactionSource !== "credit_card_bill_payment" &&
    txn.date ∈ selectedMonth
  )
```

---

### 3.2 In Hand

```ts
inHand =
  sum(wallet.currentBalance where
    wallet.walletType !== "credit_card"
  )
```

---

### 3.3 Borrowed Power

```ts
borrowedPower =
  sum(max(wallet.creditLimit - wallet.pendingAmount, 0)
    for credit cards)
```

---

### 3.4 Overall Spend Capacity

```ts
overall = inHand + borrowedPower;
```

---

## 4. Queries

---

### 4.1 Transactions (Preferred)

```ts
getTransactions(uid, startDate, endDate);
```

Firestore query:

- `uid == user`
- `date >= start`
- `date <= end`
- order by `date desc`

---

### 4.2 Wallets

```ts
getWallets(uid);
```

---

## 5. UI Behavior

---

### 5.1 Wallet Modal

#### Step 1: Select Type

- Credit Card
- Bank
- UPI Lite
- Cash

#### Step 2: Fields

| Type        | Fields                              |
| ----------- | ----------------------------------- |
| Credit Card | name, icon, creditLimit, billingDay |
| Bank        | name, icon, currentBalance          |
| UPI Lite    | name, icon, currentBalance          |
| Cash        | name, icon, currentBalance          |

---

### 5.2 Wallet Screen

Credit card:

- pending amount
- available credit
- CTA: **Mark Bill as Paid**

---

### 5.3 Bill Payment Modal

Fields:

- card name
- pending amount
- select bank account
- amount (default = full)
- date

---

### 5.4 Home

- Month selector (top)

- Metrics:
  - Monthly Spend
  - In Hand
  - Borrowed Power
  - Overall

- Transaction list filtered by month

---

## 6. Validation

---

### Wallet

- creditLimit > 0 (CC)
- billingDay ∈ [1,28]

---

### Transaction

- amount > 0
- wallet exists

---

### Bill Payment

- bank exists
- sufficient balance
- pendingAmount > 0

---

## 7. Migration

---

### Wallets

```ts
wallet.amount → wallet.currentBalance
wallet.walletType = "bank_account"
```

---

### Transactions

```ts
txn.walletType = lookup(wallet.walletType);
```

---

## 8. Encryption

---

### Encrypt

- name
- balances
- amounts
- descriptions

### Plaintext

- walletType
- walletId
- transactionSource
- linkedWalletId
- date

---

## 9. Edge Cases

- pendingAmount = 0 → block payment
- no bank → disable CTA
- partial payment allowed
- delete wallet → txn still valid (has walletType)

---

## 10. File Changes

---

### Types

- `types.ts` → new wallet + txn schema

### Services

- `walletService.ts`
- `transactionService.ts`

### UI

- wallet modal
- transaction modal
- wallet list item
- home screen

---

## 11. Non-Negotiables (Critical)

- ❌ no shared `amount` field
- ❌ no double counting spend
- ❌ no direct reset of CC without txn
- ❌ no wallet type edits

---

## 12. Optional (V2)

- partial payment reminders
- auto billing cycle detection
- analytics per wallet type
