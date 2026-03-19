import BackButton from "@/components/BackButton";
import Button from "@/components/Button";
import Header from "@/components/Header";
import ImageUpload from "@/components/ImageUpload";
import Input from "@/components/Input";
import ModalWrapper from "@/components/ModalWrapper";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import { createOrUpdateWallet, deleteWallet } from "@/services/walletService";
import { WalletKind, WalletType } from "@/types";
import { scale, verticalScale } from "@/utils/styling";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const WALLET_ICONS = [
  "💰", "🏦", "💳", "🪙", "💵", "🏧", "💎", "📊", "🛍️", "📈",
  "🏠", "🚗", "✈️", "🎓", "💼", "🎮", "🍔", "🏋️", "⚕️", "🎵",
];

const getRandomWalletIcon = () =>
  WALLET_ICONS[Math.floor(Math.random() * WALLET_ICONS.length)];

type WalletTypeOption = {
  kind: WalletKind;
  label: string;
  emoji: string;
  desc: string;
};

const WALLET_TYPE_OPTIONS: WalletTypeOption[] = [
  { kind: "bank_account", label: "Bank Account", emoji: "🏦", desc: "Savings or current account" },
  { kind: "credit_card", label: "Credit Card", emoji: "💳", desc: "Track spending & bill payments" },
  { kind: "upi_lite", label: "UPI Lite", emoji: "📱", desc: "UPI or digital wallet" },
  { kind: "cash", label: "Cash", emoji: "💵", desc: "Physical cash on hand" },
];

const WalletModal = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  type OldWalletParams = {
    id?: string;
    name?: string;
    image?: string;
    walletType?: WalletKind;
    creditLimit?: string;
    billingDay?: string;
    currentBalance?: string;
    pendingAmount?: string;
  };
  const oldWallet: OldWalletParams = useLocalSearchParams();
  const isEditing = !!oldWallet?.id;

  const [selectedType, setSelectedType] = useState<WalletKind | null>(
    oldWallet?.walletType ?? null
  );
  const [wallet, setWallet] = useState({
    name: oldWallet?.name ?? "",
    image: oldWallet?.image ?? null,
    currentBalance: oldWallet?.currentBalance ? Number(oldWallet.currentBalance) : 0,
    creditLimit: oldWallet?.creditLimit ? Number(oldWallet.creditLimit) : 0,
    billingDay: oldWallet?.billingDay ? Number(oldWallet.billingDay) : 5,
  });

  useEffect(() => {
    if (oldWallet?.walletType) {
      setSelectedType(oldWallet.walletType);
    }
  }, []);

  const onSelectImage = (file: any) => {
    if (file) setWallet({ ...wallet, image: file });
  };

  const validateAndSubmit = async () => {
    if (loading) return;

    if (!selectedType) {
      Alert.alert("Wallet", "Please select a wallet type.");
      return;
    }
    if (!wallet.name.trim()) {
      Alert.alert("Wallet", "Please enter a wallet name.");
      return;
    }
    if (selectedType === "credit_card") {
      if (!wallet.creditLimit || wallet.creditLimit <= 0) {
        Alert.alert("Wallet", "Please enter a valid credit limit.");
        return;
      }
      if (wallet.billingDay < 1 || wallet.billingDay > 28) {
        Alert.alert("Wallet", "Billing day must be between 1 and 28.");
        return;
      }
    } else {
      if (wallet.currentBalance < 0) {
        Alert.alert("Wallet", "Balance cannot be negative.");
        return;
      }
    }

    const finalImage = wallet.image || getRandomWalletIcon();

    const data: Partial<WalletType> = {
      name: wallet.name,
      image: finalImage,
      uid: user?.uid,
      walletType: selectedType,
    };

    if (isEditing) {
      data.id = oldWallet.id;
      // Type-specific editable fields
      if (selectedType === "credit_card") {
        data.creditLimit = wallet.creditLimit;
        data.billingDay = wallet.billingDay;
      }
    } else {
      // New wallet — pass initial balance fields
      if (selectedType === "credit_card") {
        data.creditLimit = wallet.creditLimit;
        data.billingDay = wallet.billingDay;
      } else {
        data.currentBalance = wallet.currentBalance;
      }
    }

    setLoading(true);
    const res = await createOrUpdateWallet(data);
    setLoading(false);

    if (res.success) {
      router.back();
    } else {
      Alert.alert("Wallet", res.msg);
    }
  };

  const onDelete = async () => {
    if (!oldWallet?.id) return;
    setLoading(true);
    const res = await deleteWallet(oldWallet.id);
    setLoading(false);
    if (res.success) {
      router.back();
    } else {
      Alert.alert("Wallet", res.msg);
    }
  };

  const showDeleteAlert = () => {
    Alert.alert(
      "Confirm",
      "Are you sure you want to delete this wallet?\nThis will remove all related transactions!",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", onPress: onDelete, style: "destructive" },
      ]
    );
  };

  const navigateToBillPayment = () => {
    router.push({
      pathname: "/(modals)/billPaymentModal",
      params: {
        cardId: oldWallet.id,
        cardName: wallet.name,
        pendingAmount: oldWallet.pendingAmount ?? "0",
      },
    });
  };

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title={isEditing ? "Edit Wallet" : "New Wallet"}
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._10 }}
        />

        <ScrollView contentContainerStyle={styles.form}>
          {/* Wallet type selector */}
          <View style={styles.inputContainer}>
            <Typo color={colors.neutral200} size={16} fontWeight="500">
              Wallet Type
            </Typo>
            <View style={styles.typeGrid}>
              {WALLET_TYPE_OPTIONS.map((option) => {
                const selected = selectedType === option.kind;
                return (
                  <TouchableOpacity
                    key={option.kind}
                    style={[
                      styles.typeCard,
                      selected && styles.typeCardSelected,
                      isEditing && styles.typeCardDisabled,
                    ]}
                    onPress={() => {
                      if (!isEditing) setSelectedType(option.kind);
                    }}
                    activeOpacity={isEditing ? 1 : 0.7}
                  >
                    <Typo size={24}>{option.emoji}</Typo>
                    <Typo
                      size={13}
                      fontWeight="600"
                      color={selected ? colors.primary : colors.neutral200}
                    >
                      {option.label}
                    </Typo>
                    <Typo size={11} color={colors.neutral500}>
                      {option.desc}
                    </Typo>
                  </TouchableOpacity>
                );
              })}
            </View>
            {isEditing && (
              <Typo size={12} color={colors.neutral500}>
                Wallet type cannot be changed after creation.
              </Typo>
            )}
          </View>

          {/* Wallet Name */}
          {selectedType && (
            <View style={styles.inputContainer}>
              <Typo color={colors.neutral200}>Wallet Name</Typo>
              <Input
                placeholder={
                  selectedType === "credit_card"
                    ? "HDFC Credit Card"
                    : selectedType === "bank_account"
                    ? "Savings Account"
                    : selectedType === "upi_lite"
                    ? "PhonePe / GPay"
                    : "Cash"
                }
                value={wallet.name}
                onChangeText={(value) => setWallet({ ...wallet, name: value })}
              />
            </View>
          )}

          {/* Icon */}
          {selectedType && (
            <View style={styles.inputContainer}>
              <View style={styles.labelRow}>
                <Typo color={colors.neutral200}>Wallet Icon</Typo>
                <Typo color={colors.neutral500} size={14}>(optional)</Typo>
              </View>
              <ImageUpload
                file={wallet.image}
                onSelect={onSelectImage}
                onClear={() => setWallet({ ...wallet, image: null })}
                placeholder="Upload Image"
              />
            </View>
          )}

          {/* Credit Card specific fields */}
          {selectedType === "credit_card" && (
            <>
              <View style={styles.inputContainer}>
                <Typo color={colors.neutral200}>Credit Limit</Typo>
                <Input
                  keyboardType="numeric"
                  placeholder="100000"
                  value={wallet.creditLimit === 0 ? "" : wallet.creditLimit.toString()}
                  onChangeText={(value) =>
                    setWallet({
                      ...wallet,
                      creditLimit: Number(value.replace(/[^0-9.]/g, "")),
                    })
                  }
                />
              </View>
              <View style={styles.inputContainer}>
                <Typo color={colors.neutral200}>Billing Day</Typo>
                <Input
                  keyboardType="numeric"
                  placeholder="5"
                  value={wallet.billingDay.toString()}
                  onChangeText={(value) => {
                    const day = parseInt(value.replace(/[^0-9]/g, ""), 10) || 1;
                    setWallet({ ...wallet, billingDay: Math.min(Math.max(day, 1), 28) });
                  }}
                />
                <Typo size={12} color={colors.neutral500}>
                  Day of month your bill is generated (1–28)
                </Typo>
              </View>

              {/* Mark Bill as Paid (edit mode only) */}
              {isEditing && (
                <TouchableOpacity
                  style={styles.billPaymentCta}
                  onPress={navigateToBillPayment}
                >
                  <Icons.CreditCard
                    size={verticalScale(20)}
                    color={colors.primary}
                    weight="bold"
                  />
                  <Typo color={colors.primary} fontWeight="600" size={15}>
                    Mark Bill as Paid
                  </Typo>
                  <Icons.CaretRight
                    size={verticalScale(16)}
                    color={colors.primary}
                    weight="bold"
                  />
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Balance for non-CC wallets (new only) */}
          {selectedType && selectedType !== "credit_card" && !isEditing && (
            <View style={styles.inputContainer}>
              <View style={styles.labelRow}>
                <Typo color={colors.neutral200}>Current Balance</Typo>
                <Typo color={colors.neutral500} size={14}>(optional)</Typo>
              </View>
              <Input
                keyboardType="numeric"
                placeholder="0"
                value={wallet.currentBalance === 0 ? "" : wallet.currentBalance.toString()}
                onChangeText={(value) =>
                  setWallet({
                    ...wallet,
                    currentBalance: Number(value.replace(/[^0-9.]/g, "")),
                  })
                }
              />
              <Typo size={12} color={colors.neutral500}>
                Opening balance — won't be counted as income
              </Typo>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {isEditing && !loading && (
          <Button
            style={{ backgroundColor: colors.rose, paddingHorizontal: spacingX._15 }}
            onPress={showDeleteAlert}
          >
            <Icons.Trash color={colors.white} size={verticalScale(24)} weight="bold" />
          </Button>
        )}
        <Button onPress={validateAndSubmit} loading={loading} style={{ flex: 1 }}>
          <Typo color={colors.black} fontWeight="700" size={18}>
            {isEditing ? "Update Wallet" : "Add Wallet"}
          </Typo>
        </Button>
      </View>
    </ModalWrapper>
  );
};

export default WalletModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingY._20,
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: spacingX._20,
    gap: scale(12),
    paddingTop: spacingY._15,
    borderTopColor: colors.neutral700,
    marginBottom: spacingY._5,
    borderTopWidth: 1,
  },
  form: {
    gap: spacingY._20,
    paddingVertical: spacingY._15,
    paddingBottom: spacingY._40,
  },
  inputContainer: {
    gap: spacingY._10,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._5,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(10),
  },
  typeCard: {
    width: "47%",
    backgroundColor: colors.neutral800,
    borderRadius: radius._12,
    borderCurve: "continuous",
    borderWidth: 1.5,
    borderColor: colors.neutral700,
    padding: spacingX._12,
    gap: spacingY._5,
    alignItems: "flex-start",
  },
  typeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.neutral700,
  },
  typeCardDisabled: {
    opacity: 0.6,
  },
  billPaymentCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
    backgroundColor: colors.neutral800,
    borderRadius: radius._12,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacingX._15,
  },
});
