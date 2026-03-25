import BackButton from "@/components/BackButton";
import Header from "@/components/Header";
import Input from "@/components/Input";
import ModalWrapper from "@/components/ModalWrapper";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import { updateEmotionColors, updateEmotionTags } from "@/services/userService";
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

export const DEFAULT_EMOTION_TAGS = [
  "happy", "sad", "stressed", "neutral",
  "excited", "anxious", "content", "bored",
];

// Pastel palette — works well on dark backgrounds
export const CHIP_PALETTE = [
  { bg: "#fef08a", text: "#713f12" },
  { bg: "#86efac", text: "#14532d" },
  { bg: "#93c5fd", text: "#1e3a8a" },
  { bg: "#f9a8d4", text: "#831843" },
  { bg: "#fdba74", text: "#7c2d12" },
  { bg: "#c4b5fd", text: "#4c1d95" },
  { bg: "#6ee7b7", text: "#064e3b" },
  { bg: "#fca5a5", text: "#7f1d1d" },
];

// Default color for each built-in emotion
export const DEFAULT_EMOTION_COLORS: Record<string, string> = {
  happy: "#86efac",
  sad: "#93c5fd",
  stressed: "#fca5a5",
  neutral: "#e5e7eb",
  excited: "#fef08a",
  anxious: "#fdba74",
  content: "#6ee7b7",
  bored: "#c4b5fd",
};

// Swatches offered in the color picker
const COLOR_SWATCHES = [
  "#fef08a", "#86efac", "#93c5fd", "#f9a8d4",
  "#fdba74", "#c4b5fd", "#6ee7b7", "#fca5a5",
  "#e5e7eb", "#fb923c", "#34d399", "#818cf8",
];

/**
 * Returns the display color for an emotion.
 * Priority: user override → DEFAULT_EMOTION_COLORS → palette by index → fallback.
 */
export const getEmotionColor = (
  emotion: string | undefined,
  emotionColors: Record<string, string> | undefined,
  emotionTags: string[] = DEFAULT_EMOTION_TAGS
): string => {
  if (!emotion) return colors.neutral700;
  if (emotionColors?.[emotion]) return emotionColors[emotion];
  if (DEFAULT_EMOTION_COLORS[emotion]) return DEFAULT_EMOTION_COLORS[emotion];
  const idx = emotionTags.indexOf(emotion);
  return CHIP_PALETTE[idx >= 0 ? idx % CHIP_PALETTE.length : 0].bg;
};

const EmotionsModal = () => {
  const { user, updateUserData } = useAuth();

  const [emotionTags, setEmotionTags] = useState<string[]>(
    user?.emotionTags?.length ? user.emotionTags : DEFAULT_EMOTION_TAGS
  );
  const [emotionColors, setEmotionColors] = useState<Record<string, string>>(
    user?.emotionColors ?? {}
  );
  const [newEmotion, setNewEmotion] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingColorFor, setEditingColorFor] = useState<string | null>(null);

  const saveTags = async (tags: string[]) => {
    if (!user?.uid) return;
    setSaving(true);
    await updateEmotionTags(user.uid, tags);
    await updateUserData(user.uid);
    setSaving(false);
  };

  const saveColors = async (next: Record<string, string>) => {
    if (!user?.uid) return;
    setSaving(true);
    await updateEmotionColors(user.uid, next);
    await updateUserData(user.uid);
    setSaving(false);
  };

  const addEmotion = async () => {
    const tag = newEmotion.trim().toLowerCase();
    if (!tag) return;
    if (emotionTags.includes(tag)) {
      Alert.alert("Emotion Tags", "This emotion already exists.");
      return;
    }
    const updated = [...emotionTags, tag];
    setEmotionTags(updated);
    setNewEmotion("");
    await saveTags(updated);
  };

  const removeEmotion = async (tag: string) => {
    if (editingColorFor === tag) setEditingColorFor(null);
    const updatedTags = emotionTags.filter((e) => e !== tag);
    setEmotionTags(updatedTags);
    // Also remove any stored color for this tag
    const updatedColors = { ...emotionColors };
    delete updatedColors[tag];
    setEmotionColors(updatedColors);
    await saveTags(updatedTags);
    if (Object.keys(updatedColors).length !== Object.keys(emotionColors).length) {
      await saveColors(updatedColors);
    }
  };

  const pickColor = async (tag: string, hex: string) => {
    const next = { ...emotionColors, [tag]: hex };
    setEmotionColors(next);
    setEditingColorFor(null);
    await saveColors(next);
  };

  const resetToDefaults = async () => {
    setEmotionTags(DEFAULT_EMOTION_TAGS);
    setEmotionColors({});
    setEditingColorFor(null);
    await saveTags(DEFAULT_EMOTION_TAGS);
    await saveColors({});
  };

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title="Emotion Tags"
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
              Tag how you feel when logging a transaction. Tap the paint icon to set a color — it appears as the border on each transaction.
            </Typo>
          </View>

          {/* Tags card */}
          <View style={styles.tagsCard}>
            <View style={styles.tagsCardHeader}>
              <Typo size={13} color={colors.neutral400} fontWeight="600" style={styles.sectionLabel}>
                YOUR EMOTIONS
              </Typo>
              <View style={styles.countBadge}>
                <Typo size={12} fontWeight="700" color={colors.black}>
                  {emotionTags.length}
                </Typo>
              </View>
            </View>

            {emotionTags.length === 0 ? (
              <Typo size={13} color={colors.neutral500} style={{ textAlign: "center", paddingVertical: verticalScale(16) }}>
                No emotions yet — add some below.
              </Typo>
            ) : (
              <View style={styles.chipWrap}>
                {emotionTags.map((tag) => {
                  const chipBg = getEmotionColor(tag, emotionColors, emotionTags);
                  const isEditingThis = editingColorFor === tag;
                  return (
                    <View key={tag} style={[styles.chip, { backgroundColor: chipBg }]}>
                      <Typo size={13} fontWeight="600" color="#1a1a1a">
                        {tag.charAt(0).toUpperCase() + tag.slice(1)}
                      </Typo>
                      <TouchableOpacity
                        onPress={() => setEditingColorFor(isEditingThis ? null : tag)}
                        hitSlop={8}
                      >
                        <Icons.PaintBrush
                          size={verticalScale(12)}
                          color={isEditingThis ? "#1a1a1a" : "#555"}
                          weight={isEditingThis ? "fill" : "regular"}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeEmotion(tag)} hitSlop={8}>
                        <Icons.X size={verticalScale(12)} color="#555" weight="bold" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Inline color picker */}
            {editingColorFor && (
              <View style={styles.colorPicker}>
                <View style={styles.colorPickerHeader}>
                  <Typo size={12} color={colors.neutral400} fontWeight="600">
                    COLOR FOR {editingColorFor.toUpperCase()}
                  </Typo>
                  <TouchableOpacity onPress={() => setEditingColorFor(null)} hitSlop={8}>
                    <Icons.X size={verticalScale(14)} color={colors.neutral500} weight="bold" />
                  </TouchableOpacity>
                </View>
                <View style={styles.swatchRow}>
                  {COLOR_SWATCHES.map((hex) => {
                    const isCurrent = getEmotionColor(editingColorFor, emotionColors, emotionTags) === hex;
                    return (
                      <TouchableOpacity
                        key={hex}
                        style={[
                          styles.swatch,
                          { backgroundColor: hex },
                          isCurrent && styles.swatchSelected,
                        ]}
                        onPress={() => pickColor(editingColorFor, hex)}
                        disabled={saving}
                      />
                    );
                  })}
                </View>
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
                placeholder="e.g. calm, hopeful, frustrated…"
                value={newEmotion}
                onChangeText={setNewEmotion}
                containerStyle={{ flex: 1, height: verticalScale(50) }}
                onSubmitEditing={addEmotion}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.addBtn, saving && { opacity: 0.6 }]}
                onPress={addEmotion}
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
              Reset to default emotions & colors
            </Typo>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </ModalWrapper>
  );
};

export default EmotionsModal;

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
  colorPicker: {
    backgroundColor: colors.neutral700,
    borderRadius: radius._10,
    borderCurve: "continuous",
    padding: scale(12),
    gap: spacingY._10,
  },
  colorPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  swatchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(8),
  },
  swatch: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchSelected: {
    borderColor: colors.white,
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
