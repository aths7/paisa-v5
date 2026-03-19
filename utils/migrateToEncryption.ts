import { firestore } from "@/config/firebase";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import {
  deriveKey,
  encryptField,
  isEncrypted,
  TRANSACTION_STRING_FIELDS,
  TRANSACTION_NUMERIC_FIELDS,
  WALLET_STRING_FIELDS,
  WALLET_NUMERIC_FIELDS,
  USER_STRING_FIELDS,
} from "@/services/encryptionService";

/**
 * Returns true if the given field is still plaintext and needs encryption.
 */
const needsEncryption = (value: unknown, isNumeric: boolean): boolean => {
  if (isNumeric) return typeof value === "number";
  return typeof value === "string" && !isEncrypted(value);
};

/**
 * One-time migration: encrypts all plaintext Firestore documents for a given user.
 *
 * Detection logic:
 *  - Numeric fields (amount, totalIncome, totalExpenses): plaintext if typeof === "number"
 *  - String fields (name, category, description): plaintext if they do not match
 *    the CryptoJS ciphertext prefix used by this app
 *
 * This function is safe to call multiple times — it only writes documents that
 * still have plaintext fields.
 */
export const migrateExistingData = async (uid: string): Promise<void> => {
  const key = deriveKey(uid);

  try {
    // 1. Migrate user doc
    const userRef = doc(firestore, "users", uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      const updates: Record<string, string> = {};
      for (const f of USER_STRING_FIELDS) {
        if (data[f] !== undefined && data[f] !== null && needsEncryption(data[f], false)) {
          updates[f] = encryptField(data[f], key);
        }
      }
      if (Object.keys(updates).length > 0) {
        await updateDoc(userRef, updates);
        console.log("[migration] encrypted user doc fields:", Object.keys(updates));
      }
    }

    // 2. Migrate wallets
    const walletsSnap = await getDocs(collection(firestore, "users", uid, "wallets"));
    for (const walletDoc of walletsSnap.docs) {
      const data = walletDoc.data();
      const updates: Record<string, string> = {};
      for (const f of WALLET_STRING_FIELDS) {
        if (data[f] !== undefined && data[f] !== null && needsEncryption(data[f], false)) {
          updates[f] = encryptField(data[f], key);
        }
      }
      for (const f of WALLET_NUMERIC_FIELDS) {
        if (data[f] !== undefined && data[f] !== null && needsEncryption(data[f], true)) {
          updates[f] = encryptField(data[f], key);
        }
      }
      if (Object.keys(updates).length > 0) {
        await updateDoc(walletDoc.ref, updates);
        console.log("[migration] encrypted wallet", walletDoc.id, "fields:", Object.keys(updates));
      }
    }

    // 3. Migrate transactions
    const txSnap = await getDocs(collection(firestore, "users", uid, "transactions"));
    for (const txDoc of txSnap.docs) {
      const data = txDoc.data();
      const updates: Record<string, string> = {};
      for (const f of TRANSACTION_STRING_FIELDS) {
        if (data[f] !== undefined && data[f] !== null && needsEncryption(data[f], false)) {
          updates[f] = encryptField(data[f], key);
        }
      }
      for (const f of TRANSACTION_NUMERIC_FIELDS) {
        if (data[f] !== undefined && data[f] !== null && needsEncryption(data[f], true)) {
          updates[f] = encryptField(data[f], key);
        }
      }
      if (Object.keys(updates).length > 0) {
        await updateDoc(txDoc.ref, updates);
        console.log("[migration] encrypted transaction", txDoc.id, "fields:", Object.keys(updates));
      }
    }

    console.log("[migration] completed for user", uid);
  } catch (error) {
    console.error("[migration] failed:", error);
  }
};
