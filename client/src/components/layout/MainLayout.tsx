import React from 'react';
// Correct import for Outlet
import { Outlet } from 'react-router';
import { Box } from '@mui/material';
import Navbar from '../Navbar'; // Adjust path as needed
import { useAuth } from '../../context/AuthContext'; // Adjust path
import { useTvMode } from '../../context/TvModeContext'; // Adjust path
import LoadingScreen from '../common/LoadingScreen'; // Import the LoadingScreen component
import { AuthContextType } from '../../types';

const MainLayout: React.FC = () => {
    // Get the full auth context object, which could be null
    // Assuming useAuth returns AuthContextType | null based on types.ts definition
    const auth = useAuth() as AuthContextType | null;
    const { isTvMode } = useTvMode();

    // --- Handle Loading State ---
    // Use optional chaining (?.) to safely access loading even if auth is null initially
    if (auth?.loading) {
      return <LoadingScreen message="Checking authentication..." />;
    }
    // --- End Loading State Handling ---

    // Determine if the Navbar should be visible *after* loading is complete
    // We check auth and auth.user again because loading might finish but user could still be null (not logged in)
    const showNavbar = !!auth && !!auth.user && !isTvMode;

    return (
        <>
            {/* Conditionally render the Navbar */}
            {showNavbar && <Navbar />}
            <Box
                component="main"
                sx={{flexGrow: 1 }} // Example padding values
            >
                {/* The rest of the routed components will render here */}
                <Outlet />
            </Box>
        </>
    );
};

export default MainLayout;