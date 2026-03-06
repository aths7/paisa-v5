import { ScrollView, StyleSheet, View } from "react-native";
import React from "react";
import ModalWrapper from "@/components/ModalWrapper";
import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import Typo from "@/components/Typo";
import { colors, spacingX, spacingY } from "@/constants/theme";
import { verticalScale } from "@/utils/styling";

type Section = {
  heading: string;
  body: string;
};

type TableRow = {
  col1: string;
  col2: string;
  col3?: string;
};

const LAST_UPDATED = "March 6, 2026";
const PACKAGE = "com.aths7.paisav5";

const SECTIONS: Section[] = [
  {
    heading: "1. Introduction",
    body: 'Paisa ("we", "our", or "us") is a personal finance management application. This Privacy Policy explains what data we collect, why we collect it, how it is stored, and your rights over it. By using the app, you agree to this policy.',
  },
  {
    heading: "2. Data We Do NOT Collect",
    body: "We do not collect: location data, contacts or address book, microphone or camera input, SMS or call logs, device identifiers (IMEI, MAC address), advertising IDs, browsing history, or any data from other apps.",
  },
  {
    heading: "3. How We Use Your Data",
    body: "Your data is used solely to operate the app:\n\n• Authentication — verify your identity and keep you securely logged in\n• Financial tracking — store and display your wallets, income, and expense transactions\n• Profile display — show your name and photo within the app\n• App functionality — enable all features (adding, editing, deleting transactions and wallets)\n\nWe do not use your data for advertising, profiling, or any purpose beyond operating the app for you personally.",
  },
  {
    heading: "4. Data Storage & Third-Party Services",
    body: "Your data is stored using Google Firebase:\n\n• Firebase Authentication — Email, password hash, UID, display name\n• Firebase Firestore — User profile, wallets, transactions\n• Firebase Storage — Profile photos, wallet icons, receipt images\n• Cloudinary — Image hosting for uploaded photos\n\nFirebase is a Google LLC service. Data may be stored on Google servers outside your country. Google's Privacy Policy applies to these services.\n\nAsyncStorage stores your authentication session token locally on your device only.\n\nWe do not sell, rent, or share your data with any other third parties.",
  },
  {
    heading: "5. Data Retention",
    body: "Your data is retained for as long as your account is active. If you delete your account, all associated data (profile, wallets, transactions, images) will be permanently deleted from Firebase. Authentication session data on your device is cleared on sign-out.",
  },
  {
    heading: "6. Permissions Requested",
    body: "Internet — Required to connect to Firebase (authentication, data sync).\n\nPhoto Library (Read) — Required to let you select a profile photo or attach receipt images to transactions.\n\nNo other system permissions are requested.",
  },
  {
    heading: "7. Your Rights",
    body: "You have the right to:\n\n• Access your data at any time within the app\n• Update your profile name and photo via the Profile screen\n• Delete individual transactions or wallets at any time\n• Delete your account — go to Profile > Settings > Delete Account & Data. All your data will be permanently erased.",
  },
  {
    heading: "8. Children's Privacy",
    body: "Paisa is not directed at children under the age of 13. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us and we will delete it promptly.",
  },
  {
    heading: "9. Changes to This Policy",
    body: 'We may update this policy as the app evolves. We will update the "Last updated" date at the top. Continued use of the app after changes constitutes acceptance.',
  },
  {
    heading: "10. Contact",
    body: "For privacy questions, data deletion requests, or any concerns, please contact us at the email listed on our Play Store listing.",
  },
];

const DATA_COLLECTED: TableRow[] = [
  { col1: "Email address", col2: "Account creation & login" },
  { col1: "Display name", col2: "Personalising your experience" },
  { col1: "Profile photo", col2: "Profile display" },
  { col1: "User ID (UID)", col2: "Linking your data internally" },
  { col1: "Wallet name & icon", col2: "Organising your accounts" },
  { col1: "Transaction type, amount, date", col2: "Financial tracking" },
  { col1: "Expense category", col2: "Spending awareness" },
  { col1: "Transaction description", col2: "Personal notes (optional)" },
  { col1: "Receipt image", col2: "Proof of transaction (optional)" },
  { col1: "Auth session token", col2: "Keeping you logged in (device only)" },
];

const PrivacyPolicyModal = () => {
  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title="Privacy Policy"
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._10 }}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {/* Meta */}
          <Typo size={13} color={colors.neutral400}>
            Last updated: {LAST_UPDATED}
          </Typo>
          <Typo size={13} color={colors.neutral400} style={{ marginBottom: spacingY._20 }}>
            App package: {PACKAGE}
          </Typo>

          {/* Data collected table */}
          <Typo size={17} fontWeight={"700"} style={{ marginBottom: spacingY._10 }}>
            Data We Collect
          </Typo>

          <View style={styles.table}>
            {/* Header row */}
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Typo size={13} fontWeight={"700"} color={colors.neutral900} style={styles.col1}>
                Data
              </Typo>
              <Typo size={13} fontWeight={"700"} color={colors.neutral900} style={styles.col2}>
                Purpose
              </Typo>
            </View>
            {DATA_COLLECTED.map((row, i) => (
              <View
                key={i}
                style={[
                  styles.tableRow,
                  i % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd,
                ]}
              >
                <Typo size={13} color={colors.neutral900} style={styles.col1}>
                  {row.col1}
                </Typo>
                <Typo size={13} color={colors.neutral900} style={styles.col2}>
                  {row.col2}
                </Typo>
              </View>
            ))}
          </View>

          {/* Sections */}
          {SECTIONS.map((section, i) => (
            <View key={i} style={styles.section}>
              <Typo size={17} fontWeight={"700"} style={{ marginBottom: spacingY._7 }}>
                {section.heading}
              </Typo>
              <Typo size={14} color={colors.textLighter} style={{ lineHeight: 22 }}>
                {section.body}
              </Typo>
            </View>
          ))}
        </ScrollView>
      </View>
    </ModalWrapper>
  );
};

export default PrivacyPolicyModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  content: {
    paddingVertical: spacingY._15,
    paddingBottom: spacingY._40,
  },
  section: {
    marginTop: spacingY._20,
  },
  table: {
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: spacingY._10,
  },
  tableHeader: {
    backgroundColor: colors.primary,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: verticalScale(8),
    paddingHorizontal: spacingX._10,
  },
  tableRowEven: {
    backgroundColor: colors.neutral200,
  },
  tableRowOdd: {
    backgroundColor: colors.neutral100,
  },
  col1: {
    flex: 1,
    paddingRight: spacingX._5,
  },
  col2: {
    flex: 1.4,
  },
});
