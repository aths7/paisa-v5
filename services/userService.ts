import { auth, firestore } from "@/config/firebase";
import { ResponseType, UserDataType } from "@/types";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { deleteUser } from "firebase/auth";
import { uploadFileToCloudinary } from "./imageService";

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

    // Update the user document with the provided updatedData
    await updateDoc(userRef, updatedData);

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
