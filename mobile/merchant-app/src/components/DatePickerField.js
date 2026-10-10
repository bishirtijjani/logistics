import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";

/**
 * DatePickerField - a pure-JS, theme-aware calendar date picker.
 *
 * No native modules, so it runs identically in Expo Go, dev builds and
 * production on both platforms. Replaces the old "type YYYY-MM-DD by hand"
 * text inputs across onboarding, KYC and profile.
 *
 * Value contract is a `"YYYY-MM-DD"` string (or "" / null when unset) so it's
 * a drop-in for the fields that previously stored that exact format.
 *
 * Props:
 *   label, icon            - presentation
 *   value                  - "YYYY-MM-DD" | "" | null
 *   onChange(next)         - called with "YYYY-MM-DD"
 *   error                  - error string shown below the field
 *   placeholder            - shown when no value (default "Select date")
 *   minDate / maxDate      - Date | "YYYY-MM-DD"; days outside are disabled
 *   disabled               - non-interactive
 */

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const pad = (n) => String(n).padStart(2, "0");

/** Parse "YYYY-MM-DD" → {y, m, d} (m is 1-12), or null. */
function parse(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/** Coerce a Date | "YYYY-MM-DD" | null into {y, m, d} or null. */
function toParts(input) {
  if (!input) return null;
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return { y: input.getFullYear(), m: input.getMonth() + 1, d: input.getDate() };
  }
  return parse(input);
}

const fmt = ({ y, m, d }) => `${y}-${pad(m)}-${pad(d)}`;
const cmp = ({ y, m, d }) => y * 10000 + m * 100 + d;
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
const firstWeekday = (y, m) => new Date(y, m - 1, 1).getDay();

function todayParts() {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

function clampParts(parts, min, max) {
  if (min && cmp(parts) < cmp(min)) return min;
  if (max && cmp(parts) > cmp(max)) return max;
  return parts;
}

export default function DatePickerField({
  label,
  icon = "calendar-outline",
  value,
  onChange,
  error,
  placeholder = "Select date",
  minDate,
  maxDate,
  disabled = false,
}) {
  const { tokens } = useTheme();
  const min = useMemo(() => toParts(minDate), [minDate]);
  const max = useMemo(() => toParts(maxDate), [maxDate]);
  const selected = useMemo(() => parse(value), [value]);

  const [open, setOpen] = useState(false);
  const [yearMode, setYearMode] = useState(false);
  // The month currently shown in the grid.
  const [view, setView] = useState(() =>
    clampParts(selected || todayParts(), min, max),
  );
  // Day highlighted in the open modal (committed only on "Done").
  const [draft, setDraft] = useState(selected);

  const openModal = () => {
    if (disabled) return;
    const start = clampParts(selected || todayParts(), min, max);
    setView({ y: start.y, m: start.m, d: start.d });
    setDraft(selected);
    setYearMode(false);
    setOpen(true);
  };

  const confirm = () => {
    if (draft) onChange?.(fmt(draft));
    setOpen(false);
  };

  // Year bounds for the year picker.
  const today = todayParts();
  const minYear = min ? min.y : today.y - 100;
  const maxYear = max ? max.y : today.y + 30;
  const years = useMemo(() => {
    const out = [];
    for (let yr = maxYear; yr >= minYear; yr--) out.push(yr);
    return out;
  }, [minYear, maxYear]);

  const isDisabledDay = (d) => {
    const p = { y: view.y, m: view.m, d };
    if (min && cmp(p) < cmp(min)) return true;
    if (max && cmp(p) > cmp(max)) return true;
    return false;
  };

  const goMonth = (delta) => {
    let m = view.m + delta;
    let y = view.y;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setView({ y, m, d: 1 });
  };

  // Disable month arrows when the entire neighbouring month is out of range.
  const prevDisabled = min && cmp({ y: view.y, m: view.m, d: 1 }) <= cmp(min);
  const nextDisabled =
    max && cmp({ y: view.y, m: view.m, d: daysInMonth(view.y, view.m) }) >= cmp(max);

  // ── Trigger field ──────────────────────────────────────────────────────────
  const display = selected
    ? `${selected.d} ${MONTHS_SHORT[selected.m - 1]} ${selected.y}`
    : placeholder;

  const triggerBorder = error
    ? tokens.status.error
    : tokens.border.default;

  // ── Calendar grid cells ─────────────────────────────────────────────────────
  const cells = useMemo(() => {
    const lead = firstWeekday(view.y, view.m);
    const total = daysInMonth(view.y, view.m);
    const arr = [];
    for (let i = 0; i < lead; i++) arr.push(null);
    for (let d = 1; d <= total; d++) arr.push(d);
    return arr;
  }, [view.y, view.m]);

  return (
    <View style={{ marginBottom: 20 }}>
      {label ? (
        <Text style={{ fontSize: 12, fontWeight: "600", marginBottom: 6, marginLeft: 2, color: tokens.text.muted }}>
          {label}
        </Text>
      ) : null}

      <TouchableOpacity
        onPress={openModal}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}. ${display}` : display}
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: tokens.bg.surface,
          paddingHorizontal: 16,
          paddingVertical: 16,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: triggerBorder,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Ionicons
          name={icon}
          size={18}
          color={selected ? tokens.brand.default : tokens.text.placeholder}
          style={{ marginRight: 10 }}
        />
        <Text
          style={{
            flex: 1,
            fontSize: 16,
            fontWeight: "500",
            color: selected ? tokens.text.primary : tokens.text.placeholder,
          }}
        >
          {display}
        </Text>
        <Ionicons name="chevron-down" size={18} color={tokens.text.muted} />
      </TouchableOpacity>

      {error ? (
        <Text style={{ fontSize: 12, marginTop: 6, marginLeft: 2, fontWeight: "500", color: tokens.status.error }}>
          {error}
        </Text>
      ) : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: tokens.overlay.scrim, justifyContent: "flex-end" }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: tokens.bg.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 28,
            }}
          >
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => goMonth(-1)}
                disabled={yearMode || prevDisabled}
                hitSlop={10}
                style={{ padding: 6, opacity: yearMode || prevDisabled ? 0.3 : 1 }}
                accessibilityLabel="Previous month"
              >
                <Ionicons name="chevron-back" size={22} color={tokens.text.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setYearMode((v) => !v)}
                style={{ flex: 1, alignItems: "center" }}
                accessibilityRole="button"
              >
                <Text style={{ fontSize: 16, fontWeight: "800", color: tokens.text.primary }}>
                  {MONTHS[view.m - 1]} {view.y}
                </Text>
                <Text style={{ fontSize: 11, color: tokens.brand.default, fontWeight: "600", marginTop: 2 }}>
                  {yearMode ? "Pick a month" : "Tap to change year"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => goMonth(1)}
                disabled={yearMode || nextDisabled}
                hitSlop={10}
                style={{ padding: 6, opacity: yearMode || nextDisabled ? 0.3 : 1 }}
                accessibilityLabel="Next month"
              >
                <Ionicons name="chevron-forward" size={22} color={tokens.text.primary} />
              </TouchableOpacity>
            </View>

            {yearMode ? (
              <View>
                {/* Year grid */}
                <ScrollView style={{ maxHeight: 200 }} contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {years.map((yr) => {
                    const active = yr === view.y;
                    return (
                      <TouchableOpacity
                        key={yr}
                        onPress={() => { setView((v) => ({ ...v, y: yr })); }}
                        style={{
                          width: "25%",
                          paddingVertical: 12,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: active ? "800" : "500",
                            color: active ? tokens.brand.default : tokens.text.primary,
                          }}
                        >
                          {yr}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {/* Month chips */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
                  {MONTHS_SHORT.map((mo, idx) => {
                    const m = idx + 1;
                    const active = m === view.m;
                    const monthOutOfRange =
                      (min && cmp({ y: view.y, m, d: daysInMonth(view.y, m) }) < cmp(min)) ||
                      (max && cmp({ y: view.y, m, d: 1 }) > cmp(max));
                    return (
                      <TouchableOpacity
                        key={mo}
                        disabled={monthOutOfRange}
                        onPress={() => { setView((v) => ({ ...v, m })); setYearMode(false); }}
                        style={{
                          width: "25%",
                          paddingVertical: 12,
                          alignItems: "center",
                          opacity: monthOutOfRange ? 0.3 : 1,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: active ? "800" : "500",
                            color: active ? tokens.brand.default : tokens.text.primary,
                          }}
                        >
                          {mo}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              <View>
                {/* Weekday header */}
                <View style={{ flexDirection: "row", marginBottom: 4 }}>
                  {WEEKDAYS.map((w) => (
                    <Text
                      key={w}
                      style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: tokens.text.muted }}
                    >
                      {w}
                    </Text>
                  ))}
                </View>
                {/* Day grid */}
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {cells.map((d, i) => {
                    if (d === null) {
                      return <View key={`b${i}`} style={{ width: `${100 / 7}%`, height: 44 }} />;
                    }
                    const isSelected =
                      draft && draft.y === view.y && draft.m === view.m && draft.d === d;
                    const off = isDisabledDay(d);
                    return (
                      <TouchableOpacity
                        key={d}
                        disabled={off}
                        onPress={() => setDraft({ y: view.y, m: view.m, d })}
                        style={{
                          width: `${100 / 7}%`,
                          height: 44,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: isSelected ? tokens.brand.default : "transparent",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: isSelected ? "800" : "500",
                              color: off
                                ? tokens.text.placeholder
                                : isSelected
                                  ? tokens.text.onBrand
                                  : tokens.text.primary,
                            }}
                          >
                            {d}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Footer */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: tokens.bg.surfaceMuted,
                }}
              >
                <Text style={{ color: tokens.text.primary, fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirm}
                disabled={!draft}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: draft ? tokens.brand.default : tokens.bg.surfaceMuted,
                }}
              >
                <Text style={{ color: draft ? tokens.text.onBrand : tokens.text.muted, fontWeight: "800" }}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
