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
import * as Haptics from "expo-haptics";
import ConfettiCannon from "react-native-confetti-cannon";
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
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
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
import { updateExpenseCategories, updateEmotionTags } from "@/services/userService";
import { createOrUpdateWallet } from "@/services/walletService";
import { TransactionType, WalletType } from "@/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { orderBy } from "firebase/firestore";

// ─── Numpad key layout ────────────────────────────────────────────────────────
const NUMPAD_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "⌫"],
];

const KEY_GAP = scale(12);
const KEY_COLS = 3;
const KEY_W = (SCREEN_W - FORM_H_PAD - KEY_GAP * (KEY_COLS - 1)) / KEY_COLS;
const KEY_H = verticalScale(64);

// ─── Step 1: Amount entry ─────────────────────────────────────────────────────
interface AmountStepProps {
  amountStr: string;
  onKey: (key: string) => void;
  onContinue: () => void;
  onClose: () => void;
  insets: { bottom: number; top: number };
}

const formatAmountDisplay = (str: string): string => {
  if (!str) return "0";
  const [intPart, decPart] = str.split(".");
  const formatted = parseInt(intPart || "0", 10).toLocaleString("en-IN");
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
};

const AmountStep = ({ amountStr, onKey, onContinue, onClose, insets }: AmountStepProps) => {
  const display = formatAmountDisplay(amountStr);
  const isEmpty = !amountStr;

  // Shrink font as number grows
  const fontSize = display.length > 10 ? scale(36) : display.length > 7 ? scale(44) : scale(56);

  return (
    <View style={[amtStyles.root, { paddingTop: insets.top + verticalScale(12), paddingBottom: insets.bottom + verticalScale(12) }]}>
      {/* Close button */}
      <TouchableOpacity style={amtStyles.closeBtn} onPress={onClose} hitSlop={16}>
        <Icons.X size={scale(24)} color={colors.neutral200} weight="bold" />
      </TouchableOpacity>

      {/* Amount display */}
      <View style={amtStyles.amountArea}>
        <View style={amtStyles.amountRow}>
          <Typo
            size={fontSize * 0.48}
            fontWeight="300"
            color={isEmpty ? colors.neutral700 : colors.neutral400}
          >
            ₹
          </Typo>
          <Typo
            size={fontSize}
            fontWeight="300"
            color={isEmpty ? colors.neutral700 : colors.white}
            style={{ letterSpacing: -1 }}
          >
            {display}
          </Typo>
        </View>
      </View>

      {/* Numpad */}
      <View style={amtStyles.numpad}>
        {NUMPAD_KEYS.map((row, ri) => (
          <View key={ri} style={amtStyles.numpadRow}>
            {row.map((key) => (
              <TouchableOpacity
                key={key}
                style={amtStyles.key}
                onPress={() => onKey(key)}
                activeOpacity={0.6}
              >
                {key === "⌫" ? (
                  <Icons.Backspace size={scale(26)} color={colors.neutral200} weight="regular" />
                ) : (
                  <Typo size={scale(28)} fontWeight="300" color={colors.white}>
                    {key}
                  </Typo>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      {/* Continue button */}
      <View style={[amtStyles.continueWrapper, { paddingHorizontal: spacingX._20 }]}>
        <Button
          onPress={onContinue}
          disabled={isEmpty}
          style={[amtStyles.continueBtn, isEmpty && { opacity: 0.4 }]}
        >
          <Typo color={colors.black} size={18} fontWeight="700">
            Continue
          </Typo>
        </Button>
      </View>
    </View>
  );
};

const amtStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.black,
  },
  closeBtn: {
    alignSelf: "flex-end",
    marginRight: spacingX._20,
    marginTop: verticalScale(8),
    padding: scale(4),
  },
  amountArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
  },
  numpad: {
    gap: KEY_GAP,
    paddingHorizontal: spacingX._20,
    paddingBottom: verticalScale(8),
  },
  numpadRow: {
    flexDirection: "row",
    gap: KEY_GAP,
  },
  key: {
    width: KEY_W,
    height: KEY_H,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius._15,
    borderCurve: "continuous",
  },
  continueWrapper: {
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(4),
  },
  continueBtn: {
    width: "100%",
  },
});

// ─── Main modal ───────────────────────────────────────────────────────────────
const TransactionModal = () => {
  const { user, updateUserData } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const footerBottom = useRef(new Animated.Value(0)).current;

  const [step, setStep] = useState<1 | 2>(1);

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
  const [showConfetti, setShowConfetti] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryText, setNewCategoryText] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [addingEmotion, setAddingEmotion] = useState(false);
  const [newEmotionText, setNewEmotionText] = useState("");
  const [savingEmotion, setSavingEmotion] = useState(false);
  const [addingWallet, setAddingWallet] = useState(false);
  const [newWalletText, setNewWalletText] = useState("");
  const [savingWallet, setSavingWallet] = useState(false);
  const isEdit = Boolean(oldTransaction?.id);

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

  // ── Numpad key handler ────────────────────────────────────────────────────
  const handleKey = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setAmountStr((prev) => {
      if (key === "⌫") {
        const next = prev.slice(0, -1);
        setTransaction((t) => ({ ...t, amount: parseFloat(next) || 0 }));
        return next;
      }
      if (key === ".") {
        if (prev.includes(".")) return prev; // only one decimal
        const next = prev === "" ? "0." : prev + ".";
        setTransaction((t) => ({ ...t, amount: parseFloat(next) || 0 }));
        return next;
      }
      // digit
      if (prev === "0") {
        // replace leading zero
        setTransaction((t) => ({ ...t, amount: parseFloat(key) || 0 }));
        return key;
      }
      // guard: max 2 decimal places
      const dotIdx = prev.indexOf(".");
      if (dotIdx !== -1 && prev.length - dotIdx > 2) return prev;
      const next = prev + key;
      setTransaction((t) => ({ ...t, amount: parseFloat(next) || 0 }));
      return next;
    });
  };

  const handleAddEmotion = async () => {
    const tag = newEmotionText.trim().toLowerCase().replace(/\s+/g, "_");
    if (!tag || !user?.uid) return;
    const currentTags = user?.emotionTags?.length ? user.emotionTags : DEFAULT_EMOTION_TAGS;
    if (currentTags.includes(tag)) {
      Alert.alert("Emotion", "This emotion already exists.");
      return;
    }
    const updated = [...currentTags, tag];
    setSavingEmotion(true);
    await updateEmotionTags(user.uid, updated);
    await updateUserData(user.uid);
    setSavingEmotion(false);
    setNewEmotionText("");
    setAddingEmotion(false);
    setTransaction((t) => ({ ...t, emotion: tag }));
  };

  const handleAddWallet = async () => {
    const name = newWalletText.trim();
    if (!name || !user?.uid) return;
    setSavingWallet(true);
    const res = await createOrUpdateWallet({ name, amount: 0 });
    setSavingWallet(false);
    if (res.success) {
      setNewWalletText("");
      setAddingWallet(false);
      if (res.data?.id) setTransaction((t) => ({ ...t, walletId: res.data.id }));
    } else {
      Alert.alert("Wallet", res.msg || "Failed to create wallet.");
    }
  };

  const handleAddCategory = async () => {
    const tag = newCategoryText.trim().toLowerCase().replace(/\s+/g, "_");
    if (!tag || !user?.uid) return;
    const currentKeys = user?.expenseCategories?.length ? user.expenseCategories : DEFAULT_EXPENSE_CATEGORIES;
    if (currentKeys.includes(tag)) {
      Alert.alert("Category", "This category already exists.");
      return;
    }
    const updated = [...currentKeys, tag];
    setSavingCategory(true);
    await updateExpenseCategories(user.uid, updated);
    await updateUserData(user.uid);
    setSavingCategory(false);
    setNewCategoryText("");
    setAddingCategory(false);
    setTransaction((t) => ({ ...t, category: tag }));
  };

  const onDateChange = (event: any, selectedDate: any) => {
    const currentDate = selectedDate || transaction.date;
    setTransaction({ ...transaction, date: currentDate });
    setShowDatePicker(Platform.OS == "android" ? false : true);
  };

  const onSelectImage = (file: any) => {
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
    setLoading(false);
    if (res.success) {
      if (!isEdit) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowConfetti(true);

        const streakResult = res.data?.streak;
        if (streakResult?.isFirstToday) {
          setTimeout(() => {
            router.replace({
              pathname: "/(modals)/streakCelebrationModal",
              params: {
                streakCount: String(streakResult.newStreak),
                action: streakResult.action,
              },
            });
          }, 150);
          return;
        }
      }
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

  // ── Step 1: amount numpad ────────────────────────────────────────────────
  if (step === 1) {
    return (
      <AmountStep
        amountStr={amountStr}
        onKey={handleKey}
        onContinue={() => setStep(2)}
        onClose={() => router.back()}
        insets={insets}
      />
    );
  }

  // ── Step 2: rest of the form ─────────────────────────────────────────────
  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title={oldTransaction?.id ? "Update Transaction" : "Add Transaction"}
          leftIcon={<BackButton onPress={() => setStep(1)} />}
          style={{ marginBottom: spacingY._10 }}
        />

        {/* form */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {/* amount summary (read-only, tappable to go back) */}
          <TouchableOpacity style={styles.amountSummary} onPress={() => setStep(1)}>
            <Typo color={colors.neutral400} size={14} fontWeight="500">Amount</Typo>
            <Typo color={colors.white} size={28} fontWeight="300">
              ₹{amountStr || "0"}
            </Typo>
          </TouchableOpacity>

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

              {!addingEmotion && (
                <TouchableOpacity
                  style={styles.emotionPill}
                  onPress={() => setAddingEmotion(true)}
                >
                  <Icons.Plus size={scale(13)} color={colors.neutral400} weight="bold" />
                </TouchableOpacity>
              )}
            </View>

            {addingEmotion && (
              <View style={styles.addCategoryRow}>
                <TextInput
                  style={styles.addCategoryInput}
                  placeholder="Emotion name…"
                  placeholderTextColor={colors.neutral500}
                  value={newEmotionText}
                  onChangeText={setNewEmotionText}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleAddEmotion}
                />
                <TouchableOpacity
                  style={[styles.addCategoryConfirm, savingEmotion && { opacity: 0.5 }]}
                  onPress={handleAddEmotion}
                  disabled={savingEmotion}
                >
                  {savingEmotion
                    ? <Icons.CircleNotch size={scale(16)} color={colors.black} weight="bold" />
                    : <Icons.Check size={scale(16)} color={colors.black} weight="bold" />
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addCategoryCancel}
                  onPress={() => { setAddingEmotion(false); setNewEmotionText(""); }}
                >
                  <Icons.X size={scale(16)} color={colors.neutral400} weight="bold" />
                </TouchableOpacity>
              </View>
            )}
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

                {/* Add category pill */}
                {!addingCategory && (
                  <TouchableOpacity
                    style={styles.addCategoryPill}
                    onPress={() => setAddingCategory(true)}
                  >
                    <Icons.Plus size={scale(13)} color={colors.neutral400} weight="bold" />
                    <Typo size={12} fontWeight="500" color={colors.neutral400}>New</Typo>
                  </TouchableOpacity>
                )}
              </View>

              {/* Inline add input */}
              {addingCategory && (
                <View style={styles.addCategoryRow}>
                  <TextInput
                    style={styles.addCategoryInput}
                    placeholder="Category name…"
                    placeholderTextColor={colors.neutral500}
                    value={newCategoryText}
                    onChangeText={setNewCategoryText}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleAddCategory}
                  />
                  <TouchableOpacity
                    style={[styles.addCategoryConfirm, savingCategory && { opacity: 0.5 }]}
                    onPress={handleAddCategory}
                    disabled={savingCategory}
                  >
                    {savingCategory
                      ? <Icons.CircleNotch size={scale(16)} color={colors.black} weight="bold" />
                      : <Icons.Check size={scale(16)} color={colors.black} weight="bold" />
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.addCategoryCancel}
                    onPress={() => { setAddingCategory(false); setNewCategoryText(""); }}
                  >
                    <Icons.X size={scale(16)} color={colors.neutral400} weight="bold" />
                  </TouchableOpacity>
                </View>
              )}
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

              {!addingWallet && (
                <TouchableOpacity
                  style={[styles.walletPill, { flexDirection: "row", gap: scale(4) }]}
                  onPress={() => setAddingWallet(true)}
                >
                  <Icons.Plus size={scale(13)} color={colors.neutral400} weight="bold" />
                  <Typo size={13} fontWeight="500" color={colors.neutral400}>New</Typo>
                </TouchableOpacity>
              )}
            </View>

            {addingWallet && (
              <View style={styles.addCategoryRow}>
                <TextInput
                  style={styles.addCategoryInput}
                  placeholder="Wallet name…"
                  placeholderTextColor={colors.neutral500}
                  value={newWalletText}
                  onChangeText={setNewWalletText}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleAddWallet}
                />
                <TouchableOpacity
                  style={[styles.addCategoryConfirm, savingWallet && { opacity: 0.5 }]}
                  onPress={handleAddWallet}
                  disabled={savingWallet}
                >
                  {savingWallet
                    ? <Icons.CircleNotch size={scale(16)} color={colors.black} weight="bold" />
                    : <Icons.Check size={scale(16)} color={colors.black} weight="bold" />
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addCategoryCancel}
                  onPress={() => { setAddingWallet(false); setNewWalletText(""); }}
                >
                  <Icons.X size={scale(16)} color={colors.neutral400} weight="bold" />
                </TouchableOpacity>
              </View>
            )}
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

      {/* Confetti */}
      {showConfetti && (
        <ConfettiCannon
          count={120}
          origin={{ x: Dimensions.get("window").width / 2, y: -20 }}
          autoStart={true}
          fadeOut={true}
          colors={[colors.primary, "#ffffff", "#fbbf24", "#f97316"]}
          onAnimationEnd={() => setShowConfetti(false)}
          fallSpeed={3000}
          explosionSpeed={350}
        />
      )}
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
  amountSummary: {
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._15,
    borderCurve: "continuous",
    paddingHorizontal: spacingX._20,
    paddingVertical: spacingY._12,
    backgroundColor: colors.neutral800,
    gap: spacingY._5,
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
  iosDatePicker: {},
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
  addCategoryPill: {
    width: categoryPillW,
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(6),
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._15,
    borderCurve: "continuous",
    backgroundColor: "transparent",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: scale(4),
  },
  addCategoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    marginTop: verticalScale(8),
  },
  addCategoryInput: {
    flex: 1,
    height: verticalScale(40),
    borderWidth: 1,
    borderColor: colors.neutral600,
    borderRadius: radius._10,
    borderCurve: "continuous",
    paddingHorizontal: spacingX._12,
    color: colors.white,
    fontSize: scale(14),
    backgroundColor: colors.neutral800,
  },
  addCategoryConfirm: {
    width: verticalScale(40),
    height: verticalScale(40),
    backgroundColor: colors.primary,
    borderRadius: radius._10,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  addCategoryCancel: {
    width: verticalScale(40),
    height: verticalScale(40),
    backgroundColor: colors.neutral700,
    borderRadius: radius._10,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
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
