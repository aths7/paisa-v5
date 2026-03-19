import { firestore } from "@/config/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import {
  decryptField,
  deriveKey,
  encryptField,
  isEncrypted,
  TRANSACTION_STRING_FIELDS,
  USER_STRING_FIELDS,
  WALLET_STRING_FIELDS,
} from "@/services/encryptionService";

type RepairStats = {
  usersUpdated: number;
  walletsUpdated: number;
  transactionsUpdated: number;
  fieldsReencrypted: number;
  fieldsSkipped: number;
  fieldsFailed: number;
};

type RepairFieldResult = {
  repaired: boolean;
  failed: boolean;
  nextValue?: string;
};

const MAX_DECRYPTION_PASSES = 6;

const repairStringField = (value: unknown, key: string): RepairFieldResult => {
  if (typeof value !== "string") {
    return { repaired: false, failed: false };
  }

  // Plaintext legacy values should be normalized to a single encrypted layer.
  if (!isEncrypted(value)) {
    return {
      repaired: true,
      failed: false,
      nextValue: encryptField(value, key),
    };
  }

  let current = value;
  let decryptions = 0;

  try {
    while (isEncrypted(current) && decryptions < MAX_DECRYPTION_PASSES) {
      current = decryptField(current, key);
      decryptions += 1;
    }
  } catch {
    return { repaired: false, failed: true };
  }

  if (isEncrypted(current)) {
    return { repaired: false, failed: true };
  }

  // A single decrypt means the field was already stored correctly.
  if (decryptions <= 1) {
    return { repaired: false, failed: false };
  }

  return {
    repaired: true,
    failed: false,
    nextValue: encryptField(current, key),
  };
};

const repairDocumentStrings = async (
  data: Record<string, any>,
  fields: readonly string[],
  key: string,
  applyUpdates: (updates: Record<string, string>) => Promise<void>
): Promise<{ updated: boolean; stats: Pick<RepairStats, "fieldsReencrypted" | "fieldsSkipped" | "fieldsFailed"> }> => {
  const updates: Record<string, string> = {};
  const stats = {
    fieldsReencrypted: 0,
    fieldsSkipped: 0,
    fieldsFailed: 0,
  };

  for (const field of fields) {
    const result = repairStringField(data[field], key);

    if (result.failed) {
      stats.fieldsFailed += 1;
      continue;
    }

    if (!result.repaired || result.nextValue === undefined) {
      stats.fieldsSkipped += 1;
      continue;
    }

    updates[field] = result.nextValue;
    stats.fieldsReencrypted += 1;
  }

  if (Object.keys(updates).length > 0) {
    await applyUpdates(updates);
    return { updated: true, stats };
  }

  return { updated: false, stats };
};

/**
 * One-time repair utility for string fields that were accidentally double-encrypted.
 *
 * What it does:
 * - leaves correctly encrypted fields unchanged
 * - re-encrypts plaintext legacy fields once
 * - unwraps multi-encrypted string fields and stores them encrypted once
 *
 * Call this manually for an affected user. Do not run it automatically on login.
 */
export const repairCorruptedEncryptedData = async (uid: string) => {
  const key = deriveKey(uid);
  const stats: RepairStats = {
    usersUpdated: 0,
    walletsUpdated: 0,
    transactionsUpdated: 0,
    fieldsReencrypted: 0,
    fieldsSkipped: 0,
    fieldsFailed: 0,
  };

  try {
    const userRef = doc(firestore, "users", uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const result = await repairDocumentStrings(
        userSnap.data(),
        USER_STRING_FIELDS,
        key,
        (updates) => updateDoc(userRef, updates)
      );
      if (result.updated) stats.usersUpdated += 1;
      stats.fieldsReencrypted += result.stats.fieldsReencrypted;
      stats.fieldsSkipped += result.stats.fieldsSkipped;
      stats.fieldsFailed += result.stats.fieldsFailed;
    }

    const walletSnaps = await getDocs(collection(firestore, "users", uid, "wallets"));
    for (const walletDoc of walletSnaps.docs) {
      const result = await repairDocumentStrings(
        walletDoc.data(),
        WALLET_STRING_FIELDS,
        key,
        (updates) => updateDoc(walletDoc.ref, updates)
      );
      if (result.updated) stats.walletsUpdated += 1;
      stats.fieldsReencrypted += result.stats.fieldsReencrypted;
      stats.fieldsSkipped += result.stats.fieldsSkipped;
      stats.fieldsFailed += result.stats.fieldsFailed;
    }

    const transactionSnaps = await getDocs(collection(firestore, "users", uid, "transactions"));
    for (const transactionDoc of transactionSnaps.docs) {
      const result = await repairDocumentStrings(
        transactionDoc.data(),
        TRANSACTION_STRING_FIELDS,
        key,
        (updates) => updateDoc(transactionDoc.ref, updates)
      );
      if (result.updated) stats.transactionsUpdated += 1;
      stats.fieldsReencrypted += result.stats.fieldsReencrypted;
      stats.fieldsSkipped += result.stats.fieldsSkipped;
      stats.fieldsFailed += result.stats.fieldsFailed;
    }

    console.log("[repair] completed", { uid, ...stats });
    return { success: true, stats };
  } catch (error: any) {
    console.error("[repair] failed", error);
    return {
      success: false,
      msg: error?.message || "Failed to repair corrupted encrypted data",
      stats,
    };
  }
};
