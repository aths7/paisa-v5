import React, { useState } from "react";
import { LayoutAnimation, Platform, StyleSheet, TouchableOpacity, UIManager, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Icons from "phosphor-react-native";
import Typo from "./Typo";
import { colors, spacingX, spacingY } from "@/constants/theme";
import { verticalScale } from "@/utils/styling";

// Required for LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  title: string;
  optional?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const ANIMATION_CONFIG = {
  duration: 280,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

const CollapsibleSection = ({ title, optional, defaultOpen = true, children }: Props) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const rotation = useSharedValue(defaultOpen ? 0 : -90);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const toggle = () => {
    LayoutAnimation.configureNext(ANIMATION_CONFIG);
    const next = !isOpen;
    rotation.value = withTiming(next ? 0 : -90, { duration: 280 });
    setIsOpen(next);
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <TouchableOpacity style={styles.header} onPress={toggle} activeOpacity={0.7}>
        <View style={styles.titleRow}>
          <Typo color={colors.neutral200} size={16} fontWeight="500">
            {title}
          </Typo>
          {optional && (
            <Typo color={colors.neutral500} size={14}>
              (optional)
            </Typo>
          )}
        </View>
        <Animated.View style={chevronStyle}>
          <Icons.CaretDown size={verticalScale(18)} color={colors.neutral400} />
        </Animated.View>
      </TouchableOpacity>

      {isOpen && <View>{children}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacingY._10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacingY._5,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._5,
  },
});

export default CollapsibleSection;
