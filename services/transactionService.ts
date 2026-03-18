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
  updateDoc,
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
  if (!uid) {
    throw new Error("User not authenticated");
  }
  return uid;
};

export const createOrUpdateTransaction = async (
  transactionData: Partial<TransactionType>
) => {
  try {
    const uid = getUserId();
    const key = deriveKey(uid);
    const { id, type, amount, walletId, image } = transactionData;

    if (!amount || amount <= 0 || !type) {
      return {
        success: false,
        msg: "Invalid transaction data!",
      };
    }

    const newWalletId = walletId || "";

    // do this while updating: Fetch the original transaction if updating
    if (id) {
      // Fetch the old transaction data and decrypt it
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

      const shouldRevertOriginal =
        oldTransaction.type != type ||
        oldTransaction.amount != amount ||
        oldWalletId != newWalletId;

      if (shouldRevertOriginal) {
        if (oldWalletId && newWalletId) {
          // Both have wallets — revert old and apply new
          let res = await revertAndUpdateWallets(
            oldTransaction,
            Number(amount!),
            type,
            newWalletId
          );
          if (!res.success) return res;
        } else if (oldWalletId && !newWalletId) {
          // Had a wallet, now removed — revert old wallet only
          const oldWalletRef = doc(firestore, "users", uid, "wallets", oldWalletId);
          const oldWalletSnap = await getDoc(oldWalletRef);
          if (oldWalletSnap.exists()) {
            const oldWalletData = decryptDocument(
              oldWalletSnap.data() as WalletType,
              WALLET_STRING_FIELDS,
              WALLET_NUMERIC_FIELDS,
              key
            );
            const revertType = oldTransaction.type === "income" ? "totalIncome" : "totalExpenses";
            const revertAmount = oldTransaction.type === "income"
              ? -Number(oldTransaction.amount!)
              : Number(oldTransaction.amount!);
            await createOrUpdateWallet({
              id: oldWalletId,
              amount: Number(oldWalletData.amount!) + revertAmount,
              [revertType]: Number(oldWalletData[revertType]!) - Number(oldTransaction.amount!),
            });
          }
        } else if (!oldWalletId && newWalletId) {
          // No previous wallet, now adding one — apply to new wallet
          let res = await updateWalletForNewTransaction(newWalletId, Number(amount!), type);
          if (!res.success) return res;
        }
        // else: neither has a wallet — nothing to update
      }
    } else {
      // Handle wallet updates for new transactions
      if (newWalletId) {
        let res = await updateWalletForNewTransaction(newWalletId, Number(amount!), type);
        if (!res.success) return res;
      }
    }

    // Upload image if provided
    if (image) {
      const imageUploadResponse = await uploadFileToCloudinary(
        image,
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

    // Encrypt transaction data before writing to Firestore
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

    return {
      success: true,
      data: { ...transactionData, id: transactionRef.id },
    };
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

    // Fetch and decrypt the wallet
    const walletRef = doc(firestore, "users", uid, "wallets", walletId);
    const walletSnapshot = await getDoc(walletRef);

    if (!walletSnapshot.exists()) {
      console.error("Wallet not found");
      return { success: false, msg: "Wallet not found!" };
    }

    const walletData = decryptDocument(
      walletSnapshot.data() as WalletType,
      WALLET_STRING_FIELDS,
      WALLET_NUMERIC_FIELDS,
      key
    );

    // Adjust wallet balance and totals based on the transaction type
    const updatedWalletAmount =
      type === "income"
        ? Number(walletData.amount!) + amount
        : Number(walletData.amount!) - amount;

    const updateType = type === "income" ? "totalIncome" : "totalExpenses";
    const updatedTotals =
      type === "income"
        ? Number(walletData.totalIncome!) + amount
        : Number(walletData.totalExpenses!) + amount;

    // Write via createOrUpdateWallet so the new amounts are encrypted
    await createOrUpdateWallet({
      id: walletId,
      amount: updatedWalletAmount,
      [updateType]: updatedTotals,
    });
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

    // Fetch and decrypt the original wallet
    const originalWalletSnapshot = await getDoc(
      doc(firestore, "users", uid, "wallets", oldTransaction.walletId)
    );
    const originalWallet = decryptDocument(
      originalWalletSnapshot.data() as WalletType,
      WALLET_STRING_FIELDS,
      WALLET_NUMERIC_FIELDS,
      key
    );

    // Fetch and decrypt the new wallet
    let newWalletSnapshot = await getDoc(
      doc(firestore, "users", uid, "wallets", newWalletId)
    );
    let newWallet = decryptDocument(
      newWalletSnapshot.data() as WalletType,
      WALLET_STRING_FIELDS,
      WALLET_NUMERIC_FIELDS,
      key
    );

    const revertType =
      oldTransaction.type == "income" ? "totalIncome" : "totalExpenses";

    const revertIncomeExpense: number =
      oldTransaction.type == "income"
        ? -Number(oldTransaction.amount!)
        : Number(oldTransaction.amount!);

    const revertedWalletAmount =
      Number(originalWallet.amount!) + Number(revertIncomeExpense);

    const revertedIncomeExpenseAmount =
      Number(originalWallet[revertType]!) - Number(oldTransaction.amount!);

    // Update the original wallet (createOrUpdateWallet handles re-encryption)
    await createOrUpdateWallet({
      id: oldTransaction.walletId,
      amount: revertedWalletAmount,
      [revertType]: revertedIncomeExpenseAmount,
    });

    // Re-fetch the new wallet (may be same wallet — get updated amounts)
    newWalletSnapshot = await getDoc(
      doc(firestore, "users", uid, "wallets", newWalletId)
    );
    newWallet = decryptDocument(
      newWalletSnapshot.data() as WalletType,
      WALLET_STRING_FIELDS,
      WALLET_NUMERIC_FIELDS,
      key
    );

    // Apply the new transaction to the new wallet
    const updateType =
      newTransactionType == "income" ? "totalIncome" : "totalExpenses";
    const updateWalletAmount: number =
      newTransactionType == "income"
        ? Number(newTransactionAmount)
        : -Number(newTransactionAmount);

    const newWalletAmount = Number(newWallet.amount!) + updateWalletAmount;
    const newIncomeExpenseAmount =
      Number(newWallet[updateType]!) + Number(newTransactionAmount);

    await createOrUpdateWallet({
      id: newWalletId,
      amount: newWalletAmount,
      [updateType]: newIncomeExpenseAmount,
    });
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

    // Fetch and decrypt the transaction
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

    const rawTransactionData = transactionSnapshot.data();
    const transactionData = decryptDocument(
      rawTransactionData as TransactionType,
      TRANSACTION_STRING_FIELDS,
      TRANSACTION_NUMERIC_FIELDS,
      key
    );
    const transactionType = transactionData?.type;
    const transactionAmount = Number(transactionData?.amount);
    const txWalletId = transactionData?.walletId || "";

    // Update wallet if the transaction was linked to one
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

      const updateType =
        transactionType === "income" ? "totalIncome" : "totalExpenses";
      const newWalletAmount =
        Number(walletData.amount!) -
        (transactionType === "income" ? transactionAmount : -transactionAmount);
      const updatedTotals = Number(walletData[updateType]!) - transactionAmount;

      await createOrUpdateWallet({
        id: txWalletId,
        amount: newWalletAmount,
        [updateType]: updatedTotals,
      });
    }

    // Delete the transaction from Firestore
    await deleteDoc(transactionRef);

    return { success: true, msg: "Transaction deleted and wallet updated" };
  } catch (error) {
    console.error("Error deleting transaction and updating wallet:", error);
    return {
      success: false,
      msg: "Failed to delete transaction or update wallet",
    };
  }
};

/// statistics — queries Firestore then decrypts before aggregating

export const fetchWeeklyStats = async (uid: string): Promise<ResponseType> => {
  try {
    const key = deriveKey(uid);
    const db = firestore;
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const transactionsQuery = query(
      collection(db, "users", uid, "transactions"),
      where("date", ">=", Timestamp.fromDate(sevenDaysAgo)),
      where("date", "<=", Timestamp.fromDate(today)),
      orderBy("date", "desc")
    );

    const querySnapshot = await getDocs(transactionsQuery);
    const weeklyData = getLast7Days();
    const transactions: TransactionType[] = [];

    querySnapshot.forEach((doc) => {
      const raw = { id: doc.id, ...doc.data() } as TransactionType;
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
      {
        value: day.expense,
        frontColor: colors.rose,
      },
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
    const db = firestore;
    const today = new Date();
    const twelveMonthsAgo = new Date(today);
    twelveMonthsAgo.setMonth(today.getMonth() - 12);

    const transactionsQuery = query(
      collection(db, "users", uid, "transactions"),
      where("date", ">=", Timestamp.fromDate(twelveMonthsAgo)),
      where("date", "<=", Timestamp.fromDate(today)),
      orderBy("date", "desc")
    );

    const querySnapshot = await getDocs(transactionsQuery);
    const monthlyData = getLast12Months();
    const transactions: TransactionType[] = [];

    querySnapshot.forEach((doc) => {
      const raw = { id: doc.id, ...doc.data() } as TransactionType;
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
      {
        value: month.expense,
        frontColor: colors.rose,
      },
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
    const db = firestore;

    const transactionsQuery = query(
      collection(db, "users", uid, "transactions"),
      orderBy("date", "desc")
    );

    const querySnapshot = await getDocs(transactionsQuery);
    const transactions: TransactionType[] = [];

    const firstTransaction = querySnapshot.docs.reduce((earliest, doc) => {
      const transactionDate = doc.data().date.toDate();
      return transactionDate < earliest ? transactionDate : earliest;
    }, new Date());

    const firstYear = firstTransaction.getFullYear();
    const currentYear = new Date().getFullYear();
    const yearlyData = getYearsRange(firstYear, currentYear);

    querySnapshot.forEach((doc) => {
      const raw = { id: doc.id, ...doc.data() } as TransactionType;
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
      {
        value: year.expense,
        frontColor: colors.rose,
      },
    ]);

    return { success: true, data: { stats, transactions } };
  } catch (error) {
    console.error("Error fetching yearly transactions:", error);
    return { success: false, msg: "Failed to fetch yearly transactions" };
  }
};
