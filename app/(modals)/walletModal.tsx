import BackButton from "@/components/BackButton";
import Button from "@/components/Button";
import Header from "@/components/Header";
import ImageUpload from "@/components/ImageUpload";
import Input from "@/components/Input";
import ModalWrapper from "@/components/ModalWrapper";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import { createOrUpdateWallet, deleteWallet } from "@/services/walletService";
import { WalletType } from "@/types";
import { scale, verticalScale } from "@/utils/styling";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

const WALLET_ICONS = [
  "💰", "🏦", "💳", "🪙", "💵", "🏧", "💎", "📊", "🛍️", "📈",
  "🏠", "🚗", "✈️", "🎓", "💼", "🎮", "🍔", "🏋️", "⚕️", "🎵",
];

const getRandomWalletIcon = () =>
  WALLET_ICONS[Math.floor(Math.random() * WALLET_ICONS.length)];

const WalletModal = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const oldWallet = useLocalSearchParams<{ id?: string; name?: string; image?: string }>();
  const isEditing = !!oldWallet?.id;

  const [wallet, setWallet] = useState({
    name: oldWallet?.name ?? "",
    image: oldWallet?.image ?? null,
  });

  const onSelectImage = (file: any) => {
    if (file) setWallet({ ...wallet, image: file });
  };

  const validateAndSubmit = async () => {
    if (loading) return;
    if (!wallet.name.trim()) {
      Alert.alert("Wallet", "Please enter a wallet name.");
      return;
    }

    const finalImage = wallet.image || getRandomWalletIcon();
    const data: Partial<WalletType> = {
      name: wallet.name,
      image: finalImage,
      uid: user?.uid,
    };
    if (isEditing) data.id = oldWallet.id;

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

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title={isEditing ? "Edit Wallet" : "New Wallet"}
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._10 }}
        />

        <ScrollView contentContainerStyle={styles.form}>
          {/* Wallet Name */}
          <View style={styles.inputContainer}>
            <Typo color={colors.neutral200}>Wallet Name</Typo>
            <Input
              placeholder="e.g. Savings, Cash, PhonePe"
              value={wallet.name}
              onChangeText={(value) => setWallet({ ...wallet, name: value })}
            />
          </View>

          {/* Icon */}
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
});
