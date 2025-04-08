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
  import { ThemeProvider, PaletteMode } from "@mui/material";
  import { lightTheme, darkTheme } from "../theme";
  import { useAuth } from "./AuthContext"; 
  
  interface ThemeContextType {
    mode: PaletteMode;
    toggleThemeMode: () => void;
    setThemeMode: (mode: PaletteMode) => void;
  }
  
  const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
  
  interface ThemeProviderWrapperProps {
    children: ReactNode;
  }
  
  const getUserThemeKey = (userId: string | number | undefined): string | null => {
    return userId ? `themeMode_${userId}` : null;
  };
  
  export const ThemeProviderWrapper: React.FC<ThemeProviderWrapperProps> = ({
    children,
  }) => {

    const [mode, setModeState] = useState<PaletteMode>(() => {
       return 'dark';
    });
  
    const setThemeMode = useCallback((newMode: PaletteMode) => {
      if (newMode === 'light' || newMode === 'dark') {
          setModeState(newMode);
      }
    }, []);
  
  
    const toggleThemeMode = useCallback(() => {
      setModeState((prevMode) => {
        const newMode = prevMode === "light" ? "dark" : "light";
     
        return newMode;
      });
    }, []); 
  
  
  
    const theme = useMemo(
      () => (mode === "light" ? lightTheme : darkTheme),
      [mode],
    );
  
    const contextValue = useMemo(
      () => ({
        mode,
        toggleThemeMode,
        setThemeMode,
      }),
      [mode, toggleThemeMode, setThemeMode],
    );
  
    return (
      <ThemeContext.Provider value={contextValue}>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
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
  
  
  export const useApplyUserThemePreference = () => {
      const { user, loading: authLoading } = useAuth();
      const { setThemeMode } = useThemeMode();
  
      useEffect(() => {
          if (!authLoading && user?.id) {
              const userThemeKey = getUserThemeKey(user.id);
              if (userThemeKey) {
                  const storedPreference = localStorage.getItem(userThemeKey);
                  if (storedPreference === 'light' || storedPreference === 'dark') {
                      console.log(`Applying stored theme preference '${storedPreference}' for user ${user.id}`);
                      setThemeMode(storedPreference);
                  } else {
                      console.log(`No stored theme preference found for user ${user.id}, using default.`);
                      
                  }
              }
          }
    
  
      }, [user, authLoading, setThemeMode]); 
  }