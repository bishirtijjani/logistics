import React, { useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { useTheme } from "../../theme";

/**
 * 7-day bar chart for the earnings dashboard. Renders the LAST 7 days
 * (today + previous 6) in chronological order. Days with no earnings show
 * a faint placeholder bar so the timeline is always 7 ticks wide.
 *
 * `daily` is the trailing-30-day series from the server. We pluck the last
 * 7 (in chronological order) by date, filling missing days with zero.
 *
 * Tapping a bar invokes `onSelectDay(yyyyMmDd)` so the dashboard can drill
 * into that day's deliveries.
 */
const CHART_HEIGHT = 132;
const BAR_GAP = 8;

function formatYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayLabel(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][date.getDay()];
}

export default function EarningsChart({ daily, selectedDate, onSelectDay }) {
  const { tokens } = useTheme();

  const buckets = useMemo(() => {
    const map = new Map();
    for (const row of daily || []) {
      if (row?.date) map.set(row.date, row);
    }
    const out = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = formatYmd(d);
      const row = map.get(key);
      out.push({
        date: key,
        amount: Number(row?.amount || 0),
        count: Number(row?.count || 0),
      });
    }
    return out;
  }, [daily]);

  const maxAmount = useMemo(() => {
    return Math.max(1, ...buckets.map((b) => b.amount));
  }, [buckets]);

  // We approximate width per bar with flex layout below; SVG handles
  // proportional heights only. This way the chart scales to any container
  // width without measuring.
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`7-day earnings chart, highest day ₦${Math.round(maxAmount).toLocaleString("en-NG")}`}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: CHART_HEIGHT, gap: BAR_GAP }}>
        {buckets.map((b) => {
          const pct = maxAmount > 0 ? b.amount / maxAmount : 0;
          const barH = Math.max(2, Math.round(pct * (CHART_HEIGHT - 24)));
          const isSelected = selectedDate === b.date;
          return (
            <TouchableOpacity
              key={b.date}
              onPress={() => onSelectDay?.(b.date)}
              accessibilityRole="button"
              accessibilityLabel={`${dayLabel(b.date)}, ₦${Math.round(b.amount).toLocaleString("en-NG")} from ${b.count} ${b.count === 1 ? "delivery" : "deliveries"}`}
              accessibilityState={{ selected: isSelected }}
              activeOpacity={0.7}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "flex-end",
                height: CHART_HEIGHT,
              }}
            >
              <Svg width="100%" height={barH} preserveAspectRatio="none" viewBox={`0 0 10 ${barH}`}>
                <Rect
                  x="0"
                  y="0"
                  width="10"
                  height={barH}
                  rx="2"
                  ry="2"
                  fill={b.amount > 0 ? (isSelected ? tokens.brand.strong : tokens.brand.default) : tokens.border.strong}
                  opacity={b.amount > 0 ? 1 : 0.45}
                />
              </Svg>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", marginTop: 8, gap: BAR_GAP }}>
        {buckets.map((b) => (
          <Text
            key={b.date}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 11,
              fontWeight: "700",
              color: selectedDate === b.date ? tokens.brand.strong : tokens.text.muted,
            }}
          >
            {dayLabel(b.date)}
          </Text>
        ))}
      </View>
    </View>
  );
}

