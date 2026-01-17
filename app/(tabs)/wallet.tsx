import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useEffect, useState } from "react";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { scale, verticalScale } from "@/utils/styling";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Button from "@/components/Button";
import * as Icons from "phosphor-react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Header from "@/components/Header";
import useFetchData from "@/hooks/useFetchData";
import { WalletType } from "@/types";
import { orderBy } from "firebase/firestore";
import Loading from "@/components/Loading";
import WalletListItem from "@/components/WalletListItem";
const Wallet = () => {
  const router = useRouter();
  const {
    data: wallets,
    loading,
    error,
  } = useFetchData<WalletType>("wallets", [
    orderBy("created", "desc"),
  ]);

  const getTotalBalance = () =>
    wallets.reduce((total, item) => {
      total = total + (item?.amount || 0);
      return total;
    }, 0);

  return (
    <ScreenWrapper style={{ backgroundColor: colors.black }}>
      <View style={styles.container}>
        {/* balance view */}
        <View style={styles.balanceView}>
          <View style={{ alignItems: "center" }}>
            <Typo size={45} fontWeight={"500"}>
              ₹{getTotalBalance()?.toFixed(2)}
            </Typo>
            <Typo size={16} color={colors.neutral300}>
              Total balance
            </Typo>
          </View>
        </View>

        {/* wallets */}
        <View style={styles.wallets}>
          {/* header */}
          <View style={styles.flexRow}>
            <Typo size={20} fontWeight={"500"}>
              My Wallets
            </Typo>
            <TouchableOpacity
              onPress={() => router.push("/(modals)/walletModal")}
            >
              <Icons.PlusCircle
                weight="fill"
                color={colors.primary}
                size={verticalScale(33)}
              />
            </TouchableOpacity>
          </View>

          {/* wallets data */}
          {loading && <Loading />}
          <FlatList
            data={wallets}
            renderItem={({ item, index }) => (
              <WalletListItem item={item} router={router} index={index} />
            )}
            contentContainerStyle={styles.listStyle}
          // keyExtractor={(item) => item.id}
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
