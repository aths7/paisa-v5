import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import React, { useEffect, useState } from "react";
import ScreenWrapper from "@/components/ScreenWrapper";
import Typo from "@/components/Typo";
import { BarChart } from "react-native-gifted-charts";
import { colors, radius, spacingX, spacingY } from "@/constants/theme";
import Loading from "@/components/Loading";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { scale, verticalScale } from "@/utils/styling";
import Header from "@/components/Header";
import * as Icons from "phosphor-react-native";
import { useAuth } from "@/contexts/authContext";
import {
  fetchMonthlyStats,
  fetchWeeklyStats,
  fetchYearlyStats,
} from "@/services/transactionService";
import TransactionList from "@/components/TransactionList";

const { width: screenWidth } = Dimensions.get("window");

const barData = [
  {
    value: 40,
    label: "Mon",
    spacing: scale(4),
    labelWidth: scale(30),
    frontColor: colors.primary,
    // topLabelComponent: () => (
    //   <Typo size={10} style={{ marginBottom: 4 }} fontWeight={"bold"}>
    //     50
    //   </Typo>
    // ),
  },
  {
    value: 20,
    frontColor: colors.rose,
  },

  {
    value: 50,
    label: "Tue",
    spacing: scale(4),
    labelWidth: scale(30),
    frontColor: colors.primary,
  },
  { value: 40, frontColor: colors.rose },
  {
    value: 75,
    label: "Wed",
    spacing: scale(4),
    labelWidth: scale(30),
    frontColor: colors.primary,
  },
  { value: 25, frontColor: colors.rose },
  {
    value: 30,
    label: "Thu",
    spacing: scale(4),
    labelWidth: scale(30),
    frontColor: colors.primary,
  },
  { value: 20, frontColor: colors.rose },
  {
    value: 60,
    label: "Fri",
    spacing: scale(4),
    labelWidth: scale(30),
    frontColor: colors.primary,
  },
  { value: 40, frontColor: colors.rose },
  {
    value: 65,
    label: "Sat",
    spacing: scale(4),
    labelWidth: scale(30),
    frontColor: colors.primary,
  },
  { value: 30, frontColor: colors.rose },
  {
    value: 65,
    label: "Sun",
    spacing: scale(4),
    labelWidth: scale(30),
    frontColor: colors.primary,
  },
  { value: 30, frontColor: colors.rose },
  // {
  //   value: 65,
  //   label: "Sun",
  //   spacing: scale(4),
  //   labelWidth: scale(30),
  //   frontColor: colors.primary,
  // },
  // { value: 30, frontColor: colors.rose },
];

const Analytics = () => {
  const [chartLoading, setChartLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [chartData, setChartData] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (activeIndex == 0) {
      getWeeklyStats();
    }
    if (activeIndex == 1) {
      getMonthlyStats();
    }
    if (activeIndex == 2) {
      getYearlyStats();
    }
  }, [activeIndex]);

  const getWeeklyStats = async () => {
    setChartLoading(true);
    let res = await fetchWeeklyStats(user?.uid as string);
    setChartLoading(false);
    if (res.success) {
      setChartData(res.data.stats);
      setTransactions(res.data.transactions);
    } else {
      Alert.alert("Error", res.msg);
    }
  };

  const getMonthlyStats = async () => {
    setChartLoading(true);
    let res = await fetchMonthlyStats(user?.uid as string);
    setChartLoading(false);
    if (res.success) {
      setChartData(res.data.stats);
      setTransactions(res.data.transactions);
    } else {
      Alert.alert("Error", res.msg);
    }
  };

  const getYearlyStats = async () => {
    setChartLoading(true);
    let res = await fetchYearlyStats(user?.uid as string);
    setChartLoading(false);
    if (res.success) {
      setChartData(res.data.stats);
      setTransactions(res.data.transactions);
    } else {
      Alert.alert("Error", res.msg);
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* segments */}
        <View style={styles.header}>
          <Header
            title="Statistics"
            // rightIcon={
            //   <TouchableOpacity style={styles.searchIcon}>
            //     <Icons.MagnifyingGlass
            //       size={verticalScale(22)}
            //       color={colors.white}
            //     />
            //   </TouchableOpacity>
            // }
          />
        </View>
        <ScrollView
          contentContainerStyle={{
            gap: spacingY._20,
            paddingTop: spacingY._5,
            paddingBottom: verticalScale(100),
          }}
          showsVerticalScrollIndicator={false}
        >
          <SegmentedControl
            values={["Weekly", "Monthly", "Yearly"]}
            selectedIndex={activeIndex}
            tintColor={colors.neutral200}
            backgroundColor={colors.neutral800}
            appearance="dark"
            activeFontStyle={styles.segmentFontStyle}
            fontStyle={{ ...styles.segmentFontStyle, color: colors.white }}
            style={styles.segmentStyle}
            onChange={(event) =>
              setActiveIndex(event.nativeEvent.selectedSegmentIndex)
            }
          />

          <View style={styles.chartContainer}>
            {chartData.length > 0 ? (
              <BarChart
                data={chartData}
                barWidth={scale(12)}
                spacing={[1, 2].includes(activeIndex) ? scale(25) : scale(16)}
                // width={screenWidth - spacingX._30}
                roundedTop
                roundedBottom
                hideRules
                yAxisLabelPrefix="$"
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisLabelWidth={
                  [1, 2].includes(activeIndex) ? scale(38) : scale(35)
                }
                // hideYAxisText
                yAxisTextStyle={{ color: colors.neutral350 }}
                xAxisLabelTextStyle={{
                  color: colors.neutral350,
                  fontSize: verticalScale(12),
                }}
                noOfSections={3}
                minHeight={5}
                // maxValue={100}
                // animationDuration={500}
                // isAnimated={true}
              />
            ) : (
              <View style={styles.noChart} />
            )}

            {chartLoading && (
              <View style={styles.chartLoadingContainer}>
                <Loading color="white" />
              </View>
            )}
          </View>

          {/* transactions */}
          <View>
            <TransactionList
              title="Transactions"
              emptyListMessage="No transactions found"
              data={transactions}
            />
          </View>
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
};

export default Analytics;

const styles = StyleSheet.create({
  chartContainer: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  chartLoadingContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: radius._12,
    backgroundColor: "rgba(0,0,0, 0.6)",
  },
  header: {},
  noChart: {
    backgroundColor: "rgba(0,0,0, 0.6)",
    height: verticalScale(210),
  },
  searchIcon: {
    backgroundColor: colors.neutral700,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 100,
    height: verticalScale(35),
    width: verticalScale(35),
    borderCurve: "continuous",
  },
  segmentStyle: {
    height: scale(37),
    borderRadius: radius._15,
  },
  segmentFontStyle: {
    fontSize: verticalScale(13),
    fontWeight: "bold",
    color: colors.black,
  },
  container: {
    paddingHorizontal: spacingX._20,
    paddingVertical: spacingY._5,
    gap: spacingY._10,
  },
});
