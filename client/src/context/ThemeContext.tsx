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
  // Import useAuth to access user ID for saving preferences
  import { useAuth } from "./AuthContext"; // Adjust path if needed
  
  interface ThemeContextType {
    mode: PaletteMode;
    toggleThemeMode: () => void;
    setThemeMode: (mode: PaletteMode) => void; // Add setter function
  }
  
  const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
  
  interface ThemeProviderWrapperProps {
    children: ReactNode;
  }
  
  // Helper function to get the user-specific theme key
  const getUserThemeKey = (userId: string | number | undefined): string | null => {
    return userId ? `themeMode_${userId}` : null;
  };
  
  export const ThemeProviderWrapper: React.FC<ThemeProviderWrapperProps> = ({
    children,
  }) => {
    // Read initial preference (e.g., default to 'dark')
    // We'll apply user-specific preference later via an effect
    const [mode, setModeState] = useState<PaletteMode>(() => {
       // Optionally read a generic preference or system preference here as initial default
       // const genericPreference = localStorage.getItem('lastUsedThemeMode');
       // return (genericPreference === 'light' || genericPreference === 'dark') ? genericPreference : 'dark';
       return 'dark'; // Defaulting to dark
    });
  
    // Function to set the mode directly
    const setThemeMode = useCallback((newMode: PaletteMode) => {
      if (newMode === 'light' || newMode === 'dark') {
          setModeState(newMode);
          // Optionally save the generic preference when set directly
          // localStorage.setItem('lastUsedThemeMode', newMode);
      }
    }, []);
  
  
    // Function to toggle and save user-specific preference
    const toggleThemeMode = useCallback(() => {
      setModeState((prevMode) => {
        const newMode = prevMode === "light" ? "dark" : "light";
        // We will save the user-specific preference in the component calling this (Navbar)
        // because this context doesn't directly know the userId when toggle is called.
        // Alternatively, the saving logic could be moved to the setThemeMode function
        // if the userId is available when it's called.
        // localStorage.setItem('lastUsedThemeMode', newMode); // Update generic preference on toggle
        return newMode;
      });
    }, []); // No dependencies needed here if saving happens elsewhere
  
  
    // Memoize the theme based on the mode
    const theme = useMemo(
      () => (mode === "light" ? lightTheme : darkTheme),
      [mode],
    );
  
    const contextValue = useMemo(
      () => ({
        mode,
        toggleThemeMode,
        setThemeMode, // Expose the setter
      }),
      [mode, toggleThemeMode, setThemeMode],
    );
  
    return (
      <ThemeContext.Provider value={contextValue}>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </ThemeContext.Provider>
    );
  };
  
  // Custom hook remains the same
  export const useThemeMode = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
      throw new Error("useThemeMode must be used within a ThemeProviderWrapper");
    }
    return context;
  };
  
  // --- New Component/Hook to Apply User Preference ---
  
  // This effect hook runs within the App structure AFTER auth is resolved
  export const useApplyUserThemePreference = () => {
      const { user, loading: authLoading } = useAuth();
      const { setThemeMode } = useThemeMode();
  
      useEffect(() => {
          // Wait for auth check to complete and ensure user object is available
          if (!authLoading && user?.id) {
              const userThemeKey = getUserThemeKey(user.id);
              if (userThemeKey) {
                  const storedPreference = localStorage.getItem(userThemeKey);
                  if (storedPreference === 'light' || storedPreference === 'dark') {
                      console.log(`Applying stored theme preference '${storedPreference}' for user ${user.id}`);
                      setThemeMode(storedPreference);
                  } else {
                      console.log(`No stored theme preference found for user ${user.id}, using default.`);
                      // Optionally set default theme explicitly if needed, but ThemeProviderWrapper already has one.
                      // setThemeMode('dark'); // Or your preferred default
                  }
              }
          }
           // If user logs out (user becomes null), we might want to revert to a default theme.
           // This depends on desired behavior. Currently, it will just keep the last set theme.
           // else if (!authLoading && !user) {
           //    setThemeMode('dark'); // Revert to default on logout
           // }
  
      }, [user, authLoading, setThemeMode]); // Rerun when user or auth state changes
  }