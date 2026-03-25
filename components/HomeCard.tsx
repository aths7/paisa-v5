import { ImageBackground, StyleSheet, TouchableOpacity, View } from "react-native";
import React from "react";
import { scale, verticalScale } from "@/utils/styling";
import Typo from "./Typo";
import { colors, spacingX } from "@/constants/theme";
import * as Icons from "phosphor-react-native";
import { useRouter } from "expo-router";
import { formatRupees } from "@/utils/common";

type HomeCardProps = {
  monthlySpend?: number;
  monthLabel?: string;
};

const HomeCard = ({ monthlySpend = 0, monthLabel }: HomeCardProps) => {
  const router = useRouter();

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
            This Month
          </Typo>
          <TouchableOpacity onPress={() => router.push("/(tabs)/wallet")}>
            <Icons.DotsThreeOutline
              size={verticalScale(23)}
              color={colors.black}
              weight="fill"
            />
          </TouchableOpacity>
        </View>

        {/* Big spend number */}
        <View style={styles.spendBlock}>
          <Typo color={colors.neutral600} size={13} fontWeight="500">
            Total Spent
          </Typo>
          <Typo color={colors.rose} size={36} fontWeight="bold">
            {formatRupees(monthlySpend)}
          </Typo>
          {monthLabel ? (
            <Typo size={12} color={colors.neutral500}>{monthLabel}</Typo>
          ) : null}
        </View>

        {/* Bottom icon row */}
        <View style={styles.iconRow}>
          <Icons.ChartBar size={verticalScale(18)} color={colors.neutral500} weight="bold" />
        </View>
      </View>
    </ImageBackground>
  );
};

export default HomeCard;

const styles = StyleSheet.create({
  bgImage: {
    height: scale(200),
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
  spendBlock: {
    gap: verticalScale(2),
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});
