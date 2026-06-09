// Public API for the theme module.
//
// Pull theming reactively via `useTheme()`:
//   const { tokens, isDark, mode, setMode, radius, spacing } = useTheme();
//   <View style={{ backgroundColor: tokens.bg.surface }} />
//
// For StyleSheet.create files, build the sheet from a factory and memoize it:
//   const { tokens } = useTheme();
//   const styles = useMemo(() => makeStyles(tokens), [tokens]);
//   const makeStyles = (tokens) => StyleSheet.create({ card: { backgroundColor: tokens.bg.surface } });

export { ThemeProvider } from './ThemeProvider';
export { useTheme } from './useTheme';
export { buildNavigationTheme } from './navigationTheme';
export { light, dark, radius, spacing } from './tokens';
