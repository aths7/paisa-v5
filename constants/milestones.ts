import { MilestoneConfig } from "@/types";

export const MILESTONES: MilestoneConfig[] = [
  {
    days: 7,
    label: "Week Warrior",
    icon: "Lightning",
    description: "7 days in a row",
  },
  {
    days: 14,
    label: "Fortnight Focus",
    icon: "Target",
    description: "14 days in a row",
  },
  {
    days: 21,
    label: "Habit Maker",
    icon: "Brain",
    description: "21 days in a row",
  },
  {
    days: 30,
    label: "Monthly Master",
    icon: "Medal",
    description: "30 days in a row",
  },
  {
    days: 60,
    label: "Diamond Discipline",
    icon: "Diamond",
    description: "60 days in a row",
  },
  {
    days: 90,
    label: "Quarter Champion",
    icon: "Trophy",
    description: "90 days in a row",
  },
];

export const getMilestoneForStreak = (n: number): MilestoneConfig | null =>
  MILESTONES.find((m) => m.days === n) ?? null;

export const getNextMilestone = (n: number): MilestoneConfig | null =>
  MILESTONES.find((m) => m.days > n) ?? null;
