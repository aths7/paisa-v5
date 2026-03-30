import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import DebtCard from "@/components/DebtCard";
import DebtSummaryCard from "@/components/DebtSummaryCard";
import Button from "@/components/Button";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { scale, verticalScale } from "@/utils/styling";
import { useAuth } from "@/contexts/authContext";
import { fetchDebts } from "@/services/debtService";
import { DebtType } from "@/types";

const formatINR = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN");

const DebtScreen = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [debts, setDebts] = useState<DebtType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    const unsub = fetchDebts(
      user.uid,
      (data) => {
        setDebts(data);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [user?.uid, retryKey]);

  const { activeDebts, inactiveDebts, totalPayable, totalMonthlyEmi, uniqueLenders } =
    useMemo(() => {
      const active = debts.filter((d) => d.isActive && d.status === "active");
      const inactive = debts.filter((d) => !d.isActive || d.status === "inactive");
      const totalPayable = active.reduce((s, d) => s + d.totalScheduledPayable, 0);
      const totalMonthlyEmi = active.reduce((s, d) => s + d.monthlyEmi, 0);
      const uniqueLenders = new Set(active.map((d) => d.lenderName.trim().toLowerCase())).size;
      return { activeDebts: active, inactiveDebts: inactive, totalPayable, totalMonthlyEmi, uniqueLenders };
    }, [debts]);

  const handleRetry = useCallback(() => setRetryKey((k) => k + 1), []);

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Typo size={13} fontWeight="500" color={colors.neutral500} style={styles.headerSub}>
            My
          </Typo>
          <Typo size={28} fontWeight="800" color={colors.neutral100} style={styles.headerTitle}>
            Responsibilities
          </Typo>
        </View>
      </View>

      {/* Summary strip — always visible when active debts exist */}
      {activeDebts.length > 0 && (
        <View style={styles.summaryStrip}>
          <DebtSummaryCard label="Total Payable" value={formatINR(totalPayable)} />
          <View style={styles.summaryDivider} />
          <DebtSummaryCard label="Monthly EMI" value={formatINR(totalMonthlyEmi)} />
          <View style={styles.summaryDivider} />
          <DebtSummaryCard label="Lenders" value={String(uniqueLenders)} />
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? null : error ? (
          /* Error state */
          <View style={styles.centerContent}>
            <Icons.WifiSlash size={verticalScale(32)} color={colors.neutral400} />
            <Typo size={14} color={colors.neutral400} style={styles.centerText}>
              Could not load your responsibilities. Check your connection and try again.
            </Typo>
            <Button onPress={handleRetry} style={styles.retryBtn}>
              <Typo size={14} fontWeight="600" color={colors.black}>Retry</Typo>
            </Button>
          </View>
        ) : debts.length === 0 ? (
          /* Empty state */
          <View style={styles.centerContent}>
            <View style={styles.emptyIconWrap}>
              <Icons.HandCoins size={verticalScale(44)} color={colors.primary} />
            </View>
            <Typo size={20} fontWeight="700" color={colors.neutral100} style={styles.centerTitle}>
              Stay on top of what you owe
            </Typo>
            <Typo size={14} color={colors.neutral400} style={styles.centerText}>
              Tap + to add a responsibility and track EMIs, interest, and payments — all in one place.
            </Typo>
          </View>
        ) : (
          <>
            {activeDebts.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionDot} />
                  <Typo size={12} fontWeight="600" color={colors.neutral400} style={styles.sectionLabel}>
                    ACTIVE
                  </Typo>
                  <Typo size={12} color={colors.neutral600}>
                    {activeDebts.length}
                  </Typo>
                </View>
                <View style={styles.cardList}>
                  {activeDebts.map((debt) => (
                    <DebtCard key={debt.id} debt={debt} />
                  ))}
                </View>
              </View>
            )}

            {inactiveDebts.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, styles.sectionDotClosed]} />
                  <Typo size={12} fontWeight="600" color={colors.neutral400} style={styles.sectionLabel}>
                    CLOSED
                  </Typo>
                  <Typo size={12} color={colors.neutral600}>
                    {inactiveDebts.length}
                  </Typo>
                </View>
                <View style={styles.cardList}>
                  {inactiveDebts.map((debt) => (
                    <DebtCard key={debt.id} debt={debt} />
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/(modals)/debtModal")}
        activeOpacity={0.85}
      >
        <Icons.Plus size={scale(24)} color={colors.black} weight="bold" />
      </TouchableOpacity>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacingX._20,
    paddingTop: spacingY._10,
    paddingBottom: spacingY._15,
  },
  headerSub: {
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: verticalScale(2),
  },
  headerTitle: {
    letterSpacing: -0.5,
  },
  summaryStrip: {
    flexDirection: "row",
    backgroundColor: colors.neutral800,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.neutral700,
    marginHorizontal: spacingX._20,
    borderRadius: radius._15,
    marginBottom: spacingY._15,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.neutral700,
    marginVertical: spacingY._10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacingX._20,
    paddingBottom: verticalScale(110),
    flexGrow: 1,
    gap: spacingY._5,
  },
  section: {
    marginBottom: spacingY._10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
    marginBottom: spacingY._12,
  },
  sectionDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: colors.primary,
  },
  sectionDotClosed: {
    backgroundColor: colors.neutral600,
  },
  sectionLabel: {
    letterSpacing: 1,
    flex: 1,
  },
  cardList: {
    gap: spacingY._12,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacingY._15,
    paddingTop: verticalScale(60),
  },
  emptyIconWrap: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    backgroundColor: colors.primary + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  centerTitle: {
    textAlign: "center",
  },
  centerText: {
    textAlign: "center",
    paddingHorizontal: spacingX._20,
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: spacingY._5,
    paddingHorizontal: spacingX._25,
  },
  fab: {
    position: "absolute",
    bottom: verticalScale(30),
    right: scale(30),
    width: scale(54),
    height: scale(54),
    borderRadius: scale(27),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default DebtScreen;
