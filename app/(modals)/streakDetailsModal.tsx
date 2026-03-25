import React, { useEffect, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Svg, { Circle, Path, Defs, RadialGradient, Stop } from "react-native-svg";
import * as Icons from "phosphor-react-native";
import { useAuth } from "@/contexts/authContext";
import { getStreakData } from "@/services/streakService";
import { getNextMilestone, MILESTONES } from "@/constants/milestones";
import { StreakType } from "@/types";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { scale, verticalScale } from "@/utils/styling";

const { width: SCREEN_W } = Dimensions.get("window");
const HERO_SIZE = SCREEN_W * 0.72;
const STROKE = scale(14);
const R = (HERO_SIZE - STROKE) / 2;
const CX = HERO_SIZE / 2;
const CY = HERO_SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

// Arc from 210° to 330° going clockwise (leaving gap at bottom)
const START_DEG = 210;
const END_DEG = 330; // total sweep = 300°
const SWEEP = 300;

const degToRad = (d: number) => (d * Math.PI) / 180;

const arcPath = (cx: number, cy: number, r: number, startDeg: number, sweepDeg: number) => {
  const start = degToRad(startDeg);
  const end = degToRad(startDeg + sweepDeg);
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
};

// Full 300° background track
const BG_PATH = arcPath(CX, CY, R, START_DEG, SWEEP);

// Filled arc based on progress ratio (0 to 1)
const fillPath = (ratio: number) => {
  const sweep = SWEEP * Math.min(Math.max(ratio, 0), 1);
  if (sweep < 1) return arcPath(CX, CY, R, START_DEG, 1);
  return arcPath(CX, CY, R, START_DEG, sweep);
};

// ---------------------------------------------------------------------------
// Build current-week momentum grid (Mon → Sun)
// ---------------------------------------------------------------------------
const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const getMomentumDays = (currentStreak: number, lastEntryDate: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateStr(today);

  // Monday of current week
  const dow = today.getDay(); // 0=Sun
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMonday);

  // Earliest date in the current streak
  let streakStartDate: Date | null = null;
  if (currentStreak > 0 && lastEntryDate) {
    const last = new Date(lastEntryDate + "T00:00:00");
    streakStartDate = new Date(last);
    streakStartDate.setDate(last.getDate() - (currentStreak - 1));
  }

  const days: { label: string; status: "done" | "today" | "future" | "missed" }[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    d.setHours(0, 0, 0, 0);
    const dStr = toDateStr(d);

    let status: "done" | "today" | "future" | "missed";

    if (d > today) {
      status = "future";
    } else if (dStr === todayStr) {
      // Today is green only if already logged
      status = lastEntryDate === todayStr ? "today" : "future";
    } else {
      // Past day — green if it falls within the current streak window
      const lastDate = lastEntryDate ? new Date(lastEntryDate + "T00:00:00") : null;
      if (streakStartDate && lastDate && d >= streakStartDate && d <= lastDate) {
        status = "done";
      } else {
        status = "missed";
      }
    }

    days.push({ label: DAY_LABELS[i], status });
  }

  return days;
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const StreakDetailsModal = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [streakData, setStreakData] = useState<StreakType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    getStreakData(user.uid).then((data) => {
      setStreakData(data);
      setLoading(false);
    });
  }, []);

  const current = streakData?.currentStreak ?? 0;
  const longest = streakData?.longestStreak ?? 0;
  const lastEntryDate = streakData?.lastEntryDate ?? "";
  const history = streakData?.history ?? [];
  const nextMilestone = getNextMilestone(current);
  const progressRatio = nextMilestone ? current / nextMilestone.days : 1;
  const momentumDays = getMomentumDays(current, lastEntryDate);

  // Milestones: completed vs upcoming
  const completedMilestones = MILESTONES.filter((m) => current >= m.days);
  const upcomingMilestones = MILESTONES.filter((m) => current < m.days);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Subtle back button — no formal header */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.backBtn, { top: insets.top + verticalScale(10) }]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Icons.CaretLeft size={scale(20)} color={colors.neutral300} weight="bold" />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── HERO: Circular arc ───────────────────────────────────────── */}
        <View style={styles.heroContainer}>
          <Svg width={HERO_SIZE} height={HERO_SIZE}>
            <Defs>
              <RadialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.15} />
                <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
              </RadialGradient>
            </Defs>

            {/* Glow fill */}
            <Circle cx={CX} cy={CY} r={R - STROKE / 2} fill="url(#glowGrad)" />

            {/* Background track */}
            <Path
              d={BG_PATH}
              stroke={colors.neutral700}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
            />

            {/* Progress fill */}
            <Path
              d={fillPath(progressRatio)}
              stroke={colors.primary}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>

          {/* Center content — overlaid on SVG */}
          <View style={styles.heroCenter}>
            {/* Lightning bolt badge */}
            <View style={styles.lightningBadge}>
              <Icons.Lightning size={verticalScale(22)} color={colors.black} weight="fill" />
            </View>

            <Typo size={64} fontWeight="800" color={colors.white} style={styles.heroCount}>
              {current}
            </Typo>
            <Typo size={11} fontWeight="700" color={colors.primary} style={styles.heroLabel}>
              DAYS LOCKED IN
            </Typo>
          </View>
        </View>

        {/* Streak meta row */}
        <View style={styles.heroMetaRow}>
          {streakData?.streakStartDate ? (
            <View style={styles.heroMetaItem}>
              <Icons.CalendarBlank size={scale(13)} color={colors.neutral500} />
              <Typo size={12} color={colors.neutral500}>
                {" "}Started {formatDate(streakData.streakStartDate)}
              </Typo>
            </View>
          ) : null}
          {longest > current && (
            <View style={styles.heroMetaItem}>
              <Icons.TrendUp size={scale(13)} color={colors.neutral500} />
              <Typo size={12} color={colors.neutral500}>
                {" "}Best {longest} days
              </Typo>
            </View>
          )}
        </View>

        {/* ── MOMENTUM DASHBOARD ──────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionAccent} />
          <Typo size={17} fontWeight="700" color={colors.text}>
            Momentum Dashboard
          </Typo>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daysRow}
        >
          {momentumDays.map((day, i) => {
            const isToday = day.status === "today";
            const isDone = day.status === "done";
            const isMissed = day.status === "missed";

            return (
              <View
                key={i}
                style={[
                  styles.dayPill,
                  isToday && styles.dayPillActive,
                  isDone && styles.dayPillDone,
                ]}
              >
                <Typo
                  size={11}
                  fontWeight="700"
                  color={isToday ? colors.black : isDone ? colors.primary : colors.neutral500}
                >
                  {day.label}
                </Typo>
                <View style={styles.dayIconWrap}>
                  {isToday ? (
                    <Icons.Lightning size={scale(18)} color={colors.black} weight="fill" />
                  ) : isDone ? (
                    <Icons.CheckCircle size={scale(18)} color={colors.primary} weight="fill" />
                  ) : (
                    <Icons.CircleIcon size={scale(18)} color={colors.neutral700} />
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* ── REPUTATION LEVELS ───────────────────────────────────────── */}
        <View style={[styles.sectionHeader, { marginTop: spacingY._25 }]}>
          <View style={styles.sectionAccent} />
          <Typo size={17} fontWeight="700" color={colors.text}>
            Milestones
          </Typo>
        </View>

        <View style={styles.milestoneList}>
          {MILESTONES.map((m) => {
            const unlocked = current >= m.days;
            const isActive = nextMilestone?.days === m.days;
            const IconComp = (Icons as any)[m.icon];
            const daysLeft = m.days - current;
            const rowRatio = isActive ? current / m.days : unlocked ? 1 : 0;

            return (
              <View
                key={m.days}
                style={[
                  styles.milestoneRow,
                  unlocked && styles.milestoneRowUnlocked,
                  isActive && styles.milestoneRowActive,
                ]}
              >
                {/* Left accent bar */}
                <View
                  style={[
                    styles.milestoneAccentBar,
                    unlocked
                      ? styles.milestoneAccentBarUnlocked
                      : isActive
                      ? styles.milestoneAccentBarActive
                      : styles.milestoneAccentBarLocked,
                  ]}
                />

                {/* Icon circle */}
                <View
                  style={[
                    styles.milestoneIconCircle,
                    unlocked && styles.milestoneIconCircleUnlocked,
                    isActive && styles.milestoneIconCircleActive,
                  ]}
                >
                  {unlocked ? (
                    IconComp ? (
                      <IconComp size={scale(18)} color={colors.black} weight="fill" />
                    ) : null
                  ) : isActive ? (
                    IconComp ? (
                      <IconComp size={scale(18)} color={colors.black} weight="fill" />
                    ) : null
                  ) : (
                    <Icons.LockSimple size={scale(15)} color={colors.neutral600} weight="fill" />
                  )}
                </View>

                {/* Text block */}
                <View style={styles.milestoneTextBlock}>
                  <View style={styles.milestoneTitleRow}>
                    <Typo
                      size={14}
                      fontWeight="700"
                      color={unlocked ? colors.text : isActive ? colors.text : colors.neutral600}
                    >
                      {m.label}
                    </Typo>
                    <Typo
                      size={12}
                      color={unlocked ? colors.neutral500 : isActive ? colors.neutral500 : colors.neutral700}
                    >
                      {m.days} days
                    </Typo>
                  </View>
                  <Typo
                    size={12}
                    color={unlocked ? colors.neutral500 : isActive ? colors.neutral500 : colors.neutral700}
                  >
                    {m.description}
                  </Typo>
                  {isActive && (
                    <View style={styles.milestoneProgressTrack}>
                      <View
                        style={[
                          styles.milestoneProgressFill,
                          { width: `${rowRatio * 100}%` as any },
                        ]}
                      />
                    </View>
                  )}
                </View>

                {/* Right status */}
                <View style={styles.milestoneStatusCol}>
                  {unlocked ? (
                    <Icons.CheckCircle size={scale(22)} color={colors.primary} weight="fill" />
                  ) : isActive ? (
                    <>
                      <Typo size={15} fontWeight="800" color={colors.primary}>
                        {daysLeft}
                      </Typo>
                      <Typo size={10} color={colors.neutral500}>
                        days left
                      </Typo>
                    </>
                  ) : (
                    <>
                      <Typo size={15} fontWeight="700" color={colors.neutral700}>
                        {daysLeft}
                      </Typo>
                      <Typo size={10} color={colors.neutral700}>
                        days
                      </Typo>
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Past Streaks */}
        {history.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { marginTop: spacingY._25 }]}>
              <View style={styles.sectionAccent} />
              <Typo size={17} fontWeight="700" color={colors.text}>
                Past Streaks
              </Typo>
            </View>
            {history.map((h, i) => (
              <View key={i} style={styles.historyRow}>
                <View style={styles.historyLeft}>
                  <Icons.Fire size={scale(16)} color="#f97316" weight="fill" />
                  <Typo size={15} fontWeight="600" color={colors.text} style={{ marginLeft: scale(8) }}>
                    {h.streak} day streak
                  </Typo>
                </View>
                <Typo size={13} color={colors.neutral500}>
                  ended {formatDate(h.endedOn)}
                </Typo>
              </View>
            ))}
          </>
        )}

        <View style={{ height: spacingY._40 }} />
      </ScrollView>
    </View>
  );
};

export default StreakDetailsModal;

const ACCENT_W = scale(4);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d0d",
  },
  backBtn: {
    position: "absolute",
    left: spacingX._15,
    zIndex: 10,
    backgroundColor: colors.neutral800,
    borderRadius: radius._10,
    padding: scale(8),
  },
  scrollContent: {
    paddingTop: verticalScale(48),
    paddingHorizontal: spacingX._20,
    paddingBottom: spacingY._20,
    alignItems: "center",
  },

  // Hero
  heroContainer: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacingY._25,
  },
  heroCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  lightningBadge: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: verticalScale(6),
  },
  heroCount: {
    lineHeight: verticalScale(68),
    letterSpacing: -2,
  },
  heroLabel: {
    letterSpacing: 1.5,
    marginTop: verticalScale(2),
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
    alignSelf: "flex-start",
    marginBottom: spacingY._12,
  },
  sectionAccent: {
    width: ACCENT_W,
    height: verticalScale(20),
    backgroundColor: colors.primary,
    borderRadius: ACCENT_W / 2,
  },

  // Momentum days
  daysRow: {
    gap: scale(8),
    paddingHorizontal: spacingX._5,
    paddingBottom: spacingY._5,
  },
  dayPill: {
    width: scale(58),
    paddingVertical: verticalScale(12),
    borderRadius: radius._15,
    backgroundColor: colors.neutral800,
    alignItems: "center",
    gap: verticalScale(6),
  },
  dayPillActive: {
    backgroundColor: colors.primary,
  },
  dayPillDone: {
    backgroundColor: colors.neutral800,
    borderWidth: 1,
    borderColor: colors.neutral700,
  },
  dayIconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },

  // Hero meta row
  heroMetaRow: {
    flexDirection: "row",
    gap: spacingX._20,
    marginTop: -spacingY._15,
    marginBottom: spacingY._10,
    justifyContent: "center",
  },
  heroMetaItem: {
    flexDirection: "row",
    alignItems: "center",
  },

  // Milestone vertical list
  milestoneList: {
    width: "100%",
    gap: spacingY._10,
    marginBottom: spacingY._10,
  },
  milestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    paddingVertical: verticalScale(14),
    paddingRight: spacingX._15,
    overflow: "hidden",
    gap: spacingX._12,
  },
  milestoneRowUnlocked: {
    backgroundColor: "#1a1f1a",
    borderWidth: 1,
    borderColor: "#2a3a2a",
  },
  milestoneRowActive: {
    backgroundColor: "#151a10",
    borderWidth: 1,
    borderColor: colors.primary + "40",
  },
  milestoneAccentBar: {
    width: scale(4),
    height: "100%",
    minHeight: verticalScale(60),
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    flexShrink: 0,
  },
  milestoneAccentBarUnlocked: {
    backgroundColor: colors.primary,
  },
  milestoneAccentBarActive: {
    backgroundColor: colors.primary,
    opacity: 0.6,
  },
  milestoneAccentBarLocked: {
    backgroundColor: colors.neutral700,
  },
  milestoneIconCircle: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral700,
    flexShrink: 0,
  },
  milestoneIconCircleUnlocked: {
    backgroundColor: colors.primary,
  },
  milestoneIconCircleActive: {
    backgroundColor: colors.primary,
    opacity: 0.8,
  },
  milestoneTextBlock: {
    flex: 1,
    gap: verticalScale(2),
  },
  milestoneTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._7,
  },
  milestoneProgressTrack: {
    height: verticalScale(4),
    backgroundColor: colors.neutral700,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: verticalScale(6),
  },
  milestoneProgressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  milestoneStatusCol: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: scale(44),
    flexShrink: 0,
  },

  // History
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    paddingHorizontal: spacingX._15,
    paddingVertical: spacingY._12,
    marginBottom: spacingY._10,
  },
  historyLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
});
