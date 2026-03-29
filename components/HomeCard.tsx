import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { formatRupees } from "@/utils/common";
import { verticalScale } from "@/utils/styling";
import React from "react";
import { StyleSheet, View } from "react-native";
import Typo from "./Typo";

type HomeCardProps = {
  monthlySpend?: number;
  monthLabel?: string;
  todaySpend?: number;
  last7DaysSpend?: number;
};

const HomeCard = ({ monthlySpend = 0, monthLabel, todaySpend = 0, last7DaysSpend = 0 }: HomeCardProps) => {
  return (
    <View style={styles.card}>
      <Typo size={13} color={colors.neutral400} fontWeight="500">
        {"Spends For"} {monthLabel ?? "This Month"}
      </Typo>
      <Typo size={38} fontWeight="700" color={colors.white}>
        {formatRupees(monthlySpend)}
      </Typo>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Today + Last 7 Days */}
      <View style={styles.subRow}>
        <View style={styles.subItem}>
          <Typo size={11} color={colors.neutral500} fontWeight="500">Today</Typo>
          <Typo size={15} fontWeight="600" color={colors.neutral200}>
            {formatRupees(todaySpend)}
          </Typo>
        </View>
        <View style={[styles.subItem, styles.subItemRight]}>
          <Typo size={11} color={colors.neutral500} fontWeight="500">Last 7 Days</Typo>
          <Typo size={15} fontWeight="600" color={colors.neutral200}>
            {formatRupees(last7DaysSpend)}
          </Typo>
        </View>
      </View>
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
    paddingTop: spacingY._17,
    paddingBottom: spacingY._15,
    gap: verticalScale(2),
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral800,
    marginTop: verticalScale(10),
    marginBottom: verticalScale(8),
  },
  subRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  subItem: {
    gap: verticalScale(2),
  },
  subItemRight: {
    alignItems: "flex-end",
  },
});
