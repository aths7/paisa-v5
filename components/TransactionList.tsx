import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import React from "react";
import Typo from "./Typo";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import {
  TransactionItemProps,
  TransactionListType,
  TransactionType,
} from "@/types";
import * as Icons from "phosphor-react-native";
import { expenseCategories, incomeCategory } from "@/constants/data";
import { verticalScale } from "@/utils/styling";
import Loading from "./Loading";
import { Timestamp } from "firebase/firestore";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { FlashList } from "@shopify/flash-list";

const TransactionList = ({
  data,
  title,
  loading,
  emptyListMessage,
}: TransactionListType) => {
  //   console.log("got data: ", data);
  const router = useRouter();

  const handleClick = (item: TransactionType) => {
    console.log("opeingin: ", item.image);
    router.push({
      pathname: "/(modals)/transactionModal",
      params: {
        id: item.id,
        type: item.type,
        amount: item.amount.toString(), // Convert number to string
        category: item.category,
        date: (item.date as Timestamp)?.toDate()?.toISOString(), // Convert Date to string
        description: item.description,
        image: item?.image,
        uid: item.uid,
        walletId: item.walletId,
      },
    });
  };
  return (
    <View style={styles.container}>
      {title && (
        <Typo fontWeight={"500"} size={20}>
          {title}
        </Typo>
      )}

      <View style={styles.list}>
        <FlashList
          data={data}
          renderItem={({ item, index }) => (
            <TransactionItem
              handleClick={handleClick}
              item={item}
              // key={item?.id}
              index={index}
            />
          )}
        // estimatedItemSize={60}
        />
        {/* {data.map((item, index) => (
          <TransactionItem
            handleClick={handleClick}
            item={item}
            key={item?.id}
            index={index}
          />
        ))} */}
      </View>

      {!loading && data.length == 0 && (
        <Typo
          size={15}
          color={colors.neutral400}
          style={{ textAlign: "center", marginTop: spacingY._15 }}
        >
          {emptyListMessage}
        </Typo>
      )}
      {loading && (
        <View style={{ top: verticalScale(100) }}>
          <Loading />
        </View>
      )}
    </View>
  );
};

const TransactionItem = ({
  item,
  index,
  handleClick,
}: TransactionItemProps) => {
  let category =
    item?.type == "income" ? incomeCategory : expenseCategories[item.category!];
  const IconComponent = category.icon;

  let date = (item?.date as Timestamp)?.toDate()?.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

  //   console.log("date: ", date);
  // string category.icon will match one of the keys from the Icons object, which is a valid icon component.
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50)
        .springify()
        .damping(30)
        .mass(3)
        .stiffness(250)}
    >
      <TouchableOpacity style={styles.row} onPress={() => handleClick(item)}>
        <View style={[styles.icon, { backgroundColor: category.bgColor }]}>
          {IconComponent && (
            <IconComponent
              size={verticalScale(25)}
              weight="fill"
              color={colors.white}
            />
          )}
        </View>

        <View style={styles.categoryDes}>
          <Typo size={17}>{category.label}</Typo>
          <Typo
            size={12}
            color={colors.neutral400}
            textProps={{ numberOfLines: 1 }}
          >
            {item?.description}
          </Typo>
        </View>
        <View style={styles.amountDate}>
          <Typo
            fontWeight={"500"}
            color={item?.type == "income" ? colors.primary : colors.rose}
          >{`${item?.type == "income" ? "+ ₹" : "- ₹"}${item?.amount}`}</Typo>
          <Typo size={13} color={colors.neutral400}>
            {date}
          </Typo>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default TransactionList;

const styles = StyleSheet.create({
  container: {
    gap: spacingY._17,
    // flex: 1,
    // backgroundColor: "red",
  },
  list: {
    minHeight: 3,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacingX._12,
    marginBottom: spacingY._12,

    // list with background
    backgroundColor: colors.neutral800,
    padding: spacingY._10,
    paddingHorizontal: spacingY._10,
    borderRadius: radius._17,
  },
  icon: {
    height: verticalScale(44),
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: radius._12,
    borderCurve: "continuous",
  },
  categoryDes: {
    flex: 1,
    gap: 2.5,
  },
  amountDate: {
    alignItems: "flex-end",
    gap: 3,
  },
});
