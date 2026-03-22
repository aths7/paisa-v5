import BackButton from "@/components/BackButton";
import Header from "@/components/Header";
import Input from "@/components/Input";
import ModalWrapper from "@/components/ModalWrapper";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { DEFAULT_EXPENSE_CATEGORIES, expenseCategories } from "@/constants/data";
import { useAuth } from "@/contexts/authContext";
import { updateExpenseCategories } from "@/services/userService";
import { scale, verticalScale } from "@/utils/styling";
import * as Icons from "phosphor-react-native";
import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const CHIP_PALETTE = [
  { bg: "#fef08a", text: "#713f12" },
  { bg: "#86efac", text: "#14532d" },
  { bg: "#93c5fd", text: "#1e3a8a" },
  { bg: "#f9a8d4", text: "#831843" },
  { bg: "#fdba74", text: "#7c2d12" },
  { bg: "#c4b5fd", text: "#4c1d95" },
  { bg: "#6ee7b7", text: "#064e3b" },
  { bg: "#fca5a5", text: "#7f1d1d" },
];

const chipColor = (index: number) => CHIP_PALETTE[index % CHIP_PALETTE.length];

const getCategoryLabel = (value: string) =>
  expenseCategories[value as keyof typeof expenseCategories]?.label ||
  value.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const CategoryModal = () => {
  const { user, updateUserData } = useAuth();

  const [categories, setCategories] = useState<string[]>(
    user?.expenseCategories?.length ? user.expenseCategories : DEFAULT_EXPENSE_CATEGORIES
  );
  const [newCategory, setNewCategory] = useState("");
  const [saving, setSaving] = useState(false);

  const saveCategories = async (cats: string[]) => {
    if (!user?.uid) return;
    setSaving(true);
    await updateExpenseCategories(user.uid, cats);
    await updateUserData(user.uid);
    setSaving(false);
  };

  const addCategory = async () => {
    const tag = newCategory.trim().toLowerCase().replace(/\s+/g, "_");
    if (!tag) return;
    if (categories.includes(tag)) {
      Alert.alert("Categories", "This category already exists.");
      return;
    }
    const updated = [...categories, tag];
    setCategories(updated);
    setNewCategory("");
    await saveCategories(updated);
  };

  const removeCategory = async (cat: string) => {
    const updated = categories.filter((c) => c !== cat);
    setCategories(updated);
    await saveCategories(updated);
  };

  const resetToDefaults = async () => {
    setCategories(DEFAULT_EXPENSE_CATEGORIES);
    await saveCategories(DEFAULT_EXPENSE_CATEGORIES);
  };

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title="Expense Categories"
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._10 }}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Icons.Info size={verticalScale(16)} color={colors.neutral400} weight="fill" />
            <Typo size={13} color={colors.neutral400} style={{ flex: 1 }}>
              Customise the categories shown when logging an expense. Changes apply to all new transactions.
            </Typo>
          </View>

          {/* Tags card */}
          <View style={styles.tagsCard}>
            <View style={styles.tagsCardHeader}>
              <Typo size={13} color={colors.neutral400} fontWeight="600" style={styles.sectionLabel}>
                YOUR CATEGORIES
              </Typo>
              <View style={styles.countBadge}>
                <Typo size={12} fontWeight="700" color={colors.black}>
                  {categories.length}
                </Typo>
              </View>
            </View>

            {categories.length === 0 ? (
              <Typo size={13} color={colors.neutral500} style={{ textAlign: "center", paddingVertical: verticalScale(16) }}>
                No categories yet — add some below.
              </Typo>
            ) : (
              <View style={styles.chipWrap}>
                {categories.map((cat, idx) => {
                  const { bg, text } = chipColor(idx);
                  return (
                    <View key={cat} style={[styles.chip, { backgroundColor: bg }]}>
                      <Typo size={13} fontWeight="600" color={text}>
                        {getCategoryLabel(cat)}
                      </Typo>
                      <TouchableOpacity onPress={() => removeCategory(cat)} hitSlop={8}>
                        <Icons.X size={verticalScale(12)} color={text} weight="bold" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Add new */}
          <View style={styles.addSection}>
            <Typo size={13} color={colors.neutral400} fontWeight="600" style={styles.sectionLabel}>
              ADD NEW
            </Typo>
            <View style={styles.addRow}>
              <Input
                placeholder="e.g. fuel, gym, coffee…"
                value={newCategory}
                onChangeText={setNewCategory}
                containerStyle={{ flex: 1, height: verticalScale(50) }}
                onSubmitEditing={addCategory}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.addBtn, saving && { opacity: 0.6 }]}
                onPress={addCategory}
                disabled={saving}
              >
                {saving ? (
                  <Icons.CircleNotch size={verticalScale(20)} color={colors.black} weight="bold" />
                ) : (
                  <Icons.Plus size={verticalScale(22)} color={colors.black} weight="bold" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Reset */}
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={resetToDefaults}
            disabled={saving}
          >
            <Icons.ArrowCounterClockwise size={verticalScale(15)} color={colors.neutral500} />
            <Typo size={13} color={colors.neutral500}>
              Reset to default categories
            </Typo>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </ModalWrapper>
  );
};

export default CategoryModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  content: {
    gap: spacingY._17,
    paddingBottom: spacingY._40,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: scale(10),
    backgroundColor: colors.neutral800,
    borderRadius: radius._12,
    borderCurve: "continuous",
    padding: spacingX._12,
  },
  tagsCard: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    borderCurve: "continuous",
    padding: spacingX._15,
    gap: spacingY._12,
  },
  tagsCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLabel: {
    letterSpacing: 0.8,
  },
  countBadge: {
    backgroundColor: colors.primary,
    borderRadius: 99,
    minWidth: scale(22),
    height: scale(22),
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: scale(6),
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(8),
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    borderRadius: radius._10,
    borderCurve: "continuous",
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(7),
  },
  addSection: {
    gap: spacingY._10,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
  },
  addBtn: {
    width: verticalScale(50),
    height: verticalScale(50),
    backgroundColor: colors.primary,
    borderRadius: radius._12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    alignSelf: "center",
    paddingVertical: spacingY._7,
  },
});
