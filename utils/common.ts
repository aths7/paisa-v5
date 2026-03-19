/**
 * Formats a number using Indian locale (e.g. 1,00,000.00).
 * Use `decimals: 0` for whole numbers.
 */
export const formatIndianNumber = (value: number, decimals = 2): string =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

/** Returns "₹1,00,000.00" */
export const formatRupees = (value: number, decimals = 2): string =>
  `₹${formatIndianNumber(value, decimals)}`;

/**
 * Returns a compact rupee string suited for tight UI (cards, badges).
 * ≥ 1 Cr  → "₹1.20Cr"
 * ≥ 1 L   → "₹4.99L"
 * ≥ 1 K   → "₹24.1K"
 * < 1 K   → "₹850"
 */
export const formatCompact = (value: number): string => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${formatIndianNumber(value, 0)}`;
};

export const getLast7Days = () => {
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const result = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    result.push({
      day: daysOfWeek[date.getDay()],
      date: date.toISOString().split("T")[0],
      income: 0,
      expense: 0,
    });
  }
  return result.reverse();
  // returns an array of all the previous 7 days
};

export const getLast12Months = () => {
  const monthsOfYear = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const result = [];

  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);

    const monthName = monthsOfYear[date.getMonth()];
    const shortYear = date.getFullYear().toString().slice(-2);
    const formattedMonthYear = `${monthName} ${shortYear}`; // Jan 24, Feb 25
    const formattedDate = date.toISOString().split("T")[0];

    result.push({
      month: formattedMonthYear,
      fullDate: formattedDate,
      income: 0,
      expense: 0,
    });
  }

  // return result;
  return result.reverse();
};

export const getYearsRange = (startYear: number, endYear: number): any => {
  const result = [];
  for (let year = startYear; year <= endYear; year++) {
    result.push({
      year: year.toString(),
      fullDate: `01-01-${year}`,
      income: 0,
      expense: 0,
    });
  }
  // return result;
  return result.reverse();
};
