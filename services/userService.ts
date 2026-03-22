import { auth, firestore } from "@/config/firebase";
import { ResponseType, UserDataType } from "@/types";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { deleteUser } from "firebase/auth";
import { uploadFileToCloudinary } from "./imageService";
import {
  deriveKey,
  encryptField,
  USER_STRING_FIELDS,
} from "./encryptionService";

export const updateUser = async (
  uid: string,
  updatedData: UserDataType
): Promise<ResponseType> => {
  try {
    if (updatedData.image && updatedData?.image?.uri) {
      const imageUploadResponse = await uploadFileToCloudinary(
        updatedData.image,
        "users"
      );

      if (!imageUploadResponse.success) {
        return {
          success: false,
          msg: imageUploadResponse.msg || "Failed to upload image",
        };
      }

      updatedData.image = imageUploadResponse.data;
    }

    const userRef = doc(firestore, "users", uid);
    const key = deriveKey(uid);

    // Encrypt sensitive fields before writing
    const dataToWrite = { ...updatedData } as any;
    for (const f of USER_STRING_FIELDS) {
      if (dataToWrite[f] !== undefined && dataToWrite[f] !== null) {
        dataToWrite[f] = encryptField(dataToWrite[f], key);
      }
    }

    await updateDoc(userRef, dataToWrite);

    // Fetch the updated user data
    const updatedUserDoc = await getDoc(userRef);

    return {
      success: true,
      msg: "Updated successfully",
    };

    // if (updatedUserDoc.exists()) {
    //   return {
    //     success: true,
    //     data: updatedUserDoc.data(),
    //   };
    // } else {
    //   return {
    //     success: false,
    //     msg: "User not found",
    //   };
    // }
  } catch (error: any) {
    console.error("Error updating user:", error);
    return {
      success: false,
      msg: error.message,
    };
  }
};

export const deleteAccount = async (uid: string): Promise<ResponseType> => {
  try {
    // 1. Delete all transactions
    const transactionsSnap = await getDocs(
      collection(firestore, "users", uid, "transactions")
    );
    if (!transactionsSnap.empty) {
      const txBatch = writeBatch(firestore);
      transactionsSnap.forEach((d) => txBatch.delete(d.ref));
      await txBatch.commit();
    }

    // 2. Delete all wallets
    const walletsSnap = await getDocs(
      collection(firestore, "users", uid, "wallets")
    );
    if (!walletsSnap.empty) {
      const walletBatch = writeBatch(firestore);
      walletsSnap.forEach((d) => walletBatch.delete(d.ref));
      await walletBatch.commit();
    }

    // 3. Delete the user document
    await deleteDoc(doc(firestore, "users", uid));

    // 4. Delete the Firebase Auth account
    const currentUser = auth.currentUser;
    if (currentUser) {
      await deleteUser(currentUser);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting account:", error);
    return { success: false, msg: error.message };
  }
};

export const updateExpenseCategories = async (
  uid: string,
  categories: string[]
): Promise<ResponseType> => {
  try {
    await setDoc(doc(firestore, "users", uid), { expenseCategories: categories }, { merge: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, msg: error.message };
  }
};

export const updateEmotionTags = async (
  uid: string,
  tags: string[]
): Promise<ResponseType> => {
  try {
    await setDoc(doc(firestore, "users", uid), { emotionTags: tags }, { merge: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, msg: error.message };
  }
};
