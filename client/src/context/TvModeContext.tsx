/*
src/context/TvModeContext.tsx
*/
import React, { createContext, useState, useContext, useMemo, ReactNode, useCallback } from 'react';

// Define the shape of the context data
interface TvModeContextType {
    isTvMode: boolean;
    toggleTvMode: () => void;
 
}

// Create the context with an initial undefined value
// This ensures consumers get an error if used outside the provider
const TvModeContext = createContext<TvModeContextType | undefined>(undefined);

// Define the props for the provider component
interface TvModeProviderProps {
    children: ReactNode;
}

// Create the provider component
export const TvModeProvider: React.FC<TvModeProviderProps> = ({ children }) => {
    // State to track if TV mode is active
    const [isTvMode, setIsTvMode] = useState<boolean>(false);

    // Callback to toggle TV mode state
    const toggleTvMode = useCallback(() => {
        setIsTvMode(prev => !prev);
    }, []);

    // Callbacks to explicitly enable/disable (optional, keep commented if toggle is sufficient)
    // const enableTvMode = useCallback(() => setIsTvMode(true), []);
    // const disableTvMode = useCallback(() => setIsTvMode(false), []);

    // Memoize the context value to prevent unnecessary re-renders
    const value = useMemo(() => ({
        isTvMode,
        toggleTvMode,
        // enableTvMode,
        // disableTvMode,
    }), [isTvMode, toggleTvMode /*, enableTvMode, disableTvMode */]);

    // Provide the context value to children components
    return (
        <TvModeContext.Provider value={value}>
            {children}
        </TvModeContext.Provider>
    );
};

// Create a custom hook for easy consumption of the context
export const useTvMode = (): TvModeContextType => {
    const context = useContext(TvModeContext);
    // Ensure the hook is used within a TvModeProvider
    if (context === undefined) {
        throw new Error('useTvMode must be used within a TvModeProvider');
    }
    return context;
};