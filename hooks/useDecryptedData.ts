import { QueryConstraint } from "firebase/firestore";
import { useMemo } from "react";
import { useAuth } from "@/contexts/authContext";
import {
  decryptDocument,
  deriveKey,
} from "@/services/encryptionService";
import useFetchData from "./useFetchData";

/**
 * Wraps useFetchData and decrypts each document before returning it.
 * The encryption key is derived from the current user's UID — no storage needed.
 */
const useDecryptedData = <T extends object>(
  collectionName: string,
  stringFields: readonly string[],
  numericFields: readonly string[],
  constraints: QueryConstraint[] = []
): { data: T[]; loading: boolean; error: string | null } => {
  const { user } = useAuth();
  const { data: rawData, loading, error } = useFetchData<T>(
    collectionName,
    constraints
  );

  const data = useMemo(() => {
    if (!user?.uid || rawData.length === 0) return rawData;
    const key = deriveKey(user.uid);
    return rawData.map((doc) =>
      decryptDocument(doc, stringFields, numericFields, key)
    );
  }, [rawData, user?.uid]);

  return { data, loading, error };
};

export default useDecryptedData;
