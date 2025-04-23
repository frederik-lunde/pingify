// src/components/layout/MainLayout.tsx
import React from 'react';
import { Outlet } from 'react-router';
import { Box } from '@mui/material';
import Navbar from '../Navbar'; // Adjust path as needed
import { useAuth } from '../../context/AuthContext'; // Adjust path
import { useTvMode } from '../../context/TvModeContext'; // Adjust path

const MainLayout: React.FC = () => {
    const { user } = useAuth();
    const { isTvMode } = useTvMode();

    // Determine if the Navbar should be visible
    const showNavbar = user && !isTvMode;

    return (
        <>
            {showNavbar && <Navbar />}
            {/* Add padding top to main content if navbar is shown to prevent overlap */}
            <Box component="main" sx={{ pt: showNavbar ? { xs: 3, sm: 2 } : 0, flexGrow: 1 }}>
                <Outlet /> {/* Nested routes will render here */}
            </Box>
        </>
    );
};

export default MainLayout;