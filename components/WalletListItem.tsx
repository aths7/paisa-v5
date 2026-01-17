import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React from "react";
import { WalletType } from "@/types";
import { Image } from "expo-image";
import { scale, verticalScale } from "@/utils/styling";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Typo from "./Typo";
import * as Icons from "phosphor-react-native";
import { Router, useRouter } from "expo-router";
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
          <Image
            style={{ flex: 1 }}
            source={item.image}
            contentFit="cover"
            transition={100}
          />
        </View>

        <View style={styles.nameContainer}>
          <Typo size={16}>{item.name}</Typo>
          <Typo size={14} color={colors.neutral400}>
            ₹{item?.amount?.toFixed(2) || 0}
          </Typo>
        </View>

        {/* <TouchableOpacity> */}
        <Icons.CaretRight
          size={verticalScale(20)}
          weight="bold"
          color={colors.white}
        />
        {/* </TouchableOpacity> */}
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
    // padding: spacingX._15,
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
    gap: 2,
    marginLeft: spacingX._10,
  },
});
