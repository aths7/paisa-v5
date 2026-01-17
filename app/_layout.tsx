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
    <Stack screenOptions={{ headerShown: false }} initialRouteName="index">
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
