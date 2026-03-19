import { ImageBackground, StyleSheet, TouchableOpacity, View } from "react-native";
import React from "react";
import { scale, verticalScale } from "@/utils/styling";
import Typo from "./Typo";
import { colors, spacingX, spacingY } from "@/constants/theme";
import * as Icons from "phosphor-react-native";
import useDecryptedData from "@/hooks/useDecryptedData";
import { WALLET_STRING_FIELDS, WALLET_NUMERIC_FIELDS } from "@/services/encryptionService";
import { WalletType } from "@/types";
import { orderBy } from "firebase/firestore";
import { useRouter } from "expo-router";

type HomeCardProps = {
  monthlySpend?: number;
  monthLabel?: string;
};

const HomeCard = ({ monthlySpend = 0, monthLabel }: HomeCardProps) => {
  const router = useRouter();
  const {
    data: wallets,
    loading: walletLoading,
  } = useDecryptedData<WalletType>(
    "wallets",
    WALLET_STRING_FIELDS,
    WALLET_NUMERIC_FIELDS,
    [orderBy("created", "desc")]
  );

  /** Sum of currentBalance (or legacy `amount`) for non-credit-card wallets */
  const inHand = wallets
    .filter((w) => w.walletType !== "credit_card")
    .reduce((sum, w) => sum + (w.currentBalance ?? w.amount ?? 0), 0);

  /** Sum of available credit across all credit cards */
  const borrowedPower = wallets
    .filter((w) => w.walletType === "credit_card")
    .reduce((sum, w) => {
      const limit = w.creditLimit ?? 0;
      const pending = w.pendingAmount ?? 0;
      return sum + Math.max(limit - pending, 0);
    }, 0);

  const overallSpendCapacity = inHand + borrowedPower;

  const fmt = (n: number) => `₹${n.toFixed(2)}`;

  return (
    <ImageBackground
      source={require("../assets/images/card.png")}
      resizeMode="stretch"
      style={styles.bgImage}
    >
      <View style={styles.container}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <Typo color={colors.neutral800} size={17} fontWeight="500">
            Spend Capacity
          </Typo>
          <TouchableOpacity onPress={() => router.push("/(tabs)/wallet")}>
            <Icons.DotsThreeOutline
              size={verticalScale(23)}
              color={colors.black}
              weight="fill"
            />
          </TouchableOpacity>
        </View>

        {/* Big number — overall spend capacity */}
        <Typo color={colors.black} size={30} fontWeight="bold">
          {walletLoading ? "----" : fmt(overallSpendCapacity)}
        </Typo>

        {/* Three metric columns */}
        <View style={styles.stats}>
          {/* Monthly Spend */}
          <View style={styles.statCol}>
            <View style={styles.statLabel}>
              <View style={[styles.statsIcon, { backgroundColor: "#fde68a" }]}>
                <Icons.ChartBar
                  size={verticalScale(14)}
                  color={colors.black}
                  weight="bold"
                />
              </View>
              <Typo size={13} color={colors.neutral700} fontWeight="500">
                Spend
              </Typo>
            </View>
            <Typo size={14} color={colors.rose} fontWeight="600">
              {walletLoading ? "----" : fmt(monthlySpend)}
            </Typo>
            {monthLabel && (
              <Typo size={11} color={colors.neutral600}>
                {monthLabel}
              </Typo>
            )}
          </View>

          {/* In Hand */}
          <View style={styles.statCol}>
            <View style={styles.statLabel}>
              <View style={[styles.statsIcon, { backgroundColor: "#bbf7d0" }]}>
                <Icons.Wallet
                  size={verticalScale(14)}
                  color={colors.black}
                  weight="bold"
                />
              </View>
              <Typo size={13} color={colors.neutral700} fontWeight="500">
                In Hand
              </Typo>
            </View>
            <Typo size={14} color={colors.green} fontWeight="600">
              {walletLoading ? "----" : fmt(inHand)}
            </Typo>
          </View>

          {/* Borrowed Power */}
          <View style={styles.statCol}>
            <View style={styles.statLabel}>
              <View style={[styles.statsIcon, { backgroundColor: "#bfdbfe" }]}>
                <Icons.CreditCard
                  size={verticalScale(14)}
                  color={colors.black}
                  weight="bold"
                />
              </View>
              <Typo size={13} color={colors.neutral700} fontWeight="500">
                Credit
              </Typo>
            </View>
            <Typo size={14} color={colors.neutral800} fontWeight="600">
              {walletLoading ? "----" : fmt(borrowedPower)}
            </Typo>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
};

export default HomeCard;

const styles = StyleSheet.create({
  bgImage: {
    height: scale(210),
    width: "100%",
  },
  container: {
    padding: spacingX._20,
    paddingHorizontal: scale(23),
    height: "90%",
    width: "100%",
    justifyContent: "space-between",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stats: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  statCol: {
    gap: verticalScale(3),
    flex: 1,
  },
  statLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
  },
  statsIcon: {
    padding: spacingY._5,
    borderRadius: 50,
  },
});
