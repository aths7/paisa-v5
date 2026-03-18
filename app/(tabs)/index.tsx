import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useEffect } from "react";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { StatusBar } from "expo-status-bar";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import * as Icons from "phosphor-react-native";
import { scale, verticalScale } from "@/utils/styling";
import HomeCard from "@/components/HomeCard";
import Button from "@/components/Button";
import { signOut } from "firebase/auth";
import { auth } from "@/config/firebase";
import { useAuth } from "@/contexts/authContext";
import { Router, useRouter } from "expo-router";
import TransactionList from "@/components/TransactionList";
import { limit, orderBy } from "firebase/firestore";
import useDecryptedData from "@/hooks/useDecryptedData";
import { TRANSACTION_STRING_FIELDS, TRANSACTION_NUMERIC_FIELDS, WALLET_STRING_FIELDS, WALLET_NUMERIC_FIELDS } from "@/services/encryptionService";
import { TransactionType, WalletType } from "@/types";
import { fetchWeeklyStats } from "@/services/transactionService";
import Animated, { FadeInDown } from "react-native-reanimated";

type SetupStep = {
  number: number;
  label: string;
  subLabel: string;
  done: boolean;
  active: boolean;
  onPress: () => void;
};

const Home = () => {
  const { user } = useAuth();
  const router = useRouter();

  const constraints = [
    orderBy("date", "desc"),
    limit(30),
  ];

  const {
    data: recentTransactions,
    loading: transactionsLoading,
    error,
  } = useDecryptedData<TransactionType>(
    "transactions",
    TRANSACTION_STRING_FIELDS,
    TRANSACTION_NUMERIC_FIELDS,
    constraints
  );

  const { data: wallets, loading: walletsLoading } = useDecryptedData<WalletType>(
    "wallets",
    WALLET_STRING_FIELDS,
    WALLET_NUMERIC_FIELDS,
    [orderBy("created", "desc")]
  );

  const hasWallets = !walletsLoading && wallets.length > 0;
  const hasTransactions = !transactionsLoading && recentTransactions.length > 0;
  const showSetupCard = !walletsLoading && !transactionsLoading && (!hasWallets || !hasTransactions);

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

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* header */}
        <View style={styles.header}>
          <View style={{ gap: 4 }}>
            <Typo size={16} color={colors.neutral400}>
              Hello,
            </Typo>
            <Typo fontWeight={"500"} size={20}>
              {user?.name || " "}
            </Typo>
          </View>
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
          {/* card */}
          <View>
            <HomeCard />
          </View>

          {/* getting started card */}
          {showSetupCard && (
            <Animated.View
              entering={FadeInDown.duration(600).springify().damping(30).mass(3).stiffness(250)}
              style={styles.setupCard}
            >
              <View style={styles.setupHeader}>
                <Icons.Sparkle
                  size={verticalScale(18)}
                  color={colors.primary}
                  weight="fill"
                />
                <Typo size={16} fontWeight={"700"}>
                  Getting Started
                </Typo>
              </View>

              <View style={styles.setupSteps}>
                {setupSteps.map((step) => (
                  <View key={step.number} style={styles.stepRow}>
                    {/* step indicator */}
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
                          fontWeight={"700"}
                          color={step.active ? colors.neutral900 : colors.neutral500}
                        >
                          {step.number}
                        </Typo>
                      )}
                    </View>

                    {/* step connector line */}
                    {step.number < setupSteps.length && (
                      <View
                        style={[
                          styles.stepLine,
                          step.done && styles.stepLineDone,
                        ]}
                      />
                    )}

                    {/* step text + button */}
                    <View style={styles.stepContent}>
                      <Typo
                        size={14}
                        fontWeight={"600"}
                        color={step.done ? colors.neutral500 : step.active ? colors.text : colors.neutral600}
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

                    {/* CTA arrow */}
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
            title={"Recent Transactions"}
            loading={transactionsLoading}
            data={recentTransactions}
            emptyListMessage="No Transactions added yet!"
          />

          {/* <Button onPress={logout}>
            <Typo color={colors.black}>Logout</Typo>
          </Button> */}
        </ScrollView>
        <Button
          onPress={() => router.push("/(modals)/transactionModal")}
          style={styles.floatingButton}
        >
          <Icons.Plus
            color={colors.black}
            weight="bold"
            size={verticalScale(24)}
          />
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
  stepCircleDone: {
    backgroundColor: colors.primary,
  },
  stepCircleActive: {
    backgroundColor: colors.primary,
  },
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
  stepLineDone: {
    backgroundColor: colors.primary,
  },
  stepContent: {
    flex: 1,
    gap: verticalScale(3),
  },
  strikethrough: {
    textDecorationLine: "line-through",
  },
  stepButton: {
    backgroundColor: colors.primary,
    borderRadius: radius._10,
    padding: verticalScale(7),
    alignSelf: "center",
  },
});
