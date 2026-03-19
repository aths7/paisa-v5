import BackButton from "@/components/BackButton";
import Header from "@/components/Header";
import Input from "@/components/Input";
import ModalWrapper from "@/components/ModalWrapper";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { useAuth } from "@/contexts/authContext";
import { updateEmotionTags } from "@/services/userService";
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

const EmotionsModal = () => {
  const { user, updateUserData } = useAuth();

  const [emotionTags, setEmotionTags] = useState<string[]>(
    user?.emotionTags?.length ? user.emotionTags : DEFAULT_EMOTION_TAGS
  );
  const [newEmotion, setNewEmotion] = useState("");
  const [saving, setSaving] = useState(false);

  const saveTags = async (tags: string[]) => {
    if (!user?.uid) return;
    setSaving(true);
    await updateEmotionTags(user.uid, tags);
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
    const updated = emotionTags.filter((e) => e !== tag);
    setEmotionTags(updated);
    await saveTags(updated);
  };

  const resetToDefaults = async () => {
    setEmotionTags(DEFAULT_EMOTION_TAGS);
    await saveTags(DEFAULT_EMOTION_TAGS);
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
        >
          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Icons.Info size={verticalScale(16)} color={colors.neutral400} weight="fill" />
            <Typo size={13} color={colors.neutral400} style={{ flex: 1 }}>
              Tag how you feel when logging a transaction — helps you spot mood-driven spending patterns.
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
                {emotionTags.map((tag, idx) => {
                  const { bg, text } = chipColor(idx);
                  return (
                    <View key={tag} style={[styles.chip, { backgroundColor: bg }]}>
                      <Typo size={13} fontWeight="600" color={text}>
                        {tag.charAt(0).toUpperCase() + tag.slice(1)}
                      </Typo>
                      <TouchableOpacity onPress={() => removeEmotion(tag)} hitSlop={8}>
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
              Reset to default emotions
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
