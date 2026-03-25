import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { formatRupees } from "@/utils/common";
import { verticalScale } from "@/utils/styling";
import React from "react";
import { StyleSheet, View } from "react-native";
import Typo from "./Typo";

type HomeCardProps = {
  monthlySpend?: number;
  monthLabel?: string;
};

const HomeCard = ({ monthlySpend = 0, monthLabel }: HomeCardProps) => {
  return (
    <View style={styles.card}>
      <Typo size={13} color={colors.neutral400} fontWeight="500">
        {"Spends For"} {monthLabel ?? "This Month"}
      </Typo>
      <Typo size={42} fontWeight="700" color={colors.white}>
        {formatRupees(monthlySpend)}
      </Typo>

    </View>
  );
};

export default HomeCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral900,
    borderRadius: radius._20,
    borderCurve: "continuous",
    paddingHorizontal: spacingX._20,
    paddingVertical: spacingY._25,
    gap: verticalScale(2),
  },
});
