import React from "react";
import { StyleSheet, View } from "react-native";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY } from "@/constants/theme";
import { scale, verticalScale } from "@/utils/styling";

interface DebtSummaryCardProps {
  label: string;
  value: string;
}

const DebtSummaryCard = ({ label, value }: DebtSummaryCardProps) => (
  <View style={styles.tile}>
    <Typo size={16} fontWeight="700" color={colors.primary} textProps={{ numberOfLines: 1, adjustsFontSizeToFit: true }}>
      {value}
    </Typo>
    <Typo size={11} color={colors.neutral400} fontWeight="500">
      {label}
    </Typo>
  </View>
);

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacingY._12,
    paddingHorizontal: spacingX._7,
    gap: verticalScale(4),
  },
});

export default DebtSummaryCard;
