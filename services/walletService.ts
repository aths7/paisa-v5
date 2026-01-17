import {
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { collection } from "firebase/firestore";
import { uploadFileToCloudinary } from "./imageService";
import { ResponseType, WalletType } from "@/types";
import { auth, firestore } from "@/config/firebase";

const getUserId = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error("User not authenticated");
  }
  return uid;
};

export const createOrUpdateWallet = async (
  walletData: Partial<WalletType>
): Promise<ResponseType> => {
  try {
    const uid = getUserId();

    // upload image

    let walletToSave = { ...walletData, uid };
    console.log("here")

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
      walletToSave.amount = 0;
      walletToSave.totalIncome = 0;
      walletToSave.totalExpenses = 0;
      walletToSave.created = new Date();
    }

    console.log("here 2")

    const walletRef = walletData.id
      ? doc(firestore, "users", uid, "wallets", walletData.id)
      : doc(collection(firestore, "users", uid, "wallets"));

    await setDoc(walletRef, walletToSave, { merge: true }); // merge: true updates only the data provided
    
    console.log("here 3")

    return {
      success: true,
      data: { ...walletToSave, id: walletRef.id },
    };
  } catch (error: any) {
    console.error("Error creating or updating wallet:", error);
    return {
      success: false,
      msg: error.message,
    };
  }
};

export const deleteWallet = async (walletId: string): Promise<ResponseType> => {
  try {
    const uid = getUserId();
    const walletRef = doc(firestore, "users", uid, "wallets", walletId);

    await deleteDoc(walletRef);

    // implement later, when we are able to create transactions
    deleteTransactionsByWalletId(walletId);

    return {
      success: true,
      msg: "Wallet deleted successfully",
    };
  } catch (error: any) {
    console.error("Error deleting wallet:", error);
    return {
      success: false,
      msg: error.message,
    };
  }
};

export const deleteTransactionsByWalletId = async (
  walletId: string
): Promise<ResponseType> => {
  try {
    const uid = getUserId();
    let hasMoreTransactions = true;

    while (hasMoreTransactions) {
      // Query to fetch transactions based on walletId
      const transactionsQuery = query(
        collection(firestore, "users", uid, "transactions"),
        where("walletId", "==", walletId)
      );

      // Fetch the transactions
      const transactionsSnapshot = await getDocs(transactionsQuery);

      if (transactionsSnapshot.size === 0) {
        hasMoreTransactions = false; // No more transactions to delete
        break;
      }

      // Start a batch for deleting the transactions
      const batch = writeBatch(firestore);

      // Add each transaction to the batch deletion
      transactionsSnapshot.forEach((transactionDoc) => {
        batch.delete(transactionDoc.ref);
      });

      // Commit the batch
      await batch.commit();

      console.log(
        `${transactionsSnapshot.size} transactions deleted in this batch`
      );
    }

    return {
      success: true,
      msg: "All transactions deleted successfully",
    };
  } catch (error: any) {
    console.error("Error deleting transactions:", error);
    return {
      success: false,
      msg: error.message,
    };
  }
};
