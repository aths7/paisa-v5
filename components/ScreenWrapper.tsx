import { Dimensions, Platform, StyleSheet, Text, View } from "react-native";
import React from "react";
import { ScreenWrapperProps } from "@/types";
import { colors } from "@/constants/theme";
import { StatusBar } from "expo-status-bar";

const { height } = Dimensions.get("window");

const ScreenWrapper = ({ style, children }: ScreenWrapperProps) => {
  let paddingTop = Platform.OS === "ios" ? height * 0.06 : 50;
  return (
    <View
      style={[
        { paddingTop, flex: 1, backgroundColor: colors.neutral900 },
        style,
      ]}
    >
      <StatusBar style="light" />
      {children}
    </View>
  );
};

export default ScreenWrapper;
