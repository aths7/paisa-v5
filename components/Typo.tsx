import { StyleSheet, Text, TextStyle, View } from "react-native";
import React from "react";
import { verticalScale } from "@/utils/styling";
import { colors } from "@/constants/theme";
import { TypoProps } from "@/types";

const Typo = ({
  size,
  color = colors.text,
  fontWeight = "400",
  children,
  style,
  textProps = {},
}: TypoProps) => {
  const textStyle: TextStyle = {
    fontSize: size ? verticalScale(size) : verticalScale(18),
    color,
    fontWeight,
  };
  return (
    <Text style={[textStyle, style]} {...textProps}>
      {children}
    </Text>
  );
};

export default Typo;
