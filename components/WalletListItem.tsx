import { StyleSheet, TouchableOpacity, View } from "react-native";
import React from "react";
import { WalletType } from "@/types";
import { Image } from "expo-image";
import { verticalScale } from "@/utils/styling";
import { colors, radius, spacingX } from "@/constants/theme";
import Typo from "./Typo";
import * as Icons from "phosphor-react-native";
import { Router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";

const WalletListItem = ({
  item,
  index,
  router,
}: {
  item: WalletType;
  index: number;
  router: Router;
}) => {
  const handleOpen = () => {
    router.push({
      pathname: "/(modals)/walletModal",
      params: {
        id: item?.id,
        name: item?.name,
        image: item?.image,
      },
    });
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50)
        .springify()
        .damping(30)
        .mass(3)
        .stiffness(250)}
    >
      <TouchableOpacity style={styles.container} onPress={handleOpen}>
        <View style={styles.imageContainer}>
          {item.image && typeof item.image === "string" && !item.image.startsWith("http") ? (
            <View style={styles.emojiContainer}>
              <Typo size={26}>{item.image}</Typo>
            </View>
          ) : (
            <Image
              style={{ flex: 1 }}
              source={item.image}
              contentFit="cover"
              transition={100}
            />
          )}
        </View>

        <View style={styles.nameContainer}>
          <Typo size={16}>{item.name}</Typo>
        </View>

        <Icons.CaretRight
          size={verticalScale(20)}
          weight="bold"
          color={colors.white}
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

export default WalletListItem;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: verticalScale(17),
  },
  imageContainer: {
    height: verticalScale(45),
    width: verticalScale(45),
    borderWidth: 1,
    borderColor: colors.neutral600,
    borderRadius: radius._12,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  nameContainer: {
    flex: 1,
    marginLeft: spacingX._10,
  },
  emojiContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
