// src/context/FocusModeContext.tsx
import React, { createContext, useState, useContext, useMemo, ReactNode, useCallback } from 'react';

interface FocusModeContextType {
    isFocusMode: boolean;
    toggleFocusMode: () => void;
    // Optional: Functions to explicitly set focus mode on/off if needed later
    // enableFocusMode: () => void;
    // disableFocusMode: () => void;
}

// Create the context with a default value (important for TypeScript)
const FocusModeContext = createContext<FocusModeContextType | undefined>(undefined);

interface FocusModeProviderProps {
    children: ReactNode;
}

// Create the Provider component
export const FocusModeProvider: React.FC<FocusModeProviderProps> = ({ children }) => {
    const [isFocusMode, setIsFocusMode] = useState<boolean>(false);

    // Define the toggle function using useCallback for stability
    const toggleFocusMode = useCallback(() => {
        setIsFocusMode(prev => !prev);
    }, []);

    // Optional explicit setters
    // const enableFocusMode = useCallback(() => setIsFocusMode(true), []);
    // const disableFocusMode = useCallback(() => setIsFocusMode(false), []);

    // Memoize the context value to prevent unnecessary re-renders
    const value = useMemo(() => ({
        isFocusMode,
        toggleFocusMode,
        // enableFocusMode,
        // disableFocusMode,
    }), [isFocusMode, toggleFocusMode /*, enableFocusMode, disableFocusMode */]);

    return (
        <FocusModeContext.Provider value={value}>
            {children}
        </FocusModeContext.Provider>
    );
};

// Create a custom hook for easy consumption of the context
export const useFocusMode = (): FocusModeContextType => {
    const context = useContext(FocusModeContext);
    if (context === undefined) {
        throw new Error('useFocusMode must be used within a FocusModeProvider');
    }
    return context;
};