# Wallet Types + Home Filter LLD

## Status

Draft for review only. No implementation work is included in this document.

## Objective

Reshape the current generic wallet model into a typed money-source model and update the Home screen to be month-aware.

Primary goals:

1. Add wallet types with type-specific fields and behavior.
2. Add credit-card bill payment flow tied to a bank account.
3. Update transaction creation to work with typed wallets.
4. Change Home from total balance view to current-month financial summary.
5. Add month filter on Home only.

## Product Decisions Confirmed

### Wallet types

- `credit_card`
- `bank_account`
- `upi_lite`
- `cash`

### Opening balance behavior

- `bank_account`: optional opening/current balance
- `upi_lite`: optional opening/current balance
- `cash`: optional opening/current balance
- `credit_card`: no balance field; instead use `creditLimit`, `billingDay`, `pendingAmount`

### Credit card transactions

- Credit card supports both:
  - `expense`
  - `income`
- Credit card `expense` increases pending amount
- Credit card `income` decreases pending amount

### Bill payment behavior

When user marks a credit-card bill as paid:

- it must reset only the pending amount for that credit card
- it must also create/update a linked payment from a selected bank account
- user must choose which bank account paid the bill

This is not just a visual reset. It must affect bank-account balance correctly.

### Wallet type editability

- Wallet type is locked after creation
- User cannot change a wallet’s type later

### Home scope

- Month filter affects Home only
- Statistics screen remains unchanged for now

### Home metrics

Replace top-level balance card with:

- `Monthly Spend`
- `In Hand`
- `Borrowed Power`
- `Overall Spend Capacity`

Definitions:

- `Monthly Spend` = total expense transactions in selected calendar month
- `In Hand` = sum of current balances from `bank_account + cash + upi_lite`
- `Borrowed Power` = total remaining usable credit across all credit cards
- `Overall Spend Capacity` = `In Hand + Borrowed Power`

## Current System Summary

Current implementation characteristics:

- Wallets are generic and use `amount` as a shared balance field
- Wallet math is centralized in transaction service and assumes wallet balances always go up/down directly
- Home card is wallet-total based, not month-based
- Transaction list on Home is not month-filtered

These assumptions are incompatible with credit-card semantics, so this feature requires data-model and service-layer changes, not just UI updates.

## Proposed Data Model

## Wallet Type Model

```ts
export type WalletKind =
  | "credit_card"
  | "bank_account"
  | "upi_lite"
  | "cash";

export type WalletType = {
  id?: string;
  name: string;
  walletType: WalletKind;
  image: any;
  uid?: string;
  created?: Date | Timestamp | string;

  totalIncome?: number;
  totalExpenses?: number;

  // Applies to bank_account, upi_lite, cash
  currentBalance?: number;

  // Credit-card-only fields
  creditLimit?: number;
  billingDay?: number;
  pendingAmount?: number;
  lastBillPaidAt?: Date | Timestamp | string;
};
```

## Transaction Model

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

  // Optional metadata for system-generated bill settlement records
  transactionSource?: "manual" | "credit_card_bill_payment";
  linkedWalletId?: string;
};
```

## Why keep `walletType` on transaction

- avoids wallet lookup for each list item
- enables future filtering by wallet type
- preserves historical context even if wallet name changes
- simplifies credit-card/bank-account paired payment records

## Wallet Semantics

### Bank Account

- stores `currentBalance`
- normal income increases balance
- normal expense decreases balance

### UPI Lite

- stores `currentBalance`
- same math as bank account

### Cash

- stores `currentBalance`
- same math as bank account

### Credit Card

- stores `creditLimit`
- stores `pendingAmount`
- `pendingAmount` means unpaid card utilization
- available card power is computed:

```ts
availableCredit = max(creditLimit - pendingAmount, 0)
```

- expense increases `pendingAmount`
- income decreases `pendingAmount`

## Wallet Creation Flow

## Shared inputs

- wallet name
- wallet type
- optional image

## Conditional inputs by type

### Credit Card

- `creditLimit` required
- `billingDay` required
- opening balance hidden
- initialize `pendingAmount = 0`

### Bank Account

- `currentBalance` optional
- label: `Current Balance`

### UPI Lite

- `currentBalance` optional

### Cash

- `currentBalance` optional

## Editing rules

- name can be edited
- image can be edited
- type cannot be edited
- type-specific fields can be edited
- credit card edit screen includes `Mark Bill as Paid`

## Transaction Behavior

## Standard wallet transaction rules

For `bank_account`, `upi_lite`, `cash`:

- `income`:
  - `currentBalance += amount`
  - `totalIncome += amount`
- `expense`:
  - `currentBalance -= amount`
  - `totalExpenses += amount`

## Credit card transaction rules

### Credit-card expense

- `pendingAmount += amount`
- `totalExpenses += amount`

### Credit-card income

Interpretation: refund, reversal, cashback credit, or any money reducing due amount.

- `pendingAmount -= amount`
- `totalIncome += amount`
- final pending amount cannot go below `0`

```ts
pendingAmount = max(pendingAmount - amount, 0)
```

## Bill Payment Flow

This is a wallet action initiated from a credit card wallet, not a normal transaction-entry flow.

## UX flow

1. User opens a credit-card wallet.
2. User taps `Mark Bill as Paid`.
3. App shows modal/sheet:
   - credit card name
   - current pending amount
   - dropdown of available bank accounts only
   - payment date defaulted to today
4. User selects bank account and confirms.

## Service behavior

Assume:

- selected credit card pending amount = `X`
- selected bank account current balance = `B`

On confirm:

1. Validate selected wallet is a `bank_account`
2. Validate pending amount > 0
3. Validate bank account has sufficient balance if strict mode is enabled
4. Update bank account:
   - `currentBalance = B - X`
5. Update credit card:
   - `pendingAmount = 0`
   - `lastBillPaidAt = now`
6. Create two linked transaction records

## Linked transaction records

### Credit card side

Create income transaction on the credit card:

- `type = "income"`
- `amount = X`
- `walletId = creditCardId`
- `walletType = "credit_card"`
- `transactionSource = "credit_card_bill_payment"`
- `linkedWalletId = bankAccountId`
- `description = "Bill paid via <bank account name>"`

Reason:
- this reduces pending amount using the same wallet math model
- it creates an auditable record on the card timeline

### Bank account side

Create expense transaction on the bank account:

- `type = "expense"`
- `amount = X`
- `walletId = bankAccountId`
- `walletType = "bank_account"`
- `transactionSource = "credit_card_bill_payment"`
- `linkedWalletId = creditCardId`
- `description = "Credit card bill payment for <card name>"`

Reason:
- bank balance drops correctly
- payment is visible in transaction history

## Important accounting note

This flow creates a money movement event, not a new purchase expense.

To avoid double counting in monthly spend, `Monthly Spend` on Home should exclude:

- `transactionSource = "credit_card_bill_payment"`

Otherwise:

- purchase on credit card counts once as expense
- bill payment from bank counts again as expense

That would be wrong.

## Home Screen Design

## Current behavior

Current card is wallet-total based.

## New behavior

Home becomes month-aware with a selected month state.

### Controls

- month selector on Home
- default selected month = current calendar month
- options = last 12 months initially

### Metrics shown

#### Monthly Spend

Definition:

- sum of expense transactions in selected month
- exclude `credit_card_bill_payment` expense records

#### In Hand

Definition:

- sum of `currentBalance` from:
  - bank accounts
  - UPI Lite wallets
  - cash wallets

#### Borrowed Power

Definition:

- sum of remaining usable credit across all cards

```ts
sum(max(creditLimit - pendingAmount, 0))
```

#### Overall Spend Capacity

Definition:

```ts
overallSpendCapacity = inHand + borrowedPower
```

## Home transaction list

- filtered by selected month only
- ordered by date desc
- if no records, empty message reflects selected month

## Month Filter Design

## Scope

- affects Home only
- does not affect Statistics for now

## State

```ts
type MonthFilter = {
  year: number;
  month: number; // 0-11
};
```

## Query boundaries

For selected month:

```ts
start = first day of selected month at 00:00
end = first day of next month at 00:00
```

Firestore query:

- `where("date", ">=", start)`
- `where("date", "<", end)`
- `orderBy("date", "desc")`

## Service Layer Changes

## New wallet helpers

Introduce wallet-type-aware helpers:

- `applyTransactionToWallet(wallet, tx)`
- `revertTransactionFromWallet(wallet, tx)`
- `getWalletDisplayMetrics(wallet)`
- `markCreditCardBillPaid(creditCardId, bankAccountId, date?)`

## Wallet create/update service changes

Responsibilities:

- validate required fields by wallet type
- initialize type-specific fields
- prevent wallet type change on existing records
- preserve existing type-specific values on partial update

## Transaction service changes

Responsibilities:

- fetch wallet before applying transaction changes
- branch logic by `walletType`
- stamp `walletType` on transaction writes
- handle linked bill-payment transactions
- ensure credit-card pending amount never drops below zero

## Home data service

Add new Home-focused service, or extend transaction service:

- `fetchHomeMonthSummary(uid, selectedMonth)`
- returns:
  - `monthlySpend`
  - `monthTransactions`
  - `inHand`
  - `borrowedPower`
  - `overallSpendCapacity`

## UI Changes by Screen

## Wallet Modal

File likely impacted:

- `app/(modals)/walletModal.tsx`

Changes:

- add wallet-type selector
- add conditional fields
- lock type when editing
- update helper copy for each type

## Wallet List / Wallet Screen

Files likely impacted:

- wallet list item components
- wallet tab screen

Changes:

- add wallet type badge:
  - `CC`
  - `BA`
  - `UPI`
  - `C`
- show type-specific metrics:
  - credit card: limit, pending, available
  - others: current balance
- add `Mark Bill as Paid` CTA for credit cards

## Transaction Modal

File likely impacted:

- `app/(modals)/transactionModal.tsx`

Changes:

- wallet dropdown labels include wallet type
- selected wallet stamps `walletType`
- for credit cards:
  - helper copy about pending amount
  - allow `income` and `expense`

## Home

Files likely impacted:

- `components/HomeCard.tsx`
- `app/(tabs)/index.tsx`

Changes:

- add month selector
- top card shows:
  - monthly spend
  - in hand
  - borrowed power
  - overall spend capacity
- transaction list filtered by selected month

## Data Migration

Existing wallets and transactions need a migration path.

## Wallet migration

For existing wallet docs:

- set `walletType = "bank_account"` by default
- map old `amount -> currentBalance`
- preserve:
  - `totalIncome`
  - `totalExpenses`
- initialize credit-card-only fields as absent

## Transaction migration

For existing transactions:

- backfill `walletType` using referenced wallet if available
- if wallet missing, leave `walletType` undefined and handle gracefully in UI
- existing transaction behavior remains unchanged after wallet migration because migrated wallets become `bank_account`

## Encryption Impact

## Wallet encrypted string fields

- `name`

`walletType` should remain plaintext.

Reason:

- structural metadata
- easier querying and filtering
- not sensitive enough to justify encryption overhead

## Wallet encrypted numeric fields

Recommended:

- `currentBalance`
- `totalIncome`
- `totalExpenses`
- `creditLimit`
- `pendingAmount`
- `billingDay`

## Transaction encrypted fields

Keep encrypted:

- `amount`
- `category`
- `description`

Keep plaintext:

- `walletId`
- `walletType`
- `transactionSource`
- `linkedWalletId`

## Validation Rules

## Wallet validation

### Credit card

- `creditLimit > 0`
- `billingDay` within allowed day range

### Bank account / UPI Lite / Cash

- `currentBalance >= 0` for initial setup

## Transaction validation

- all transactions require wallet selection
- amount must be `> 0`
- for credit card income:
  - amount cannot reduce pending below zero unless clamped by service
- for bill payment:
  - selected source wallet must be `bank_account`

## Edge Cases

1. Credit card pending amount is zero and user taps `Mark Bill as Paid`
- block action with message

2. No bank accounts exist
- disable bill payment CTA or show prompt to create bank account first

3. Bank account balance is less than card due amount
- either block or allow negative balance

Recommended V1:

- block and show validation error

4. Credit-card income larger than pending amount
- clamp pending to zero

5. Deleted linked wallet after bill payment
- linked historical transaction remains valid because transaction stores snapshot metadata

## Implementation Phases

### Phase 1

- type updates
- schema extension
- encryption field updates
- migration utilities

### Phase 2

- wallet create/edit UX
- wallet list rendering by type

### Phase 3

- transaction service type-aware behavior
- transaction modal updates

### Phase 4

- credit-card bill payment flow
- linked bank-account settlement records

### Phase 5

- Home month filter
- Home monthly summary card
- filtered transaction list

## Risks

1. Existing transaction logic currently assumes one numeric wallet balance field.
- This must be refactored carefully before credit-card support is added.

2. Bill payment can accidentally double count expenses.
- Must exclude settlement transactions from monthly spend.

3. Wallet migration touches encrypted numeric fields.
- Migration order and repair logic must be deliberate.

4. Linking two system-generated transactions requires consistent rollback behavior.
- If one write fails, the service should fail atomically or compensate.

## Recommendation

Proceed with implementation using these principles:

- keep Firestore collection name `wallets`
- add `walletType` rather than renaming the domain entity
- treat bill payment as a linked transfer-like flow
- compute Home summary from transactions plus typed-wallet availability
- keep month filtering limited to Home in V1

## Review Items

Please confirm these before implementation:

1. Bill payment should be blocked if selected bank account has insufficient balance.
2. `credit_card_bill_payment` transactions should be hidden from the default Home transaction list, or shown with a special label.
3. `billingDay` should be day-of-month only, not a full date.
