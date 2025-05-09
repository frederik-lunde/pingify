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
  
  interface ThemeContextType {
    mode: AppThemeMode;
    setThemeMode: (mode: AppThemeMode) => void;
  }
  
  const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
  
  interface ThemeProviderWrapperProps {
    children: ReactNode;
  }
  
  /**
   * Generates a localStorage key for storing user-specific theme preferences.
   */
  const getUserThemeKey = (userId: string | number | undefined): string | null => {
    return userId ? `themeMode_${userId}` : null;
  };
  
  /**
   * Retrieves the initial theme mode from localStorage or defaults to 'dark'.
   */
  const getInitialMode = (): AppThemeMode => {
     try {
        const genericPref = localStorage.getItem('themeMode_loggedOut') as AppThemeMode | null;
        if (genericPref && ['light', 'dark', 'colorblind'].includes(genericPref)) {
            return genericPref;
        }
        return 'dark';
     } catch (e) {
          console.error("Error reading initial theme from localStorage, defaulting to dark", e);
         return 'dark';
     }
  };
  
  /**
   * Provides theme context and MUI theme provider, managing theme mode state and persistence.
   */
  export const ThemeProviderWrapper: React.FC<ThemeProviderWrapperProps> = ({
    children,
  }) => {
    const auth = useAuth();
    const user = auth?.user;
    const authLoading = auth?.loading ?? true;
    const [mode, setModeState] = useState<AppThemeMode>(getInitialMode);
  
    /**
     * Effect to load and apply user's theme preference from localStorage.
     */
    useEffect(() => {
        if (!authLoading && user?.id) {
            const userThemeKey = getUserThemeKey(user.id);
            if (userThemeKey) {
                const storedPreference = localStorage.getItem(userThemeKey) as AppThemeMode | null;
                if (storedPreference && ['light', 'dark', 'colorblind'].includes(storedPreference)) {
                    if (storedPreference !== mode) {
                        setModeState(storedPreference);
                    }
                } else {
                     localStorage.setItem(userThemeKey, mode);
                }
            }
        } else if (!authLoading && !user) {
             const genericPref = localStorage.getItem('themeMode_loggedOut') as AppThemeMode | null;
             const targetMode = (genericPref && ['light', 'dark', 'colorblind'].includes(genericPref)) ? genericPref : 'dark';
             if (targetMode !== mode) {
                 setModeState(targetMode);
             }
        }
    }, [authLoading, user, mode]);
  
    /**
     * Sets the application theme mode and persists it to localStorage.
     */
    const setThemeMode = useCallback((newMode: AppThemeMode) => {
        if (['light', 'dark', 'colorblind'].includes(newMode)) {
            setModeState(newMode);
            const currentUserId = auth?.user?.id;
            const keyToSave = getUserThemeKey(currentUserId) || 'themeMode_loggedOut';
            localStorage.setItem(keyToSave, newMode);
        }
    }, [auth]);
  
    const theme = useMemo(() => {
        switch (mode) {
            case "light": return lightTheme;
            case "dark": return darkTheme;
            case "colorblind": return colorblindTheme;
            default: return darkTheme;
        }
    }, [mode]);
  
    const contextValue = useMemo(
        () => ({ mode, setThemeMode }),
        [mode, setThemeMode],
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
  
  /**
   * Custom hook to access the theme mode and setter function.
   */
  export const useThemeMode = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useThemeMode must be used within a ThemeProviderWrapper");
    }
    return context;
  };