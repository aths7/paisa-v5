import Header from "@/components/Header";
import Loading from "@/components/Loading";
import ScreenWrapper from "@/components/ScreenWrapper";
import TransactionList from "@/components/TransactionList";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import {
  fetchMonthlyStats,
  fetchWeeklyStats,
  fetchYearlyStats,
} from "@/services/transactionService";
import { TransactionType } from "@/types";
import { formatRupees } from "@/utils/common";
import { scale, verticalScale } from "@/utils/styling";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart } from "react-native-gifted-charts";

const EMOTION_COLORS = [
  "#818cf8", "#f472b6", "#fb923c", "#34d399",
  "#38bdf8", "#a78bfa", "#fbbf24", "#f87171",
];

const Analytics = () => {
  const { user } = useAuth();

  const [activeMainTab, setActiveMainTab] = useState(0); // 0 = Statistics, 1 = Emotions
  const [activePeriod, setActivePeriod] = useState(0);  // 0 = Weekly, 1 = Monthly, 2 = Yearly
  const [chartLoading, setChartLoading] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (activePeriod === 0) getWeeklyStats();
    if (activePeriod === 1) getMonthlyStats();
    if (activePeriod === 2) getYearlyStats();
  }, [activePeriod, refreshKey]);

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((k) => k + 1);
    }, [])
  );

  // Behavior + emotion stats derived from fetched transactions
  const behaviorStats = useMemo(() => {
    const expenses = (transactions as TransactionType[]).filter(
      (t) => t.type === "expense"
    );
    const totalExpense = expenses.reduce((s, t) => s + Number(t.amount), 0);

    const impulsiveTotal = expenses
      .filter((t) => t.purchaseStyle === "impulsive")
      .reduce((s, t) => s + Number(t.amount), 0);
    const nonImpulsiveTotal = totalExpense - impulsiveTotal;
    const impulsivePct =
      totalExpense > 0 ? (impulsiveTotal / totalExpense) * 100 : 0;

    const emotionMap: Record<string, number> = {};
    expenses.forEach((t) => {
      if (t.emotion) {
        emotionMap[t.emotion] = (emotionMap[t.emotion] || 0) + Number(t.amount);
      }
    });
    const emotionStats = Object.entries(emotionMap).sort((a, b) => b[1] - a[1]);

    return {
      impulsiveTotal,
      nonImpulsiveTotal,
      impulsivePct,
      emotionStats,
      totalExpense,
    };
  }, [transactions]);

  const getWeeklyStats = async () => {
    setChartLoading(true);
    const res = await fetchWeeklyStats(user?.uid as string);
    setChartLoading(false);
    if (res.success) {
      setChartData(res.data.stats);
      setTransactions(res.data.transactions);
    } else {
      Alert.alert("Error", res.msg);
    }
  };

  const getMonthlyStats = async () => {
    setChartLoading(true);
    const res = await fetchMonthlyStats(user?.uid as string);
    setChartLoading(false);
    if (res.success) {
      setChartData(res.data.stats);
      setTransactions(res.data.transactions);
    } else {
      Alert.alert("Error", res.msg);
    }
  };

  const getYearlyStats = async () => {
    setChartLoading(true);
    const res = await fetchYearlyStats(user?.uid as string);
    setChartLoading(false);
    if (res.success) {
      setChartData(res.data.stats);
      setTransactions(res.data.transactions);
    } else {
      Alert.alert("Error", res.msg);
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Header title="Statistics" />

        {/* Main tab switcher */}
        <View style={styles.mainTabRow}>
          {["Statistics", "Emotions"].map((tab, i) => (
            <TouchableOpacity
              key={tab}
              style={[styles.mainTabPill, activeMainTab === i && styles.mainTabPillActive]}
              onPress={() => setActiveMainTab(i)}
            >
              <Typo
                size={14}
                fontWeight="600"
                color={activeMainTab === i ? colors.black : colors.neutral400}
              >
                {tab}
              </Typo>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Period selector — shared by both tabs */}
          <SegmentedControl
            values={["Weekly", "Monthly", "Yearly"]}
            selectedIndex={activePeriod}
            tintColor={colors.neutral200}
            backgroundColor={colors.neutral800}
            appearance="dark"
            activeFontStyle={styles.segmentFontStyle}
            fontStyle={{ ...styles.segmentFontStyle, color: colors.white }}
            style={styles.segmentStyle}
            onChange={(e) => setActivePeriod(e.nativeEvent.selectedSegmentIndex)}
          />

          {/* ── Statistics tab ── */}
          {activeMainTab === 0 && (
            <>
              <View style={styles.chartContainer}>
                {chartData.length > 0 ? (
                  <BarChart
                    data={chartData}
                    barWidth={scale(12)}
                    spacing={[1, 2].includes(activePeriod) ? scale(25) : scale(16)}
                    roundedTop
                    roundedBottom
                    hideRules
                    xAxisThickness={0}
                    yAxisThickness={0}
                    yAxisLabelWidth={scale(60)}
                    formatYLabel={(val) => {
                      const num = Number(val);
                      if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)}Cr`;
                      if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
                      if (num >= 1000) return `₹${(num / 1000).toFixed(0)}K`;
                      return `₹${num}`;
                    }}
                    yAxisTextStyle={{ color: colors.neutral350 }}
                    xAxisLabelTextStyle={{
                      color: colors.neutral350,
                      fontSize: verticalScale(12),
                    }}
                    noOfSections={3}
                    minHeight={5}
                  />
                ) : (
                  <View style={styles.noChart} />
                )}
                {chartLoading && (
                  <View style={styles.chartLoadingContainer}>
                    <Loading color="white" />
                  </View>
                )}
              </View>

              <TransactionList
                title="Transactions"
                emptyListMessage="No transactions found"
                data={transactions}
              />
            </>
          )}

          {/* ── Emotions tab ── */}
          {activeMainTab === 1 && (
            <>
              {chartLoading && (
                <View style={styles.loadingWrap}>
                  <Loading color="white" />
                </View>
              )}

              {/* Purchase Behavior */}
              {!chartLoading && behaviorStats.totalExpense > 0 && (
                <View style={styles.statsCard}>
                  <Typo size={16} fontWeight="600" style={{ marginBottom: spacingY._12 }}>
                    Purchase Behavior
                  </Typo>

                  {/* Progress bar: rose = impulsive, remainder = non-impulsive */}
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${behaviorStats.impulsivePct}%` as any,
                          backgroundColor: colors.rose,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.behaviorRow}>
                    <View style={styles.behaviorItem}>
                      <View style={[styles.dot, { backgroundColor: colors.rose }]} />
                      <View>
                        <Typo size={13} color={colors.neutral400}>Impulsive</Typo>
                        <Typo size={15} fontWeight="600" color={colors.rose}>
                          {formatRupees(behaviorStats.impulsiveTotal)}
                        </Typo>
                        <Typo size={12} color={colors.neutral500}>
                          {behaviorStats.impulsivePct.toFixed(1)}% of expenses
                        </Typo>
                      </View>
                    </View>

                    <View style={styles.behaviorItem}>
                      <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                      <View>
                        <Typo size={13} color={colors.neutral400}>Non-Impulsive</Typo>
                        <Typo size={15} fontWeight="600" color={colors.primary}>
                          {formatRupees(behaviorStats.nonImpulsiveTotal)}
                        </Typo>
                        <Typo size={12} color={colors.neutral500}>
                          {(100 - behaviorStats.impulsivePct).toFixed(1)}% of expenses
                        </Typo>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* Mood Spending */}
              {!chartLoading && behaviorStats.emotionStats.length > 0 && (
                <View style={styles.statsCard}>
                  <Typo size={16} fontWeight="600" style={{ marginBottom: spacingY._12 }}>
                    Mood Spending
                  </Typo>
                  {behaviorStats.emotionStats.map(([emotion, total], idx) => {
                    const pct =
                      behaviorStats.totalExpense > 0
                        ? (total / behaviorStats.totalExpense) * 100
                        : 0;
                    const barColor = EMOTION_COLORS[idx % EMOTION_COLORS.length];
                    return (
                      <View key={emotion} style={styles.emotionRow}>
                        <Typo size={13} style={{ width: scale(72) }}>
                          {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
                        </Typo>
                        <View style={styles.emotionBarTrack}>
                          <View
                            style={[
                              styles.emotionBarFill,
                              { width: `${pct}%` as any, backgroundColor: barColor },
                            ]}
                          />
                        </View>
                        <Typo
                          size={13}
                          fontWeight="600"
                          color={barColor}
                          style={{ width: scale(90), textAlign: "right" }}
                        >
                          {formatRupees(total)}
                        </Typo>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Empty state */}
              {!chartLoading &&
                behaviorStats.totalExpense === 0 &&
                behaviorStats.emotionStats.length === 0 && (
                  <Typo
                    size={14}
                    color={colors.neutral400}
                    style={{ textAlign: "center", marginTop: verticalScale(40) }}
                  >
                    No emotion data yet. Tag your feelings when adding a transaction.
                  </Typo>
                )}
            </>
          )}
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
};

export default Analytics;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
    paddingTop: spacingY._5,
    gap: spacingY._10,
  },
  mainTabRow: {
    flexDirection: "row",
    backgroundColor: colors.neutral800,
    borderRadius: radius._12,
    borderCurve: "continuous",
    padding: 3,
  },
  mainTabPill: {
    flex: 1,
    paddingVertical: verticalScale(8),
    alignItems: "center",
    borderRadius: radius._10,
    borderCurve: "continuous",
  },
  mainTabPillActive: {
    backgroundColor: colors.neutral200,
  },
  scrollContent: {
    gap: spacingY._20,
    paddingTop: spacingY._5,
    paddingBottom: verticalScale(100),
  },
  segmentStyle: {
    height: scale(37),
    borderRadius: radius._15,
  },
  segmentFontStyle: {
    fontSize: verticalScale(13),
    fontWeight: "bold",
    color: colors.black,
  },
  chartContainer: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  chartLoadingContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: radius._12,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  noChart: {
    backgroundColor: "rgba(0,0,0,0.6)",
    height: verticalScale(210),
    width: "100%",
  },
  loadingWrap: {
    marginTop: verticalScale(40),
    alignItems: "center",
  },
  statsCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    borderCurve: "continuous",
    padding: spacingX._15,
  },
  progressTrack: {
    height: verticalScale(8),
    backgroundColor: colors.primary,
    borderRadius: 99,
    overflow: "hidden",
    marginBottom: spacingY._12,
  },
  progressFill: {
    height: "100%",
    borderRadius: 99,
  },
  behaviorRow: {
    flexDirection: "row",
    gap: spacingX._20,
  },
  behaviorItem: {
    flex: 1,
    flexDirection: "row",
    gap: scale(8),
    alignItems: "flex-start",
  },
  dot: {
    width: scale(10),
    height: scale(10),
    borderRadius: 99,
    marginTop: verticalScale(4),
  },
  emotionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    marginBottom: verticalScale(10),
  },
  emotionBarTrack: {
    flex: 1,
    height: verticalScale(6),
    backgroundColor: colors.neutral700,
    borderRadius: 99,
    overflow: "hidden",
  },
  emotionBarFill: {
    height: "100%",
    borderRadius: 99,
    minWidth: 4,
  },
});
