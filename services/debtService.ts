import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, firestore } from "@/config/firebase";
import {
  deriveKey,
  encryptField,
  decryptField,
  decryptNumber,
  isEncrypted,
  DEBT_STRING_FIELDS,
  DEBT_NUMERIC_FIELDS,
} from "./encryptionService";
import {
  DebtType,
  DebtFeeItem,
  DebtClosureSummary,
  InterestRateFrequency,
  DebtDurationUnit,
  DebtCalculationSource,
  ResponseType,
} from "@/types";

// ---------------------------------------------------------------------------
// Calculation input / result types
// ---------------------------------------------------------------------------

export type DebtCalculationInput = {
  loanName: string;
  lenderName: string;
  principalAmount: number;
  interestRate: number;
  interestRateFrequency: InterestRateFrequency;
  startDate: Date;
  durationValue: number;
  durationUnit: DebtDurationUnit;
  isActive: boolean;
  feeItems: DebtFeeItem[];
};

export type DebtCalculationResult = {
  monthlyEmi: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  totalCharges: number;
  totalScheduledPayable: number;
  derivedAnnualInterestRate: number;
  derivedMonthlyInterestRate: number;
  durationMonths: number;
  calculationSource: DebtCalculationSource;
  calculationExplanation?: string;
};

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

const getUserId = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("User not authenticated");
  return uid;
};

// ---------------------------------------------------------------------------
// Pure calculation helpers
// ---------------------------------------------------------------------------

const normalizeDurationMonths = (value: number, unit: DebtDurationUnit): number =>
  unit === "years" ? value * 12 : value;

const normalizeMonthlyRate = (rate: number, frequency: InterestRateFrequency): number =>
  frequency === "per_year" ? rate / 12 / 100 : rate / 100;

const computeEmi = (principal: number, monthlyRate: number, n: number): number => {
  if (monthlyRate === 0) return principal / n;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, n)) /
    (Math.pow(1 + monthlyRate, n) - 1);
};

// ---------------------------------------------------------------------------
// Exported pure calculation functions
// ---------------------------------------------------------------------------

export const calculateDebtPreview = (input: DebtCalculationInput): DebtCalculationResult => {
  const durationMonths = normalizeDurationMonths(input.durationValue, input.durationUnit);
  const derivedMonthlyInterestRate = normalizeMonthlyRate(input.interestRate, input.interestRateFrequency);
  const derivedAnnualInterestRate = derivedMonthlyInterestRate * 12 * 100;
  const monthlyEmi = computeEmi(input.principalAmount, derivedMonthlyInterestRate, durationMonths);
  const totalPrincipalPaid = input.principalAmount;
  const totalInterestPaid = Math.max(monthlyEmi * durationMonths - input.principalAmount, 0);
  const totalCharges = input.feeItems.reduce((s, f) => s + f.amount, 0);
  const totalScheduledPayable = totalPrincipalPaid + totalInterestPaid + totalCharges;

  return {
    monthlyEmi,
    totalPrincipalPaid,
    totalInterestPaid,
    totalCharges,
    totalScheduledPayable,
    derivedAnnualInterestRate,
    derivedMonthlyInterestRate,
    durationMonths,
    calculationSource: "rate_based",
  };
};

export const recalculateDebtFromEmi = (
  input: DebtCalculationInput,
  desiredEmi: number
): DebtCalculationResult => {
  const durationMonths = normalizeDurationMonths(input.durationValue, input.durationUnit);
  const P = input.principalAmount;
  const n = durationMonths;

  // Binary search for the monthly rate whose EMI matches desiredEmi
  let lo = 0;
  let hi = 0.5;
  let derivedMonthlyInterestRate = 0;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const emi = computeEmi(P, mid, n);
    if (Math.abs(emi - desiredEmi) < 0.001) {
      derivedMonthlyInterestRate = mid;
      break;
    }
    if (emi < desiredEmi) lo = mid;
    else hi = mid;
    derivedMonthlyInterestRate = mid;
  }

  // Validate that the solution is reasonable
  const checkEmi = computeEmi(P, derivedMonthlyInterestRate, n);
  if (Math.abs(checkEmi - desiredEmi) > 1 && desiredEmi < P / n) {
    throw new Error("EMI_TOO_LOW");
  }

  const derivedAnnualInterestRate = derivedMonthlyInterestRate * 12 * 100;
  const originalAnnualRate =
    input.interestRateFrequency === "per_year"
      ? input.interestRate
      : input.interestRate * 12;

  const totalPrincipalPaid = P;
  const totalInterestPaid = Math.max(desiredEmi * n - P, 0);
  const totalCharges = input.feeItems.reduce((s, f) => s + f.amount, 0);
  const totalScheduledPayable = totalPrincipalPaid + totalInterestPaid + totalCharges;

  const explanation = `Your EMI has been used as the source of truth. We recalculated the interest rate that matches this EMI for the same loan amount and duration. The implied annual rate is ${derivedAnnualInterestRate.toFixed(2)}% p.a., which differs from your original rate (${originalAnnualRate.toFixed(2)}% p.a.). This is likely due to processing fees or a different calculation method used by your lender.`;

  return {
    monthlyEmi: desiredEmi,
    totalPrincipalPaid,
    totalInterestPaid,
    totalCharges,
    totalScheduledPayable,
    derivedAnnualInterestRate,
    derivedMonthlyInterestRate,
    durationMonths,
    calculationSource: "emi_override_back_calculated",
    calculationExplanation: explanation,
  };
};

export const seedPaidMonths = (startDate: Date, count: number): string[] => {
  const months: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
};

export const getElapsedMonths = (startDate: Date): number => {
  const now = new Date();
  const elapsed = (now.getFullYear() - startDate.getFullYear()) * 12 +
    (now.getMonth() - startDate.getMonth());
  return Math.max(elapsed, 0);
};

// ---------------------------------------------------------------------------
// Encrypt / decrypt helpers for nested debt structures
// ---------------------------------------------------------------------------

export const encryptDebtDocument = (debt: Partial<DebtType>, key: string): Partial<DebtType> => {
  const result = { ...debt } as any;

  // Flat scalar fields
  for (const f of DEBT_STRING_FIELDS) {
    if (result[f] !== undefined && result[f] !== null) {
      result[f] = encryptField(result[f], key);
    }
  }
  for (const f of DEBT_NUMERIC_FIELDS) {
    if (result[f] !== undefined && result[f] !== null) {
      result[f] = encryptField(result[f], key);
    }
  }

  // feeItems nested encryption
  if (Array.isArray(result.feeItems)) {
    result.feeItems = result.feeItems.map((item: DebtFeeItem) => ({
      id: item.id,
      name: encryptField(item.name, key),
      amount: encryptField(item.amount, key),
    }));
  }

  // customMonthPayments nested encryption (month stays plaintext, amount encrypted)
  if (Array.isArray(result.customMonthPayments)) {
    result.customMonthPayments = result.customMonthPayments.map((item: any) => ({
      month: item.month,
      amount: encryptField(item.amount, key),
    }));
  }

  // closedSummary nested encryption
  if (result.closedSummary) {
    const cs = result.closedSummary;
    result.closedSummary = {
      closedAt: cs.closedAt,
      closePaymentAmount: encryptField(cs.closePaymentAmount, key),
      scheduledTotalPayable: encryptField(cs.scheduledTotalPayable, key),
      difference: encryptField(cs.difference, key),
    };
  }

  return result;
};

export const decryptDebtDocument = (debt: any, key: string): DebtType => {
  const result = { ...debt } as any;

  // Flat string fields
  for (const f of DEBT_STRING_FIELDS) {
    if (result[f] !== undefined && result[f] !== null) {
      if (!isEncrypted(result[f])) continue;
      try { result[f] = decryptField(result[f], key); } catch { /* leave as-is */ }
    }
  }

  // Flat numeric fields
  for (const f of DEBT_NUMERIC_FIELDS) {
    if (result[f] !== undefined && result[f] !== null) {
      if (typeof result[f] === "number") continue;
      if (!isEncrypted(result[f])) continue;
      try { result[f] = decryptNumber(result[f], key); } catch { /* leave as-is */ }
    }
  }

  // feeItems nested decryption
  if (Array.isArray(result.feeItems)) {
    result.feeItems = result.feeItems.map((item: any) => ({
      id: item.id,
      name: isEncrypted(item.name) ? (() => { try { return decryptField(item.name, key); } catch { return item.name; } })() : item.name,
      amount: typeof item.amount === "number" ? item.amount : isEncrypted(item.amount) ? (() => { try { return decryptNumber(item.amount, key); } catch { return 0; } })() : item.amount,
    }));
  }

  // customMonthPayments nested decryption
  if (Array.isArray(result.customMonthPayments)) {
    result.customMonthPayments = result.customMonthPayments.map((item: any) => ({
      month: item.month,
      amount: typeof item.amount === "number" ? item.amount : isEncrypted(item.amount) ? (() => { try { return decryptNumber(item.amount, key); } catch { return 0; } })() : item.amount,
    }));
  }

  // closedSummary nested decryption
  if (result.closedSummary) {
    const cs = result.closedSummary;
    result.closedSummary = {
      closedAt: cs.closedAt,
      closePaymentAmount: typeof cs.closePaymentAmount === "number" ? cs.closePaymentAmount : isEncrypted(cs.closePaymentAmount) ? (() => { try { return decryptNumber(cs.closePaymentAmount, key); } catch { return 0; } })() : cs.closePaymentAmount,
      scheduledTotalPayable: typeof cs.scheduledTotalPayable === "number" ? cs.scheduledTotalPayable : isEncrypted(cs.scheduledTotalPayable) ? (() => { try { return decryptNumber(cs.scheduledTotalPayable, key); } catch { return 0; } })() : cs.scheduledTotalPayable,
      difference: typeof cs.difference === "number" ? cs.difference : isEncrypted(cs.difference) ? (() => { try { return decryptNumber(cs.difference, key); } catch { return 0; } })() : cs.difference,
    };
  }

  // paidMonths null safety — always normalize
  result.paidMonths = Array.isArray(result.paidMonths) ? result.paidMonths : [];

  return result as DebtType;
};

// ---------------------------------------------------------------------------
// Firestore operations
// ---------------------------------------------------------------------------

export const createDebt = async (debt: Partial<DebtType>): Promise<ResponseType> => {
  try {
    const uid = getUserId();
    const key = deriveKey(uid);

    const { principalAmount, durationMonths, monthlyEmi } = debt;
    if (!principalAmount || principalAmount <= 0) {
      return { success: false, msg: "Principal amount must be greater than 0." };
    }
    if (!durationMonths || durationMonths <= 0) {
      return { success: false, msg: "Duration must be greater than 0." };
    }
    if (!monthlyEmi || monthlyEmi <= 0) {
      return { success: false, msg: "EMI must be greater than 0." };
    }

    const id = doc(collection(firestore, "users", uid, "debts")).id;
    const now = Timestamp.now();

    const fullDebt: DebtType = {
      ...debt as DebtType,
      id,
      uid,
      paidMonths: Array.isArray(debt.paidMonths) ? debt.paidMonths : [],
      isActive: debt.isActive !== false,
      status: (debt.isActive !== false) ? "active" : "inactive",
      userAcceptedCalculation: true,
      createdAt: now,
      updatedAt: now,
    };

    const encrypted = encryptDebtDocument(fullDebt, key);
    // paidMonths stays plaintext — it is already in fullDebt, and encryptDebtDocument doesn't touch it
    const writePayload = {
      ...encrypted,
      paidMonths: fullDebt.paidMonths,
    };

    await setDoc(doc(firestore, "users", uid, "debts", id), writePayload);
    return { success: true, data: { id } };
  } catch (e: any) {
    return { success: false, msg: e?.message ?? "Could not save the loan." };
  }
};

export const updateDebt = async (debt: Partial<DebtType>): Promise<ResponseType> => {
  try {
    const uid = getUserId();
    if (!debt.id) return { success: false, msg: "Missing debt ID." };

    // paidMonths is always stripped from the update payload (Section 7.4)
    const { paidMonths, id, uid: _uid, createdAt, ...writeableFields } = debt as any;

    const key = deriveKey(uid);
    const encrypted = encryptDebtDocument(writeableFields, key);

    await setDoc(
      doc(firestore, "users", uid, "debts", debt.id),
      { ...encrypted, updatedAt: Timestamp.now() },
      { merge: true }
    );
    return { success: true };
  } catch (e: any) {
    return { success: false, msg: e?.message ?? "Could not update the loan." };
  }
};

export const markMonthPaid = async (
  debtId: string,
  uid: string,
  monthStr: string
): Promise<ResponseType> => {
  try {
    const ref = doc(firestore, "users", uid, "debts", debtId);
    await updateDoc(ref, {
      paidMonths: arrayUnion(monthStr),
      updatedAt: Timestamp.now(),
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, msg: e?.message ?? "Could not mark month as paid." };
  }
};

export const closeDebt = async (
  debtId: string,
  closePaymentAmount: number,
  uid: string
): Promise<ResponseType> => {
  try {
    const key = deriveKey(uid);
    const ref = doc(firestore, "users", uid, "debts", debtId);

    // Fetch to get scheduledTotalPayable
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, msg: "Loan not found." };

    const raw = { id: snap.id, ...snap.data() } as any;
    const decrypted = decryptDebtDocument(raw, key);

    if (!decrypted.isActive) {
      return { success: false, msg: "This loan is already closed." };
    }

    const scheduledTotalPayable = decrypted.totalScheduledPayable;
    const difference = closePaymentAmount - scheduledTotalPayable;

    // Partial update only — never touches paidMonths
    await updateDoc(ref, {
      isActive: false,
      status: encryptField("inactive", key),
      "closedSummary.closedAt": Timestamp.now(),
      "closedSummary.closePaymentAmount": encryptField(closePaymentAmount, key),
      "closedSummary.scheduledTotalPayable": encryptField(scheduledTotalPayable, key),
      "closedSummary.difference": encryptField(difference, key),
      updatedAt: Timestamp.now(),
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, msg: e?.message ?? "Could not close the loan." };
  }
};

export const deleteDebt = async (debtId: string, uid: string): Promise<ResponseType> => {
  try {
    await deleteDoc(doc(firestore, "users", uid, "debts", debtId));
    return { success: true };
  } catch (e: any) {
    return { success: false, msg: e?.message ?? "Could not delete the loan." };
  }
};

export const fetchDebts = (
  uid: string,
  onData: (debts: DebtType[]) => void,
  onError: (e: Error) => void
): (() => void) => {
  const key = deriveKey(uid);
  const q = query(
    collection(firestore, "users", uid, "debts"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const debts = snapshot.docs.map((d) =>
        decryptDebtDocument({ id: d.id, ...d.data() }, key)
      );
      onData(debts);
    },
    onError
  );
};

export const fetchDebtById = (
  uid: string,
  id: string,
  onData: (debt: DebtType | null) => void,
  onError?: (e: Error) => void
): (() => void) => {
  const key = deriveKey(uid);
  const ref = doc(firestore, "users", uid, "debts", id);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const decrypted = decryptDebtDocument({ id: snap.id, ...snap.data() }, key);
      onData(decrypted);
    },
    onError ?? (() => {})
  );
};
