import BackButton from "@/components/BackButton";
import CollapsibleSection from "@/components/CollapsibleSection";
import Button from "@/components/Button";
import Header from "@/components/Header";
import Input from "@/components/Input";
import ModalWrapper from "@/components/ModalWrapper";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { scale, verticalScale } from "@/utils/styling";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Icons from "phosphor-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from "react-native";

const { width: SCREEN_W } = Dimensions.get("window");
const FORM_H_PAD = scale(20) * 2;
const PILL_GAP = scale(8);
const emotionPillW = (SCREEN_W - FORM_H_PAD - PILL_GAP * 3) / 4; // 4 columns
const categoryPillW = (SCREEN_W - FORM_H_PAD - PILL_GAP * 2) / 3; // 3 columns
const walletPillW = (SCREEN_W - FORM_H_PAD - PILL_GAP) / 2;       // 2 columns
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ImageUpload from "@/components/ImageUpload";
import { DEFAULT_EXPENSE_CATEGORIES, expenseCategories } from "@/constants/data";
import { useAuth } from "@/contexts/authContext";
import { PurchaseStyle } from "@/types";
import useDecryptedData from "@/hooks/useDecryptedData";
import { WALLET_STRING_FIELDS, WALLET_NUMERIC_FIELDS } from "@/services/encryptionService";
import {
  createOrUpdateTransaction,
  deleteTransaction,
} from "@/services/transactionService";
import { TransactionType, WalletType } from "@/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { orderBy } from "firebase/firestore";

const TransactionModal = () => {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const footerBottom = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        Animated.timing(footerBottom, {
          toValue: e.endCoordinates.height - insets.bottom,
          duration: Platform.OS === "ios" ? e.duration : 200,
          useNativeDriver: false,
        }).start();
      }
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      (e) => {
        Animated.timing(footerBottom, {
          toValue: 0,
          duration: Platform.OS === "ios" ? e.duration : 200,
          useNativeDriver: false,
        }).start();
      }
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  type paramType = {
    id: string;
    type: string;
    amount: string;
    category?: string;
    date: string;
    description?: string;
    image?: any;
    uid?: string;
    walletId: string;
    purchaseStyle?: string;
    emotion?: string;
  };
  const oldTransaction: paramType = useLocalSearchParams();
  // console.log("old transaction: ", oldTransaction);

  const normalizeOptionalParam = (value?: string) => {
    if (!value || value === "undefined" || value === "null") return "";
    return value;
  };

  const {
    data: wallets = [],
    loading: walletLoading,
    error,
  } = user?.uid
      ? useDecryptedData<WalletType>("wallets", WALLET_STRING_FIELDS, WALLET_NUMERIC_FIELDS, [orderBy("created", "desc")])
      : { data: [], loading: false, error: null };

  const [loading, setLoading] = useState(false);
  const [amountStr, setAmountStr] = useState("");

  const [showDatePicker, setShowDatePicker] = useState(false);

  const DEFAULT_EMOTION_TAGS = ["happy", "sad", "stressed", "neutral", "excited", "anxious", "content", "bored"];
  const emotionOptions = (user?.emotionTags?.length ? user.emotionTags : DEFAULT_EMOTION_TAGS)
    .map((e) => ({ label: e.charAt(0).toUpperCase() + e.slice(1), value: e }));

  const categoryKeys = user?.expenseCategories?.length ? user.expenseCategories : DEFAULT_EXPENSE_CATEGORIES;
  const categoryOptions = categoryKeys.map((value) => ({
    label:
      expenseCategories[value as keyof typeof expenseCategories]?.label ||
      value.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
    value,
  }));

  const [transaction, setTransaction] = useState<TransactionType>({
    type: "expense",
    amount: 0,
    description: "",
    category: "",
    date: new Date(),
    walletId: "",
    image: null,
    purchaseStyle: "non_impulsive",
    emotion: "",
  });

  useEffect(() => {
    if (oldTransaction?.id) {
      const amt = Number(oldTransaction.amount);
      setAmountStr(amt ? amt.toString() : "");
      setTransaction({
        type: oldTransaction.type,
        amount: amt,
        description: normalizeOptionalParam(oldTransaction.description),
        category: normalizeOptionalParam(oldTransaction.category),
        date: new Date(oldTransaction.date),
        walletId: oldTransaction.walletId,
        image: oldTransaction?.image || null,
        purchaseStyle: (oldTransaction.purchaseStyle as PurchaseStyle) || "non_impulsive",
        emotion: normalizeOptionalParam(oldTransaction.emotion),
      });
    }
  }, []);

  const onDateChange = (event: any, selectedDate: any) => {
    const currentDate = selectedDate || transaction.date;
    setTransaction({ ...transaction, date: currentDate }); // Update the date state
    setShowDatePicker(Platform.OS == "android" ? false : true); // will be false on android, but will stay open on ios
  };

  const onSelectImage = (file: any) => {
    // console.log("file: ", file);
    if (file) setTransaction({ ...transaction, image: file });
  };

  const onSubmit = async () => {
    const { type, amount, description, category, date, walletId, image } =
      transaction;
    const sanitizedDescription = normalizeOptionalParam(description);
    const sanitizedCategory =
      type === "expense" ? normalizeOptionalParam(category) : "";

    if (!date || !amount) {
      Alert.alert("Transaction", "Please fill all the fields");
      return;
    }

    // if (type == "expense") {
    //   let selectedWallet = wallets.find((wallet) => wallet.id == walletId);
    //   if (selectedWallet) {
    //     let remainingBalance = selectedWallet.amount! - amount;
    //     if (remainingBalance < 0) {
    //       Alert.alert(
    //         "Not Enough Balance",
    //         "The selected wallet don't have enough balance"
    //       );
    //       return;
    //     }
    //   }
    // }

    let transactionData: TransactionType = {
      type,
      amount,
      description: sanitizedDescription,
      category: sanitizedCategory,
      date,
      walletId,
      image,
      uid: user?.uid,
      purchaseStyle: transaction.purchaseStyle || "non_impulsive",
      ...(transaction.emotion ? { emotion: transaction.emotion } : {}),
    };

    if (oldTransaction?.id) transactionData.id = oldTransaction.id;

    setLoading(true);

    const res = await createOrUpdateTransaction(transactionData);
    // console.log("transaction: ", res);
    setLoading(false);
    if (res.success) {
      router.back();
    } else {
      Alert.alert("Transaction", res.msg);
    }
  };

  const showDeleteAlert = () => {
    Alert.alert(
      "Confirm",
      "Are you sure you want to delete this transaction?",
      [
        {
          text: "Cancel",
          onPress: () => console.log("Cancel delete"),
          style: "cancel",
        },
        {
          text: "Delete",
          onPress: () => onDeleteTransaction(),
          style: "destructive",
        },
      ]
    );
  };

  const onDeleteTransaction = async () => {
    console.log("deleting the tr: ", oldTransaction);
    if (oldTransaction) {
      setLoading(true);
      let res = await deleteTransaction(
        oldTransaction?.id,
        oldTransaction?.walletId
      );
      setLoading(false);
      if (res.success) {
        router.back();
      } else {
        Alert.alert("Transaction", res.msg);
      }
    }
  };

  // console.log("got item: ", transaction.type);

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title={oldTransaction?.id ? "Update Transaction" : "Add Transaction"}
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._10 }}
        />

        {/* form */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {/* purchase style — expense only */}
          {transaction.type === "expense" && (
            <View style={styles.inputContainer}>
              <Typo color={colors.neutral200} size={16} fontWeight="500">
                Purchase Style
              </Typo>
              <View style={styles.styleRow}>
                {(["non_impulsive", "impulsive"] as PurchaseStyle[]).map((style) => {
                  const active = transaction.purchaseStyle === style;
                  const label = style === "impulsive" ? "Impulsive" : "Non-Impulsive";
                  return (
                    <TouchableOpacity
                      key={style}
                      style={[
                        styles.stylePill,
                        active && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => setTransaction({ ...transaction, purchaseStyle: style })}
                    >
                      <Typo size={14} fontWeight="600" color={active ? colors.black : colors.neutral400}>
                        {label}
                      </Typo>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* emotion */}
          <View style={styles.inputContainer}>
            <View style={styles.flexRow}>
              <Typo color={colors.neutral200} size={16} fontWeight="500">
                Emotion
              </Typo>
              <Typo color={colors.neutral500} size={14}>(optional)</Typo>
            </View>
            <View style={styles.emotionRow}>
              {emotionOptions.map(({ label, value }) => {
                const active = transaction.emotion === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.emotionPill,
                      active && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() =>
                      setTransaction({ ...transaction, emotion: active ? "" : value })
                    }
                  >
                    <Typo size={13} fontWeight="500" color={active ? colors.black : colors.neutral400}>
                      {label}
                    </Typo>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* amount */}
          <View style={styles.inputContainer}>
            <Typo color={colors.neutral200} size={16}>
              Amount
            </Typo>
            <Input
              keyboardType="decimal-pad"
              value={amountStr}
              onChangeText={(value) => {
                const cleaned = value
                  .replace(/[^0-9.]/g, "")
                  .replace(/(\..*)\./g, "$1");
                setAmountStr(cleaned);
                setTransaction({ ...transaction, amount: parseFloat(cleaned) || 0 });
              }}
            />
          </View>

          {/* category — expense only */}
          {transaction.type === "expense" && (
            <CollapsibleSection title="Category" optional defaultOpen={false}>
              <View style={styles.emotionRow}>
                {categoryOptions.map(({ label, value }) => {
                  const active = transaction.category === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      style={[
                        styles.categoryPill,
                        active && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() =>
                        setTransaction({ ...transaction, category: active ? "" : value })
                      }
                    >
                      <Typo size={12} fontWeight="500" color={active ? colors.black : colors.neutral400} style={{ textAlign: "center" }}>
                        {label}
                      </Typo>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </CollapsibleSection>
          )}

          {/* wallet */}
          <CollapsibleSection title="Wallet" optional defaultOpen={false}>
            <View style={styles.emotionRow}>
              {wallets.map((wallet) => {
                const active = transaction.walletId === wallet.id;
                return (
                  <TouchableOpacity
                    key={wallet.id}
                    style={[
                      styles.walletPill,
                      active && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() =>
                      setTransaction({ ...transaction, walletId: active ? "" : wallet.id! })
                    }
                  >
                    <Typo size={13} fontWeight="500" color={active ? colors.black : colors.neutral400}>
                      {wallet.name}
                    </Typo>
                  </TouchableOpacity>
                );
              })}
            </View>
          </CollapsibleSection>

          {/* description */}
          <View style={styles.inputContainer}>
            <View style={styles.flexRow}>
              <Typo color={colors.neutral200} size={16}>Description</Typo>
              <Typo color={colors.neutral500} size={14}>(optional)</Typo>
            </View>
            <Input
              value={transaction.description}
              multiline
              numberOfLines={2}
              containerStyle={{
                height: verticalScale(100),
                alignItems: "stretch",
                paddingVertical: 15,
              }}
              inputStyle={{ textAlignVertical: "top" }}
              onChangeText={(value) =>
                setTransaction({ ...transaction, description: value })
              }
            />
          </View>

          {/* receipt */}
          <View style={styles.inputContainer}>
            <View style={styles.flexRow}>
              <Typo color={colors.neutral200} size={16}>Receipt</Typo>
              <Typo color={colors.neutral500} size={14}>(optional)</Typo>
            </View>
            <ImageUpload
              file={transaction.image}
              onSelect={onSelectImage}
              onClear={() => setTransaction({ ...transaction, image: null })}
              placeholder="Upload Image"
            />
          </View>

          {/* type */}
          <View style={styles.inputContainer}>
            <Typo color={colors.neutral200} size={16} fontWeight="500">
              Type
            </Typo>
            <View style={styles.styleRow}>
              {(["expense", "income"] as const).map((t) => {
                const active = transaction.type === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.stylePill,
                      active && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setTransaction({ ...transaction, type: t })}
                  >
                    <Typo size={14} fontWeight="600" color={active ? colors.black : colors.neutral400}>
                      {t === "expense" ? "Expense" : "Income"}
                    </Typo>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* date */}
          <View style={styles.inputContainer}>
            <Typo color={colors.neutral200} size={16} fontWeight="500">
              Date
            </Typo>
            {!showDatePicker && (
              <Pressable style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
                <Typo size={14}>
                  {(transaction?.date as Date)?.toLocaleDateString()}
                </Typo>
              </Pressable>
            )}
            {showDatePicker && (
              <View style={Platform.OS == "ios" && styles.iosDatePicker}>
                <DateTimePicker
                  themeVariant="dark"
                  value={transaction.date as Date}
                  textColor={colors.white}
                  mode="date"
                  maximumDate={new Date()}
                  display={Platform.OS == "ios" ? "spinner" : "default"}
                  onChange={onDateChange}
                />
                {Platform.OS == "ios" && (
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Typo size={15} fontWeight="500">OK</Typo>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* footer */}
      <Animated.View style={[styles.footer, { marginBottom: footerBottom, paddingBottom: insets.bottom }]}>
        {oldTransaction?.id && !loading && (
          <Button
            style={{
              backgroundColor: colors.rose,
              paddingHorizontal: spacingX._15,
            }}
            onPress={showDeleteAlert}
          >
            <Icons.Trash
              color={colors.white}
              size={verticalScale(24)}
              weight="bold"
            />
          </Button>
        )}

        <Button loading={loading} onPress={onSubmit} style={{ flex: 1 }}>
          <Typo color={colors.black} size={20} fontWeight={"bold"}>
            {oldTransaction?.id ? "Update" : "Submit"}
          </Typo>
        </Button>
      </Animated.View>
    </ModalWrapper>
  );
};

export default TransactionModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingY._20,
  },
  form: {
    gap: spacingY._20,
    paddingVertical: spacingY._15,
    paddingBottom: spacingY._40,
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: spacingX._20,
    gap: scale(12),
    paddingTop: spacingY._15,
    borderTopColor: colors.neutral700,
    borderTopWidth: 1,
  },
  inputContainer: {
    gap: spacingY._10,
  },
  flexRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._5,
  },
  dateInput: {
    flexDirection: "row",
    height: verticalScale(54),
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.neutral300,
    borderRadius: radius._17,
    borderCurve: "continuous",
    paddingHorizontal: spacingX._15,
  },

  iosDatePicker: {
    // backgroundColor: "red",
  },
  datePickerButton: {
    backgroundColor: colors.neutral700,
    alignSelf: "flex-end",
    padding: spacingY._7,
    marginRight: spacingX._7,
    paddingHorizontal: spacingY._15,
    borderRadius: radius._10,
  },
  styleRow: {
    flexDirection: "row",
    gap: scale(10),
  },
  emotionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: PILL_GAP,
  },
  emotionPill: {
    width: emotionPillW,
    paddingVertical: verticalScale(8),
    borderWidth: 1,
    borderColor: colors.neutral600,
    borderRadius: radius._15,
    borderCurve: "continuous",
    backgroundColor: colors.neutral800,
    alignItems: "center",
  },
  categoryPill: {
    width: categoryPillW,
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(6),
    borderWidth: 1,
    borderColor: colors.neutral600,
    borderRadius: radius._15,
    borderCurve: "continuous",
    backgroundColor: colors.neutral800,
    alignItems: "center",
  },
  walletPill: {
    width: walletPillW,
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(10),
    borderWidth: 1,
    borderColor: colors.neutral600,
    borderRadius: radius._15,
    borderCurve: "continuous",
    backgroundColor: colors.neutral800,
    alignItems: "center",
  },
  stylePill: {
    flex: 1,
    height: verticalScale(48),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.neutral600,
    borderRadius: radius._15,
    borderCurve: "continuous",
    backgroundColor: colors.neutral800,
  },
});
