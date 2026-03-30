import { auth } from "@/config/firebase";
import { AuthProvider, useAuth } from "@/contexts/authContext";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import "react-native-reanimated";

// Prevent the splash screen from auto-hiding before asset loading is complete.
// SplashScreen.preventAutoHideAsync();

function StackLayout() {
  const router = useRouter();
  const { setUser, updateUserData } = useAuth();

  // const [loaded] = useFonts({
  //   SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  // });

  // useEffect(() => {
  //   if (loaded) {
  //     SplashScreen.hideAsync();
  //   }
  // }, [loaded]);

  // useEffect(() => {
  //   logout();
  // }, []);

  // const logout = async () => {
  //   await signOut(auth);
  // };

  // if (!loaded) {
  //   return null;
  // }

  return (
    <Stack screenOptions={{ headerShown: false, animationDuration: 250 }} initialRouteName="index">
      <Stack.Screen
        name="(modals)/transactionModal"
        options={{
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="(modals)/walletModal"
        options={{
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="(modals)/categoryModal"
        options={{
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="(modals)/profileModal"
        options={{
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="(modals)/searchModal"
        options={{
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="(modals)/settingsModal"
        options={{
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="(modals)/privacyPolicyModal"
        options={{
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="(modals)/emotionsModal"
        options={{
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="(modals)/streakCelebrationModal"
        options={{
          presentation: "fullScreenModal",
          gestureEnabled: false,
          animation: "fade",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="(modals)/streakDetailsModal"
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="(modals)/debtModal"
        options={{
          presentation: "modal",
          animationDuration: 250,
        }}
      />
      <Stack.Screen
        name="(modals)/debtEditModal"
        options={{
          presentation: "modal",
          animationDuration: 250,
        }}
      />
      <Stack.Screen
        name="debt/[id]"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StackLayout />
    </AuthProvider>
  );
}
