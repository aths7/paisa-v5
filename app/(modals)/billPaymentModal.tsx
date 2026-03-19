import BackButton from "@/components/BackButton";
import Button from "@/components/Button";
import Header from "@/components/Header";
import ModalWrapper from "@/components/ModalWrapper";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { scale, verticalScale } from "@/utils/styling";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import useDecryptedData from "@/hooks/useDecryptedData";
import {
  WALLET_STRING_FIELDS,
  WALLET_NUMERIC_FIELDS,
} from "@/services/encryptionService";
import { WalletType } from "@/types";
import { orderBy } from "firebase/firestore";
import { markCreditCardBillPaid } from "@/services/walletService";
import { formatIndianNumber } from "@/utils/common";
import Input from "@/components/Input";

const BillPaymentModal = () => {
  const router = useRouter();
  type Params = { cardId: string; cardName: string; pendingAmount: string };
  const { cardId, cardName, pendingAmount: pendingStr } = useLocalSearchParams<Params>();
  const pendingAmount = Number(pendingStr) || 0;

  const { data: allWallets, loading: walletsLoading } = useDecryptedData<WalletType>(
    "wallets",
    WALLET_STRING_FIELDS,
    WALLET_NUMERIC_FIELDS,
    [orderBy("created", "desc")]
  );

  const bankAccounts = allWallets.filter(
    (w) => w.walletType === "bank_account" && w.id !== cardId
  );

  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [amountStr, setAmountStr] = useState(pendingAmount > 0 ? pendingAmount.toString() : "");
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAmountStr(pendingAmount > 0 ? pendingAmount.toString() : "");
  }, [pendingAmount]);

  const onDateChange = (_: any, selectedDate?: Date) => {
    const date = selectedDate || paymentDate;
    setPaymentDate(date);
    setShowDatePicker(Platform.OS === "ios");
  };

  const onSubmit = async () => {
    if (loading) return;

    const amount = parseFloat(amountStr) || 0;

    if (!selectedBankId) {
      Alert.alert("Bill Payment", "Please select a bank account.");
      return;
    }
    if (amount <= 0) {
      Alert.alert("Bill Payment", "Please enter a valid payment amount.");
      return;
    }
    if (amount > pendingAmount) {
      Alert.alert("Bill Payment", "Payment amount cannot exceed the pending amount.");
      return;
    }

    const selectedBank = bankAccounts.find((b) => b.id === selectedBankId);
    const bankBalance = selectedBank?.currentBalance ?? selectedBank?.amount ?? 0;
    if (bankBalance < amount) {
      Alert.alert("Bill Payment", "Insufficient balance in the selected bank account.");
      return;
    }

    setLoading(true);
    const res = await markCreditCardBillPaid(cardId, selectedBankId, amount, paymentDate);
    setLoading(false);

    if (res.success) {
      Alert.alert("Success", "Bill payment recorded successfully!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } else {
      Alert.alert("Bill Payment", res.msg);
    }
  };

  const bankDropdownData = bankAccounts.map((w) => {
    const balance = w.currentBalance ?? w.amount ?? 0;
    return {
      label: `${w.name} (₹${formatIndianNumber(balance)})`,
      value: w.id,
    };
  });

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title="Pay Credit Card Bill"
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._10 }}
        />

        <ScrollView contentContainerStyle={styles.form}>
          {/* Card summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Icons.CreditCard
                size={verticalScale(22)}
                color={colors.primary}
                weight="fill"
              />
              <View style={{ flex: 1 }}>
                <Typo size={15} fontWeight="600">{cardName}</Typo>
                <Typo size={13} color={colors.neutral400}>Credit Card</Typo>
              </View>
            </View>
            <View style={styles.pendingRow}>
              <Typo size={14} color={colors.neutral400}>Total Pending</Typo>
              <Typo size={20} fontWeight="700" color={colors.rose}>
                ₹{formatIndianNumber(pendingAmount)}
              </Typo>
            </View>
          </View>

          {/* Pay from */}
          <View style={styles.inputContainer}>
            <Typo color={colors.neutral200} size={16} fontWeight="500">
              Pay From
            </Typo>
            {bankAccounts.length === 0 ? (
              <View style={styles.noBankNote}>
                <Icons.Warning size={verticalScale(18)} color={colors.rose} weight="fill" />
                <Typo size={14} color={colors.neutral400}>
                  No bank accounts found. Add a bank account first.
                </Typo>
              </View>
            ) : (
              <Dropdown
                style={styles.dropdown}
                activeColor={colors.neutral700}
                itemTextStyle={styles.dropdownItemText}
                selectedTextStyle={styles.dropdownSelectedText}
                itemContainerStyle={styles.dropdownItemContainer}
                iconStyle={styles.dropdownIcon}
                placeholderStyle={styles.dropdownPlaceholder}
                containerStyle={styles.dropdownListContainer}
                data={bankDropdownData}
                labelField="label"
                valueField="value"
                placeholder="Select bank account"
                value={selectedBankId || null}
                onChange={(item) => setSelectedBankId(item.value || "")}
                maxHeight={250}
              />
            )}
          </View>

          {/* Amount */}
          <View style={styles.inputContainer}>
            <Typo color={colors.neutral200} size={16} fontWeight="500">
              Amount to Pay
            </Typo>
            <Input
              keyboardType="decimal-pad"
              value={amountStr}
              onChangeText={(value) => {
                const cleaned = value
                  .replace(/[^0-9.]/g, "")
                  .replace(/(\..*)\./g, "$1");
                setAmountStr(cleaned);
              }}
            />
            <Typo size={12} color={colors.neutral500}>
              Partial payments supported (max ₹{formatIndianNumber(pendingAmount)})
            </Typo>
          </View>

          {/* Payment date */}
          <View style={styles.inputContainer}>
            <Typo color={colors.neutral200} size={16} fontWeight="500">
              Payment Date
            </Typo>
            {!showDatePicker && (
              <Pressable
                style={styles.dateInput}
                onPress={() => setShowDatePicker(true)}
              >
                <Typo size={14}>{paymentDate.toLocaleDateString()}</Typo>
              </Pressable>
            )}
            {showDatePicker && (
              <View>
                <DateTimePicker
                  themeVariant="dark"
                  value={paymentDate}
                  textColor={colors.white}
                  mode="date"
                  maximumDate={new Date()}
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={onDateChange}
                />
                {Platform.OS === "ios" && (
                  <Pressable
                    style={styles.dateOkButton}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Typo size={15} fontWeight="500">OK</Typo>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          onPress={onSubmit}
          loading={loading}
          style={{ flex: 1 }}
        >
          <Typo color={colors.black} fontWeight="700" size={18}>
            Confirm Payment
          </Typo>
        </Button>
      </View>
    </ModalWrapper>
  );
};

export default BillPaymentModal;

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
  summaryCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.neutral700,
    padding: spacingX._15,
    gap: spacingY._10,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
  },
  pendingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacingY._7,
    borderTopWidth: 1,
    borderTopColor: colors.neutral700,
  },
  inputContainer: {
    gap: spacingY._10,
  },
  noBankNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
    backgroundColor: colors.neutral800,
    borderRadius: radius._12,
    padding: spacingX._12,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  dateInput: {
    height: verticalScale(54),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.neutral300,
    borderRadius: radius._17,
    borderCurve: "continuous",
    paddingHorizontal: spacingX._15,
    flexDirection: "row",
  },
  dateOkButton: {
    backgroundColor: colors.neutral700,
    alignSelf: "flex-end",
    padding: spacingY._7,
    marginRight: spacingX._7,
    paddingHorizontal: spacingY._15,
    borderRadius: radius._10,
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: spacingX._20,
    paddingTop: spacingY._15,
    borderTopColor: colors.neutral700,
    borderTopWidth: 1,
    marginBottom: spacingY._5,
  },
  dropdown: {
    height: verticalScale(54),
    borderWidth: 1,
    borderColor: colors.neutral300,
    paddingHorizontal: spacingX._15,
    borderRadius: radius._15,
    borderCurve: "continuous",
  },
  dropdownItemText: { color: colors.white },
  dropdownSelectedText: { color: colors.white, fontSize: verticalScale(14) },
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
  dropdownPlaceholder: { color: colors.neutral400 },
  dropdownItemContainer: {
    borderRadius: radius._15,
    marginHorizontal: spacingX._7,
  },
  dropdownIcon: {
    height: verticalScale(30),
    tintColor: colors.neutral300,
  },
});
