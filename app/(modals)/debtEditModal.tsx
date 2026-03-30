import React, { useEffect, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import { doc, getDoc } from "firebase/firestore";
import DateInput from "@/components/DateInput";
import { firestore } from "@/config/firebase";
import { deriveKey } from "@/services/encryptionService";
import ModalWrapper from "@/components/ModalWrapper";
import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import Input from "@/components/Input";
import Button from "@/components/Button";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { scale, verticalScale } from "@/utils/styling";
import {
  calculateDebtPreview,
  updateDebt,
  decryptDebtDocument,
  DebtCalculationResult,
  DebtCalculationInput,
} from "@/services/debtService";
import {
  DebtFeeItem,
  DebtType,
  InterestRateFrequency,
  DebtDurationUnit,
} from "@/types";
import { useAuth } from "@/contexts/authContext";

const formatINR = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN");

type CustomPaymentEntry = { month: string; amount: number };

type FormState = {
  loanName: string;
  lenderName: string;
  loanAmountStr: string;
  interestRateStr: string;
  interestRateFrequency: InterestRateFrequency;
  durationStr: string;
  durationUnit: DebtDurationUnit;
  isActive: boolean;
  feeItems: DebtFeeItem[];
  monthlyEmiStr: string;
  customMonthPayments: CustomPaymentEntry[];
};

const DebtEditModal = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [originalDebt, setOriginalDebt] = useState<DebtType | null>(null);
  const [fetching, setFetching] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState | null>(null);
  const [startDay, setStartDay] = useState("01");
  const [startMonth, setStartMonth] = useState("01");
  const [startYear, setStartYear] = useState(String(new Date().getFullYear()));
  const [calc, setCalc] = useState<DebtCalculationResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Fee row scratch state
  const [feeName, setFeeName] = useState("");
  const [feeAmountStr, setFeeAmountStr] = useState("");

  // Custom month payment scratch state — single "DD/MM/YYYY" masked field
  const [customDateStr, setCustomDateStr] = useState("");
  const [customDateError, setCustomDateError] = useState<string | null>(null);
  const [customAmountStr, setCustomAmountStr] = useState("");

  // Fetch and pre-fill on mount
  useEffect(() => {
    if (!id || !user?.uid) return;
    const key = deriveKey(user.uid);
    getDoc(doc(firestore, "users", user.uid, "debts", id))
      .then((snap) => {
        if (!snap.exists()) {
          Alert.alert("Not Found", "This loan could not be found.");
          router.back();
          return;
        }
        const raw = { id: snap.id, ...snap.data() } as any;
        const debt = decryptDebtDocument(raw, key);

        setOriginalDebt(debt);

        const sd = debt.startDate instanceof Date
          ? debt.startDate
          : new Date((debt.startDate as any)?.seconds ? (debt.startDate as any).seconds * 1000 : debt.startDate as string);
        setStartDay(String(sd.getDate()).padStart(2, "0"));
        setStartMonth(String(sd.getMonth() + 1).padStart(2, "0"));
        setStartYear(String(sd.getFullYear()));

        setForm({
          loanName: debt.loanName,
          lenderName: debt.lenderName,
          loanAmountStr: String(debt.principalAmount),
          interestRateStr: String(debt.enteredInterestRate),
          interestRateFrequency: debt.enteredInterestRateFrequency,
          durationStr: String(debt.durationValue),
          durationUnit: debt.durationUnit,
          isActive: debt.isActive,
          feeItems: debt.feeItems ?? [],
          monthlyEmiStr: String(Math.round(debt.monthlyEmi)),
          customMonthPayments: debt.customMonthPayments ?? [],
        });
      })
      .catch(() => {
        Alert.alert("Error", "Could not load this loan.");
        router.back();
      })
      .finally(() => setFetching(false));
  }, [id, user?.uid]);

  const setField = (key: keyof FormState, value: any) =>
    setForm((f) => f ? { ...f, [key]: value } : f);

  const parsedStartDate = (): Date | null => {
    const d = parseInt(startDay, 10);
    const m = parseInt(startMonth, 10);
    const y = parseInt(startYear, 10);
    if (isNaN(d) || isNaN(m) || isNaN(y) || y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const date = new Date(y, m - 1, d);
    return date.getDate() === d ? date : null;
  };

  const parseCustomDate = (raw: string): { month: string } | null => {
    // Accepts "DD/MM/YYYY"
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8) return null;
    const d = parseInt(digits.slice(0, 2), 10);
    const m = parseInt(digits.slice(2, 4), 10);
    const y = parseInt(digits.slice(4, 8), 10);
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
    const date = new Date(y, m - 1, d);
    if (date.getDate() !== d) return null; // invalid day for month
    return { month: `${y}-${String(m).padStart(2, "0")}` };
  };

  const handleCustomDateChange = (text: string) => {
    // Auto-insert slashes: DD/MM/YYYY
    const digits = text.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4);
    else if (digits.length > 2) formatted = digits.slice(0, 2) + "/" + digits.slice(2);
    setCustomDateStr(formatted);
    setCustomDateError(null);
  };

  const handleAddCustomPayment = () => {
    if (!form) return;
    const amount = parseFloat(customAmountStr);
    if (isNaN(amount) || amount <= 0) {
      setCustomDateError("Enter a valid amount.");
      return;
    }
    const parsed = parseCustomDate(customDateStr);
    if (!parsed) {
      setCustomDateError("Enter a valid date as DD/MM/YYYY.");
      return;
    }
    setCustomDateError(null);
    const existing = form.customMonthPayments.filter((c) => c.month !== parsed.month);
    setField("customMonthPayments", [...existing, { month: parsed.month, amount }]);
    setCustomDateStr("");
    setCustomAmountStr("");
  };

  const handleRemoveCustomPayment = (month: string) => {
    if (!form) return;
    setField("customMonthPayments", form.customMonthPayments.filter((c) => c.month !== month));
  };

  const handleAddFee = () => {
    if (!form) return;
    const amount = parseFloat(feeAmountStr);
    if (!feeName.trim() || isNaN(amount) || amount <= 0) return;
    setField("feeItems", [
      ...form.feeItems,
      { id: String(Date.now() + Math.random()), name: feeName.trim(), amount },
    ]);
    setFeeName("");
    setFeeAmountStr("");
  };

  const handleRemoveFee = (id: string) => {
    if (!form) return;
    setField("feeItems", form.feeItems.filter((f) => f.id !== id));
  };

  const calcFieldsChanged = (): boolean => {
    if (!form || !originalDebt) return false;
    const principal = parseFloat(form.loanAmountStr);
    const rate = parseFloat(form.interestRateStr);
    const duration = parseFloat(form.durationStr);
    return (
      principal !== originalDebt.principalAmount ||
      rate !== originalDebt.enteredInterestRate ||
      form.interestRateFrequency !== originalDebt.enteredInterestRateFrequency ||
      duration !== originalDebt.durationValue ||
      form.durationUnit !== originalDebt.durationUnit
    );
  };

  const handleProceed = () => {
    if (!form) return;
    const principal = parseFloat(form.loanAmountStr);
    const rate = parseFloat(form.interestRateStr);
    const duration = parseFloat(form.durationStr);

    if (!form.loanName.trim()) return Alert.alert("Validation", "Loan name is required.");
    if (!form.lenderName.trim()) return Alert.alert("Validation", "Lender name is required.");
    if (isNaN(principal) || principal <= 0) return Alert.alert("Validation", "Enter a valid loan amount.");
    if (isNaN(rate) || rate <= 0) return Alert.alert("Validation", "Enter a valid interest rate.");
    if (isNaN(duration) || duration <= 0) return Alert.alert("Validation", "Enter a valid duration.");

    const sd = parsedStartDate();
    if (!sd) return Alert.alert("Validation", "Enter a valid start date (DD/MM/YYYY).");

    if (calcFieldsChanged()) {
      const input: DebtCalculationInput = {
        loanName: form.loanName,
        lenderName: form.lenderName,
        principalAmount: principal,
        interestRate: rate,
        interestRateFrequency: form.interestRateFrequency,
        startDate: sd,
        durationValue: duration,
        durationUnit: form.durationUnit,
        isActive: form.isActive,
        feeItems: form.feeItems,
      };
      setCalc(calculateDebtPreview(input));
      setStep(2);
    } else {
      // No calculation change — save directly
      handleSaveDirectly();
    }
  };

  const handleSaveDirectly = async () => {
    if (!form || !id) return;
    setLoading(true);
    try {
      const emiOverride = parseFloat(form.monthlyEmiStr);
      const result = await updateDebt({
        id,
        loanName: form.loanName,
        lenderName: form.lenderName,
        isActive: form.isActive,
        status: form.isActive ? "active" : "inactive",
        feeItems: form.feeItems,
        totalCharges: form.feeItems.reduce((s, f) => s + f.amount, 0),
        ...(emiOverride > 0 && !isNaN(emiOverride) ? { monthlyEmi: emiOverride } : {}),
        customMonthPayments: form.customMonthPayments,
        userAcceptedCalculation: true,
      });
      if (result.success) router.back();
      else Alert.alert("Something went wrong", result.msg ?? "Your changes could not be saved. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWithCalc = async () => {
    if (!form || !calc || !id) return;
    setLoading(true);
    try {
      const principal = parseFloat(form.loanAmountStr);
      const rate = parseFloat(form.interestRateStr);
      const duration = parseFloat(form.durationStr);

      const result = await updateDebt({
        id,
        loanName: form.loanName,
        lenderName: form.lenderName,
        principalAmount: principal,
        enteredInterestRate: rate,
        enteredInterestRateFrequency: form.interestRateFrequency,
        derivedAnnualInterestRate: calc.derivedAnnualInterestRate,
        derivedMonthlyInterestRate: calc.derivedMonthlyInterestRate,
        startDate: parsedStartDate() ?? new Date(),
        durationValue: duration,
        durationUnit: form.durationUnit,
        durationMonths: calc.durationMonths,
        isActive: form.isActive,
        status: form.isActive ? "active" : "inactive",
        feeItems: form.feeItems,
        totalCharges: calc.totalCharges,
        monthlyEmi: calc.monthlyEmi,
        totalPrincipalPaid: calc.totalPrincipalPaid,
        totalInterestPaid: calc.totalInterestPaid,
        totalScheduledPayable: calc.totalScheduledPayable,
        calculationSource: calc.calculationSource,
        customMonthPayments: form.customMonthPayments,
        userAcceptedCalculation: true,
      });
      if (result.success) router.back();
      else Alert.alert("Something went wrong", result.msg ?? "Your changes could not be saved. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching || !form) {
    return (
      <ModalWrapper>
        <Header title="Edit Responsibility" leftIcon={<BackButton onPress={() => router.back()} />} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </ModalWrapper>
    );
  }

  // ── Step 1 ──
  if (step === 1) {
    return (
      <ModalWrapper>
        <Header title="Edit Responsibility" leftIcon={<BackButton onPress={() => router.back()} />} />
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.field}>
            <Typo size={13} color={colors.neutral400} style={styles.label}>Name</Typo>
            <Input
              placeholder="e.g. Home Loan"
              value={form.loanName}
              onChangeText={(v) => setField("loanName", v)}
              icon={<Icons.Tag size={scale(20)} color={colors.neutral400} />}
            />
          </View>

          <View style={styles.field}>
            <Typo size={13} color={colors.neutral400} style={styles.label}>Lender</Typo>
            <Input
              placeholder="e.g. HDFC Bank"
              value={form.lenderName}
              onChangeText={(v) => setField("lenderName", v)}
              icon={<Icons.Buildings size={scale(20)} color={colors.neutral400} />}
            />
          </View>

          <View style={styles.field}>
            <Typo size={13} color={colors.neutral400} style={styles.label}>Amount</Typo>
            <Input
              placeholder="0"
              value={form.loanAmountStr}
              onChangeText={(v) => setField("loanAmountStr", v)}
              keyboardType="decimal-pad"
              icon={<Icons.CurrencyInr size={scale(20)} color={colors.neutral400} />}
            />
          </View>

          <View style={styles.field}>
            <Typo size={13} color={colors.neutral400} style={styles.label}>Interest Rate</Typo>
            <View style={styles.rowField}>
              <View style={{ flex: 1 }}>
                <Input
                  placeholder="0"
                  value={form.interestRateStr}
                  onChangeText={(v) => setField("interestRateStr", v)}
                  keyboardType="decimal-pad"
                  icon={<Icons.Percent size={scale(20)} color={colors.neutral400} />}
                />
              </View>
              <View style={styles.pillToggle}>
                {(["per_month", "per_year"] as InterestRateFrequency[]).map((freq) => (
                  <TouchableOpacity
                    key={freq}
                    style={[styles.pill, form.interestRateFrequency === freq && styles.pillActive]}
                    onPress={() => setField("interestRateFrequency", freq)}
                  >
                    <Typo size={12} fontWeight="500" color={form.interestRateFrequency === freq ? colors.black : colors.neutral400}>
                      {freq === "per_month" ? "/ mo" : "/ yr"}
                    </Typo>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.field}>
            <Typo size={13} color={colors.neutral400} style={styles.label}>Start Date</Typo>
            <DateInput
              day={startDay} month={startMonth} year={startYear}
              onDayChange={setStartDay} onMonthChange={setStartMonth} onYearChange={setStartYear}
            />
          </View>

          <View style={styles.field}>
            <Typo size={13} color={colors.neutral400} style={styles.label}>Duration</Typo>
            <View style={styles.rowField}>
              <View style={{ flex: 1 }}>
                <Input
                  placeholder="0"
                  value={form.durationStr}
                  onChangeText={(v) => setField("durationStr", v)}
                  keyboardType="number-pad"
                  icon={<Icons.Clock size={scale(20)} color={colors.neutral400} />}
                />
              </View>
              <View style={styles.pillToggle}>
                {(["months", "years"] as DebtDurationUnit[]).map((unit) => (
                  <TouchableOpacity
                    key={unit}
                    style={[styles.pill, form.durationUnit === unit && styles.pillActive]}
                    onPress={() => setField("durationUnit", unit)}
                  >
                    <Typo size={12} fontWeight="500" color={form.durationUnit === unit ? colors.black : colors.neutral400}>
                      {unit === "months" ? "Months" : "Years"}
                    </Typo>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={[styles.field, styles.switchRow]}>
            <Typo size={14} color={colors.neutral200}>Currently active</Typo>
            <Switch
              value={form.isActive}
              onValueChange={(v) => setField("isActive", v)}
              trackColor={{ false: colors.neutral700, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          {/* Extra Fees */}
          <View style={styles.field}>
            <Typo size={13} color={colors.neutral400} style={styles.label}>Extra Fees (Optional)</Typo>
            {form.feeItems.map((item) => (
              <View key={item.id} style={styles.feeRow}>
                <Typo size={13} color={colors.neutral200} style={{ flex: 1 }}>{item.name}</Typo>
                <Typo size={13} color={colors.neutral400}>{formatINR(item.amount)}</Typo>
                <TouchableOpacity onPress={() => handleRemoveFee(item.id)} hitSlop={8}>
                  <Icons.X size={scale(16)} color={colors.neutral400} />
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.addFeeRow}>
              <View style={{ flex: 1 }}>
                <Input placeholder="Fee name" value={feeName} onChangeText={setFeeName} containerStyle={styles.feeInput} />
              </View>
              <View style={{ width: scale(90) }}>
                <Input placeholder="Amount" value={feeAmountStr} onChangeText={setFeeAmountStr} keyboardType="decimal-pad" containerStyle={styles.feeInput} />
              </View>
              <TouchableOpacity onPress={handleAddFee} hitSlop={8}>
                <Icons.PlusCircle size={scale(28)} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Override Monthly EMI */}
          <View style={styles.field}>
            <Typo size={13} color={colors.neutral400} style={styles.label}>Monthly EMI Going Forward</Typo>
            <Input
              placeholder="0"
              value={form.monthlyEmiStr}
              onChangeText={(v) => setField("monthlyEmiStr", v)}
              keyboardType="decimal-pad"
              icon={<Icons.CurrencyInr size={scale(20)} color={colors.neutral400} />}
            />
            <Typo size={12} color={colors.neutral600}>
              Change this to update your EMI from now on without recalculating the full loan.
            </Typo>
          </View>

          {/* Custom Monthly Payments */}
          <View style={styles.field}>
            <Typo size={13} color={colors.neutral400} style={styles.label}>Custom Monthly Payments</Typo>
            <Typo size={12} color={colors.neutral600} style={{ marginBottom: spacingY._5 }}>
              Record months where you paid a different amount (e.g. extra prepayment).
            </Typo>
            {form.customMonthPayments
              .sort((a, b) => a.month.localeCompare(b.month))
              .map((item) => (
                <View key={item.month} style={styles.feeRow}>
                  <Typo size={13} color={colors.neutral200} style={{ flex: 1 }}>
                    {new Date(item.month + "-01").toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                  </Typo>
                  <Typo size={13} color={colors.neutral400}>{formatINR(item.amount)}</Typo>
                  <TouchableOpacity onPress={() => handleRemoveCustomPayment(item.month)} hitSlop={8}>
                    <Icons.X size={scale(16)} color={colors.neutral400} />
                  </TouchableOpacity>
                </View>
              ))}
            <Input
              placeholder="DD/MM/YYYY"
              value={customDateStr}
              onChangeText={handleCustomDateChange}
              keyboardType="number-pad"
              containerStyle={styles.feeInput}
            />
            <View style={styles.addFeeRow}>
              <View style={{ flex: 1 }}>
                <Input
                  placeholder="Amount paid"
                  value={customAmountStr}
                  onChangeText={setCustomAmountStr}
                  keyboardType="decimal-pad"
                  containerStyle={styles.feeInput}
                  icon={<Icons.CurrencyInr size={scale(18)} color={colors.neutral400} />}
                />
              </View>
              <TouchableOpacity onPress={handleAddCustomPayment} hitSlop={8}>
                <Icons.PlusCircle size={scale(28)} color={colors.primary} />
              </TouchableOpacity>
            </View>
            {customDateError && (
              <Typo size={12} color={colors.rose}>{customDateError}</Typo>
            )}
          </View>
          <Button onPress={handleProceed} loading={loading} style={styles.submitBtn}>
            <Typo size={15} fontWeight="600" color={colors.black}>
              {calcFieldsChanged() ? "Calculate & Preview →" : "Save Changes"}
            </Typo>
          </Button>
        </ScrollView>
        </KeyboardAvoidingView>
      </ModalWrapper>
    );
  }

  // ── Step 2 (recalculation required) ──
  return (
    <ModalWrapper>
      <Header
        title="Updated Summary"
        leftIcon={<BackButton onPress={() => { setStep(1); setCalc(null); }} />}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {calc && (
          <View style={styles.resultsCard}>
            <ResultRow label="EMI per Month" value={formatINR(calc.monthlyEmi)} highlight />
            <ResultRow label="Total Principal" value={formatINR(calc.totalPrincipalPaid)} />
            <ResultRow label="Total Interest" value={formatINR(calc.totalInterestPaid)} />
            {calc.totalCharges > 0 && (
              <ResultRow label="Extra Fees" value={formatINR(calc.totalCharges)} />
            )}
            <View style={styles.divider} />
            <ResultRow label="Total Cost" value={formatINR(calc.totalScheduledPayable)} highlight primary />
          </View>
        )}

        <Button onPress={handleSaveWithCalc} loading={loading} style={styles.acceptBtn}>
          <Typo size={15} fontWeight="600" color={colors.black}>Accept &amp; Save</Typo>
        </Button>
      </ScrollView>
    </ModalWrapper>
  );
};

interface ResultRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  primary?: boolean;
}
const ResultRow = ({ label, value, highlight, primary }: ResultRowProps) => (
  <View style={rStyles.row}>
    <Typo size={14} color={colors.neutral400}>{label}</Typo>
    <Typo size={highlight ? 15 : 14} fontWeight={highlight ? "700" : "500"} color={primary ? colors.primary : colors.neutral100}>
      {value}
    </Typo>
  </View>
);
const rStyles = StyleSheet.create({ row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: verticalScale(6) } });

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  kav: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacingX._20,
    paddingBottom: verticalScale(30),
    gap: spacingY._15,
  },
  submitBtn: { marginTop: spacingY._5 },
  field: { gap: spacingY._7 },
  label: { marginBottom: 2 },
  rowField: { flexDirection: "row", alignItems: "center", gap: spacingX._10 },
  pillToggle: { flexDirection: "row", backgroundColor: colors.neutral700, borderRadius: radius._10, overflow: "hidden" },
  pill: { paddingHorizontal: scale(12), paddingVertical: verticalScale(10), alignItems: "center", justifyContent: "center" },
  pillActive: { backgroundColor: colors.primary },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  feeRow: { flexDirection: "row", alignItems: "center", gap: spacingX._10, paddingVertical: verticalScale(4) },
  addFeeRow: { flexDirection: "row", alignItems: "center", gap: spacingX._10 },
  feeInput: { height: verticalScale(44) },
  resultsCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
    paddingHorizontal: spacingX._15,
    paddingVertical: spacingY._12,
  },
  divider: { height: 1, backgroundColor: colors.neutral700, marginVertical: spacingY._7 },
  acceptBtn: { marginTop: spacingY._5 },
});

export default DebtEditModal;
