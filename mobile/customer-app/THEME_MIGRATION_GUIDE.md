# Customer App — Dark Mode Migration Guide

The theme infrastructure (`src/theme/`) is complete: `useTheme()` returns reactive
`{ tokens, isDark, mode, setMode, radius, spacing }`. The legacy `colors` shim in
`src/theme/index.js` is **hard-pinned to the LIGHT palette** and does NOT react to
theme changes. Every screen still importing `colors` renders light-only.

This guide is the canonical procedure for migrating a file off `colors` onto
reactive `tokens`. Follow it exactly so all 62 files come out consistent.

## Golden rules

1. **Never change layout, spacing, copy, logic, or behavior.** Color/theme only.
2. **Every color that affects readability (background, text, border) MUST become a
   token** so it flips with the theme.
3. **No new hardcoded hex.** Map existing hex literals to the nearest semantic token
   (table below). If truly no token fits a decorative accent, leave it but confirm it
   reads on BOTH `#FAFAFA` (light canvas) and `#0B0B0F` (dark canvas).
4. Keep `overlay.scrim` / `rgba(0,0,0,...)` modal scrims as-is (intentional in both modes),
   but prefer `tokens.overlay.scrim` if a token import is already present.
5. Delete the `import { colors } from '...theme'` line once no `colors.` references remain.

## Step 1 — get tokens into the component

Add inside the component body (function components only — hooks can't run at module level):

```js
import { useTheme } from '../../theme';   // adjust depth: components/ = '../theme'
...
const { tokens, isDark } = useTheme();
```

If the file already imports `useTheme` (e.g. only used it for `mode`), reuse that call —
do not add a second `useTheme()`.

## Step 2a — INLINE style files (the common case, ~54 files)

These use `style={{ ... }}` with `colors.X` inline. Just swap each reference:

```js
// before
<Text style={{ color: colors.text }}>
// after
<Text style={{ color: tokens.text.primary }}>
```

No factory needed — inline styles re-evaluate every render, so they pick up the new
`tokens` automatically.

## Step 2b — StyleSheet.create files (~8 files)

`StyleSheet.create({...})` runs ONCE at module load, so it can't read `tokens`. Convert
the static stylesheet into a factory and memoize it per render:

```js
import React, { useMemo } from 'react';
import { useTheme } from '../theme';

const MyComp = (props) => {
  const { tokens } = useTheme();
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  return <View style={styles.wrap}>...</View>;
};

const makeStyles = (tokens) => StyleSheet.create({
  wrap: { backgroundColor: tokens.bg.surface },
  title: { color: tokens.text.primary },
});
```

Color-free style keys (padding, fontSize, flex) stay exactly as they were — only the
color values reference `tokens`. The 8 files using this pattern:
SkeletonLoader, EmptyState, ErrorState, FormInput, PinBottomSheet, SearchModal,
LocaleSheet, BvnConfirmSheet (verify with `grep -l StyleSheet.create`).

## Step 3 — StatusBar must flip

Any hardcoded `barStyle="dark-content"` is wrong in dark mode (dark icons on dark bg).
Replace with:

```js
<StatusBar
  barStyle={isDark ? 'light-content' : 'dark-content'}
  backgroundColor={tokens.bg.canvas}
/>
```

## Step 4 — module-level color constants

Constants defined at module top (e.g. `KYC_BADGE = { color: '#6B7280', bg: '#F3F4F6' }`)
can't read `tokens`. Either:
- move the map inside the component and reference `tokens`, OR
- key it by a token path and resolve at render: `tokens.text.muted`.
Map the hex to its token via the table below.

## Legacy `colors.*` → token map

| legacy `colors.X`        | token                       |
|--------------------------|-----------------------------|
| `colors.primary`         | `tokens.brand.default`      |
| `colors.primaryStrong`   | `tokens.brand.strong`       |
| `colors.dark`            | `tokens.bg.elevated`        |
| `colors.background`      | `tokens.bg.canvas`          |
| `colors.surface`         | `tokens.bg.surface`         |
| `colors.surfaceMuted`    | `tokens.bg.surfaceMuted`    |
| `colors.text`            | `tokens.text.primary`       |
| `colors.textMuted`       | `tokens.text.muted`         |
| `colors.textLight`       | `tokens.text.placeholder`   |
| `colors.border`          | `tokens.border.default`     |
| `colors.error`           | `tokens.status.error`       |
| `colors.errorStrong`     | `tokens.status.errorStrong` |
| `colors.success`         | `tokens.status.success`     |
| `colors.white` (card bg) | `tokens.bg.surface`         |
| `colors.white` (on brand/dark fill) | `tokens.text.onBrand` / `tokens.text.onElevated` |
| `colors.food`/`.package`/`.pharmacy`/`.groceries` | `tokens.category.<name>` |
| `colors.airtime`/`.data`/`.electricity`/`.transfer` | `tokens.category.<name>` |

`colors.white` is context-dependent: it's `bg.surface` when used as a card/surface fill,
but `text.onBrand` (light) / `text.onElevated` when it's text/icon sitting on a brand or
dark `bg.elevated` fill. Read the surrounding element to decide.

## Hardcoded hex → token map (light palette literals)

| hex            | token                       | notes |
|----------------|-----------------------------|-------|
| `#FAFAFA`      | `tokens.bg.canvas`          | screen bg |
| `#FFFFFF` `#fff` `white` | `tokens.bg.surface` (fill) or `tokens.text.onBrand` (text on brand) | by context |
| `#F3F4F6`      | `tokens.bg.surfaceMuted`    | also `border.subtle` |
| `#E5E7EB`      | `tokens.border.default`     | or `bg.surfaceStrong` |
| `#D1D5DB`      | `tokens.border.strong`      | |
| `#09090b` `#000` | `tokens.text.primary`     | or `bg.elevated` when a fill |
| `#6B7280`      | `tokens.text.muted`         | |
| `#9CA3AF`      | `tokens.text.placeholder`   | |
| `#EA580C`      | `tokens.brand.default`      | |
| `#C2410C`      | `tokens.brand.strong`       | |
| `#FFF7ED`      | `tokens.brand.soft`         | |
| `#FED7AA`      | `tokens.brand.softBorder`   | |
| `#EF4444`      | `tokens.status.error`       | |
| `#DC2626`      | `tokens.status.errorStrong` | |
| `#FEE2E2`      | `tokens.status.errorSoft`   | |
| `#FECACA`      | `tokens.status.errorSoftBorder` | |
| `#10B981`      | `tokens.status.success`     | |
| `#059669`      | `tokens.status.successStrong` | |
| `#D1FAE5`      | `tokens.status.successSoft` | |
| `#D97706`      | `tokens.status.warning`     | |
| `#B45309`      | `tokens.status.warningStrong` | |
| `#FEF3C7`      | `tokens.status.warningSoft` | |
| `#2563EB`      | `tokens.status.info`        | |
| `#1D4ED8`      | `tokens.status.infoStrong`  | |
| `#EFF6FF`      | `tokens.status.infoSoft`    | also package category bg |
| `#BFDBFE`      | `tokens.status.infoSoftBorder` | |
| `#FFF0E8`      | `tokens.category.food.bg`   | |
| `#ECFDF5`      | `tokens.category.pharmacy.bg` | |
| `#F5F3FF`      | `tokens.category.groceries.bg` | |
| `#7C3AED` `#9333EA` | `tokens.category.groceries.icon` | shops/groceries accent |

For gradient accent colors on HomeScreen tiles (category icon/bg pairs), map each tile's
`color`/`bg` to the matching `tokens.category.<slug>.icon` / `.bg` so gradients re-tone in
dark mode. Category slug → token: restaurant→food, grocery→groceries, pharmacy→pharmacy,
package→package.

## Done-check for each file

- [ ] No `colors.` references remain (`grep -n "colors\." <file>` is empty)
- [ ] `import { colors }` line deleted
- [ ] No raw `#hex` / `'white'` left for bg/text/border (accent-only exceptions noted)
- [ ] StatusBar `barStyle` is `isDark ? 'light-content' : 'dark-content'`
- [ ] StyleSheet.create files use `makeStyles(tokens)` + `useMemo`
- [ ] No layout/logic/copy changed
</content>
