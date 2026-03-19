import { ResponseType, TransactionType, WalletType } from "@/types";
import { uploadFileToCloudinary } from "./imageService";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { auth, firestore } from "@/config/firebase";
import { createOrUpdateWallet } from "./walletService";
import { getLast12Months, getLast7Days, getYearsRange } from "@/utils/common";
import { scale } from "@/utils/styling";
import { colors } from "@/constants/theme";
import {
  deriveKey,
  decryptDocument,
  encryptDocument,
  TRANSACTION_STRING_FIELDS,
  TRANSACTION_NUMERIC_FIELDS,
  WALLET_STRING_FIELDS,
  WALLET_NUMERIC_FIELDS,
} from "./encryptionService";

const getUserId = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("User not authenticated");
  return uid;
};

// ---------------------------------------------------------------------------
// Wallet-type-aware balance helpers
// ---------------------------------------------------------------------------

/**
 * Returns wallet updates to apply after a transaction.
 * Credit cards: expense raises pendingAmount; income lowers it (clamped to 0).
 * Others: income raises currentBalance; expense lowers it.
 */
const applyTxnToWallet = (
  wallet: WalletType,
  type: string,
  amount: number
): Partial<WalletType> => {
  if (wallet.walletType === "credit_card") {
    const pending = wallet.pendingAmount ?? 0;
    if (type === "expense") {
      return {
        pendingAmount: pending + amount,
        totalExpenses: (wallet.totalExpenses ?? 0) + amount,
      };
    } else {
      return {
        pendingAmount: Math.max(pending - amount, 0),
        totalIncome: (wallet.totalIncome ?? 0) + amount,
      };
    }
  } else {
    const balance = wallet.currentBalance ?? wallet.amount ?? 0;
    if (type === "income") {
      return {
        currentBalance: balance + amount,
        totalIncome: (wallet.totalIncome ?? 0) + amount,
      };
    } else {
      return {
        currentBalance: balance - amount,
        totalExpenses: (wallet.totalExpenses ?? 0) + amount,
      };
    }
  }
};

/**
 * Exact reverse of applyTxnToWallet — used when editing or deleting a transaction.
 */
const revertTxnFromWallet = (
  wallet: WalletType,
  type: string,
  amount: number
): Partial<WalletType> => {
  if (wallet.walletType === "credit_card") {
    const pending = wallet.pendingAmount ?? 0;
    if (type === "expense") {
      return {
        pendingAmount: Math.max(pending - amount, 0),
        totalExpenses: Math.max((wallet.totalExpenses ?? 0) - amount, 0),
      };
    } else {
      return {
        pendingAmount: pending + amount,
        totalIncome: Math.max((wallet.totalIncome ?? 0) - amount, 0),
      };
    }
  } else {
    const balance = wallet.currentBalance ?? wallet.amount ?? 0;
    if (type === "income") {
      return {
        currentBalance: balance - amount,
        totalIncome: Math.max((wallet.totalIncome ?? 0) - amount, 0),
      };
    } else {
      return {
        currentBalance: balance + amount,
        totalExpenses: Math.max((wallet.totalExpenses ?? 0) - amount, 0),
      };
    }
  }
};

// ---------------------------------------------------------------------------
// Transaction CRUD
// ---------------------------------------------------------------------------

export const createOrUpdateTransaction = async (
  transactionData: Partial<TransactionType>
) => {
  try {
    const uid = getUserId();
    const key = deriveKey(uid);
    const { id, type, amount, walletId } = transactionData;

    if (!amount || amount <= 0 || !type) {
      return { success: false, msg: "Invalid transaction data!" };
    }

    const newWalletId = walletId || "";

    if (id) {
      // Updating existing transaction — fetch original first
      const oldTransactionSnapshot = await getDoc(
        doc(firestore, "users", uid, "transactions", id)
      );
      const rawOldTransaction = oldTransactionSnapshot.data() as TransactionType;
      const oldTransaction = decryptDocument(
        rawOldTransaction,
        TRANSACTION_STRING_FIELDS,
        TRANSACTION_NUMERIC_FIELDS,
        key
      );
      const oldWalletId = oldTransaction.walletId || "";

      const shouldRevert =
        oldTransaction.type !== type ||
        oldTransaction.amount !== amount ||
        oldWalletId !== newWalletId;

      if (shouldRevert) {
        if (oldWalletId && newWalletId) {
          const res = await revertAndUpdateWallets(
            oldTransaction,
            Number(amount),
            type,
            newWalletId
          );
          if (!res.success) return res;
        } else if (oldWalletId && !newWalletId) {
          const oldWalletSnap = await getDoc(
            doc(firestore, "users", uid, "wallets", oldWalletId)
          );
          if (oldWalletSnap.exists()) {
            const oldWallet = decryptDocument(
              oldWalletSnap.data() as WalletType,
              WALLET_STRING_FIELDS,
              WALLET_NUMERIC_FIELDS,
              key
            );
            const revertUpdates = revertTxnFromWallet(
              oldWallet,
              oldTransaction.type,
              Number(oldTransaction.amount)
            );
            await createOrUpdateWallet({ id: oldWalletId, ...revertUpdates });
          }
        } else if (!oldWalletId && newWalletId) {
          const res = await updateWalletForNewTransaction(newWalletId, Number(amount), type);
          if (!res.success) return res;
        }
      }
    } else {
      // New transaction
      if (newWalletId) {
        const res = await updateWalletForNewTransaction(newWalletId, Number(amount), type);
        if (!res.success) return res;
      }
    }

    // Stamp walletType on the transaction (plaintext — used for filtering)
    if (newWalletId) {
      const walletSnap = await getDoc(
        doc(firestore, "users", uid, "wallets", newWalletId)
      );
      if (walletSnap.exists()) {
        transactionData.walletType = walletSnap.data().walletType;
      }
    }

    // Upload receipt image if provided
    if (transactionData.image) {
      const imageUploadResponse = await uploadFileToCloudinary(
        transactionData.image,
        "transactions"
      );
      if (!imageUploadResponse.success) {
        return {
          success: false,
          msg: imageUploadResponse.msg || "Failed to upload image",
        };
      }
      transactionData.image = imageUploadResponse.data;
    }

    const transactionRef = id
      ? doc(firestore, "users", uid, "transactions", id)
      : doc(collection(firestore, "users", uid, "transactions"));
    transactionData.uid = transactionData.uid || uid;

    const encryptedTransaction = encryptDocument(
      transactionData,
      TRANSACTION_STRING_FIELDS,
      TRANSACTION_NUMERIC_FIELDS,
      key
    );
    await setDoc(transactionRef, encryptedTransaction, { merge: true });

    return { success: true, data: { ...transactionData, id: transactionRef.id } };
  } catch (error: any) {
    console.error("Error creating or updating transaction:", error);
    return { success: false, msg: error.message };
  }
};

export const updateWalletForNewTransaction = async (
  walletId: string,
  amount: number,
  type: string
) => {
  try {
    const uid = getUserId();
    const key = deriveKey(uid);

    const walletRef = doc(firestore, "users", uid, "wallets", walletId);
    const walletSnapshot = await getDoc(walletRef);

    if (!walletSnapshot.exists()) {
      return { success: false, msg: "Wallet not found!" };
    }

    const walletData = decryptDocument(
      walletSnapshot.data() as WalletType,
      WALLET_STRING_FIELDS,
      WALLET_NUMERIC_FIELDS,
      key
    );

    const updates = applyTxnToWallet(walletData, type, amount);
    await createOrUpdateWallet({ id: walletId, ...updates });
    return { success: true };
  } catch (error) {
    console.error("Error updating wallet for new transaction:", error);
    return { success: false, msg: "Could not update the wallet!" };
  }
};

export const revertAndUpdateWallets = async (
  oldTransaction: TransactionType,
  newTransactionAmount: number,
  newTransactionType: string,
  newWalletId: string
) => {
  try {
    const uid = getUserId();
    const key = deriveKey(uid);

    // Fetch and decrypt original wallet
    const originalWalletSnap = await getDoc(
      doc(firestore, "users", uid, "wallets", oldTransaction.walletId)
    );
    const originalWallet = decryptDocument(
      originalWalletSnap.data() as WalletType,
      WALLET_STRING_FIELDS,
      WALLET_NUMERIC_FIELDS,
      key
    );

    // Revert old transaction from original wallet
    const revertUpdates = revertTxnFromWallet(
      originalWallet,
      oldTransaction.type,
      Number(oldTransaction.amount)
    );
    await createOrUpdateWallet({ id: oldTransaction.walletId, ...revertUpdates });

    // Re-fetch new wallet (may be same as original — now has reverted amounts)
    const newWalletSnap = await getDoc(
      doc(firestore, "users", uid, "wallets", newWalletId)
    );
    const newWallet = decryptDocument(
      newWalletSnap.data() as WalletType,
      WALLET_STRING_FIELDS,
      WALLET_NUMERIC_FIELDS,
      key
    );

    // Apply new transaction to new wallet
    const applyUpdates = applyTxnToWallet(newWallet, newTransactionType, newTransactionAmount);
    await createOrUpdateWallet({ id: newWalletId, ...applyUpdates });

    return { success: true };
  } catch (error) {
    console.error("Error updating wallets:", error);
    return { success: false, msg: "Could not update the wallet!" };
  }
};

export const deleteTransaction = async (
  transactionId: string,
  walletId: string
) => {
  try {
    const uid = getUserId();
    const key = deriveKey(uid);

    const transactionRef = doc(
      firestore,
      "users",
      uid,
      "transactions",
      transactionId
    );
    const transactionSnapshot = await getDoc(transactionRef);

    if (!transactionSnapshot.exists()) {
      return { success: false, msg: "Transaction not found" };
    }

    const transactionData = decryptDocument(
      transactionSnapshot.data() as TransactionType,
      TRANSACTION_STRING_FIELDS,
      TRANSACTION_NUMERIC_FIELDS,
      key
    );

    const txWalletId = transactionData?.walletId || "";

    if (txWalletId) {
      const walletRef = doc(firestore, "users", uid, "wallets", txWalletId);
      const walletSnapshot = await getDoc(walletRef);

      if (!walletSnapshot.exists()) {
        return { success: false, msg: "Wallet not found" };
      }

      const walletData = decryptDocument(
        walletSnapshot.data() as WalletType,
        WALLET_STRING_FIELDS,
        WALLET_NUMERIC_FIELDS,
        key
      );

      const revertUpdates = revertTxnFromWallet(
        walletData,
        transactionData.type,
        Number(transactionData.amount)
      );
      await createOrUpdateWallet({ id: txWalletId, ...revertUpdates });
    }

    await deleteDoc(transactionRef);
    return { success: true, msg: "Transaction deleted and wallet updated" };
  } catch (error) {
    console.error("Error deleting transaction and updating wallet:", error);
    return { success: false, msg: "Failed to delete transaction or update wallet" };
  }
};

// ---------------------------------------------------------------------------
// Statistics — queries Firestore then decrypts before aggregating
// ---------------------------------------------------------------------------

export const fetchWeeklyStats = async (uid: string): Promise<ResponseType> => {
  try {
    const key = deriveKey(uid);
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const transactionsQuery = query(
      collection(firestore, "users", uid, "transactions"),
      where("date", ">=", Timestamp.fromDate(sevenDaysAgo)),
      where("date", "<=", Timestamp.fromDate(today)),
      orderBy("date", "desc")
    );

    const querySnapshot = await getDocs(transactionsQuery);
    const weeklyData = getLast7Days();
    const transactions: TransactionType[] = [];

    querySnapshot.forEach((docSnap) => {
      const raw = { id: docSnap.id, ...docSnap.data() } as TransactionType;
      const transaction = decryptDocument(
        raw,
        TRANSACTION_STRING_FIELDS,
        TRANSACTION_NUMERIC_FIELDS,
        key
      );
      transactions.push(transaction);

      const transactionDate = (transaction.date as Timestamp)
        .toDate()
        .toISOString()
        .split("T")[0];
      const dayData = weeklyData.find((day) => day.date === transactionDate);

      if (dayData) {
        if (transaction.type === "income") dayData.income += Number(transaction.amount);
        else if (transaction.type === "expense") dayData.expense += Number(transaction.amount);
      }
    });

    const stats = weeklyData.flatMap((day) => [
      {
        value: day.income,
        label: day.day,
        spacing: scale(4),
        labelWidth: scale(30),
        frontColor: colors.primary,
      },
      { value: day.expense, frontColor: colors.rose },
    ]);

    return { success: true, data: { stats, transactions } };
  } catch (error) {
    console.error("Error fetching weekly transactions:", error);
    return { success: false, msg: "Failed to fetch weekly transactions" };
  }
};

export const fetchMonthlyStats = async (uid: string): Promise<ResponseType> => {
  try {
    const key = deriveKey(uid);
    const today = new Date();
    const twelveMonthsAgo = new Date(today);
    twelveMonthsAgo.setMonth(today.getMonth() - 12);

    const transactionsQuery = query(
      collection(firestore, "users", uid, "transactions"),
      where("date", ">=", Timestamp.fromDate(twelveMonthsAgo)),
      where("date", "<=", Timestamp.fromDate(today)),
      orderBy("date", "desc")
    );

    const querySnapshot = await getDocs(transactionsQuery);
    const monthlyData = getLast12Months();
    const transactions: TransactionType[] = [];

    querySnapshot.forEach((docSnap) => {
      const raw = { id: docSnap.id, ...docSnap.data() } as TransactionType;
      const transaction = decryptDocument(
        raw,
        TRANSACTION_STRING_FIELDS,
        TRANSACTION_NUMERIC_FIELDS,
        key
      );
      transactions.push(transaction);

      const transactionDate = (transaction.date as Timestamp).toDate();
      const monthName = transactionDate.toLocaleString("default", { month: "short" });
      const shortYear = transactionDate.getFullYear().toString().slice(-2);
      const monthData = monthlyData.find(
        (month) => month.month === `${monthName} ${shortYear}`
      );

      if (monthData) {
        if (transaction.type === "income") monthData.income += Number(transaction.amount);
        else if (transaction.type === "expense") monthData.expense += Number(transaction.amount);
      }
    });

    const stats = monthlyData.flatMap((month) => [
      {
        value: month.income,
        label: month.month,
        spacing: scale(4),
        labelWidth: scale(46),
        frontColor: colors.primary,
      },
      { value: month.expense, frontColor: colors.rose },
    ]);

    return { success: true, data: { stats, transactions } };
  } catch (error) {
    console.error("Error fetching monthly transactions:", error);
    return { success: false, msg: "Failed to fetch monthly transactions" };
  }
};

export const fetchYearlyStats = async (uid: string): Promise<ResponseType> => {
  try {
    const key = deriveKey(uid);

    const transactionsQuery = query(
      collection(firestore, "users", uid, "transactions"),
      orderBy("date", "desc")
    );

    const querySnapshot = await getDocs(transactionsQuery);
    const transactions: TransactionType[] = [];

    const firstTransaction = querySnapshot.docs.reduce((earliest, docSnap) => {
      const transactionDate = docSnap.data().date.toDate();
      return transactionDate < earliest ? transactionDate : earliest;
    }, new Date());

    const firstYear = firstTransaction.getFullYear();
    const currentYear = new Date().getFullYear();
    const yearlyData = getYearsRange(firstYear, currentYear);

    querySnapshot.forEach((docSnap) => {
      const raw = { id: docSnap.id, ...docSnap.data() } as TransactionType;
      const transaction = decryptDocument(
        raw,
        TRANSACTION_STRING_FIELDS,
        TRANSACTION_NUMERIC_FIELDS,
        key
      );
      transactions.push(transaction);

      const transactionYear = (transaction.date as Timestamp).toDate().getFullYear();
      const yearData = yearlyData.find(
        (item: any) => item.year === transactionYear.toString()
      );

      if (yearData) {
        if (transaction.type === "income") yearData.income += Number(transaction.amount);
        else if (transaction.type === "expense") yearData.expense += Number(transaction.amount);
      }
    });

    const stats = yearlyData.flatMap((year: any) => [
      {
        value: year.income,
        label: year.year,
        spacing: scale(4),
        labelWidth: scale(35),
        frontColor: colors.primary,
      },
      { value: year.expense, frontColor: colors.rose },
    ]);

    return { success: true, data: { stats, transactions } };
  } catch (error) {
    console.error("Error fetching yearly transactions:", error);
    return { success: false, msg: "Failed to fetch yearly transactions" };
  }
};
