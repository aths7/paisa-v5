import { StyleSheet, TouchableOpacity, View } from "react-native";
import React from "react";
import { WalletType } from "@/types";
import { Image } from "expo-image";
import { scale, verticalScale } from "@/utils/styling";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Typo from "./Typo";
import * as Icons from "phosphor-react-native";
import { Router } from "expo-router";
import { formatIndianNumber } from "@/utils/common";
import Animated, { FadeInDown } from "react-native-reanimated";

const WALLET_TYPE_LABELS: Record<string, string> = {
  credit_card: "Credit Card",
  bank_account: "Bank",
  upi_lite: "UPI Lite",
  cash: "Cash",
};

const WALLET_TYPE_COLORS: Record<string, string> = {
  credit_card: "#1d4ed8",
  bank_account: "#065F46",
  upi_lite: "#7c3aed",
  cash: "#b45309",
};

const getDisplayInfo = (item: WalletType) => {
  if (item.walletType === "credit_card") {
    const pending = item.pendingAmount ?? 0;
    const limit = item.creditLimit ?? 0;
    const available = Math.max(limit - pending, 0);
    return {
      primaryLabel: `₹${formatIndianNumber(pending)} due`,
      secondaryLabel: `₹${formatIndianNumber(available)} available`,
    };
  }
  const balance = item.currentBalance ?? item.amount ?? 0;
  return {
    primaryLabel: `₹${formatIndianNumber(balance)}`,
    secondaryLabel: null,
  };
};

const WalletListItem = ({
  item,
  index,
  router,
}: {
  item: WalletType;
  index: number;
  router: Router;
}) => {
  const handleOpen = () => {
    router.push({
      pathname: "/(modals)/walletModal",
      params: {
        id: item?.id,
        name: item?.name,
        image: item?.image,
        walletType: item?.walletType,
        creditLimit: item?.creditLimit?.toString(),
        billingDay: item?.billingDay?.toString(),
        currentBalance: item?.currentBalance?.toString(),
        pendingAmount: item?.pendingAmount?.toString(),
      },
    });
  };

  const { primaryLabel, secondaryLabel } = getDisplayInfo(item);
  const typeLabel = item.walletType ? WALLET_TYPE_LABELS[item.walletType] : null;
  const typeBadgeColor = item.walletType ? WALLET_TYPE_COLORS[item.walletType] : colors.neutral600;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50)
        .springify()
        .damping(30)
        .mass(3)
        .stiffness(250)}
    >
      <TouchableOpacity style={styles.container} onPress={handleOpen}>
        <View style={styles.imageContainer}>
          {item.image && typeof item.image === "string" && !item.image.startsWith("http") ? (
            <View style={styles.emojiContainer}>
              <Typo size={26}>{item.image}</Typo>
            </View>
          ) : (
            <Image
              style={{ flex: 1 }}
              source={item.image}
              contentFit="cover"
              transition={100}
            />
          )}
        </View>

        <View style={styles.nameContainer}>
          <View style={styles.nameRow}>
            <Typo size={16}>{item.name}</Typo>
            {typeLabel && (
              <View style={[styles.typeBadge, { backgroundColor: typeBadgeColor }]}>
                <Typo size={10} color={colors.white} fontWeight="600">
                  {typeLabel}
                </Typo>
              </View>
            )}
          </View>
          <Typo
            size={14}
            color={item.walletType === "credit_card" ? colors.rose : colors.neutral400}
          >
            {primaryLabel}
          </Typo>
          {secondaryLabel && (
            <Typo size={12} color={colors.green}>
              {secondaryLabel}
            </Typo>
          )}
        </View>

        <Icons.CaretRight
          size={verticalScale(20)}
          weight="bold"
          color={colors.white}
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

export default WalletListItem;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(17),
  },
  imageContainer: {
    height: verticalScale(45),
    width: verticalScale(45),
    borderWidth: 1,
    borderColor: colors.neutral600,
    borderRadius: radius._12,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  nameContainer: {
    flex: 1,
    gap: 2,
    marginLeft: spacingX._10,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
    flexWrap: "wrap",
  },
  typeBadge: {
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: radius._6,
  },
  emojiContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
