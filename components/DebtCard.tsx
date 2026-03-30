import React, { useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { scale, verticalScale } from "@/utils/styling";
import { DebtType } from "@/types";

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

const formatINR = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN");

interface DebtCardProps {
  debt: DebtType;
}

const DebtCard = ({ debt }: DebtCardProps) => {
  const router = useRouter();

  const metrics = useMemo(() => {
    if (!debt.isActive) {
      return { timeProgress: 1, pendingAmount: 0, monthsRemaining: 0, isOverdue: false };
    }

    const start = debt.startDate instanceof Date
      ? debt.startDate
      : new Date((debt.startDate as any)?.seconds ? (debt.startDate as any).seconds * 1000 : debt.startDate as string);

    const now = new Date();
    const elapsed = Math.max(
      (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()),
      0
    );
    const timeProgress = clamp(elapsed / debt.durationMonths, 0, 1);

    // Account for custom per-month payments
    const paidTotal = debt.paidMonths.reduce((sum, month) => {
      const custom = debt.customMonthPayments?.find((c) => c.month === month);
      return sum + (custom ? custom.amount : debt.monthlyEmi);
    }, 0);
    const pendingAmount = Math.max(debt.totalScheduledPayable - paidTotal, 0);

    const monthsRemaining = Math.max(debt.durationMonths - elapsed, 0);
    const isOverdue = elapsed > debt.durationMonths;

    return { timeProgress, pendingAmount, monthsRemaining, isOverdue };
  }, [debt]);

  const handlePress = () => {
    router.push({ pathname: "/debt/[id]", params: { id: debt.id } });
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Top row */}
      <View style={styles.topRow}>
        <View style={styles.topLeft}>
          <Typo size={16} fontWeight="700" color={colors.neutral100} textProps={{ numberOfLines: 1 }}>
            {debt.loanName}
          </Typo>
          <Typo size={12} color={colors.neutral500} textProps={{ numberOfLines: 1 }}>
            {debt.lenderName}
          </Typo>
        </View>
        <View style={styles.topRight}>
          <Typo size={17} fontWeight="700" color={debt.isActive ? colors.primary : colors.neutral500}>
            {formatINR(metrics.pendingAmount)}
          </Typo>
          <Typo size={11} color={colors.neutral600} style={{ textAlign: "right" }}>
            remaining
          </Typo>
        </View>
      </View>

      {/* Time-based progress bar */}
      <View style={styles.progressContainer}>
        <View
          style={[
            styles.progressFill,
            !debt.isActive && styles.progressFillClosed,
            { width: `${metrics.timeProgress * 100}%` },
          ]}
        />
      </View>

      {/* Bottom row */}
      <View style={styles.bottomRow}>
        <Typo size={13} color={colors.neutral500}>
          {formatINR(debt.monthlyEmi)} / mo
        </Typo>
        {!debt.isActive ? (
          <View style={styles.closedChip}>
            <Typo size={11} color={colors.neutral400} fontWeight="600">Closed</Typo>
          </View>
        ) : metrics.isOverdue ? (
          <View style={styles.overdueChip}>
            <Typo size={11} color={colors.white} fontWeight="600">Overdue</Typo>
          </View>
        ) : (
          <Typo size={13} color={colors.neutral500}>
            {metrics.monthsRemaining} mo left
          </Typo>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
    paddingHorizontal: spacingX._15,
    paddingVertical: spacingY._15,
    gap: spacingY._10,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  topLeft: {
    flex: 1,
    marginRight: spacingX._12,
    gap: verticalScale(3),
  },
  topRight: {
    alignItems: "flex-end",
    gap: verticalScale(2),
  },
  progressContainer: {
    height: 5,
    backgroundColor: colors.neutral700,
    borderRadius: 99,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 99,
  },
  progressFillClosed: {
    backgroundColor: colors.neutral600,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  overdueChip: {
    backgroundColor: colors.rose,
    borderRadius: radius._10,
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(3),
  },
  closedChip: {
    backgroundColor: colors.neutral700,
    borderRadius: radius._10,
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(3),
  },
});

export default DebtCard;
