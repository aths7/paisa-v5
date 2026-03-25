import React, { useEffect, useRef } from "react";
import {
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Icons from "phosphor-react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Typo from "@/components/Typo";
import Button from "@/components/Button";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { verticalScale, scale } from "@/utils/styling";
import { getMilestoneForStreak } from "@/constants/milestones";

const { width: SCREEN_W } = Dimensions.get("window");

type CelebrationParams = {
  streakCount: string;
  action: string;
};

const SUBTITLE: Record<string, string> = {
  first_entry: "You started your streak. Keep going!",
  continued: "You're on a roll. Keep the momentum!",
  restarted: "Fresh start! You've got this.",
};

// 7 weeks of day abbreviations for the check-in grid
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

const StreakCelebrationModal = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const confettiRef = useRef<any>(null);

  const { streakCount, action } = useLocalSearchParams<CelebrationParams>();
  const count = Number(streakCount) || 0;
  const subtitle = SUBTITLE[action] ?? SUBTITLE.continued;
  const milestone = getMilestoneForStreak(count);

  const onDone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.back();
  };

  const onViewMilestones = () => {
    router.push("/(modals)/streakDetailsModal");
  };

  // Build week grid: last 7 days — days up to today are "done", rest empty
  const weekDots = DAYS.map((_, i) => i < Math.min(count % 7 || (count > 0 ? 7 : 0), 7));

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacingY._20, paddingBottom: insets.bottom + spacingY._20 }]}>
      <StatusBar style="light" />

      {/* Confetti */}
      <ConfettiCannon
        ref={confettiRef}
        count={150}
        origin={{ x: SCREEN_W / 2, y: -20 }}
        autoStart={true}
        fadeOut={true}
        colors={[colors.primary, "#ffffff", "#fbbf24", "#f97316", "#a78bfa"]}
        fallSpeed={2800}
        explosionSpeed={350}
      />

      {/* Main centered content */}
      <View style={styles.content}>
        {/* Flame icon */}
        <View style={styles.flameContainer}>
          <Icons.Fire size={verticalScale(72)} color="#f97316" weight="fill" />
        </View>

        {/* Streak count */}
        <Typo size={88} fontWeight="800" color={colors.primary} style={styles.countText}>
          {count}
        </Typo>
        <Typo size={26} fontWeight="700" color={colors.white} style={styles.streakLabel}>
          Day Streak!
        </Typo>

        {/* Subtitle */}
        <Typo size={15} color={colors.neutral400} style={styles.subtitle}>
          {subtitle}
        </Typo>

        {/* Milestone badge */}
        {milestone && (
          <View style={styles.milestoneBadge}>
            <Icons.Trophy size={scale(16)} color={colors.primary} weight="fill" />
            <Typo size={13} fontWeight="600" color={colors.primary} style={{ marginLeft: scale(6) }}>
              Milestone Unlocked: {milestone.label}
            </Typo>
          </View>
        )}

        {/* Weekly check-in dots */}
        <View style={styles.weekRow}>
          {DAYS.map((day, i) => (
            <View key={i} style={styles.dayCol}>
              <View style={[styles.dot, weekDots[i] && styles.dotActive]} />
              <Typo size={11} color={colors.neutral500} style={{ marginTop: verticalScale(4) }}>
                {day}
              </Typo>
            </View>
          ))}
        </View>
      </View>

      {/* Footer actions */}
      <View style={[styles.footer, { paddingHorizontal: spacingX._20 }]}>
        <Button onPress={onDone} style={{ marginBottom: spacingY._12 }}>
          <Typo size={18} fontWeight="700" color={colors.black}>
            Done
          </Typo>
        </Button>

        <TouchableOpacity onPress={onViewMilestones} style={styles.milestonesLink}>
          <Typo size={14} color={colors.neutral400}>
            View all milestones
          </Typo>
          <Icons.ArrowRight size={scale(14)} color={colors.neutral400} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default StreakCelebrationModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral900,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacingX._30,
  },
  flameContainer: {
    marginBottom: spacingY._7,
  },
  countText: {
    lineHeight: verticalScale(95),
    letterSpacing: -2,
  },
  streakLabel: {
    marginTop: spacingY._5,
    marginBottom: spacingY._12,
  },
  subtitle: {
    textAlign: "center",
    lineHeight: verticalScale(22),
    marginBottom: spacingY._20,
  },
  milestoneBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral800,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius._30,
    paddingHorizontal: spacingX._15,
    paddingVertical: spacingY._7,
    marginBottom: spacingY._25,
  },
  weekRow: {
    flexDirection: "row",
    gap: scale(12),
    marginTop: spacingY._10,
  },
  dayCol: {
    alignItems: "center",
  },
  dot: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    backgroundColor: colors.neutral700,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  footer: {
    gap: spacingY._5,
  },
  milestonesLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(4),
    paddingVertical: spacingY._10,
  },
});
