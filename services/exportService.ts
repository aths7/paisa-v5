import { collection, getDocs, orderBy, query, Timestamp } from "firebase/firestore";
import * as FileSystem from "expo-file-system/legacy";
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

export type ExportRange = "this_month" | "last_30" | "last_90" | "last_180" | "all";

const getCutoff = (range: ExportRange): Date | null => {
  const now = new Date();
  if (range === "this_month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === "last_30")  { const d = new Date(now); d.setDate(d.getDate() - 30); return d; }
  if (range === "last_90")  { const d = new Date(now); d.setDate(d.getDate() - 90); return d; }
  if (range === "last_180") { const d = new Date(now); d.setDate(d.getDate() - 180); return d; }
  return null;
};

/** Fetches, decrypts, filters and writes the CSV. Returns the file URI. */
export const prepareTransactionsCSV = async (uid: string, range: ExportRange): Promise<string> => {
  const cutoff = getCutoff(range);
  const colRef = collection(firestore, "users", uid, "transactions");
  const q = query(colRef, orderBy("date", "desc"));
  const snapshot = await getDocs(q);

  const key = deriveKey(uid);
  const rows: TransactionType[] = snapshot.docs
    .map((doc) => {
      const raw = { id: doc.id, ...doc.data() } as TransactionType;
      return decryptDocument(raw, TRANSACTION_STRING_FIELDS, TRANSACTION_NUMERIC_FIELDS, key);
    })
    .filter((t) => !cutoff || toDate(t.date) >= cutoff);

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
  const filename = `paisa_${range}_${new Date().toISOString().split("T")[0]}.csv`;
  const fileUri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  console.log("[export] written to", fileUri);
  return fileUri;
};

/** Opens the native share sheet for the given file URI. */
export const shareCSV = async (fileUri: string): Promise<void> => {
  console.log("[share] fileUri:", fileUri);

  const info = await FileSystem.getInfoAsync(fileUri);
  console.log("[share] file exists:", info.exists, "size:", (info as any).size);

  const canShare = await Sharing.isAvailableAsync();
  console.log("[share] canShare:", canShare);
  if (!canShare) throw new Error("Sharing is not available on this device.");

  console.log("[share] calling shareAsync...");
  await Sharing.shareAsync(fileUri, {
    mimeType: "text/csv",
    dialogTitle: "Export Transactions",
    UTI: "public.comma-separated-values-text",
  });
  console.log("[share] shareAsync returned");
};
