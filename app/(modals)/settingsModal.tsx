import {
  Alert,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useState } from "react";
import ModalWrapper from "@/components/ModalWrapper";
import Header from "@/components/Header";
import BackButton from "@/components/BackButton";
import Typo from "@/components/Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { verticalScale } from "@/utils/styling";
import * as Icons from "phosphor-react-native";
import { useAuth } from "@/contexts/authContext";
import { deleteAccount } from "@/services/userService";
import Input from "@/components/Input";
import Button from "@/components/Button";
import { auth } from "@/config/firebase";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";

const SettingsModal = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showReauthForm, setShowReauthForm] = useState(false);
  const [password, setPassword] = useState("");
  const [reauthError, setReauthError] = useState("");

  const showDeleteAlert = () => {
    Alert.alert(
      "Delete Account & Data",
      "This will permanently delete your account, all wallets, and all transactions. This action cannot be undone.\n\nYou will be asked to confirm your password next.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            setPassword("");
            setReauthError("");
            setShowReauthForm(true);
          },
        },
      ]
    );
  };

  const handleConfirmDelete = async () => {
    if (!password.trim()) {
      setReauthError("Please enter your password.");
      return;
    }
    if (!user?.uid || !user?.email) return;

    setLoading(true);
    setReauthError("");

    try {
      // Step 1: Re-authenticate so Firebase allows account deletion
      const credential = EmailAuthProvider.credential(user.email!, password);
      await reauthenticateWithCredential(auth.currentUser!, credential);

      // Step 2: Delete all Firestore data + Firebase Auth account
      const res = await deleteAccount(user.uid);

      if (!res.success) {
        setLoading(false);
        Alert.alert("Error", res.msg || "Failed to delete account. Please try again.");
      }
      // On success, Firebase Auth deletion triggers onAuthStateChanged → auto-navigates to welcome
    } catch (error: any) {
      setLoading(false);
      const msg: string = error.message || "";
      if (msg.includes("auth/wrong-password") || msg.includes("auth/invalid-credential")) {
        setReauthError("Incorrect password. Please try again.");
      } else if (msg.includes("auth/too-many-requests")) {
        setReauthError("Too many attempts. Please try again later.");
      } else {
        setReauthError("Authentication failed. Please try again.");
      }
    }
  };

  return (
    <ModalWrapper>
      <View style={styles.container}>
        <Header
          title="Settings"
          leftIcon={<BackButton />}
          style={{ marginBottom: spacingY._10 }}
        />

        <View style={styles.content}>
          <View style={styles.dangerSection}>
            <Typo
              size={13}
              color={colors.neutral400}
              fontWeight={"600"}
              style={styles.sectionLabel}
            >
              DANGER ZONE
            </Typo>

            {showReauthForm ? (
              <View style={styles.reauthForm}>
                <Typo size={15} fontWeight={"600"} color={colors.rose}>
                  Confirm your password to delete
                </Typo>
                <Typo size={13} color={colors.neutral400}>
                  Required to verify your identity before permanently deleting everything.
                </Typo>

                <Input
                  placeholder="Enter your password"
                  secureTextEntry
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    if (reauthError) setReauthError("");
                  }}
                  icon={
                    <Icons.Lock
                      size={verticalScale(22)}
                      color={colors.neutral400}
                      weight="fill"
                    />
                  }
                />

                {reauthError ? (
                  <Typo size={13} color={colors.rose}>
                    {reauthError}
                  </Typo>
                ) : null}

                <Button
                  loading={loading}
                  onPress={handleConfirmDelete}
                  style={styles.confirmDeleteButton}
                >
                  <Typo size={16} fontWeight={"700"} color={colors.white}>
                    Delete Everything
                  </Typo>
                </Button>

                <TouchableOpacity
                  onPress={() => {
                    setShowReauthForm(false);
                    setPassword("");
                    setReauthError("");
                  }}
                  style={styles.cancelLink}
                  disabled={loading}
                >
                  <Typo size={14} color={colors.neutral400}>
                    Cancel
                  </Typo>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={showDeleteAlert}
                disabled={loading}
              >
                <View style={styles.deleteIconWrapper}>
                  <Icons.Trash
                    size={verticalScale(22)}
                    color={colors.rose}
                    weight="bold"
                  />
                </View>

                <View style={styles.deleteTextWrapper}>
                  <Typo size={16} fontWeight={"600"} color={colors.rose}>
                    Delete Account & Data
                  </Typo>
                  <Typo size={13} color={colors.neutral400}>
                    Permanently removes your account, all wallets, and all transactions
                  </Typo>
                </View>

                <Icons.CaretRight
                  size={verticalScale(18)}
                  color={colors.neutral500}
                  weight="bold"
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </ModalWrapper>
  );
};

export default SettingsModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  content: {
    flex: 1,
    paddingTop: spacingY._20,
  },
  sectionLabel: {
    letterSpacing: 1,
    marginBottom: spacingY._10,
    paddingHorizontal: spacingX._5,
  },
  dangerSection: {
    marginTop: spacingY._10,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._12,
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.rose,
    paddingHorizontal: spacingX._15,
    paddingVertical: verticalScale(14),
  },
  deleteIconWrapper: {
    width: verticalScale(40),
    height: verticalScale(40),
    borderRadius: radius._10,
    backgroundColor: "#3b0000",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteTextWrapper: {
    flex: 1,
    gap: verticalScale(3),
  },
  reauthForm: {
    backgroundColor: colors.neutral800,
    borderRadius: radius._15,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.rose,
    padding: spacingX._15,
    gap: spacingY._12,
  },
  confirmDeleteButton: {
    backgroundColor: colors.rose,
    marginTop: spacingY._5,
  },
  cancelLink: {
    alignSelf: "center",
    paddingVertical: spacingY._5,
  },
});
