import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Stack } from "expo-router";
import * as Icons from "phosphor-react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import BackButton from "@/components/BackButton";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { scale, verticalScale } from "@/utils/styling";
import { useAuth } from "@/contexts/authContext";
import {
  fetchDebtById,
  markMonthPaid,
  closeDebt,
  deleteDebt,
} from "@/services/debtService";
import { DebtType } from "@/types";

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const formatINR = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

const currentMonthStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const formatMonthLabel = (date?: Date) => {
  const d = date ?? new Date();
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

// ── Circular Progress ──────────────────────────────────────────────────────────
interface CircularProgressProps {
  progress: number; // 0–1
  size: number;
  strokeWidth: number;
  label: string;
  sublabel: string;
}
const CircularProgress = ({ progress, size, strokeWidth, label, sublabel }: CircularProgressProps) => {
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamp(progress, 0, 1));

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
      {/* Track */}
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        stroke={colors.neutral700}
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Fill */}
      <Circle
        cx={cx}
        cy={cy}
        r={radius}
        stroke={colors.primary}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
      {/* Center text — counter-rotate to read normally */}
      <SvgText
        x={cx}
        y={cy - verticalScale(8)}
        textAnchor="middle"
        fill={colors.neutral100}
        fontSize={scale(24)}
        fontWeight="700"
        transform={`rotate(90, ${cx}, ${cy})`}
      >
        {label}
      </SvgText>
      <SvgText
        x={cx}
        y={cy + verticalScale(14)}
        textAnchor="middle"
        fill={colors.neutral400}
        fontSize={scale(11)}
        transform={`rotate(90, ${cx}, ${cy})`}
      >
        {sublabel}
      </SvgText>
    </Svg>
  );
};

// ── Detail Row ────────────────────────────────────────────────────────────────
const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={detailRowStyles.row}>
    <Typo size={13} color={colors.neutral400} style={{ flex: 1 }}>{label}</Typo>
    <Typo size={13} color={colors.neutral200} fontWeight="500" style={{ flex: 1, textAlign: "right" }}>{value}</Typo>
  </View>
);
const detailRowStyles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", paddingVertical: verticalScale(5) } });

// ── Main Screen ───────────────────────────────────────────────────────────────
const DebtDetailScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [debt, setDebt] = useState<DebtType | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closeAmountStr, setCloseAmountStr] = useState("");
  const [closing, setClosing] = useState(false);

  const [markingPaid, setMarkingPaid] = useState(false);
  const initialLoadDoneRef = useRef(false);

  useEffect(() => {
    if (!id || !user?.uid) return;
    initialLoadDoneRef.current = false;
    setLoading(true);
    setNotFound(false);
    setFetchError(false);

    const unsub = fetchDebtById(
      user.uid,
      id,
      (d) => {
        if (d === null) {
          if (initialLoadDoneRef.current) {
            setNotFound(true);
          } else {
            setNotFound(true);
            setLoading(false);
          }
          return;
        }
        setDebt(d);
        setLoading(false);
        initialLoadDoneRef.current = true;

        // If paidMonths now contains current month, clear markingPaid
        const month = currentMonthStr();
        if (d.paidMonths.includes(month)) {
          setMarkingPaid(false);
        }
      },
      () => {
        setFetchError(true);
        setLoading(false);
      }
    );
    return unsub;
  }, [id, user?.uid, retryKey]);

  const metrics = useMemo(() => {
    if (!debt) return null;

    if (!debt.isActive) {
      return { paidProgress: 1, pendingAmount: 0, elapsedMonths: debt.durationMonths, isOverdue: false };
    }

    const start = debt.startDate instanceof Date
      ? debt.startDate
      : new Date((debt.startDate as any)?.seconds ? (debt.startDate as any).seconds * 1000 : debt.startDate as string);

    const now = new Date();
    const elapsedMonths = Math.max(
      (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()),
      0
    );
    const paidProgress = clamp(debt.paidMonths.length / debt.durationMonths, 0, 1);
    const paidTotal = debt.paidMonths.reduce((sum, month) => {
      const custom = debt.customMonthPayments?.find((c) => c.month === month);
      return sum + (custom ? custom.amount : debt.monthlyEmi);
    }, 0);
    const pendingAmount = Math.max(debt.totalScheduledPayable - paidTotal, 0);
    const isOverdue = elapsedMonths > debt.durationMonths;

    return { paidProgress, pendingAmount, elapsedMonths, isOverdue };
  }, [debt]);

  const monthAlreadyPaid = debt?.paidMonths.includes(currentMonthStr()) ?? false;
  const thisMonth = currentMonthStr();
  const thisMonthLabel = formatMonthLabel();

  const handleMarkPaid = () => {
    if (!debt || !user?.uid || markingPaid || monthAlreadyPaid) return;
    Alert.alert(
      "Mark as Paid",
      `Mark ${thisMonthLabel} as paid? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setMarkingPaid(true);
            const result = await markMonthPaid(debt.id!, user.uid!, thisMonth);
            if (!result.success) {
              setMarkingPaid(false);
              Alert.alert("Something went wrong", result.msg ?? "Could not mark month as paid. Please try again.");
            }
            // markingPaid cleared by onSnapshot when paidMonths updates
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Responsibility",
      "This will permanently delete this entry and all its payment history. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!debt?.id || !user?.uid) return;
            const result = await deleteDebt(debt.id, user.uid);
            if (result.success) {
              router.back();
            } else {
              Alert.alert("Something went wrong", result.msg ?? "Could not delete. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleCloseLoan = () => {
    const amount = parseFloat(closeAmountStr);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Validation", "Enter a valid closure amount.");
      return;
    }
    Alert.alert(
      "Confirm Closure",
      "This responsibility will be marked inactive and cannot be edited afterwards.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "destructive",
          onPress: async () => {
            if (!debt?.id || !user?.uid) return;
            setClosing(true);
            const result = await closeDebt(debt.id, amount, user.uid);
            setClosing(false);
            if (result.success) {
              router.back();
            } else {
              Alert.alert("Something went wrong", result.msg ?? "Could not close the loan. Please try again.");
            }
          },
        },
      ]
    );
  };

  // ── Loading ──
  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // ── Not found (mid-session delete) ──
  if (notFound) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerShown: false }} />
        <Icons.Warning size={verticalScale(48)} color={colors.neutral400} />
        <Typo size={18} fontWeight="600" color={colors.neutral200} style={styles.centerTitle}>
          This responsibility is no longer available
        </Typo>
        <Typo size={14} color={colors.neutral400} style={styles.centerText}>
          It may have been deleted or there was a sync error.
        </Typo>
        <Button onPress={() => router.back()} style={styles.centerBtn}>
          <Typo size={14} fontWeight="600" color={colors.black}>Go Back</Typo>
        </Button>
      </View>
    );
  }

  // ── Fetch error ──
  if (fetchError || !debt || !metrics) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerShown: false }} />
        <Icons.CloudSlash size={verticalScale(48)} color={colors.neutral400} />
        <Typo size={18} fontWeight="600" color={colors.neutral200} style={styles.centerTitle}>
          Could not load this
        </Typo>
        <Typo size={14} color={colors.neutral400} style={styles.centerText}>
          Check your connection and try again.
        </Typo>
        <Button onPress={() => setRetryKey((k) => k + 1)} style={styles.centerBtn}>
          <Typo size={14} fontWeight="600" color={colors.black}>Retry</Typo>
        </Button>
        <TouchableOpacity onPress={() => router.back()} style={styles.goBackLink}>
          <Typo size={13} color={colors.neutral400} style={{ textDecorationLine: "underline" }}>Go Back</Typo>
        </TouchableOpacity>
      </View>
    );
  }

  const startDateObj = debt.startDate instanceof Date
    ? debt.startDate
    : new Date((debt.startDate as any)?.seconds ? (debt.startDate as any).seconds * 1000 : debt.startDate as string);

  const closedAtDate = debt.closedSummary?.closedAt instanceof Date
    ? debt.closedSummary.closedAt
    : debt.closedSummary?.closedAt
      ? new Date((debt.closedSummary.closedAt as any)?.seconds
        ? (debt.closedSummary.closedAt as any).seconds * 1000
        : debt.closedSummary.closedAt as string)
      : null;

  const paidProgressPct = Math.round(metrics.paidProgress * 100);
  const monthsRemaining = Math.max(debt.durationMonths - metrics.elapsedMonths, 0);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Details",
          headerStyle: { backgroundColor: colors.neutral900 },
          headerTitleStyle: { color: colors.neutral100, fontSize: scale(16), fontWeight: "600" },
          headerLeft: () => <BackButton onPress={() => router.back()} />,
          headerTintColor: colors.neutral100,
        }}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Circular Progress */}
        <View style={styles.progressCenter}>
          <CircularProgress
            progress={metrics.paidProgress}
            size={verticalScale(180)}
            strokeWidth={14}
            label={`${paidProgressPct}%`}
            sublabel="payments confirmed"
          />
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Typo size={18} fontWeight="700" color={colors.neutral100}>{debt.paidMonths.length}</Typo>
            <Typo size={12} color={colors.neutral400}>Paid</Typo>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statTile}>
            <Typo size={18} fontWeight="700" color={colors.neutral100}>{monthsRemaining}</Typo>
            <Typo size={12} color={colors.neutral400}>Remaining</Typo>
          </View>
        </View>

        {/* Overdue banner */}
        {metrics.isOverdue && debt.isActive && (
          <View style={styles.overdueBanner}>
            <Icons.Warning size={scale(16)} color={colors.white} />
            <Typo size={13} fontWeight="600" color={colors.white}>
              Overdue
            </Typo>
          </View>
        )}

        {/* Mark as Paid */}
        {debt.isActive && (
          <TouchableOpacity
            style={[styles.markPaidBtn, (monthAlreadyPaid || markingPaid) && styles.markPaidBtnDisabled]}
            onPress={handleMarkPaid}
            disabled={monthAlreadyPaid || markingPaid}
            activeOpacity={0.8}
          >
            <Typo
              size={14}
              fontWeight="600"
              color={(monthAlreadyPaid || markingPaid) ? colors.neutral500 : colors.black}
            >
              {monthAlreadyPaid ? `Paid this month ✔` : `Mark ${thisMonthLabel} as Paid`}
            </Typo>
          </TouchableOpacity>
        )}

        <View style={styles.section}>
          <Typo size={14} fontWeight="600" color={colors.neutral400} style={styles.sectionTitle}>
            Info
          </Typo>
          <View style={styles.card}>
            <DetailRow label="Name" value={debt.loanName} />
            <DetailRow label="Lender" value={debt.lenderName} />
            <DetailRow label="Principal" value={formatINR(debt.principalAmount)} />
            <DetailRow label="Annual Rate" value={`${debt.derivedAnnualInterestRate.toFixed(2)}%`} />
            <DetailRow label="Monthly Rate" value={`${debt.derivedMonthlyInterestRate.toFixed(4)}%`} />
            <DetailRow label="Duration" value={`${debt.durationValue} ${debt.durationUnit}`} />
            <DetailRow
              label="Start Date"
              value={startDateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            />
            <DetailRow label="EMI / month" value={formatINR(debt.monthlyEmi)} />
            <DetailRow label="Total Interest" value={formatINR(debt.totalInterestPaid)} />
            {debt.totalCharges > 0 && (
              <DetailRow label="Total Fees" value={formatINR(debt.totalCharges)} />
            )}
            <DetailRow label="Total Cost" value={formatINR(debt.totalScheduledPayable)} />

            {debt.feeItems?.length > 0 && (
              <>
                <View style={styles.subDivider} />
                <Typo size={12} color={colors.neutral400} style={{ marginBottom: verticalScale(4) }}>Fee Breakdown</Typo>
                {debt.feeItems.map((item) => (
                  <DetailRow key={item.id} label={item.name} value={formatINR(item.amount)} />
                ))}
              </>
            )}

            {debt.calculationSource === "emi_override_back_calculated" && debt.calculationExplanation && (
              <View style={styles.explanationBox}>
                <Icons.Info size={scale(14)} color={colors.neutral400} />
                <Typo size={12} color={colors.neutral400} style={{ flex: 1 }}>
                  {debt.calculationExplanation}
                </Typo>
              </View>
            )}
          </View>
        </View>

        {/* Pending amount */}
        {debt.isActive && (
          <View style={styles.section}>
            <View style={[styles.card, styles.pendingCard]}>
              <Typo size={13} color={colors.neutral400}>Amount Remaining</Typo>
              <Typo size={22} fontWeight="700" color={colors.primary}>
                {formatINR(metrics.pendingAmount)}
              </Typo>
              <Typo size={12} color={colors.neutral400}>
                Based on {debt.paidMonths.length} confirmed payment{debt.paidMonths.length !== 1 ? "s" : ""}
              </Typo>
            </View>
          </View>
        )}

        {/* Closure summary */}
        {!debt.isActive && debt.closedSummary && (
          <View style={styles.section}>
            <Typo size={14} fontWeight="600" color={colors.neutral400} style={styles.sectionTitle}>
              Closure Summary
            </Typo>
            <View style={styles.card}>
              {closedAtDate && (
                <DetailRow
                  label="Closed on"
                  value={closedAtDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                />
              )}
              <DetailRow label="You paid" value={formatINR(debt.closedSummary.closePaymentAmount)} />
              <DetailRow label="Scheduled total" value={formatINR(debt.closedSummary.scheduledTotalPayable)} />
              <View style={styles.subDivider} />
              {debt.closedSummary.difference < 0 ? (
                <View style={styles.diffChip}>
                  <View style={[styles.chip, { backgroundColor: colors.green + "33" }]}>
                    <Typo size={13} fontWeight="600" color={colors.green}>
                      Saved {formatINR(Math.abs(debt.closedSummary.difference))}
                    </Typo>
                  </View>
                </View>
              ) : debt.closedSummary.difference > 0 ? (
                <View style={styles.diffChip}>
                  <View style={[styles.chip, { backgroundColor: colors.rose + "33" }]}>
                    <Typo size={13} fontWeight="600" color={colors.rose}>
                      Paid {formatINR(debt.closedSummary.difference)} extra
                    </Typo>
                  </View>
                </View>
              ) : (
                <View style={styles.diffChip}>
                  <View style={[styles.chip, { backgroundColor: colors.neutral700 }]}>
                    <Typo size={13} fontWeight="500" color={colors.neutral300}>
                      Paid exactly as scheduled
                    </Typo>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Action buttons — always visible */}
        <View style={styles.section}>
          <Button
            style={styles.editBtn}
            onPress={() => router.push(`/(modals)/debtEditModal?id=${debt.id}` as any)}
          >
            <Typo size={14} fontWeight="600" color={colors.black}>Edit</Typo>
          </Button>
          <View style={styles.actionRow}>
            {debt.isActive && !showCloseForm && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.closeBtnOutline]}
                onPress={() => setShowCloseForm(true)}
                activeOpacity={0.8}
              >
                <Icons.CheckCircle size={scale(16)} color={colors.neutral400} />
                <Typo size={14} fontWeight="600" color={colors.neutral400}>Mark Closed</Typo>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, styles.deleteBtnOutline]}
              onPress={handleDelete}
              activeOpacity={0.8}
            >
              <Icons.Trash size={scale(16)} color={colors.rose} />
              <Typo size={14} fontWeight="600" color={colors.rose}>Delete</Typo>
            </TouchableOpacity>
          </View>
        </View>

        {/* Closure form */}
        {showCloseForm && debt.isActive && (
          <View style={[styles.section, styles.closureForm]}>
            <Typo size={14} fontWeight="600" color={colors.neutral200}>
              Total amount paid to close
            </Typo>
            <Input
              placeholder="0"
              value={closeAmountStr}
              onChangeText={setCloseAmountStr}
              keyboardType="decimal-pad"
              icon={<Icons.CurrencyInr size={scale(20)} color={colors.neutral400} />}
            />
            <Button
              onPress={handleCloseLoan}
              loading={closing}
              style={[styles.editBtn, { backgroundColor: colors.rose + "22", borderWidth: 1, borderColor: colors.rose }]}
            >
              <Typo size={14} fontWeight="600" color={colors.rose}>Confirm Closure</Typo>
            </Button>
            <TouchableOpacity onPress={() => setShowCloseForm(false)} style={styles.cancelLink}>
              <Typo size={13} color={colors.neutral400}>Cancel</Typo>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.neutral900,
  },
  scrollContent: {
    paddingHorizontal: spacingX._20,
    paddingBottom: verticalScale(60),
    paddingTop: spacingY._20,
    gap: spacingY._15,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.neutral900,
    alignItems: "center",
    justifyContent: "center",
    padding: spacingX._20,
    gap: spacingY._12,
  },
  centerTitle: { textAlign: "center", marginTop: spacingY._10 },
  centerText: { textAlign: "center" },
  centerBtn: { marginTop: spacingY._10 },
  goBackLink: { marginTop: spacingY._5 },
  progressCenter: {
    alignItems: "center",
    paddingVertical: spacingY._10,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
    overflow: "hidden",
  },
  statTile: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacingY._12,
    gap: verticalScale(4),
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.neutral700,
    marginVertical: spacingY._10,
  },
  overdueBanner: {
    flexDirection: "row",
    gap: spacingX._7,
    alignItems: "center",
    backgroundColor: colors.rose,
    borderRadius: radius._10,
    paddingHorizontal: spacingX._15,
    paddingVertical: spacingY._10,
  },
  markPaidBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius._10,
    paddingVertical: verticalScale(14),
    alignItems: "center",
  },
  markPaidBtnDisabled: {
    backgroundColor: colors.neutral700,
  },
  section: { gap: spacingY._10 },
  sectionTitle: {
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
    paddingHorizontal: spacingX._15,
    paddingVertical: spacingY._12,
    gap: verticalScale(2),
  },
  pendingCard: {
    alignItems: "center",
    gap: verticalScale(6),
    paddingVertical: spacingY._20,
  },
  subDivider: {
    height: 1,
    backgroundColor: colors.neutral700,
    marginVertical: spacingY._7,
  },
  explanationBox: {
    flexDirection: "row",
    gap: spacingX._7,
    backgroundColor: colors.neutral700,
    borderRadius: radius._10,
    padding: spacingX._10,
    marginTop: spacingY._10,
  },
  diffChip: { alignItems: "flex-start" },
  chip: {
    paddingHorizontal: spacingX._12,
    paddingVertical: verticalScale(6),
    borderRadius: radius._10,
  },
  editBtn: { marginTop: spacingY._5 },
  actionRow: {
    flexDirection: "row",
    gap: spacingX._10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacingX._7,
    paddingVertical: verticalScale(12),
    borderWidth: 1,
    borderRadius: radius._10,
  },
  closeBtnOutline: {
    borderColor: colors.neutral600,
  },
  deleteBtnOutline: {
    borderColor: colors.rose + "66",
  },
  closureForm: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
    padding: spacingX._15,
  },
  cancelLink: {
    alignItems: "center",
    paddingVertical: verticalScale(8),
  },
});

export default DebtDetailScreen;
