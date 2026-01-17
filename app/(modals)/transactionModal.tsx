import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useEffect, useState } from "react";
import ModalWrapper from "@/components/ModalWrapper";
import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Typo from "@/components/Typo";
import Input from "@/components/Input";
import { scale, verticalScale } from "@/utils/styling";
import * as Icons from "phosphor-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Button from "@/components/Button";

import { Dropdown } from "react-native-element-dropdown";
import useFetchData from "@/hooks/useFetchData";
import { TransactionType, WalletType } from "@/types";
import { useAuth } from "@/contexts/authContext";
import { orderBy } from "firebase/firestore";
import ImageUpload from "@/components/ImageUpload";
import { expenseCategories, transactionTypes } from "@/constants/data";
import {
  createOrUpdateTransaction,
  deleteTransaction,
} from "@/services/transactionService";
import { useLocalSearchParams, useRouter } from "expo-router";

const TransactionModal = () => {
  const { user } = useAuth();
  const router = useRouter();
  type paramType = {
    id: string;
    type: string;
    amount: string; // Note: Keeping it as string since query parameters are strings
    category?: string;
    date: string; // Store as string for parsing later
    description?: string;
    image?: any;
    uid?: string;
    walletId: string;
  };
  const oldTransaction: paramType = useLocalSearchParams();
  // console.log("old transaction: ", oldTransaction);

  const {
    data: wallets = [],
    loading: walletLoading,
    error,
  } = user?.uid
    ? useFetchData<WalletType>("wallets", [orderBy("created", "desc")])
    : { data: [], loading: false, error: null };

  const [loading, setLoading] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);

  const [transaction, setTransaction] = useState<TransactionType>({
    type: "expense",
    amount: 0,
    description: "",
    category: "",
    date: new Date(),
    walletId: "",
    image: null,
  });

  useEffect(() => {
    if (oldTransaction?.id) {
      // console.log("old tr: ", oldTransaction);
      setTransaction({
        type: oldTransaction.type,
        amount: Number(oldTransaction.amount),
        description: oldTransaction.description || "",
        category: oldTransaction.category || "",
        date: new Date(oldTransaction.date), // Convert string to Date object
        walletId: oldTransaction.walletId,
        image: oldTransaction?.image || null,
      });
    }
  }, []);

  const onDateChange = (event: any, selectedDate: any) => {
    const currentDate = selectedDate || transaction.date;
    setTransaction({ ...transaction, date: currentDate }); // Update the date state
    setShowDatePicker(Platform.OS == "android" ? false : true); // will be false on android, but will stay open on ios
  };

  const onSelectImage = (file: any) => {
    // console.log("file: ", file);
    if (file) setTransaction({ ...transaction, image: file });
  };

  const onSubmit = async () => {
    const { type, amount, description, category, date, walletId, image } =
      transaction;

    if (!walletId || !date || !amount || (type == "expense" && !category)) {
      Alert.alert("Transaction", "Please fill all the fields");
      return;
    }

    // if (type == "expense") {
    //   let selectedWallet = wallets.find((wallet) => wallet.id == walletId);
    //   if (selectedWallet) {
    //     let remainingBalance = selectedWallet.amount! - amount;
    //     if (remainingBalance < 0) {
    //       Alert.alert(
    //         "Not Enough Balance",
    //         "The selected wallet don't have enough balance"
    //       );
    //       return;
    //     }
    //   }
    // }

    let transactionData: TransactionType = {
      type,
      amount,
      description,
      category,
      date,
      walletId,
      image,
      uid: user?.uid,
    };

    if (oldTransaction?.id) transactionData.id = oldTransaction.id;

    setLoading(true);

    const res = await createOrUpdateTransaction(transactionData);
    // console.log("transaction: ", res);
    setLoading(false);
    if (res.success) {
      router.back();
    } else {
      Alert.alert("Transaction", res.msg);
    }
  };

  const showDeleteAlert = () => {
    Alert.alert(
      "Confirm",
      "Are you sure you want to delete this transaction?",
      [
        {
          text: "Cancel",
          onPress: () => console.log("Cancel delete"),
          style: "cancel",
        },
        {
          text: "Delete",
          onPress: () => onDeleteTransaction(),
          style: "destructive",
        },
      ]
    );
  };

  const onDeleteTransaction = async () => {
    console.log("deleting the tr: ", oldTransaction);
    if (oldTransaction) {
      setLoading(true);
      let res = await deleteTransaction(
        oldTransaction?.id,
        oldTransaction?.walletId
      );
      setLoading(false);
      if (res.success) {
        router.back();
      } else {
        Alert.alert("Transaction", res.msg);
      }
    }
  };

  // console.log("got item: ", transaction.type);

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title={oldTransaction?.id ? "Update Transaction" : "Add Transaction"}
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._10 }}
        />

        {/* form */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.form}
        >
          {/* type */}
          <View style={styles.inputContainer}>
            <Typo color={colors.neutral200} size={16} fontWeight={"500"}>
              Type
            </Typo>
            <Dropdown
              style={styles.dropdownContainer}
              activeColor={colors.neutral700}
              itemTextStyle={styles.dropdownItemText}
              selectedTextStyle={styles.dropdownSelectedText}
              itemContainerStyle={styles.dropdownItemContainer}
              iconStyle={styles.dropdownIcon}
              data={transactionTypes}
              maxHeight={300}
              labelField="label"
              valueField="value"
              // placeholder={!isFocus ? "Select item" : "..."}
              // searchPlaceholder="Search..."
              placeholderStyle={styles.dropdownPlaceholder}
              value={transaction.type}
              containerStyle={styles.dropdownListContainer}
              onChange={(item) => {
                setTransaction({ ...transaction, type: item.value });
              }}
            />
          </View>

          {/* wallet */}

          <View style={styles.inputContainer}>
            <Typo color={colors.neutral200} size={16} fontWeight={"500"}>
              Wallet
            </Typo>
            <Dropdown
              style={styles.dropdownContainer}
              activeColor={colors.neutral700}
              itemTextStyle={styles.dropdownItemText}
              selectedTextStyle={styles.dropdownSelectedText}
              itemContainerStyle={styles.dropdownItemContainer}
              iconStyle={styles.dropdownIcon}
              data={wallets.map((wallet) => ({
                label: `${wallet?.name} ($${wallet.amount})`,
                value: wallet?.id,
              }))}
              maxHeight={300}
              labelField="label"
              valueField="value"
              // placeholder={!isFocus ? "Select item" : "..."}
              // searchPlaceholder="Search..."
              placeholderStyle={styles.dropdownPlaceholder}
              value={transaction.walletId}
              containerStyle={styles.dropdownListContainer}
              onChange={(item) => {
                setTransaction({ ...transaction, walletId: item.value || "" });
              }}
            />
          </View>

          {/* category: show only if type is expense */}

          {transaction.type == "expense" && (
            <View style={styles.inputContainer}>
              <Typo color={colors.neutral200} size={16} fontWeight={"500"}>
                Expense Cateogry
              </Typo>
              <Dropdown
                style={styles.dropdownContainer}
                activeColor={colors.neutral700}
                itemTextStyle={styles.dropdownItemText}
                selectedTextStyle={styles.dropdownSelectedText}
                itemContainerStyle={styles.dropdownItemContainer}
                iconStyle={styles.dropdownIcon}
                data={Object.values(expenseCategories)}
                maxHeight={300}
                labelField="label"
                valueField="value"
                // placeholder={!isFocus ? "Select item" : "..."}
                // searchPlaceholder="Search..."
                placeholderStyle={styles.dropdownPlaceholder}
                value={transaction.category}
                containerStyle={styles.dropdownListContainer}
                onChange={(item) => {
                  setTransaction({
                    ...transaction,
                    category: item.value || "",
                  });
                }}
              />
            </View>
          )}

          {/* date picker */}
          <View style={styles.inputContainer}>
            <Typo color={colors.neutral200} size={16} fontWeight={"500"}>
              Date
            </Typo>
            {!showDatePicker && (
              <Pressable
                style={styles.dateInput}
                onPress={() => setShowDatePicker(true)}
              >
                <Typo size={14}>
                  {(transaction?.date as Date)?.toLocaleDateString()}
                </Typo>
              </Pressable>
            )}

            {showDatePicker && (
              <View style={Platform.OS == "ios" && styles.iosDatePicker}>
                <DateTimePicker
                  themeVariant="dark"
                  value={transaction.date as Date}
                  textColor={colors.white}
                  mode="date"
                  display={Platform.OS == "ios" ? "spinner" : "default"}
                  onChange={onDateChange}
                />

                {Platform.OS == "ios" && (
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Typo size={15} fontWeight={"500"}>
                      OK
                    </Typo>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* amount */}
          <View style={styles.inputContainer}>
            <Typo color={colors.neutral200} size={16}>
              Amount
            </Typo>
            <Input
              keyboardType="numeric"
              // placeholder="Salary"
              value={transaction.amount?.toString()}
              onChangeText={(value) =>
                setTransaction({
                  ...transaction,
                  amount: Number(value.replace(/[^0-9]/g, "")),
                })
              }
            />
          </View>
          {/* description */}
          <View style={styles.inputContainer}>
            <View style={styles.flexRow}>
              <Typo color={colors.neutral200} size={16}>
                Description
              </Typo>
              <Typo color={colors.neutral500} size={14}>
                (optional)
              </Typo>
            </View>

            <Input
              // placeholder="Salary"
              value={transaction.description}
              multiline
              numberOfLines={2}
              containerStyle={{
                flexDirection: "row",
                height: verticalScale(100),
                alignItems: "flex-start",
                paddingVertical: 15,
              }}
              onChangeText={(value) =>
                setTransaction({
                  ...transaction,
                  description: value,
                })
              }
            />
          </View>
          <View style={styles.inputContainer}>
            <View style={styles.flexRow}>
              <Typo color={colors.neutral200} size={16}>
                Receipt
              </Typo>
              <Typo color={colors.neutral500} size={14}>
                (optional)
              </Typo>
            </View>
            <ImageUpload
              file={transaction.image}
              onSelect={onSelectImage}
              onClear={() => setTransaction({ ...transaction, image: null })}
              placeholder="Upload Image"
            />
          </View>
        </ScrollView>
      </View>

      {/* footer */}
      <View style={styles.footer}>
        {oldTransaction?.id && !loading && (
          <Button
            style={{
              backgroundColor: colors.rose,
              paddingHorizontal: spacingX._15,
            }}
            onPress={showDeleteAlert}
          >
            <Icons.Trash
              color={colors.white}
              size={verticalScale(24)}
              weight="bold"
            />
          </Button>
        )}

        <Button loading={loading} onPress={onSubmit} style={{ flex: 1 }}>
          <Typo color={colors.black} size={20} fontWeight={"bold"}>
            {oldTransaction?.id ? "Update" : "Submit"}
          </Typo>
        </Button>
      </View>
    </ModalWrapper>
  );
};

export default TransactionModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingY._20,
  },
  form: {
    gap: spacingY._20,
    paddingVertical: spacingY._15,
    paddingBottom: spacingY._40,
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: spacingX._20,
    gap: scale(12),
    paddingTop: spacingY._15,
    borderTopColor: colors.neutral700,
    marginBottom: spacingY._5,
    borderTopWidth: 1,
  },
  inputContainer: {
    gap: spacingY._10,
  },
  iosDropDown: {
    flexDirection: "row",
    height: verticalScale(54),
    alignItems: "center",
    justifyContent: "center",
    fontSize: verticalScale(14),
    borderWidth: 1,
    color: colors.white,
    borderColor: colors.neutral300,
    borderRadius: radius._17,
    borderCurve: "continuous",
    paddingHorizontal: spacingX._15,
  },
  androidDropDown: {
    // flexDirection: "row",
    height: verticalScale(54),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    fontSize: verticalScale(14),
    color: colors.white,
    borderColor: colors.neutral300,
    borderRadius: radius._17,
    borderCurve: "continuous",
    // paddingHorizontal: spacingX._15,
  },
  flexRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._5,
  },
  dateInput: {
    flexDirection: "row",
    height: verticalScale(54),
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.neutral300,
    borderRadius: radius._17,
    borderCurve: "continuous",
    paddingHorizontal: spacingX._15,
  },

  iosDatePicker: {
    // backgroundColor: "red",
  },
  datePickerButton: {
    backgroundColor: colors.neutral700,
    alignSelf: "flex-end",
    padding: spacingY._7,
    marginRight: spacingX._7,
    paddingHorizontal: spacingY._15,
    borderRadius: radius._10,
  },
  dropdownContainer: {
    height: verticalScale(54),
    borderWidth: 1,
    borderColor: colors.neutral300,
    paddingHorizontal: spacingX._15,
    borderRadius: radius._15,
    borderCurve: "continuous",
  },
  dropdownItemText: { color: colors.white },
  dropdownSelectedText: {
    color: colors.white,
    fontSize: verticalScale(14),
  },
  dropdownListContainer: {
    backgroundColor: colors.neutral900,
    borderRadius: radius._15,
    borderCurve: "continuous",
    paddingVertical: spacingY._7,
    top: 5,
    borderColor: colors.neutral500,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 5,
  },
  dropdownPlaceholder: {
    color: colors.white,
  },
  dropdownItemContainer: {
    borderRadius: radius._15,
    marginHorizontal: spacingX._7,
  },
  dropdownIcon: {
    height: verticalScale(30),
    tintColor: colors.neutral300,
  },
});
