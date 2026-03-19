import { ImageBackground, StyleSheet, TouchableOpacity, View } from "react-native";
import React from "react";
import { scale, verticalScale } from "@/utils/styling";
import Typo from "./Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import * as Icons from "phosphor-react-native";
import useDecryptedData from "@/hooks/useDecryptedData";
import { WALLET_STRING_FIELDS, WALLET_NUMERIC_FIELDS } from "@/services/encryptionService";
import { WalletType } from "@/types";
import { orderBy } from "firebase/firestore";
import { useRouter } from "expo-router";
import { formatRupees } from "@/utils/common";

type HomeCardProps = {
  monthlySpend?: number;
  monthLabel?: string;
};

type StatTileProps = {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  valueColor: string;
  subLabel?: string;
};

const StatTile = ({ icon, iconBg, label, value, valueColor, subLabel }: StatTileProps) => (
  <View style={tileStyles.tile}>
    <View style={tileStyles.labelRow}>
      <View style={[tileStyles.iconWrap, { backgroundColor: iconBg }]}>{icon}</View>
      <Typo size={12} color={colors.neutral600} fontWeight="500">{label}</Typo>
    </View>
    <Typo size={15} color={valueColor} fontWeight="700" style={tileStyles.value}>
      {value}
    </Typo>
    {subLabel ? (
      <Typo size={10} color={colors.neutral500}>{subLabel}</Typo>
    ) : null}
  </View>
);

const tileStyles = StyleSheet.create({
  tile: {
    width: "50%",
    paddingRight: scale(8),
    gap: verticalScale(2),
    marginBottom: verticalScale(6),
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
  },
  iconWrap: {
    padding: scale(4),
    borderRadius: 50,
  },
  value: {
    paddingLeft: scale(2),
  },
});

const HomeCard = ({ monthlySpend = 0, monthLabel }: HomeCardProps) => {
  const router = useRouter();
  const { data: wallets, loading: walletLoading } = useDecryptedData<WalletType>(
    "wallets",
    WALLET_STRING_FIELDS,
    WALLET_NUMERIC_FIELDS,
    [orderBy("created", "desc")]
  );

  const inHand = wallets
    .filter((w) => w.walletType !== "credit_card")
    .reduce((sum, w) => sum + (w.currentBalance ?? w.amount ?? 0), 0);

  const borrowedPower = wallets
    .filter((w) => w.walletType === "credit_card")
    .reduce((sum, w) => sum + Math.max((w.creditLimit ?? 0) - (w.pendingAmount ?? 0), 0), 0);

  const overallSpendCapacity = inHand + borrowedPower;

  const dash = "----";
  const fmt = (n: number) => walletLoading ? dash : formatRupees(n);

  return (
    <ImageBackground
      source={require("../assets/images/card.png")}
      resizeMode="stretch"
      style={styles.bgImage}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Typo color={colors.neutral800} size={16} fontWeight="500">
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

        {/* Big number */}
        <Typo color={colors.black} size={28} fontWeight="bold">
          {fmt(overallSpendCapacity)}
        </Typo>

        {/* 2×2 stat grid */}
        <View style={styles.grid}>
          <StatTile
            icon={<Icons.ChartBar size={verticalScale(12)} color={colors.black} weight="bold" />}
            iconBg="#fde68a"
            label="Monthly Spend"
            value={walletLoading ? dash : formatRupees(monthlySpend)}
            valueColor={colors.rose}
            subLabel={monthLabel}
          />
          <StatTile
            icon={<Icons.Wallet size={verticalScale(12)} color={colors.black} weight="bold" />}
            iconBg="#bbf7d0"
            label="In Hand"
            value={fmt(inHand)}
            valueColor={colors.green}
          />
          <StatTile
            icon={<Icons.CreditCard size={verticalScale(12)} color={colors.black} weight="bold" />}
            iconBg="#bfdbfe"
            label="Credit Available"
            value={fmt(borrowedPower)}
            valueColor={colors.neutral800}
          />
        </View>
      </View>
    </ImageBackground>
  );
};

export default HomeCard;

const styles = StyleSheet.create({
  bgImage: {
    height: scale(230),
    width: "100%",
  },
  container: {
    padding: spacingX._20,
    paddingHorizontal: scale(23),
    height: "92%",
    justifyContent: "space-between",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
