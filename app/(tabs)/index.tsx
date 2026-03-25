import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { StatusBar } from "expo-status-bar";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import * as Icons from "phosphor-react-native";
import { scale, verticalScale } from "@/utils/styling";
import HomeCard from "@/components/HomeCard";
import StreakHomeCard from "@/components/StreakHomeCard";
import { getStreakData } from "@/services/streakService";
import { StreakType } from "@/types";
import Button from "@/components/Button";
import { useAuth } from "@/contexts/authContext";
import { useRouter } from "expo-router";
import TransactionList from "@/components/TransactionList";
import { limit, orderBy, Timestamp } from "firebase/firestore";
import useDecryptedData from "@/hooks/useDecryptedData";
import {
  TRANSACTION_STRING_FIELDS,
  TRANSACTION_NUMERIC_FIELDS,
  WALLET_STRING_FIELDS,
  WALLET_NUMERIC_FIELDS,
} from "@/services/encryptionService";
import { TransactionType, WalletType } from "@/types";
import Animated, { FadeInDown } from "react-native-reanimated";

type MonthPill = {
  label: string;
  year: number;
  month: number; // 0–11
};

const Home = () => {
  const { user } = useAuth();
  const router = useRouter();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<MonthPill>({
    label:
      now.toLocaleString("default", { month: "short" }) +
      " " +
      now.getFullYear().toString().slice(-2),
    year: now.getFullYear(),
    month: now.getMonth(),
  });

  const [streakData, setStreakData] = useState<StreakType | null>(null);

  // Re-fetch streak every time the home tab gains focus so the card stays fresh
  // after returning from the transaction or celebration modal
  useFocusEffect(
    useCallback(() => {
      if (!user?.uid) return;
      getStreakData(user.uid).then(setStreakData);
    }, [user?.uid])
  );

  // Fetch last 100 transactions (client-side filtering by month)
  const {
    data: allTransactions,
    loading: transactionsLoading,
  } = useDecryptedData<TransactionType>(
    "transactions",
    TRANSACTION_STRING_FIELDS,
    TRANSACTION_NUMERIC_FIELDS,
    [orderBy("date", "desc"), limit(100)]
  );

  const { data: wallets, loading: walletsLoading } = useDecryptedData<WalletType>(
    "wallets",
    WALLET_STRING_FIELDS,
    WALLET_NUMERIC_FIELDS,
    [orderBy("created", "desc")]
  );

  // Build pills only from months that have at least one transaction.
  // While loading (allTransactions still empty), fall back to current month so pills never disappear.
  const monthPills = useMemo((): MonthPill[] => {
    if (transactionsLoading && allTransactions.length === 0) {
      return [
        {
          label:
            now.toLocaleString("default", { month: "short" }) +
            " " +
            now.getFullYear().toString().slice(-2),
          year: now.getFullYear(),
          month: now.getMonth(),
        },
      ];
    }
    const seen = new Set<string>();
    const pills: MonthPill[] = [];
    for (const txn of allTransactions) {
      let date: Date;
      if (txn.date instanceof Timestamp) {
        date = txn.date.toDate();
      } else if (txn.date instanceof Date) {
        date = txn.date;
      } else {
        date = new Date(txn.date as string);
      }
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${month}`;
      if (!seen.has(key)) {
        seen.add(key);
        pills.push({
          label:
            date.toLocaleString("default", { month: "short" }) +
            " " +
            year.toString().slice(-2),
          year,
          month,
        });
      }
    }
    return pills; // already newest-first (transactions ordered by date desc)
  }, [allTransactions, transactionsLoading]);

  // If the selected month has no transactions (e.g. on first load), switch to latest available
  useEffect(() => {
    if (monthPills.length === 0) return;
    const stillValid = monthPills.some(
      (p) => p.year === selectedMonth.year && p.month === selectedMonth.month
    );
    if (!stillValid) setSelectedMonth(monthPills[0]);
  }, [monthPills]);

  // Filter transactions by selected month (client-side, V1)
  const monthlyTransactions = useMemo(() => {
    return allTransactions.filter((txn) => {
      let date: Date;
      if (txn.date instanceof Timestamp) {
        date = txn.date.toDate();
      } else if (txn.date instanceof Date) {
        date = txn.date;
      } else {
        date = new Date(txn.date as string);
      }
      return (
        date.getFullYear() === selectedMonth.year &&
        date.getMonth() === selectedMonth.month
      );
    });
  }, [allTransactions, selectedMonth]);

  // Monthly spend: expenses excluding bill-payment records
  const monthlySpend = useMemo(() => {
    return monthlyTransactions
      .filter(
        (t) =>
          t.type === "expense" &&
          t.transactionSource !== "credit_card_bill_payment"
      )
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [monthlyTransactions]);

  const hasWallets = !walletsLoading && wallets.length > 0;
  const hasTransactions = !transactionsLoading && allTransactions.length > 0;
  const showSetupCard =
    !walletsLoading &&
    !transactionsLoading &&
    (!hasWallets || !hasTransactions);

  type SetupStep = {
    number: number;
    label: string;
    subLabel: string;
    done: boolean;
    active: boolean;
    onPress: () => void;
  };

  const setupSteps: SetupStep[] = [
    {
      number: 1,
      label: "Create your first wallet",
      subLabel: "A wallet represents a bank account, cash, or any money source",
      done: hasWallets,
      active: !hasWallets,
      onPress: () => router.push("/(modals)/walletModal"),
    },
    {
      number: 2,
      label: "Record your first transaction",
      subLabel: "Log an income or expense to start tracking your finances",
      done: hasTransactions,
      active: hasWallets && !hasTransactions,
      onPress: () => router.push("/(modals)/transactionModal"),
    },
  ];

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Typo size={20}>Hello, <Typo size={20} fontWeight="600">{user?.name || " "}</Typo></Typo>
          <TouchableOpacity
            onPress={() => router.push("/(modals)/searchModal")}
            style={styles.searchIcon}
          >
            <Icons.MagnifyingGlass
              size={verticalScale(22)}
              color={colors.neutral200}
              weight="bold"
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollViewStyle}
          showsVerticalScrollIndicator={false}
        >
          {/* Month pill selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillsContainer}
          >
            {monthPills.map((pill) => {
              const isSelected =
                pill.year === selectedMonth.year &&
                pill.month === selectedMonth.month;
              return (
                <TouchableOpacity
                  key={`${pill.year}-${pill.month}`}
                  style={[styles.pill, isSelected && styles.pillSelected]}
                  onPress={() => setSelectedMonth(pill)}
                >
                  <Typo
                    size={13}
                    fontWeight={isSelected ? "700" : "400"}
                    color={isSelected ? colors.black : colors.neutral300}
                  >
                    {pill.label}
                  </Typo>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* HomeCard */}
          <View>
            <HomeCard
              monthlySpend={monthlySpend}
              monthLabel={selectedMonth.label}
            />
          </View>

          {/* Streak card — hidden until first transaction creates the streak doc */}
          {streakData !== null && (
            <StreakHomeCard
              currentStreak={streakData.currentStreak}
              onPress={() => router.push("/(modals)/streakDetailsModal")}
            />
          )}

          {/* Getting started card */}
          {showSetupCard && (
            <Animated.View
              entering={FadeInDown.duration(600)
                .springify()
                .damping(30)
                .mass(3)
                .stiffness(250)}
              style={styles.setupCard}
            >
              <View style={styles.setupHeader}>
                <Icons.Sparkle
                  size={verticalScale(18)}
                  color={colors.primary}
                  weight="fill"
                />
                <Typo size={16} fontWeight="700">Getting Started</Typo>
              </View>

              <View style={styles.setupSteps}>
                {setupSteps.map((step) => (
                  <View key={step.number} style={styles.stepRow}>
                    <View
                      style={[
                        styles.stepCircle,
                        step.done && styles.stepCircleDone,
                        step.active && styles.stepCircleActive,
                        !step.done && !step.active && styles.stepCircleInactive,
                      ]}
                    >
                      {step.done ? (
                        <Icons.Check
                          size={verticalScale(13)}
                          color={colors.neutral900}
                          weight="bold"
                        />
                      ) : (
                        <Typo
                          size={12}
                          fontWeight="700"
                          color={step.active ? colors.neutral900 : colors.neutral500}
                        >
                          {step.number}
                        </Typo>
                      )}
                    </View>

                    {step.number < setupSteps.length && (
                      <View
                        style={[styles.stepLine, step.done && styles.stepLineDone]}
                      />
                    )}

                    <View style={styles.stepContent}>
                      <Typo
                        size={14}
                        fontWeight="600"
                        color={
                          step.done
                            ? colors.neutral500
                            : step.active
                            ? colors.text
                            : colors.neutral600
                        }
                        style={step.done ? styles.strikethrough : undefined}
                      >
                        {step.label}
                      </Typo>
                      {!step.done && (
                        <Typo size={12} color={colors.neutral500}>
                          {step.subLabel}
                        </Typo>
                      )}
                    </View>

                    {step.active && (
                      <TouchableOpacity
                        onPress={step.onPress}
                        style={styles.stepButton}
                      >
                        <Icons.ArrowRight
                          size={verticalScale(18)}
                          color={colors.neutral900}
                          weight="bold"
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          <TransactionList
            title={`Transactions — ${selectedMonth.label}`}
            loading={transactionsLoading}
            data={monthlyTransactions}
            emptyListMessage={`No transactions in ${selectedMonth.label}`}
          />
        </ScrollView>

        <Button
          onPress={() => router.push("/(modals)/transactionModal")}
          style={styles.floatingButton}
        >
          <Icons.Plus color={colors.black} weight="bold" size={verticalScale(24)} />
        </Button>
      </View>
    </ScreenWrapper>
  );
};

export default Home;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
    marginTop: verticalScale(8),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._10,
  },
  searchIcon: {
    backgroundColor: colors.neutral700,
    padding: spacingX._10,
    borderRadius: 50,
  },
  pillsContainer: {
    gap: scale(8),
    paddingVertical: spacingY._5,
  },
  pill: {
    paddingHorizontal: spacingX._12,
    paddingVertical: spacingY._7,
    borderRadius: radius._20,
    borderWidth: 1,
    borderColor: colors.neutral700,
    backgroundColor: colors.neutral800,
  },
  pillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  floatingButton: {
    height: verticalScale(50),
    width: verticalScale(50),
    borderRadius: 100,
    position: "absolute",
    bottom: verticalScale(30),
    right: verticalScale(30),
  },
  scrollViewStyle: {
    marginTop: spacingY._10,
    paddingBottom: verticalScale(100),
    gap: spacingY._25,
  },
  setupCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._20,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.neutral700,
    padding: spacingX._20,
    gap: spacingY._15,
  },
  setupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
  },
  setupSteps: {
    gap: spacingY._15,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacingX._12,
  },
  stepCircle: {
    width: verticalScale(26),
    height: verticalScale(26),
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: verticalScale(1),
    flexShrink: 0,
  },
  stepCircleDone: { backgroundColor: colors.primary },
  stepCircleActive: { backgroundColor: colors.primary },
  stepCircleInactive: {
    backgroundColor: colors.neutral700,
    borderWidth: 1,
    borderColor: colors.neutral600,
  },
  stepLine: {
    position: "absolute",
    left: verticalScale(12),
    top: verticalScale(27),
    width: 1,
    height: spacingY._15,
    backgroundColor: colors.neutral600,
  },
  stepLineDone: { backgroundColor: colors.primary },
  stepContent: {
    flex: 1,
    gap: verticalScale(3),
  },
  strikethrough: { textDecorationLine: "line-through" },
  stepButton: {
    backgroundColor: colors.primary,
    borderRadius: radius._10,
    padding: verticalScale(7),
    alignSelf: "center",
  },
});
