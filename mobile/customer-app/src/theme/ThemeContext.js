import { createContext } from 'react';

// Separate file so useTheme.js and ThemeProvider.js can import it without
// pulling each other's full module graph (avoids cycles).
export const ThemeContext = createContext(null);
