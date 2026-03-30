import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Icons from "phosphor-react-native";
import ModalWrapper from "@/components/ModalWrapper";
import DateInput from "@/components/DateInput";
import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import Input from "@/components/Input";
import Button from "@/components/Button";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { scale, verticalScale } from "@/utils/styling";
import {
  calculateDebtPreview,
  recalculateDebtFromEmi,
  seedPaidMonths,
  getElapsedMonths,
  createDebt,
  DebtCalculationResult,
  DebtCalculationInput,
} from "@/services/debtService";
import {
  DebtFeeItem,
  InterestRateFrequency,
  DebtDurationUnit,
} from "@/types";

const formatINR = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN");

const formatAmountDisplay = (raw: string): string => {
  if (!raw) return "";
  const n = parseInt(raw, 10);
  return isNaN(n) ? "" : n.toLocaleString("en-IN");
};

type FormState = {
  loanName: string;
  lenderName: string;
  loanAmountRaw: string;
  interestRateStr: string;
  interestRateFrequency: InterestRateFrequency;
  durationStr: string;
  durationUnit: DebtDurationUnit;
  isActive: boolean;
  feeItems: DebtFeeItem[];
};

const DEFAULT_FORM: FormState = {
  loanName: "",
  lenderName: "",
  loanAmountRaw: "",
  interestRateStr: "",
  interestRateFrequency: "per_year",
  durationStr: "",
  durationUnit: "months",
  isActive: true,
  feeItems: [],
};

const DebtModal = () => {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const now = new Date();
  const [startDay, setStartDay] = useState("01");
  const [startMonth, setStartMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [startYear, setStartYear] = useState(String(now.getFullYear()));
  const [calc, setCalc] = useState<DebtCalculationResult | null>(null);
  const [alreadyPaidStr, setAlreadyPaidStr] = useState("0");
  const [useCustomEmi, setUseCustomEmi] = useState(false);
  const [customEmiStr, setCustomEmiStr] = useState("");
  const [customCalc, setCustomCalc] = useState<DebtCalculationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [alreadyPaidError, setAlreadyPaidError] = useState<string | null>(null);

  const [feeName, setFeeName] = useState("");
  const [feeAmountStr, setFeeAmountStr] = useState("");

  const setField = (key: keyof FormState, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));

  const parsedStartDate = (): Date | null => {
    const d = parseInt(startDay, 10);
    const m = parseInt(startMonth, 10);
    const y = parseInt(startYear, 10);
    if (isNaN(d) || isNaN(m) || isNaN(y) || y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const date = new Date(y, m - 1, d);
    return date.getDate() === d ? date : null;
  };

  const elapsedMonths = (() => {
    const sd = parsedStartDate();
    return sd ? getElapsedMonths(sd) : 0;
  })();

  const handleAmountChange = (text: string) => {
    const raw = text.replace(/[^0-9]/g, "");
    setField("loanAmountRaw", raw);
  };

  const handleAddFee = () => {
    const amount = parseFloat(feeAmountStr);
    if (!feeName.trim() || isNaN(amount) || amount <= 0) return;
    setField("feeItems", [
      ...form.feeItems,
      { id: String(Date.now() + Math.random()), name: feeName.trim(), amount },
    ]);
    setFeeName("");
    setFeeAmountStr("");
  };

  const handleRemoveFee = (id: string) =>
    setField("feeItems", form.feeItems.filter((f) => f.id !== id));

  const handleCalculate = () => {
    const principal = parseInt(form.loanAmountRaw, 10);
    const rate = parseFloat(form.interestRateStr);
    const duration = parseFloat(form.durationStr);
    const sd = parsedStartDate();

    if (!form.loanName.trim()) return Alert.alert("Validation", "Name is required.");
    if (!form.lenderName.trim()) return Alert.alert("Validation", "Lender name is required.");
    if (isNaN(principal) || principal <= 0) return Alert.alert("Validation", "Enter a valid amount.");
    if (isNaN(rate) || rate <= 0) return Alert.alert("Validation", "Enter a valid interest rate.");
    if (isNaN(duration) || duration <= 0) return Alert.alert("Validation", "Enter a valid duration.");
    if (!sd) return Alert.alert("Validation", "Enter a valid start date (DD/MM/YYYY).");

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

    const result = calculateDebtPreview(input);
    setCalc(result);
    setStep(2);
  };

  const handleCustomEmiChange = (val: string) => {
    setCustomEmiStr(val);
    const desiredEmi = parseFloat(val);
    if (isNaN(desiredEmi) || desiredEmi <= 0 || !calc) {
      setCustomCalc(null);
      return;
    }
    try {
      const input: DebtCalculationInput = {
        loanName: form.loanName,
        lenderName: form.lenderName,
        principalAmount: parseInt(form.loanAmountRaw, 10),
        interestRate: parseFloat(form.interestRateStr),
        interestRateFrequency: form.interestRateFrequency,
        startDate: parsedStartDate() ?? new Date(),
        durationValue: parseFloat(form.durationStr),
        durationUnit: form.durationUnit,
        isActive: form.isActive,
        feeItems: form.feeItems,
      };
      const result = recalculateDebtFromEmi(input, desiredEmi);
      setCustomCalc(result);
    } catch {
      setCustomCalc(null);
    }
  };

  const validateAlreadyPaid = (str: string): number | null => {
    // Empty field → treat as 0, never block the save
    const trimmed = str.trim();
    if (!trimmed) {
      setAlreadyPaidError(null);
      return 0;
    }
    const n = parseInt(trimmed, 10);
    if (isNaN(n) || n < 0) {
      setAlreadyPaidError("Please enter a valid number.");
      return null;
    }
    if (elapsedMonths === 0 && n > 0) {
      setAlreadyPaidError("No EMIs have elapsed yet based on your start date.");
      return null;
    }
    if (n > elapsedMonths) {
      setAlreadyPaidError(`Cannot exceed ${elapsedMonths} — the number of months elapsed since your start date.`);
      return null;
    }
    setAlreadyPaidError(null);
    return n;
  };

  const handleSave = async (activeCalc: DebtCalculationResult) => {
    const alreadyPaid = validateAlreadyPaid(alreadyPaidStr);
    if (alreadyPaid === null) {
      // Inline error is already shown — nothing more to do
      return;
    }

    setLoading(true);
    try {
      const sd = parsedStartDate() ?? new Date();
      const paidMonths = seedPaidMonths(sd, alreadyPaid);
      const principal = parseInt(form.loanAmountRaw, 10);
      const rate = parseFloat(form.interestRateStr);
      const duration = parseFloat(form.durationStr);

      const result = await createDebt({
        loanName: form.loanName,
        lenderName: form.lenderName,
        principalAmount: principal,
        enteredInterestRate: rate,
        enteredInterestRateFrequency: form.interestRateFrequency,
        derivedAnnualInterestRate: activeCalc.derivedAnnualInterestRate,
        derivedMonthlyInterestRate: activeCalc.derivedMonthlyInterestRate,
        startDate: sd,
        durationValue: duration,
        durationUnit: form.durationUnit,
        durationMonths: activeCalc.durationMonths,
        isActive: form.isActive,
        status: form.isActive ? "active" : "inactive",
        feeItems: form.feeItems,
        totalCharges: activeCalc.totalCharges,
        monthlyEmi: activeCalc.monthlyEmi,
        totalPrincipalPaid: activeCalc.totalPrincipalPaid,
        totalInterestPaid: activeCalc.totalInterestPaid,
        totalScheduledPayable: activeCalc.totalScheduledPayable,
        paidMonths,
        calculationSource: activeCalc.calculationSource,
        calculationExplanation: activeCalc.calculationExplanation ?? null,
        emiOverrideValue: useCustomEmi ? parseFloat(customEmiStr) : null,
        userAcceptedCalculation: true,
      });

      if (result.success) {
        router.back();
      } else {
        Alert.alert("Something went wrong", result.msg ?? "Your changes could not be saved. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const showDiscrepancy =
    useCustomEmi &&
    calc &&
    customCalc &&
    Math.abs(parseFloat(customEmiStr) - calc.monthlyEmi) >= 1;

  // ── Step 1 ──
  if (step === 1) {
    return (
      <ModalWrapper>
        <Header
          title="Add Responsibility"
          leftIcon={<BackButton onPress={() => router.back()} />}
        />
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
                placeholder="e.g. Home Responsibility"
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
                value={formatAmountDisplay(form.loanAmountRaw)}
                onChangeText={handleAmountChange}
                keyboardType="number-pad"
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
                      <Typo
                        size={12}
                        fontWeight="500"
                        color={form.interestRateFrequency === freq ? colors.black : colors.neutral400}
                      >
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
                      <Typo
                        size={12}
                        fontWeight="500"
                        color={form.durationUnit === unit ? colors.black : colors.neutral400}
                      >
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
                  <Input
                    placeholder="Fee name"
                    value={feeName}
                    onChangeText={setFeeName}
                    containerStyle={styles.feeInput}
                  />
                </View>
                <View style={{ width: scale(90) }}>
                  <Input
                    placeholder="Amount"
                    value={feeAmountStr}
                    onChangeText={setFeeAmountStr}
                    keyboardType="decimal-pad"
                    containerStyle={styles.feeInput}
                  />
                </View>
                <TouchableOpacity onPress={handleAddFee} hitSlop={8}>
                  <Icons.PlusCircle size={scale(28)} color={colors.primary} />
                </TouchableOpacity>
              </View>
              {form.feeItems.length > 0 && (
                <Typo size={12} color={colors.neutral400}>
                  Total fees: {formatINR(form.feeItems.reduce((s, f) => s + f.amount, 0))}
                </Typo>
              )}
            </View>

            {/* Button lives inside the scroll so it's always reachable above the keyboard */}
            <Button onPress={handleCalculate} style={styles.submitBtn}>
              <Typo size={15} fontWeight="600" color={colors.black}>
                Calculate &amp; Preview →
              </Typo>
            </Button>
          </ScrollView>
        </KeyboardAvoidingView>
      </ModalWrapper>
    );
  }

  // ── Step 2 ──
  return (
    <ModalWrapper>
      <Header
        title="Summary"
        leftIcon={
          <BackButton
            onPress={() => {
              setStep(1);
              setCalc(null);
              setUseCustomEmi(false);
              setCustomCalc(null);
              setCustomEmiStr("");
            }}
          />
        }
      />
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
          {calc && (
            <View style={styles.resultsCard}>
              <ResultRow
                label="EMI per Month"
                value={formatINR(useCustomEmi && customCalc ? customCalc.monthlyEmi : calc.monthlyEmi)}
                highlight
              />
              <ResultRow label="Total Principal" value={formatINR(calc.totalPrincipalPaid)} />
              <ResultRow
                label="Total Interest"
                value={formatINR(useCustomEmi && customCalc ? customCalc.totalInterestPaid : calc.totalInterestPaid)}
              />
              {calc.totalCharges > 0 && (
                <ResultRow label="Extra Fees" value={formatINR(calc.totalCharges)} />
              )}
              <View style={styles.divider} />
              <ResultRow
                label="Total Cost"
                value={formatINR(useCustomEmi && customCalc ? customCalc.totalScheduledPayable : calc.totalScheduledPayable)}
                highlight
                primary
              />
            </View>
          )}

          <View style={styles.field}>
            <Typo size={14} fontWeight="600" color={colors.neutral200}>
              How many EMIs have you already paid?
            </Typo>
            <Input
              placeholder="0"
              value={alreadyPaidStr}
              onChangeText={(v) => {
                setAlreadyPaidStr(v);
                if (!v.trim()) setAlreadyPaidError(null);
                else validateAlreadyPaid(v);
              }}
              keyboardType="number-pad"
            />
            <Typo size={12} color={colors.neutral400}>
              We'll mark these months as paid automatically.
            </Typo>
            {alreadyPaidError && (
              <Typo size={12} color={colors.rose}>{alreadyPaidError}</Typo>
            )}
          </View>

          <Button
            onPress={() => calc && handleSave(useCustomEmi && customCalc ? customCalc : calc)}
            loading={loading}
            style={styles.submitBtn}
          >
            <Typo size={15} fontWeight="600" color={colors.black}>Accept &amp; Save</Typo>
          </Button>

          {!useCustomEmi && (
            <Pressable style={styles.altEmiLink} onPress={() => setUseCustomEmi(true)}>
              <Typo size={13} color={colors.neutral400} style={{ textDecorationLine: "underline" }}>
                Use a different EMI instead
              </Typo>
            </Pressable>
          )}

          {useCustomEmi && (
            <View style={styles.field}>
              <Typo size={14} fontWeight="600" color={colors.neutral200}>
                Your actual EMI from lender
              </Typo>
              <Input
                placeholder="0"
                value={customEmiStr}
                onChangeText={handleCustomEmiChange}
                keyboardType="decimal-pad"
                icon={<Icons.CurrencyInr size={scale(20)} color={colors.neutral400} />}
              />
              {showDiscrepancy && customCalc && calc && (
                <View style={styles.discrepancyBox}>
                  <Icons.Info size={scale(14)} color={colors.neutral400} />
                  <Typo size={12} color={colors.neutral400} style={{ flex: 1 }}>
                    {`The EMI you entered (${formatINR(parseFloat(customEmiStr))}) implies an effective interest rate of ${customCalc.derivedAnnualInterestRate.toFixed(2)}% p.a., which differs from your original rate (${calc.derivedAnnualInterestRate.toFixed(2)}% p.a.). This is likely due to processing fees or a different calculation method used by your lender.`}
                  </Typo>
                </View>
              )}
              {customCalc && (
                <Button onPress={() => handleSave(customCalc)} loading={loading}>
                  <Typo size={15} fontWeight="600" color={colors.black}>Save with Custom EMI</Typo>
                </Button>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  <View style={resultStyles.row}>
    <Typo size={14} color={colors.neutral400}>{label}</Typo>
    <Typo
      size={highlight ? 15 : 14}
      fontWeight={highlight ? "700" : "500"}
      color={primary ? colors.primary : colors.neutral100}
    >
      {value}
    </Typo>
  </View>
);

const resultStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: verticalScale(6),
  },
});

const styles = StyleSheet.create({
  kav: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacingX._20,
    paddingTop: spacingY._5,
    paddingBottom: verticalScale(30),
    gap: spacingY._15,
  },
  field: { gap: spacingY._7 },
  label: { marginBottom: 2 },
  rowField: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  pillToggle: {
    flexDirection: "row",
    backgroundColor: colors.neutral700,
    borderRadius: radius._10,
    overflow: "hidden",
  },
  pill: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(10),
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: { backgroundColor: colors.primary },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  feeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
    paddingVertical: verticalScale(4),
  },
  addFeeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  feeInput: { height: verticalScale(44) },
  resultsCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    borderWidth: 1,
    borderColor: colors.neutral700,
    paddingHorizontal: spacingX._15,
    paddingVertical: spacingY._12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral700,
    marginVertical: spacingY._7,
  },
  submitBtn: { marginTop: spacingY._5 },
  altEmiLink: {
    alignItems: "center",
    paddingVertical: spacingY._7,
  },
  discrepancyBox: {
    flexDirection: "row",
    gap: spacingX._7,
    backgroundColor: colors.neutral700,
    borderRadius: radius._10,
    padding: spacingX._10,
  },
});

export default DebtModal;
