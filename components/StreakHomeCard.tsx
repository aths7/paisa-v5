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
      ? "Log a transaction to start your streak"
      : next
      ? `${next.days - currentStreak} day${next.days - currentStreak !== 1 ? "s" : ""} to ${next.label}`
      : "All milestones unlocked! 🏆";

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.row}>
        {/* Left — streak info */}
        <View style={styles.left}>
          <View style={styles.labelRow}>
            <Icons.Fire size={scale(16)} color="#f97316" weight="fill" />
            <Typo size={13} color={colors.neutral400} style={{ marginLeft: scale(5) }}>
              Streak
            </Typo>
          </View>
          <View style={styles.countRow}>
            <Typo size={34} fontWeight="800" color={colors.primary} style={styles.count}>
              {currentStreak}
            </Typo>
            <Typo size={14} color={colors.neutral400} style={styles.daysLabel}>
              {" "}days
            </Typo>
          </View>
        </View>

        {/* Right — arrow */}
        <Icons.ArrowRight size={scale(20)} color={colors.neutral600} />
      </View>

      <Typo size={12} color={colors.neutral500} style={styles.hint}>
        {hint}
      </Typo>
    </TouchableOpacity>
  );
};

export default StreakHomeCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._20,
    borderWidth: 1,
    borderColor: colors.neutral700,
    paddingHorizontal: spacingX._20,
    paddingVertical: spacingY._15,
    gap: verticalScale(4),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    gap: verticalScale(2),
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  countRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  count: {
    lineHeight: verticalScale(40),
    letterSpacing: -0.5,
  },
  daysLabel: {
    lineHeight: verticalScale(40),
  },
  hint: {
    marginTop: verticalScale(2),
  },
});
