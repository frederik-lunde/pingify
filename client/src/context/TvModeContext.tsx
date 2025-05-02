import React, {
    createContext,
    useState,
    useContext,
    useMemo,
    ReactNode,
    useCallback,
    useEffect,
    useRef
} from 'react';

// --- Type Definitions for Vendor Prefixes ---
// Extend the standard Document interface
interface DocumentWithFullscreen extends Document {
    webkitExitFullscreen?: () => Promise<void>;
    msExitFullscreen?: () => Promise<void>;
    webkitFullscreenElement?: Element | null;
    msFullscreenElement?: Element | null;
}

// Extend the standard HTMLElement interface
interface HTMLElementWithFullscreen extends HTMLElement {
    webkitRequestFullscreen?: () => Promise<void>;
    msRequestFullscreen?: () => Promise<void>;
}

// --- Helper functions ---
const requestBrowserFullscreen = (element: HTMLElement) => {
    // Cast the element to our extended type to access prefixed methods
    const elementWithFullscreen = element as HTMLElementWithFullscreen;

    if (elementWithFullscreen.requestFullscreen) {
        elementWithFullscreen.requestFullscreen().catch(err => console.error("Error attempting to enable full-screen mode:", err));
    } else if (elementWithFullscreen.webkitRequestFullscreen) { /* Safari */
        // Now type-safe access
        elementWithFullscreen.webkitRequestFullscreen().catch((err) => console.error("Error attempting to enable full-screen mode (webkit):", err));
    } else if (elementWithFullscreen.msRequestFullscreen) { /* IE11 */
        // Now type-safe access
        elementWithFullscreen.msRequestFullscreen().catch((err) => console.error("Error attempting to enable full-screen mode (ms):", err));
    }
};

const exitBrowserFullscreen = () => {
    // Cast the document to our extended type
    const docWithFullscreen = document as DocumentWithFullscreen;

    if (docWithFullscreen.exitFullscreen) {
        docWithFullscreen.exitFullscreen().catch(err => console.error("Error attempting to disable full-screen mode:", err));
    } else if (docWithFullscreen.webkitExitFullscreen) { /* Safari */
        // Now type-safe access
        docWithFullscreen.webkitExitFullscreen().catch((err) => console.error("Error attempting to disable full-screen mode (webkit):", err));
    } else if (docWithFullscreen.msExitFullscreen) { /* IE11 */
        // Now type-safe access
        docWithFullscreen.msExitFullscreen().catch((err) => console.error("Error attempting to disable full-screen mode (ms):", err));
    }
};

const isBrowserFullscreen = (): boolean => {
    // Cast the document to our extended type
    const docWithFullscreen = document as DocumentWithFullscreen;
    return !!(
        docWithFullscreen.fullscreenElement ||
        docWithFullscreen.webkitFullscreenElement || // Now type-safe access
        docWithFullscreen.msFullscreenElement      // Now type-safe access
    );
};


// --- Context Definition ---
interface TvModeContextType {
    isTvMode: boolean;
    toggleTvMode: () => void;
}

const TvModeContext = createContext<TvModeContextType | undefined>(undefined);

interface TvModeProviderProps {
    children: ReactNode;
}

// --- Provider Component ---
export const TvModeProvider: React.FC<TvModeProviderProps> = ({ children }) => {
    const [isTvMode, setIsTvMode] = useState<boolean>(false);
    const isTvModeRef = useRef(isTvMode);

    useEffect(() => {
        isTvModeRef.current = isTvMode;
    }, [isTvMode]);

    const toggleTvMode = useCallback(() => {
        const nextIsTvMode = !isTvModeRef.current;
        setIsTvMode(nextIsTvMode);

        if (nextIsTvMode) {
            requestBrowserFullscreen(document.documentElement);
            // No 'as any' needed here, 'overflow' is standard CSS property
            document.body.style.overflow = 'hidden';
        } else {
            if (isBrowserFullscreen()) {
                exitBrowserFullscreen();
            }
            // No 'as any' needed here
            document.body.style.overflow = 'auto';
        }
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            const currentlyFullscreen = isBrowserFullscreen();
            if (!currentlyFullscreen && isTvModeRef.current) {
                console.log('Fullscreen exited manually, syncing TV mode state.');
                setIsTvMode(false);
                 // No 'as any' needed here
                document.body.style.overflow = 'auto';
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('msfullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('msfullscreenchange', handleFullscreenChange);
            if (isTvModeRef.current) {
                 // No 'as any' needed here
                document.body.style.overflow = 'auto';
            }
        };
    }, []);

    const value = useMemo(() => ({
        isTvMode,
        toggleTvMode,
    }), [isTvMode, toggleTvMode]);

    return (
        <TvModeContext.Provider value={value}>
            {children}
        </TvModeContext.Provider>
    );
};

// --- Consumer Hook ---
export const useTvMode = (): TvModeContextType => {
    const context = useContext(TvModeContext);
    if (context === undefined) {
        throw new Error('useTvMode must be used within a TvModeProvider');
    }
    return context;
};