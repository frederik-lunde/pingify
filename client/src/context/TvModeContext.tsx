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

interface DocumentWithFullscreen extends Document {
    webkitExitFullscreen?: () => Promise<void>;
    msExitFullscreen?: () => Promise<void>;
    webkitFullscreenElement?: Element | null;
    msFullscreenElement?: Element | null;
}
interface HTMLElementWithFullscreen extends HTMLElement {
    webkitRequestFullscreen?: () => Promise<void>;
    msRequestFullscreen?: () => Promise<void>;
}

/**
 * Requests browser fullscreen mode for a given HTML element.
 */
const requestBrowserFullscreen = (element: HTMLElement) => {
    const elementWithFullscreen = element as HTMLElementWithFullscreen;
    if (elementWithFullscreen.requestFullscreen) {
        elementWithFullscreen.requestFullscreen().catch(err => console.error("Error attempting to enable full-screen mode:", err));
    } else if (elementWithFullscreen.webkitRequestFullscreen) {
        elementWithFullscreen.webkitRequestFullscreen().catch((err) => console.error("Error attempting to enable full-screen mode (webkit):", err));
    } else if (elementWithFullscreen.msRequestFullscreen) {
        elementWithFullscreen.msRequestFullscreen().catch((err) => console.error("Error attempting to enable full-screen mode (ms):", err));
    }
};

/**
 * Exits browser fullscreen mode.
 */
const exitBrowserFullscreen = () => {
    const docWithFullscreen = document as DocumentWithFullscreen;
    if (docWithFullscreen.exitFullscreen) {
        docWithFullscreen.exitFullscreen().catch(err => console.error("Error attempting to disable full-screen mode:", err));
    } else if (docWithFullscreen.webkitExitFullscreen) {
        docWithFullscreen.webkitExitFullscreen().catch((err) => console.error("Error attempting to disable full-screen mode (webkit):", err));
    } else if (docWithFullscreen.msExitFullscreen) {
        docWithFullscreen.msExitFullscreen().catch((err) => console.error("Error attempting to disable full-screen mode (ms):", err));
    }
};

/**
 * Checks if the browser is currently in fullscreen mode.
 */
const isBrowserFullscreen = (): boolean => {
    const docWithFullscreen = document as DocumentWithFullscreen;
    return !!(
        docWithFullscreen.fullscreenElement ||
        docWithFullscreen.webkitFullscreenElement ||
        docWithFullscreen.msFullscreenElement
    );  
};

interface TvModeContextType {
    isTvMode: boolean;
    toggleTvMode: () => void;
}

const TvModeContext = createContext<TvModeContextType | undefined>(undefined);

interface TvModeProviderProps {
    children: ReactNode;
}

/**
 * Provides TV mode context and functionality to its children.
 */
export const TvModeProvider: React.FC<TvModeProviderProps> = ({ children }) => {
    const [isTvMode, setIsTvMode] = useState<boolean>(false);
    const isTvModeRef = useRef(isTvMode);

    
    useEffect(() => {
        isTvModeRef.current = isTvMode;
    }, [isTvMode]);

    /**
     * Toggles TV mode on/off and manages browser fullscreen.
     */
    const toggleTvMode = useCallback(() => {
        const nextIsTvMode = !isTvModeRef.current;
        setIsTvMode(nextIsTvMode);
        if (nextIsTvMode) {
            requestBrowserFullscreen(document.documentElement);
            document.body.style.overflow = 'hidden';
        } else {
            if (isBrowserFullscreen()) {
                exitBrowserFullscreen();
            }
            document.body.style.overflow = 'auto';
        }
    }, []);


    useEffect(() => {
        const handleFullscreenChange = () => {
            const currentlyFullscreen = isBrowserFullscreen();
            if (!currentlyFullscreen && isTvModeRef.current) {
                console.log('Fullscreen exited manually, syncing TV mode state.');
                setIsTvMode(false);
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


export const useTvMode = (): TvModeContextType => {
    const context = useContext(TvModeContext);
    if (context === undefined) {
        throw new Error('useTvMode must be used within a TvModeProvider');
    }
    return context;
};