import { FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import React from "react";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { verticalScale } from "@/utils/styling";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import * as Icons from "phosphor-react-native";
import { useRouter } from "expo-router";
import useDecryptedData from "@/hooks/useDecryptedData";
import { WALLET_STRING_FIELDS, WALLET_NUMERIC_FIELDS } from "@/services/encryptionService";
import { WalletType } from "@/types";
import { orderBy } from "firebase/firestore";
import Loading from "@/components/Loading";
import { formatIndianNumber } from "@/utils/common";
import WalletListItem from "@/components/WalletListItem";

const Wallet = () => {
  const router = useRouter();
  const { data: wallets, loading } = useDecryptedData<WalletType>(
    "wallets",
    WALLET_STRING_FIELDS,
    WALLET_NUMERIC_FIELDS,
    [orderBy("created", "desc")]
  );

  // In Hand = sum of currentBalance for non-CC wallets (legacy `amount` as fallback)
  const getTotalBalance = () =>
    wallets
      .filter((item) => item.walletType !== "credit_card")
      .reduce((total, item) => total + (item.currentBalance ?? item.amount ?? 0), 0);

  return (
    <ScreenWrapper style={{ backgroundColor: colors.black }}>
      <View style={styles.container}>
        {/* balance view */}
        <View style={styles.balanceView}>
          <View style={{ alignItems: "center" }}>
            <Typo size={45} fontWeight="500">
              ₹{formatIndianNumber(getTotalBalance())}
            </Typo>
            <Typo size={16} color={colors.neutral300}>
              In Hand
            </Typo>
          </View>
        </View>

        {/* wallets */}
        <View style={styles.wallets}>
          <View style={styles.flexRow}>
            <Typo size={20} fontWeight="500">My Wallets</Typo>
            <TouchableOpacity onPress={() => router.push("/(modals)/walletModal")}>
              <Icons.PlusCircle
                weight="fill"
                color={colors.primary}
                size={verticalScale(33)}
              />
            </TouchableOpacity>
          </View>

          {loading && <Loading />}
          <FlatList
            data={wallets}
            renderItem={({ item, index }) => (
              <WalletListItem item={item} router={router} index={index} />
            )}
            contentContainerStyle={styles.listStyle}
          />
        </View>
      </View>
    </ScreenWrapper>
  );
};

export default Wallet;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  balanceView: {
    height: verticalScale(160),
    backgroundColor: colors.black,
    justifyContent: "center",
    alignItems: "center",
  },
  flexRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacingY._10,
  },
  wallets: {
    flex: 1,
    backgroundColor: colors.neutral900,
    borderTopRightRadius: radius._30,
    borderTopLeftRadius: radius._30,
    padding: spacingX._20,
    paddingTop: spacingX._25,
  },
  listStyle: {
    paddingVertical: spacingY._25,
    paddingTop: spacingY._15,
  },
});
