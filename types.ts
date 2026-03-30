import { Timestamp } from "firebase/firestore";
import { Icon } from "phosphor-react-native";
import React, { ReactNode } from "react";
import {
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  TouchableOpacityProps,
  ViewStyle
} from "react-native";

export type ScreenWrapperProps = {
  style?: ViewStyle;
  children: React.ReactNode;
};
export type ModalWrapperProps = {
  style?: ViewStyle;
  children: React.ReactNode;
  bg?: string;
};
export type accountOptionType = {
  title: string;
  icon: React.ReactNode;
  bgColor: string;
  routeName?: any;
};

export type TypoProps = {
  size?: number;
  color?: string;
  fontWeight?: TextStyle["fontWeight"];
  children: any | null;
  style?: TextStyle;
  textProps?: TextProps;
};

export type IconComponent = React.ComponentType<{
  height?: number;
  width?: number;
  strokeWidth?: number;
  color?: string;
  fill?: string;
}>;

export type IconProps = {
  name: string;
  color?: string;
  size?: number;
  strokeWidth?: number;
  fill?: string;
};

export type HeaderProps = {
  title?: string;
  style?: ViewStyle;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export type BackButtonProps = {
  style?: ViewStyle;
  iconSize?: number;
  onPress?: () => void;
};

export type PurchaseStyle = "impulsive" | "non_impulsive";

export type TransactionType = {
  id?: string;
  type: string;
  amount: number;
  category?: string;
  date: Date | Timestamp | string;
  description?: string;
  image?: any;
  uid?: string;
  walletId: string;
  transactionSource?: "manual" | "credit_card_bill_payment";
  linkedWalletId?: string;
  purchaseStyle?: PurchaseStyle;
  emotion?: string;
};

export type CategoryType = {
  label: string;
  value: string;
  icon: Icon;
  bgColor: string;
};
export type ExpenseCategoriesType = {
  [key: string]: CategoryType;
};

export type TransactionListType = {
  data: TransactionType[];
  title?: string;
  loading?: boolean;
  emptyListMessage?: string;
};

export type TransactionItemProps = {
  item: TransactionType;
  index: number;
  handleClick: Function;
};

export interface InputProps extends TextInputProps {
  icon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  inputRef?: React.RefObject<TextInput>;
  //   label?: string;
  //   error?: string;
}

export interface CustomButtonProps extends TouchableOpacityProps {
  style?: ViewStyle;
  onPress?: () => void;
  loading?: boolean;
  children: React.ReactNode;
}

export type ImageUploadProps = {
  file?: any;
  onSelect: (file: any) => void;
  onClear: () => void;
  containerStyle?: ViewStyle;
  imageStyle?: ViewStyle;
  placeholder?: string;
};

export type UserType = {
  uid?: string;
  email?: string | null;
  name: string | null;
  image?: any;
  emotionTags?: string[];
  emotionColors?: Record<string, string>;
  expenseCategories?: string[];
} | null;

export type UserDataType = {
  name: string;
  image?: any;
};

export type AuthContextType = {
  user: UserType;
  setUser: Function;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; msg?: string }>;
  register: (
    email: string,
    password: string,
    name: string
  ) => Promise<{ success: boolean; msg?: string }>;
  updateUserData: (userId: string) => Promise<void>;
};

export type ResponseType = {
  success: boolean;
  data?: any;
  msg?: string;
};

export type WalletType = {
  id?: string;
  name: string;
  image: any;
  uid?: string;
  created?: Date | Timestamp | string;
  totalIncome?: number;
  totalExpenses?: number;
  // Legacy field — kept for backward compat with old Firestore docs
  amount?: number;
};

// ---------------------------------------------------------------------------
// Streak / Gamification types
// ---------------------------------------------------------------------------

export type StreakHistoryEntry = {
  streak: number;
  endedOn: string; // "YYYY-MM-DD"
};

export type MilestoneConfig = {
  days: number;
  label: string;
  icon: string; // phosphor-react-native icon name
  description: string;
};

export type StreakType = {
  currentStreak: number;
  longestStreak: number;
  lastEntryDate: string; // "YYYY-MM-DD"
  streakStartDate: string; // "YYYY-MM-DD"
  history: StreakHistoryEntry[]; // max 2, newest first
  updatedAt?: any;
};

export type StreakUpdateResult = {
  action: "first_entry" | "continued" | "restarted";
  newStreak: number;
  isFirstToday: boolean; // false = already logged today, suppress modal
};

// ---------------------------------------------------------------------------
// Debt Tracker types
// ---------------------------------------------------------------------------

export type InterestRateFrequency = "per_month" | "per_year";
export type DebtDurationUnit = "months" | "years";
export type DebtStatus = "active" | "inactive";
export type DebtCalculationSource =
  | "rate_based"
  | "emi_override_back_calculated";

export type DebtFeeItem = {
  id: string;
  name: string;
  amount: number;
};

export type DebtClosureSummary = {
  closedAt: Date | Timestamp | string;
  closePaymentAmount: number;
  scheduledTotalPayable: number;
  difference: number;
};

export type DebtType = {
  id?: string;
  uid?: string;

  loanName: string;
  lenderName: string;
  principalAmount: number;

  enteredInterestRate: number;
  enteredInterestRateFrequency: InterestRateFrequency;

  derivedAnnualInterestRate: number;
  derivedMonthlyInterestRate: number;

  startDate: Date | Timestamp | string;
  durationValue: number;
  durationUnit: DebtDurationUnit;
  durationMonths: number;

  status: DebtStatus;
  isActive: boolean;

  feeItems: DebtFeeItem[];
  totalCharges: number;

  monthlyEmi: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  totalScheduledPayable: number;

  // Plaintext — not encrypted, needed for arrayUnion
  paidMonths: string[];

  // Custom per-month amounts (e.g. partial prepayment month); month is plaintext, amount encrypted
  customMonthPayments?: { month: string; amount: number }[];

  calculationSource: DebtCalculationSource;
  userAcceptedCalculation: boolean;
  emiOverrideValue?: number;
  calculationExplanation?: string;

  closedSummary?: DebtClosureSummary;

  createdAt?: Date | Timestamp | string;
  updatedAt?: Date | Timestamp | string;
};
