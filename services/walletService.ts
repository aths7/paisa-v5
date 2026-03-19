import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { uploadFileToCloudinary } from "./imageService";
import { ResponseType, WalletType } from "@/types";
import { auth, firestore } from "@/config/firebase";
import {
  deriveKey,
  encryptDocument,
  decryptDocument,
  WALLET_STRING_FIELDS,
  WALLET_NUMERIC_FIELDS,
  TRANSACTION_STRING_FIELDS,
  TRANSACTION_NUMERIC_FIELDS,
} from "./encryptionService";

const getUserId = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("User not authenticated");
  return uid;
};

/**
 * Returns the effective "current balance" for any wallet type.
 * Credit cards: pendingAmount (what is owed)
 * Others: currentBalance, falling back to legacy `amount` field
 */
export const getWalletEffectiveBalance = (wallet: WalletType): number => {
  if (wallet.walletType === "credit_card") {
    return wallet.pendingAmount ?? 0;
  }
  return wallet.currentBalance ?? wallet.amount ?? 0;
};

export const createOrUpdateWallet = async (
  walletData: Partial<WalletType>
): Promise<ResponseType> => {
  try {
    const uid = getUserId();
    let walletToSave = { ...walletData, uid };

    if (walletData.image) {
      const imageUploadResponse = await uploadFileToCloudinary(
        walletData.image,
        "wallets"
      );
      if (!imageUploadResponse.success) {
        return {
          success: false,
          msg: imageUploadResponse.msg || "Failed to upload image",
        };
      }
      walletToSave.image = imageUploadResponse.data;
    }

    if (!walletData.id) {
      // New wallet — initialise type-specific fields
      walletToSave.totalIncome = 0;
      walletToSave.totalExpenses = 0;
      walletToSave.created = new Date();

      if (walletData.walletType === "credit_card") {
        walletToSave.pendingAmount = 0;
        // creditLimit and billingDay come from walletData
      } else {
        walletToSave.currentBalance = Number(walletData.currentBalance) || 0;
      }
    }

    const walletRef = walletData.id
      ? doc(firestore, "users", uid, "wallets", walletData.id)
      : doc(collection(firestore, "users", uid, "wallets"));

    const key = deriveKey(uid);
    const encryptedWallet = encryptDocument(
      walletToSave,
      WALLET_STRING_FIELDS,
      WALLET_NUMERIC_FIELDS,
      key
    );

    await setDoc(walletRef, encryptedWallet, { merge: true });

    return {
      success: true,
      data: { ...walletToSave, id: walletRef.id },
    };
  } catch (error: any) {
    console.error("Error creating or updating wallet:", error);
    return { success: false, msg: error.message };
  }
};

/**
 * Records a credit-card bill payment from a bank account.
 * Creates two linked transactions (bank expense + card income) and updates both wallet balances.
 */
export const markCreditCardBillPaid = async (
  creditCardId: string,
  bankAccountId: string,
  paidAmount: number,
  paymentDate?: Date
): Promise<ResponseType> => {
  try {
    const uid = getUserId();
    const key = deriveKey(uid);
    const date = paymentDate ?? new Date();

    const cardRef = doc(firestore, "users", uid, "wallets", creditCardId);
    const bankRef = doc(firestore, "users", uid, "wallets", bankAccountId);

    const [cardSnap, bankSnap] = await Promise.all([
      getDoc(cardRef),
      getDoc(bankRef),
    ]);

    if (!cardSnap.exists()) return { success: false, msg: "Credit card not found" };
    if (!bankSnap.exists()) return { success: false, msg: "Bank account not found" };

    const card = decryptDocument(
      cardSnap.data() as WalletType,
      WALLET_STRING_FIELDS,
      WALLET_NUMERIC_FIELDS,
      key
    );
    const bank = decryptDocument(
      bankSnap.data() as WalletType,
      WALLET_STRING_FIELDS,
      WALLET_NUMERIC_FIELDS,
      key
    );

    // Validations
    if (card.walletType !== "credit_card")
      return { success: false, msg: "Selected wallet is not a credit card" };
    if (bank.walletType !== "bank_account")
      return { success: false, msg: "Source must be a bank account" };

    const pendingAmount = card.pendingAmount ?? 0;
    const bankBalance = bank.currentBalance ?? bank.amount ?? 0;

    if (pendingAmount <= 0)
      return { success: false, msg: "No pending amount on this credit card" };
    if (paidAmount <= 0)
      return { success: false, msg: "Payment amount must be greater than 0" };
    if (paidAmount > pendingAmount)
      return { success: false, msg: "Payment amount cannot exceed pending amount" };
    if (bankBalance < paidAmount)
      return { success: false, msg: "Insufficient bank balance" };

    // Update bank account: balance decreases, totalExpenses increases
    await createOrUpdateWallet({
      id: bankAccountId,
      currentBalance: bankBalance - paidAmount,
      totalExpenses: (bank.totalExpenses ?? 0) + paidAmount,
    });

    // Update credit card: pendingAmount decreases, totalIncome increases, lastBillPaidAt set
    await createOrUpdateWallet({
      id: creditCardId,
      pendingAmount: Math.max(pendingAmount - paidAmount, 0),
      totalIncome: (card.totalIncome ?? 0) + paidAmount,
      lastBillPaidAt: date,
    });

    // Create two linked transactions
    const txnCollection = collection(firestore, "users", uid, "transactions");

    const bankTxnRaw = {
      uid,
      type: "expense",
      amount: paidAmount,
      walletId: bankAccountId,
      walletType: "bank_account",
      transactionSource: "credit_card_bill_payment",
      linkedWalletId: creditCardId,
      category: "credit_card_payment",
      description: `Credit card bill payment for ${card.name}`,
      date: Timestamp.fromDate(date),
    };

    const cardTxnRaw = {
      uid,
      type: "income",
      amount: paidAmount,
      walletId: creditCardId,
      walletType: "credit_card",
      transactionSource: "credit_card_bill_payment",
      linkedWalletId: bankAccountId,
      description: `Bill paid via ${bank.name}`,
      date: Timestamp.fromDate(date),
    };

    const encBankTxn = encryptDocument(
      bankTxnRaw,
      TRANSACTION_STRING_FIELDS,
      TRANSACTION_NUMERIC_FIELDS,
      key
    );
    const encCardTxn = encryptDocument(
      cardTxnRaw,
      TRANSACTION_STRING_FIELDS,
      TRANSACTION_NUMERIC_FIELDS,
      key
    );

    await Promise.all([
      addDoc(txnCollection, encBankTxn),
      addDoc(txnCollection, encCardTxn),
    ]);

    return { success: true, msg: "Bill payment recorded successfully" };
  } catch (error: any) {
    console.error("Error marking credit card bill as paid:", error);
    return { success: false, msg: error.message };
  }
};

export const deleteWallet = async (walletId: string): Promise<ResponseType> => {
  try {
    const uid = getUserId();
    const walletRef = doc(firestore, "users", uid, "wallets", walletId);

    await deleteDoc(walletRef);
    deleteTransactionsByWalletId(walletId);

    return { success: true, msg: "Wallet deleted successfully" };
  } catch (error: any) {
    console.error("Error deleting wallet:", error);
    return { success: false, msg: error.message };
  }
};

export const deleteTransactionsByWalletId = async (
  walletId: string
): Promise<ResponseType> => {
  try {
    const uid = getUserId();
    let hasMoreTransactions = true;

    while (hasMoreTransactions) {
      const transactionsQuery = query(
        collection(firestore, "users", uid, "transactions"),
        where("walletId", "==", walletId)
      );

      const transactionsSnapshot = await getDocs(transactionsQuery);

      if (transactionsSnapshot.size === 0) {
        hasMoreTransactions = false;
        break;
      }

      const batch = writeBatch(firestore);
      transactionsSnapshot.forEach((transactionDoc) => {
        batch.delete(transactionDoc.ref);
      });

      await batch.commit();
    }

    return { success: true, msg: "All transactions deleted successfully" };
  } catch (error: any) {
    console.error("Error deleting transactions:", error);
    return { success: false, msg: error.message };
  }
};
