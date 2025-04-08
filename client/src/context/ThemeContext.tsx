// src/context/ThemeContext.tsx
import React, {
    createContext,
    useState,
    useMemo,
    useContext,
    ReactNode,
    useCallback,
  } from "react";
  import { ThemeProvider, createTheme, PaletteMode } from "@mui/material";
  import { lightTheme, darkTheme } from "../theme"; // We'll update theme.ts next
  
  interface ThemeContextType {
    mode: PaletteMode;
    toggleThemeMode: () => void;
  }
  
  const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
  
  interface ThemeProviderWrapperProps {
    children: ReactNode;
  }
  
  export const ThemeProviderWrapper: React.FC<ThemeProviderWrapperProps> = ({
    children,
  }) => {
    // Default to 'dark' or read from localStorage if you want persistence
    const [mode, setMode] = useState<PaletteMode>("dark");
  
    const toggleThemeMode = useCallback(() => {
      setMode((prevMode) => (prevMode === "light" ? "dark" : "light"));
      // Optional: Persist preference
      // localStorage.setItem('themeMode', prevMode === 'light' ? 'dark' : 'light');
    }, []);
  
    // Memoize the theme based on the mode
    const theme = useMemo(
      () => (mode === "light" ? lightTheme : darkTheme),
      [mode],
    );
  
    const contextValue = useMemo(
      () => ({
        mode,
        toggleThemeMode,
      }),
      [mode, toggleThemeMode],
    );
  
    return (
      <ThemeContext.Provider value={contextValue}>
        {/* Apply the MUI theme based on the current mode */}
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </ThemeContext.Provider>
    );
  };
  
  // Custom hook to use the theme context
  export const useThemeMode = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
      throw new Error("useThemeMode must be used within a ThemeProviderWrapper");
    }
    return context;
  };