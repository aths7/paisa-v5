import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useCallback, useEffect, useState } from "react";
import ScreenWrapper from "@/components/ScreenWrapper";
import ModalWrapper from "@/components/ModalWrapper";
import Typo from "@/components/Typo";
import Header from "@/components/Header";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Button from "@/components/Button";
import Input from "@/components/Input";
import ImageUpload from "@/components/ImageUpload";
import { scale, verticalScale } from "@/utils/styling";
import { createOrUpdateWallet, deleteWallet } from "@/services/walletService";
import { useLocalSearchParams, useRouter } from "expo-router";
import { TransactionType, WalletType } from "@/types";
import BackButton from "@/components/BackButton";

import TransactionList from "@/components/TransactionList";
import { orderBy } from "firebase/firestore";
import useFetchData from "@/hooks/useFetchData";

const SearchModal = () => {
  const [search, setSearch] = useState("");

  const constraints = [orderBy("date", "desc")];

  // Use the useFetchData hook with the 'transactions' collection and constraints
  const {
    data: allTransactions,
    loading: transactionsLoading,
    error,
  } = useFetchData<TransactionType>("transactions", constraints);

  //   const hanldeSearch = (search: string) => {};
  //   const handleTextDebounce = useCallback(debounce(hanldeSearch, 400), []);

  const filteredTransactions = allTransactions.filter((item) => {
    if (search.length > 1) {
      if (
        item?.category?.toLowerCase()?.includes(search?.toLowerCase()) ||
        item?.type?.toLowerCase()?.includes(search?.toLowerCase()) ||
        item?.description?.toLowerCase()?.includes(search?.toLowerCase())
      ) {
        return true;
      }
      return false;
    }
    return true;
  });

  return (
    <ModalWrapper style={{ backgroundColor: colors.neutral900 }}>
      <View style={styles.container}>
        <Header
          title={"Search"}
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._10 }}
        />
        {/* form */}
        <ScrollView contentContainerStyle={styles.form}>
          <View style={styles.inputContainer}>
            <Input
              placeholder="shoes..."
              value={search}
              placeholderTextColor={colors.neutral400}
              containerStyle={{ backgroundColor: colors.neutral800 }}
              onChangeText={(value) => setSearch(value)}
            />
          </View>

          <View>
            <TransactionList
              loading={transactionsLoading}
              data={filteredTransactions}
              emptyListMessage={"No transactions match your search keywords"}
            />
          </View>
        </ScrollView>
      </View>
    </ModalWrapper>
  );
};

export default SearchModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingY._20,
  },

  form: {
    gap: spacingY._15,
    paddingVertical: spacingY._15,
    paddingBottom: spacingY._40,
    // flex: 1,
  },
  inputContainer: {
    gap: spacingY._10,
  },
});
