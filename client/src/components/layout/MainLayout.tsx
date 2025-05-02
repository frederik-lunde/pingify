// src/components/layout/MainLayout.tsx
import React from 'react';
import { Outlet } from 'react-router';
import { Box } from '@mui/material'; // Only Box needed from MUI here for layout
import Navbar from '../Navbar';
import { useAuth } from '../../context/AuthContext';
import { useTvMode } from '../../context/TvModeContext';
import LoadingScreen from '../common/LoadingScreen';
import { AuthContextType } from '../../types';

const MainLayout: React.FC = () => {
    const auth = useAuth() as AuthContextType | null;
    const { isTvMode } = useTvMode();

    // --- Handle Loading State (remains the same) ---
    if (auth?.loading) {
      return <LoadingScreen message="Checking authentication..." />;
    }
    // --- End Loading State Handling ---

    // Check if user is actually logged in
    const isLoggedIn = !!auth && !!auth.user;

    return (
        // Use a Box as the main flex container for the layout
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

            {/* Render Navbar structure only if logged in */}
            {isLoggedIn && (
                // *** Revert to using a wrapper Box for styling ***
                <Box
                    component="header" // Use semantic tag
                    sx={{
                        // Apply conditional display to this WRAPPER
                        display: isTvMode ? 'none' : 'block', // Or 'flex' if needed for AppBar layout
                    }}
                >
                    {/* Render Navbar inside the wrapper WITHOUT passing sx */}
                    <Navbar />
                </Box>
            )}

            {/* Main content area takes remaining space */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    // Layout shift handling (same considerations as before)
                    // Static AppBar usually doesn't need explicit padding adjustment here
                }}
            >
                <Outlet />
            </Box>
        </Box>
    );
};

export default MainLayout;