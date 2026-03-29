import {
  Alert,
  InteractionManager,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useState } from "react";
import { BlurView } from "expo-blur";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import Header from "@/components/Header";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { Image } from "expo-image";
import { useAuth } from "@/contexts/authContext";
import { scale, verticalScale } from "@/utils/styling";
import * as Icons from "phosphor-react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { accountOptionType } from "@/types";
import { signOut } from "firebase/auth";
import { auth } from "@/config/firebase";
import { getProfileImage } from "@/services/imageService";
import { prepareTransactionsCSV, shareCSV, ExportRange } from "@/services/exportService";

const EXPORT_OPTIONS: { label: string; range: ExportRange }[] = [
  { label: "This Month", range: "this_month" },
  { label: "Last 30 Days", range: "last_30" },
  { label: "Last 3 Months", range: "last_90" },
  { label: "Last 6 Months", range: "last_180" },
  { label: "Entire Data", range: "all" },
];

const Profile = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [showExportSheet, setShowExportSheet] = useState(false);

  const runExport = async (range: ExportRange) => {
    setShowExportSheet(false);
    if (!user?.uid) return;
    setExporting(true);
    try {
      // Prepare the file while overlay is visible
      const fileUri = await prepareTransactionsCSV(user.uid, range);
      // Dismiss overlay and wait for native layout to settle before presenting share sheet
      setExporting(false);
      await new Promise<void>(resolve => InteractionManager.runAfterInteractions(() => resolve()));
      try {
        await shareCSV(fileUri);
      } catch (shareErr: any) {
        console.log("[export] shareCSV error:", shareErr);
        Alert.alert("Share Failed", shareErr?.message || JSON.stringify(shareErr));
      }
    } catch (e: any) {
      setExporting(false);
      console.log("[export] prepareCSV error:", e);
      Alert.alert("Export Failed", e?.message || "Something went wrong.");
    }
  };

  const accountOptions: accountOptionType[] = [
    {
      title: "Edit Profile",
      icon: <Icons.User size={verticalScale(26)} color={colors.white} weight="fill" />,
      routeName: "/(modals)/profileModal",
      bgColor: "#6366f1",
    },
    {
      title: "Expense Categories",
      icon: <Icons.SquaresFour size={verticalScale(26)} color={colors.white} weight="fill" />,
      routeName: "/(modals)/categoryModal",
      bgColor: "#10b981",
    },
    {
      title: "Emotion Tags",
      icon: <Icons.Smiley size={verticalScale(26)} color={colors.white} weight="fill" />,
      routeName: "/(modals)/emotionsModal",
      bgColor: "#7c3aed",
    },
    {
      title: "Settings",
      icon: <Icons.GearSix size={verticalScale(26)} color={colors.white} weight="fill" />,
      routeName: "/(modals)/settingsModal",
      bgColor: "#059669",
    },
    {
      title: "Export Transactions",
      icon: <Icons.Export size={verticalScale(26)} color={colors.white} weight="fill" />,
      bgColor: "#0891b2",
    },
    {
      title: "Privacy Policy",
      icon: <Icons.Lock size={verticalScale(26)} color={colors.white} weight="fill" />,
      routeName: "/(modals)/privacyPolicyModal",
      bgColor: colors.neutral600,
    },
    {
      title: "Logout",
      icon: <Icons.Power size={verticalScale(26)} color={colors.white} weight="fill" />,
      bgColor: "#e11d48",
    },
  ];

  const handleLogout = async () => {
    await signOut(auth);
  };

  const showLogoutAlert = () => {
    Alert.alert("Confirm", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", onPress: () => handleLogout(), style: "destructive" },
    ]);
  };

  const handlePress = async (item: accountOptionType) => {
    if (exporting) return;
    if (item?.title === "Logout") { showLogoutAlert(); return; }
    if (item?.title === "Export Transactions") { setShowExportSheet(true); return; }
    if (item?.routeName) router.push(item?.routeName);
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Header title={"Profile"} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.userInfo}>
            <View>
              <Image
                style={styles.avatar}
                source={getProfileImage(user?.image)}
                contentFit="cover"
                transition={100}
              />
            </View>
            <View style={styles.nameContainer}>
              <Typo size={24} fontWeight={"600"} color={colors.neutral100}>
                {user?.name || " "}
              </Typo>
              <Typo size={15} color={colors.neutral400}>
                {user?.email}
              </Typo>
            </View>
          </View>

          {/* account options */}
          <View style={styles.accountOptions}>
            {accountOptions.map((item, index) => (
              <Animated.View
                key={index.toString()}
                entering={FadeInDown.delay(index * 50).springify().damping(30).mass(3).stiffness(250)}
                style={styles.listItem}
              >
                <TouchableOpacity style={styles.flexRow} onPress={() => handlePress(item)}>
                  <View style={[styles.listIcon, { backgroundColor: item?.bgColor }]}>
                    {item.icon && item.icon}
                  </View>
                  <Typo size={16} style={{ flex: 1 }} fontWeight={"500"}>{item.title}</Typo>
                  {item.title === "Export Transactions" && exporting ? (
                    <Icons.CircleNotch size={verticalScale(20)} color={colors.neutral400} weight="bold" />
                  ) : (
                    <Icons.CaretRight size={verticalScale(20)} weight="bold" color={colors.white} />
                  )}
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Blocks all interaction + tab navigation while export is running */}
      {exporting && (
        <View style={styles.exportingOverlay} pointerEvents="box-only">
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Icons.CircleNotch size={scale(32)} color={colors.primary} weight="bold" />
          <Typo size={14} color={colors.neutral300} style={{ marginTop: spacingY._10 }}>
            Exporting…
          </Typo>
        </View>
      )}

      {/* Export range picker */}
      <Modal visible={showExportSheet} transparent animationType="fade" onRequestClose={() => setShowExportSheet(false)}>
        <BlurView intensity={40} tint="dark" style={styles.blurFill}>
          <Pressable style={styles.blurFill} onPress={() => setShowExportSheet(false)} />
          <View style={styles.sheet}>
            <Typo size={13} color={colors.neutral400} fontWeight="600" style={styles.sheetTitle}>
              EXPORT TRANSACTIONS
            </Typo>
            {EXPORT_OPTIONS.map((opt, i) => (
              <TouchableOpacity
                key={opt.range}
                style={[styles.sheetRow, i < EXPORT_OPTIONS.length - 1 && styles.sheetRowBorder]}
                onPress={() => runExport(opt.range)}
              >
                <Typo size={16} color={colors.white}>{opt.label}</Typo>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelRow} onPress={() => setShowExportSheet(false)}>
              <Typo size={16} color={colors.neutral400} fontWeight="500">Cancel</Typo>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>
    </ScreenWrapper>
  );
};

export default Profile;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  userInfo: {
    marginTop: verticalScale(30),
    alignItems: "center",
    gap: spacingY._15,
  },
  avatar: {
    alignSelf: "center",
    backgroundColor: colors.neutral300,
    height: verticalScale(135),
    width: verticalScale(135),
    borderRadius: 200,
  },
  nameContainer: {
    gap: verticalScale(4),
    alignItems: "center",
  },
  listIcon: {
    height: verticalScale(44),
    width: verticalScale(44),
    backgroundColor: colors.neutral500,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius._15,
    borderCurve: "continuous",
  },
  listItem: {
    marginBottom: verticalScale(17),
  },
  scrollContent: {
    paddingBottom: verticalScale(40),
  },
  accountOptions: {
    marginTop: spacingY._35,
  },
  flexRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
  exportingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  // Export sheet
  blurFill: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.neutral800,
    borderTopLeftRadius: radius._20,
    borderTopRightRadius: radius._20,
    borderCurve: "continuous",
    paddingHorizontal: spacingX._20,
    paddingTop: spacingY._20,
    paddingBottom: spacingY._40,
  },
  sheetTitle: {
    letterSpacing: 0.8,
    marginBottom: spacingY._10,
  },
  sheetRow: {
    paddingVertical: spacingY._17,
  },
  sheetRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral700,
  },
  cancelRow: {
    marginTop: spacingY._15,
    alignItems: "center",
    paddingVertical: spacingY._10,
  },
});
