import React from "react";
import { Tabs } from "expo-router";
import CustomTabs from "@/components/CustomTabs";
import { StyleSheet } from "react-native";

const _layout = () => {
  return (
    <Tabs
      tabBar={(props) => <CustomTabs {...props} />}
      screenOptions={{ headerShown: false, animation: "none" }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="statistics" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
};

export default _layout;

const styles = StyleSheet.create({});
