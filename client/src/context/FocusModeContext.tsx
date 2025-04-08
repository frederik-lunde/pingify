// src/context/FocusModeContext.tsx
import React, { createContext, useState, useContext, useMemo, ReactNode, useCallback } from 'react';

interface FocusModeContextType {
    isFocusMode: boolean;
    toggleFocusMode: () => void;
    // enableFocusMode: () => void;
    // disableFocusMode: () => void;
}

const FocusModeContext = createContext<FocusModeContextType | undefined>(undefined);

interface FocusModeProviderProps {
    children: ReactNode;
}

export const FocusModeProvider: React.FC<FocusModeProviderProps> = ({ children }) => {
    const [isFocusMode, setIsFocusMode] = useState<boolean>(false);

    const toggleFocusMode = useCallback(() => {
        setIsFocusMode(prev => !prev);
    }, []);

    // const enableFocusMode = useCallback(() => setIsFocusMode(true), []);
    // const disableFocusMode = useCallback(() => setIsFocusMode(false), []);

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

export const useFocusMode = (): FocusModeContextType => {
    const context = useContext(FocusModeContext);
    if (context === undefined) {
        throw new Error('useFocusMode must be used within a FocusModeProvider');
    }
    return context;
};