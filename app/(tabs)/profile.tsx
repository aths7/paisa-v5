import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import React from "react";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import Header from "@/components/Header";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import { Image } from "expo-image";
import { useAuth } from "@/contexts/authContext";
import { scale, verticalScale } from "@/utils/styling";
import * as Icons from "phosphor-react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { accountOptionType } from "@/types";
import { signOut } from "firebase/auth";
import { auth } from "@/config/firebase";
import { getProfileImage } from "@/services/imageService";

const Profile = () => {
  const { user } = useAuth();
  const router = useRouter();

  const accountOptions: accountOptionType[] = [
    {
      title: "Edit Profile",
      icon: (
        <Icons.User
          size={verticalScale(26)}
          color={colors.white}
          weight="fill"
        />
      ),
      routeName: "/(modals)/profileModal",
      bgColor: "#6366f1",
    },
    // {
    //   title: "Exepnse Categories",
    //   icon: (
    //     <Icons.SquaresFour
    //       size={verticalScale(26)}
    //       color={colors.white}
    //       weight="fill"
    //     />
    //   ),
    //   routeName: "/(modals)/categoryModal",
    //   bgColor: "#10b981",
    // },
    {
      title: "Settings",
      icon: (
        <Icons.GearSix
          size={verticalScale(26)}
          color={colors.white}
          weight="fill"
        />
      ),
      // routeName: "/(modals)/categoryModal",
      bgColor: "#059669",
    },
    {
      title: "Privacy Policy",
      icon: (
        <Icons.Lock
          size={verticalScale(26)}
          color={colors.white}
          weight="fill"
        />
      ),
      // routeName: "/(modals)/categoryModal",
      bgColor: colors.neutral600,
    },
    {
      title: "Logout",
      icon: (
        <Icons.Power
          size={verticalScale(26)}
          color={colors.white}
          weight="fill"
        />
      ),
      // routeName: "/(modals)/categories",
      bgColor: "#e11d48",
    },
  ];

  const handleLogout = async () => {
    await signOut(auth);
  };

  const showLogoutAlert = () => {
    Alert.alert("Confirm", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        onPress: () => console.log("Cancel delete"),
        style: "cancel",
      },
      {
        text: "Logout",
        onPress: () => handleLogout(),
        style: "destructive",
      },
    ]);
  };

  const handlePress = async (item: accountOptionType) => {
    if (item?.title == "Logout") {
      showLogoutAlert();
    }
    if (item?.routeName) router.push(item?.routeName);
  };
  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Header title={"Profile"} />
        <View style={styles.userInfo}>
          {/* avatar */}
          <View>
            <Image
              style={styles.avatar}
              source={getProfileImage(user?.image)}
              contentFit="cover"
              transition={100}
            />
            {/* <TouchableOpacity style={styles.editIcon}>
              <Icons.Pencil
                size={verticalScale(20)}
                color={colors.neutral800}
              />
            </TouchableOpacity> */}
          </View>

          {/* name, email */}
          <View style={styles.nameContainer}>
            <Typo size={24} fontWeight={"600"} color={colors.neutral100}>
              {user?.name || " "}
            </Typo>
            <Typo size={15} color={colors.neutral400}>
              {user?.email}
            </Typo>
          </View>
        </View>

        {/* account options */}
        <View style={styles.accountOptions}>
          {accountOptions.map((item, index) => {
            return (
              <Animated.View
                key={index.toString()}
                entering={FadeInDown.delay(index * 50)
                  .springify()
                  .damping(30)
                  .mass(3)
                  .stiffness(250)}
                style={styles.listItem}
              >
                <TouchableOpacity
                  style={styles.flexRow}
                  onPress={() => handlePress(item)}
                >
                  {/* icon */}
                  <View
                    style={[
                      styles.listIcon,
                      { backgroundColor: item?.bgColor },
                    ]}
                  >
                    {item.icon && item.icon}
                  </View>
                  <Typo size={16} style={{ flex: 1 }} fontWeight={"500"}>
                    {item.title}
                  </Typo>
                  <Icons.CaretRight
                    size={verticalScale(20)}
                    weight="bold"
                    color={colors.white}
                  />
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </ScreenWrapper>
  );
};

export default Profile;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacingX._20,
  },
  userInfo: {
    marginTop: verticalScale(30),
    alignItems: "center",
    gap: spacingY._15,
  },
  avatarContainer: {
    position: "relative",
    alignSelf: "center",
  },
  avatar: {
    alignSelf: "center",
    backgroundColor: colors.neutral300,
    height: verticalScale(135),
    width: verticalScale(135),
    borderRadius: 200,
    // overflow: "hidden",
    // position: "relative",
  },
  editIcon: {
    position: "absolute",
    bottom: 5,
    right: 8,
    borderRadius: 50,
    backgroundColor: colors.neutral100,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
    padding: 5,
  },
  nameContainer: {
    gap: verticalScale(4),
    alignItems: "center",
  },
  listIcon: {
    height: verticalScale(44),
    width: verticalScale(44),
    backgroundColor: colors.neutral500,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius._15,
    borderCurve: "continuous",
  },
  listItem: {
    marginBottom: verticalScale(17),
  },
  accountOptions: {
    marginTop: spacingY._35,
  },
  flexRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacingX._10,
  },
});
