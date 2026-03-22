import { View, Pressable, StyleSheet, Platform } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { scale, verticalScale } from "@/utils/styling";
import * as Icons from "phosphor-react-native";
import { colors } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Minimum tappable area per platform guidelines
const MIN_TAP = Platform.OS === "ios" ? 44 : 48;

function CustomTabs({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const tabbarIcons: Record<string, (isFocused: boolean) => React.ReactNode> = {
    index: (isFocused) => (
      <Icons.House
        size={verticalScale(26)}
        weight={isFocused ? "fill" : "regular"}
        color={isFocused ? colors.primary : colors.neutral400}
      />
    ),
    statistics: (isFocused) => (
      <Icons.ChartBar
        size={verticalScale(26)}
        weight={isFocused ? "fill" : "regular"}
        color={isFocused ? colors.primary : colors.neutral400}
      />
    ),
    wallet: (isFocused) => (
      <Icons.Wallet
        size={verticalScale(26)}
        weight={isFocused ? "fill" : "regular"}
        color={isFocused ? colors.primary : colors.neutral400}
      />
    ),
    profile: (isFocused) => (
      <Icons.User
        size={verticalScale(26)}
        weight={isFocused ? "fill" : "regular"}
        color={isFocused ? colors.primary : colors.neutral400}
      />
    ),
  };

  return (
    <View
      style={[
        styles.tabbar,
        { paddingBottom: Math.max(insets.bottom, verticalScale(8)) },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: "tabLongPress",
            target: route.key,
          });
        };

        return (
          <Pressable
            key={route.name}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            onLongPress={onLongPress}
            android_ripple={{
              borderless: true,
              color: colors.primary + "30",
              radius: scale(32),
            }}
            style={({ pressed }) => [
              styles.tabbarItem,
              // iOS press feedback
              Platform.OS === "ios" && pressed && styles.tabbarItemPressed,
            ]}
          >
            {/* Pill/capsule highlight behind icon when active */}
            <View
              style={[styles.pill, isFocused && styles.pillActive]}
              pointerEvents="none"
            >
              <View style={isFocused ? undefined : styles.inactiveIcon}>
                {tabbarIcons[route.name]?.(isFocused)}
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabbar: {
    flexDirection: "row",
    width: "100%",
    backgroundColor: colors.neutral800,
    borderTopColor: colors.neutral700,
    borderTopWidth: 1,
    paddingTop: verticalScale(8),
  },
  tabbarItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: MIN_TAP,
  },
  tabbarItemPressed: {
    opacity: 0.7,
  },
  pill: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: scale(MIN_TAP),
    minHeight: verticalScale(MIN_TAP - 8),
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(6),
    borderRadius: verticalScale(20),
  },
  pillActive: {
    backgroundColor: colors.neutral700,
  },
  // Mute inactive icons via opacity
  inactiveIcon: {
    opacity: 0.55,
  },
});

export default CustomTabs;
