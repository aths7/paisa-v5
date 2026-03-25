import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors } from "@/constants/theme";

// Builds an SVG arc path on a circle of radius r centred at (cx, cy).
// Angles in degrees, 0° = right, going clockwise.
function arc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(startDeg));
  const y1 = cy + r * Math.sin(rad(startDeg));
  const x2 = cx + r * Math.cos(rad(endDeg));
  const y2 = cy + r * Math.sin(rad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

type Props = { size?: number };

const PaisaLoader = ({ size = 80 }: Props) => {
  const cx = size / 2;
  const outerR = cx - 5;
  const innerR = cx - 14;
  const stroke = 2.5;

  const outerRot = useSharedValue(0);
  const innerRot = useSharedValue(0);
  const scale    = useSharedValue(1);

  useEffect(() => {
    // Outer arc — spins clockwise at 1.1 s / revolution
    outerRot.value = withRepeat(
      withTiming(360, { duration: 1100, easing: Easing.linear }),
      -1
    );
    // Inner arc — spins counter-clockwise at 1.8 s / revolution
    innerRot.value = withRepeat(
      withTiming(-360, { duration: 1800, easing: Easing.linear }),
      -1
    );
    // ₹ pulses gently
    scale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 550, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.88, { duration: 550, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
  }, []);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${outerRot.value}deg` }],
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${innerRot.value}deg` }],
  }));
  const rupeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* Outer spinning arc */}
      <Animated.View style={[StyleSheet.absoluteFill, outerStyle]}>
        <Svg width={size} height={size}>
          {/* track */}
          <Circle cx={cx} cy={cx} r={outerR} stroke={colors.neutral800} strokeWidth={stroke} fill="none" />
          {/* bright arc — 270° */}
          <Path
            d={arc(cx, cx, outerR, -90, 180)}
            stroke={colors.primary}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>

      {/* Inner counter-rotating arc */}
      <Animated.View style={[StyleSheet.absoluteFill, innerStyle]}>
        <Svg width={size} height={size}>
          {/* track */}
          <Circle cx={cx} cy={cx} r={innerR} stroke={colors.neutral800} strokeWidth={stroke} fill="none" />
          {/* dimmer arc — 120° */}
          <Path
            d={arc(cx, cx, innerR, -90, 30)}
            stroke={colors.primary + "88"}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>

      {/* Pulsing ₹ */}
      <Animated.View style={rupeStyle}>
        <Text style={{ color: colors.primary, fontSize: size * 0.32, fontWeight: "700", lineHeight: size * 0.38 }}>
          ₹
        </Text>
      </Animated.View>
    </View>
  );
};

export default PaisaLoader;
