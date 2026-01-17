import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import React from "react";
import { Href, Router, useRouter } from "expo-router";
import ScreenWrapper from "@/components/ScreenWrapper";
import { StatusBar } from "expo-status-bar";
import { scale, verticalScale } from "@/utils/styling";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Typo from "@/components/Typo";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import Button from "@/components/Button";
import { useAuth } from "@/contexts/authContext";
import Loading from "@/components/Loading";

const WelcomePage = () => {
  const router = useRouter();
  return (
    <ScreenWrapper>
      <StatusBar style="light" />
      <View style={styles.container}>
        {/* login & image */}
        <View>
          <TouchableOpacity
            onPress={() => router.push("/(auth)/login")}
            style={styles.loginButton}
          >
            <Typo fontWeight={"500"}>Sign in</Typo>
          </TouchableOpacity>

          <Animated.Image
            entering={FadeIn.duration(500)}
            source={require("../../assets/images/welcome.png")}
            style={styles.welcomeImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.footer}>
          <Animated.View
            entering={FadeInDown.duration(1000)
              .springify()
              .damping(30)
              .mass(3)
              .stiffness(250)}
            style={{ alignItems: "center" }}
          >
            <Typo size={30} fontWeight={"800"}>
              Always take control
            </Typo>
            <Typo size={30} fontWeight={"800"}>
              of your finances
            </Typo>
          </Animated.View>
          <Animated.View
            entering={FadeInDown.duration(1000)
              .delay(100)
              .springify()
              .damping(30)
              .mass(3)
              .stiffness(250)}
            style={{ alignItems: "center", gap: 2 }}
          >
            <Typo size={17} color={colors.textLighter}>
              Finances must be arranged to set a better
            </Typo>
            <Typo size={17} color={colors.textLighter}>
              lifestyle in future
            </Typo>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(1000)
              .delay(200)
              .springify()
              .damping(30)
              .mass(3)
              .stiffness(250)}
            style={styles.buttonContainer}
          >
            <Button onPress={() => router.push("/(auth)/register")}>
              <Typo size={22} color={colors.neutral900} fontWeight={"600"}>
                Get Started
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
  welcomeImage: {
    width: "100%",
    height: verticalScale(300),
    alignSelf: "center",

    marginTop: verticalScale(100),
  },
  loginButton: {
    alignSelf: "flex-end",
    marginRight: spacingX._20,
  },
  footer: {
    backgroundColor: colors.neutral900,
    alignItems: "center",
    paddingTop: verticalScale(30),
    paddingBottom: verticalScale(45),
    gap: spacingY._20,
    shadowColor: "white",
    shadowOffset: { width: 0, height: -10 },
    elevation: 10,
    shadowRadius: 25,
    shadowOpacity: 0.15,
  },
  buttonContainer: {
    width: "100%",
    paddingHorizontal: spacingX._25,
  },
});

export default WelcomePage;
