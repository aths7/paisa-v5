import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import ScreenWrapper from "@/components/ScreenWrapper";
import { StatusBar } from "expo-status-bar";
import { scale, verticalScale } from "@/utils/styling";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Typo from "@/components/Typo";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import Button from "@/components/Button";

type OnboardingScreen = {
  title: string;
  description: string;
  bullets: string[];
  buttonText: string;
  showSignIn: boolean;
};

const SCREENS: OnboardingScreen[] = [
  {
    title: "Intention",
    description: "The intention towards building this project is to help",
    bullets: [
      "Increase awareness (of current income, loans, taxes & spends)",
      "Reduce guilt of spending",
    ],
    buttonText: "Activate Intention",
    showSignIn: false,
  },
  {
    title: "Principles",
    description:
      "The app is based on time tested principles which will add eventual, sustainable value to your life.",
    bullets: [
      "Intentional baby steps compound over time to become colossal transformations",
      "Real value (and therefore wealth) is in the work you do.",
    ],
    buttonText: "Commit to longer term over short term",
    showSignIn: false,
  },
  {
    title: "Become aware of your financial life",
    description: "",
    bullets: [],
    buttonText: "Get Started!",
    showSignIn: true,
  },
];

const WelcomePage = () => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  const screen = SCREENS[currentStep];

  const handleNext = () => {
    if (currentStep < SCREENS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      router.push("/(auth)/register");
    }
  };

  return (
    <ScreenWrapper>
      <StatusBar style="light" />
      <View style={styles.container}>
        {/* top row: sign in (only on last screen) */}
        <View style={styles.topRow}>
          {screen.showSignIn ? (
            <TouchableOpacity
              onPress={() => router.push("/(auth)/login")}
              style={styles.loginButton}
            >
              <Typo fontWeight={"500"}>Sign in</Typo>
            </TouchableOpacity>
          ) : (
            <View />
          )}
        </View>

        {/* image */}
        <Animated.Image
          key={currentStep}
          entering={FadeIn.duration(500)}
          source={require("../../assets/images/welcome.png")}
          style={styles.welcomeImage}
          resizeMode="contain"
        />

        {/* dots */}
        <View style={styles.dotsContainer}>
          {SCREENS.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, currentStep === index && styles.dotActive]}
            />
          ))}
        </View>

        {/* footer */}
        <View style={styles.footer}>
          <Animated.View
            key={`title-${currentStep}`}
            entering={FadeInDown.duration(800).springify().damping(30).mass(3).stiffness(250)}
            style={{ alignItems: "center" }}
          >
            <Typo size={28} fontWeight={"800"} style={{ textAlign: "center" }}>
              {screen.title}
            </Typo>
          </Animated.View>

          {screen.description ? (
            <Animated.View
              key={`desc-${currentStep}`}
              entering={FadeInDown.duration(800)
                .delay(80)
                .springify()
                .damping(30)
                .mass(3)
                .stiffness(250)}
              style={{ alignItems: "center" }}
            >
              <Typo size={16} color={colors.textLighter} style={{ textAlign: "center" }}>
                {screen.description}
              </Typo>
            </Animated.View>
          ) : null}

          {screen.bullets.length > 0 ? (
            <Animated.View
              key={`bullets-${currentStep}`}
              entering={FadeInDown.duration(800)
                .delay(160)
                .springify()
                .damping(30)
                .mass(3)
                .stiffness(250)}
              style={styles.bulletsContainer}
            >
              {screen.bullets.map((bullet, index) => (
                <View key={index} style={styles.bulletRow}>
                  <Typo size={15} color={colors.primary} fontWeight={"700"}>
                    {"• "}
                  </Typo>
                  <Typo size={15} color={colors.textLight} style={{ flex: 1 }}>
                    {bullet}
                  </Typo>
                </View>
              ))}
            </Animated.View>
          ) : null}

          <Animated.View
            key={`btn-${currentStep}`}
            entering={FadeInDown.duration(800)
              .delay(240)
              .springify()
              .damping(30)
              .mass(3)
              .stiffness(250)}
            style={styles.buttonContainer}
          >
            <Button onPress={handleNext}>
              <Typo size={18} color={colors.neutral900} fontWeight={"600"} style={{ textAlign: "center" }}>
                {screen.buttonText}
              </Typo>
            </Button>
          </Animated.View>
        </View>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingTop: spacingY._7,
  },
  topRow: {
    alignItems: "flex-end",
    paddingRight: spacingX._20,
    minHeight: verticalScale(24),
  },
  loginButton: {
    alignSelf: "flex-end",
  },
  welcomeImage: {
    width: "100%",
    height: verticalScale(280),
    alignSelf: "center",
    marginTop: verticalScale(20),
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: scale(8),
    marginTop: spacingY._15,
  },
  dot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    backgroundColor: colors.neutral600,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: scale(20),
  },
  footer: {
    backgroundColor: colors.neutral900,
    alignItems: "center",
    paddingTop: verticalScale(25),
    paddingBottom: verticalScale(45),
    paddingHorizontal: spacingX._25,
    gap: spacingY._15,
    shadowColor: "white",
    shadowOffset: { width: 0, height: -10 },
    elevation: 10,
    shadowRadius: 25,
    shadowOpacity: 0.15,
  },
  bulletsContainer: {
    alignSelf: "stretch",
    gap: spacingY._10,
    paddingHorizontal: spacingX._5,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  buttonContainer: {
    width: "100%",
    marginTop: spacingY._5,
  },
});

export default WelcomePage;
