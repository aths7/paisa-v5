import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { uploadFileToCloudinary } from "./imageService";
import { ResponseType, WalletType } from "@/types";
import { auth, firestore } from "@/config/firebase";
import {
  deriveKey,
  encryptDocument,
  WALLET_STRING_FIELDS,
  WALLET_NUMERIC_FIELDS,
} from "./encryptionService";

const getUserId = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("User not authenticated");
  return uid;
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
      walletToSave.totalIncome = 0;
      walletToSave.totalExpenses = 0;
      walletToSave.created = new Date();
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
