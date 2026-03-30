/**
 * DateInput — manual DD / MM / YYYY text entry, auto-advances focus.
 * Pass `onDateChange` to receive a valid Date (or null when incomplete/invalid).
 */
import React, { useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import Typo from "@/components/Typo";
import { colors, radius, spacingX } from "@/constants/theme";
import { scale, verticalScale } from "@/utils/styling";

interface DateInputProps {
  day: string;
  month: string;
  year: string;
  onDayChange: (v: string) => void;
  onMonthChange: (v: string) => void;
  onYearChange: (v: string) => void;
}

const DateInput = ({ day, month, year, onDayChange, onMonthChange, onYearChange }: DateInputProps) => {
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  return (
    <View style={styles.row}>
      <View style={styles.box}>
        <TextInput
          style={styles.input}
          placeholder="DD"
          placeholderTextColor={colors.neutral600}
          value={day}
          keyboardType="number-pad"
          maxLength={2}
          onChangeText={(v) => {
            const clean = v.replace(/\D/g, "").slice(0, 2);
            onDayChange(clean);
            if (clean.length === 2) monthRef.current?.focus();
          }}
          returnKeyType="next"
          onSubmitEditing={() => monthRef.current?.focus()}
        />
      </View>
      <Typo size={18} color={colors.neutral600} fontWeight="300">/</Typo>
      <View style={styles.box}>
        <TextInput
          ref={monthRef}
          style={styles.input}
          placeholder="MM"
          placeholderTextColor={colors.neutral600}
          value={month}
          keyboardType="number-pad"
          maxLength={2}
          onChangeText={(v) => {
            const clean = v.replace(/\D/g, "").slice(0, 2);
            onMonthChange(clean);
            if (clean.length === 2) yearRef.current?.focus();
          }}
          returnKeyType="next"
          onSubmitEditing={() => yearRef.current?.focus()}
        />
      </View>
      <Typo size={18} color={colors.neutral600} fontWeight="300">/</Typo>
      <View style={[styles.box, styles.yearBox]}>
        <TextInput
          ref={yearRef}
          style={styles.input}
          placeholder="YYYY"
          placeholderTextColor={colors.neutral600}
          value={year}
          keyboardType="number-pad"
          maxLength={4}
          onChangeText={(v) => {
            const clean = v.replace(/\D/g, "").slice(0, 4);
            onYearChange(clean);
          }}
          returnKeyType="done"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
    backgroundColor: colors.neutral800,
    borderWidth: 1,
    borderColor: colors.neutral700,
    borderRadius: radius._10,
    paddingHorizontal: spacingX._15,
    paddingVertical: verticalScale(4),
  },
  box: {
    alignItems: "center",
    width: scale(40),
  },
  yearBox: {
    width: scale(56),
  },
  input: {
    color: colors.neutral100,
    fontSize: scale(15),
    fontWeight: "500",
    paddingVertical: verticalScale(10),
    textAlign: "center",
    width: "100%",
  },
});

export default DateInput;
