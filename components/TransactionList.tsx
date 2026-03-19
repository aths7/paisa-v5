import { StyleSheet, TouchableOpacity, View } from "react-native";
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
import { scale, verticalScale } from "@/utils/styling";
import { formatIndianNumber } from "@/utils/common";
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
    const params: Record<string, string> = {
      id: item.id || "",
      type: item.type,
      amount: item.amount.toString(),
      date: (item.date as Timestamp)?.toDate()?.toISOString(),
      walletId: item.walletId || "",
    };

    if (item.category) params.category = item.category;
    if (item.description) params.description = item.description;
    if (item.image) params.image = item.image;
    if (item.uid) params.uid = item.uid;
    if (item.purchaseStyle) params.purchaseStyle = item.purchaseStyle;
    if (item.emotion) params.emotion = item.emotion;

    router.push({
      pathname: "/(modals)/transactionModal",
      params,
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
  const defaultExpenseCategory = {
    label: "Other",
    value: "other",
    icon: Icons.Tag,
    bgColor: colors.neutral500,
  };
  let category =
    item?.type == "income"
      ? incomeCategory
      : expenseCategories[item.category!] ?? defaultExpenseCategory;
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
      <TouchableOpacity
        style={[
          styles.row,
          {
            borderLeftWidth: 3,
            borderLeftColor: item?.type === "income" ? colors.primary : colors.rose,
          },
        ]}
        onPress={() => handleClick(item)}
      >
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
          {item?.emotion && (
            <View style={styles.emotionBadge}>
              <Typo size={11} fontWeight="600" color="#a78bfa">
                {item.emotion.charAt(0).toUpperCase() + item.emotion.slice(1)}
              </Typo>
            </View>
          )}
        </View>
        <View style={styles.amountDate}>
          <Typo
            fontWeight={"500"}
            color={item?.type == "income" ? colors.primary : colors.rose}
          >{`${item?.type == "income" ? "+₹" : "-₹"}${formatIndianNumber(Number(item?.amount))}`}</Typo>
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
  emotionBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#a78bfa22",
    borderRadius: 99,
    paddingHorizontal: scale(7),
    paddingVertical: 2,
    marginTop: 2,
  },
});
