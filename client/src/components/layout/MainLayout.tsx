import React from 'react';
import { Outlet } from 'react-router';
import { Box } from '@mui/material';
import Navbar from '../Navbar';
import { useAuth } from '../../context/AuthContext';
import { useTvMode } from '../../context/TvModeContext';
import LoadingScreen from '../common/LoadingScreen';
import { AuthContextType } from '../../types';

/**
 * Main application layout component, including Navbar and content area.
 */
const MainLayout: React.FC = () => {
    const auth = useAuth() as AuthContextType | null;
    const { isTvMode } = useTvMode();

    if (auth?.loading) {
      return <LoadingScreen message="Checking authentication..." />;
    }
    const isLoggedIn = !!auth && !!auth.user;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {}
            {isLoggedIn && (
                <Box
                    component="header"
                    sx={{
                        display: isTvMode ? 'none' : 'block',
                    }}
                >
                    {}
                    <Navbar />
                </Box>
            )}
            {}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                }}
            >
                <Outlet />
            </Box>
        </Box>
    );
};
export default MainLayout;