import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { firestore } from "@/config/firebase";
import {
  decryptDocument,
  deriveKey,
  TRANSACTION_STRING_FIELDS,
  TRANSACTION_NUMERIC_FIELDS,
} from "@/services/encryptionService";
import { TransactionType } from "@/types";

const toDate = (raw: any): Date => {
  if (raw instanceof Timestamp) return raw.toDate();
  if (raw instanceof Date) return raw;
  return new Date(raw as string);
};

const csvEscape = (value: string | number | undefined | null): string => {
  if (value === undefined || value === null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const exportTransactionsCSV = async (uid: string): Promise<void> => {
  const colRef = collection(firestore, "users", uid, "transactions");
  const q = query(colRef, orderBy("date", "desc"));
  const snapshot = await getDocs(q);

  const key = deriveKey(uid);
  const rows: TransactionType[] = snapshot.docs.map((doc) => {
    const raw = { id: doc.id, ...doc.data() } as TransactionType;
    return decryptDocument(raw, TRANSACTION_STRING_FIELDS, TRANSACTION_NUMERIC_FIELDS, key);
  });

  const headers = ["Date", "Type", "Amount", "Category", "Description", "Wallet ID", "Purchase Style", "Emotion"];
  const lines: string[] = [headers.join(",")];

  for (const t of rows) {
    const date = toDate(t.date).toISOString().split("T")[0];
    lines.push([
      csvEscape(date),
      csvEscape(t.type),
      csvEscape(t.amount),
      csvEscape(t.category),
      csvEscape(t.description),
      csvEscape(t.walletId),
      csvEscape(t.purchaseStyle),
      csvEscape(t.emotion),
    ].join(","));
  }

  const csv = lines.join("\n");
  const filename = `paisa_transactions_${new Date().toISOString().split("T")[0]}.csv`;

  // expo-file-system v19 new API: File class
  const file = new File(Paths.cache, filename);
  file.write(csv);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Sharing is not available on this device.");
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    dialogTitle: "Export Transactions",
    UTI: "public.comma-separated-values-text",
  });
};
