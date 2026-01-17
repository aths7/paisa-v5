import { Platform, StyleSheet, Text, View, Dimensions } from "react-native";
import React from "react";
import { colors, spacingX, spacingY } from "@/constants/theme";
import { ModalWrapperProps } from "@/types";
import { StatusBar } from "expo-status-bar";

const isIos = Platform.OS == "ios";

const ModalWrapper = ({
  style,
  children,
  bg = colors.neutral800,
}: ModalWrapperProps) => {
  return (
    <View style={[styles.container, { backgroundColor: bg }, style && style]}>
      <StatusBar style="light" />
      {children}
    </View>
  );
};

export default ModalWrapper;

const styles = StyleSheet.create({
  container: {
    paddingTop: isIos ? spacingX._15 : 50,
    paddingBottom: spacingY._20,
    flex: 1,
  },
});
