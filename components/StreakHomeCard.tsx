import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import * as Icons from "phosphor-react-native";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { scale, verticalScale } from "@/utils/styling";
import { getNextMilestone } from "@/constants/milestones";

type Props = {
  currentStreak: number;
  onPress: () => void;
};

const StreakHomeCard = ({ currentStreak, onPress }: Props) => {
  const next = getNextMilestone(currentStreak);

  const hint =
    currentStreak === 0
      ? "Log a transaction to start"
      : next
      ? `${next.days - currentStreak}d to ${next.label}`
      : "All milestones unlocked 🏆";

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Left: fire + count */}
      <View style={styles.left}>
        <Icons.Fire size={scale(15)} color="#f97316" weight="fill" />
        <Typo size={15} fontWeight="700" color={colors.primary}>{currentStreak}</Typo>
        <Typo size={13} color={colors.neutral400}>day streak</Typo>
      </View>

      {/* Middle: hint */}
      <Typo size={12} color={colors.neutral500} style={styles.hint} numberOfLines={1}>
        {hint}
      </Typo>

      {/* Right: arrow */}
      <Icons.ArrowRight size={scale(16)} color={colors.neutral600} />
    </TouchableOpacity>
  );
};

export default StreakHomeCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
    paddingHorizontal: spacingX._15,
    paddingVertical: spacingY._12,
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
  },
  hint: {
    flex: 1,
  },
});
