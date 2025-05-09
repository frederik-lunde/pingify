import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Link } from 'react-router';

/**
 * Displays a message when no websites have been added, with an option to add one.
 */
const NoWebsitesAdded: React.FC<{ isTvMode?: boolean }> = ({ isTvMode = false }) => {
    const commonStyles = {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        p: { xs: 2, sm: 4 },
        borderRadius: 2,
        bgcolor: "background.paper",
        boxShadow: 1,
        textAlign: "center",
        mt: 4,
    };
    const tvStyles = { mx: 'auto', maxWidth: 'sm' };
    return (
        <Box sx={isTvMode ? { ...commonStyles, ...tvStyles } : commonStyles}>
            <Typography variant="h6" gutterBottom>No websites added yet</Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
                {isTvMode
                    ? "Add your first website to start monitoring."
                    : "Add your first website to start monitoring its uptime and performance."
                }
            </Typography>
            {!isTvMode && (
                <Button variant="contained" component={Link} to="/add-website" sx={{ mt: 2 }}>
                    Add Your First Website
                </Button>
            )}
        </Box>
    );
};
export default NoWebsitesAdded;