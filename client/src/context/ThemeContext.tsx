// src/context/ThemeContext.tsx
import React, {
  createContext,
  useState,
  useMemo,
  useContext,
  ReactNode,
  useCallback,
  useEffect,
} from "react";
import { ThemeProvider as MuiThemeProvider, PaletteMode as MuiPaletteMode, CssBaseline } from "@mui/material";
import { lightTheme, darkTheme, colorblindTheme } from "../theme";
import { useAuth } from "./AuthContext";

export type AppThemeMode = MuiPaletteMode | 'colorblind';

// Remove toggleThemeMode from the type
interface ThemeContextType {
  mode: AppThemeMode;
  setThemeMode: (mode: AppThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderWrapperProps {
  children: ReactNode;
}

const getUserThemeKey = (userId: string | number | undefined): string | null => {
  return userId ? `themeMode_${userId}` : null;
};

const getInitialMode = (): AppThemeMode => {
   try {
      const genericPref = localStorage.getItem('themeMode_loggedOut') as AppThemeMode | null;
      if (genericPref && ['light', 'dark', 'colorblind'].includes(genericPref)) {
          // console.log(`Initial mode from generic preference: ${genericPref}`);
          return genericPref;
      }
       // console.log("Initial mode defaulting to dark (no generic preference found)");
      return 'dark';
   } catch (e) {
       // console.error("Error reading initial theme from localStorage, defaulting to dark", e);
       return 'dark';
   }
};


export const ThemeProviderWrapper: React.FC<ThemeProviderWrapperProps> = ({
  children,
}) => {
  const auth = useAuth();
  const user = auth?.user;
  const authLoading = auth?.loading ?? true;

  const [mode, setModeState] = useState<AppThemeMode>(getInitialMode);

  useEffect(() => {
      if (!authLoading && user?.id) {
          const userThemeKey = getUserThemeKey(user.id);
          // console.log(`Auth loaded for user ${user.id}. Checking key: ${userThemeKey}`);
          if (userThemeKey) {
              const storedPreference = localStorage.getItem(userThemeKey) as AppThemeMode | null;
              // console.log(`User preference found for ${userThemeKey}:`, storedPreference);
              if (storedPreference && ['light', 'dark', 'colorblind'].includes(storedPreference)) {
                  if (storedPreference !== mode) {
                      // console.log(`Applying USER theme: ${storedPreference}`);
                      setModeState(storedPreference);
                  } else {
                       // console.log(`User preference (${storedPreference}) matches current mode. No change needed.`);
                  }
              } else {
                   // console.log(`No valid USER theme found for ${userThemeKey}. Keeping current mode: ${mode}`);
                   localStorage.setItem(userThemeKey, mode);
                   // console.log(`Saved current mode '${mode}' as preference for key '${userThemeKey}'`);
              }
          }
      } else if (!authLoading && !user) {
           const genericPref = localStorage.getItem('themeMode_loggedOut') as AppThemeMode | null;
           const targetMode = (genericPref && ['light', 'dark', 'colorblind'].includes(genericPref)) ? genericPref : 'dark';
           if (targetMode !== mode) {
               // console.log(`User logged out. Applying generic/default theme: ${targetMode}`);
               setModeState(targetMode);
           }
      }
  }, [authLoading, user, mode]);

  const setThemeMode = useCallback((newMode: AppThemeMode) => {
      if (['light', 'dark', 'colorblind'].includes(newMode)) {
          // console.log(`setThemeMode called with: ${newMode}`);
          setModeState(newMode);
          const currentUserId = auth?.user?.id;
          const keyToSave = getUserThemeKey(currentUserId) || 'themeMode_loggedOut';
          // console.log(`Saving theme '${newMode}' to localStorage key: ${keyToSave}`);
          localStorage.setItem(keyToSave, newMode);
      } else {
          // console.warn(`Invalid theme mode ignored: ${newMode}`);
      }
  }, [auth]);

  const theme = useMemo(() => {
      // console.log(`Selecting theme object for mode: "${mode}"`);
      switch (mode) {
          case "light": return lightTheme;
          case "dark": return darkTheme;
          case "colorblind": return colorblindTheme;
          default: return darkTheme;
      }
  }, [mode]);

  // Remove toggleThemeMode from context value
  const contextValue = useMemo(
      () => ({ mode, setThemeMode }),
      [mode, setThemeMode], // Remove toggleThemeMode dependency
  );

  return (
      <ThemeContext.Provider value={contextValue}>
          <MuiThemeProvider theme={theme}>
               <CssBaseline />
              {children}
          </MuiThemeProvider>
      </ThemeContext.Provider>
  );
};

export const useThemeMode = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
      throw new Error("useThemeMode must be used within a ThemeProviderWrapper");
  }
  return context;
};