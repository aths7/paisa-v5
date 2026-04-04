import { StyleSheet, TouchableOpacity, View } from "react-native";
import React, { useRef } from "react";
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
import PaisaLoader from "./PaisaLoader";
import { Timestamp } from "firebase/firestore";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { FlashList } from "@shopify/flash-list";
import { useAuth } from "@/contexts/authContext";
import { getEmotionColor } from "@/app/(modals)/emotionsModal";
import ReanimatedSwipeable, { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import { createOrUpdateTransaction, deleteTransaction } from "@/services/transactionService";
import * as Haptics from "expo-haptics";

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
          <PaisaLoader />
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
  const { user } = useAuth();
  const swipeableRef = useRef<SwipeableMethods>(null);
  const isDuplicating = useRef(false);

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

  const handleDuplicate = async () => {
    if (isDuplicating.current) return;
    isDuplicating.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    swipeableRef.current?.close();
    const { id, ...rest } = item;
    await createOrUpdateTransaction({ ...rest, date: Timestamp.fromDate(new Date()) });
    isDuplicating.current = false;
  };

  const handleDelete = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    swipeableRef.current?.close();
    await deleteTransaction(item.id!, item.walletId);
  };

  const renderRightActions = (_progress: any, _translation: any, _swipeableMethods: SwipeableMethods) => (
    <View style={styles.rightActions}>
      <TouchableOpacity
        style={[styles.actionButton, styles.duplicateButton]}
        onPress={handleDuplicate}
        activeOpacity={0.8}
      >
        <Icons.Copy size={verticalScale(20)} weight="fill" color={colors.white} />
        <Typo size={11} fontWeight="600" color={colors.white}>Duplicate</Typo>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionButton, styles.deleteButton]}
        onPress={handleDelete}
        activeOpacity={0.8}
      >
        <Icons.Trash size={verticalScale(20)} weight="fill" color={colors.white} />
        <Typo size={11} fontWeight="600" color={colors.white}>Delete</Typo>
      </TouchableOpacity>
    </View>
  );

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50)
        .springify()
        .damping(30)
        .mass(3)
        .stiffness(250)}
      style={{ marginBottom: spacingY._12 }}
    >
      <ReanimatedSwipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={40}
        overshootRight={false}
        friction={2}
      >
        <TouchableOpacity
          style={[
            styles.row,
            {
              borderLeftWidth: 3,
              borderLeftColor: getEmotionColor(item.emotion, user?.emotionColors, user?.emotionTags),
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
              <View
                style={[
                  styles.emotionBadge,
                  { backgroundColor: getEmotionColor(item.emotion, user?.emotionColors, user?.emotionTags) + "33" },
                ]}
              >
                <Typo
                  size={11}
                  fontWeight="600"
                  color={getEmotionColor(item.emotion, user?.emotionColors, user?.emotionTags)}
                >
                  {item.emotion.charAt(0).toUpperCase() + item.emotion.slice(1)}
                </Typo>
              </View>
            )}
          </View>
          <View style={styles.amountDate}>
            <Typo
              fontWeight={"500"}
              color={colors.green}
            >{`₹${formatIndianNumber(Number(item?.amount))}`}</Typo>
            <Typo size={13} color={colors.neutral400}>
              {date}
            </Typo>
          </View>
        </TouchableOpacity>
      </ReanimatedSwipeable>
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

    // list with background
    backgroundColor: colors.neutral800,
    padding: spacingY._10,
    paddingHorizontal: spacingY._10,
    borderRadius: radius._17,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 0,
    gap: scale(6),
    paddingLeft: scale(8),
  },
  actionButton: {
    width: scale(72),
    justifyContent: "center",
    alignItems: "center",
    gap: verticalScale(4),
    borderRadius: radius._17,
  },
  duplicateButton: {
    backgroundColor: colors.primaryLight,
  },
  deleteButton: {
    backgroundColor: colors.rose,
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
    backgroundColor: "transparent",
    borderRadius: 99,
    paddingHorizontal: scale(7),
    paddingVertical: 2,
    marginTop: 2,
  },
});
