// src/components/dashboard/TvModeView.tsx
import React from 'react';
import { Box, CircularProgress, Snackbar } from '@mui/material';
import WebsiteGrid from './WebsiteGrid';
import { WebsiteUser } from '../../types';
import NoWebsitesAdded from './NoWebsitesAdded';
import EmptyFilterResults from './EmptyFilterResults';

interface TvModeViewProps {
    websiteCards: WebsiteUser[];
    isLoading: boolean;
    lastIncidentWebsiteId: number | null | undefined;
    isHighlightActive: boolean;
    isFetching: boolean;
    isEmptyDueToFilter: boolean;
    isEmptyBecauseNoWebsites: boolean;
    showTvExitMessage: boolean;
}

const TvModeView: React.FC<TvModeViewProps> = ({
    websiteCards,
    isLoading,
    lastIncidentWebsiteId,
    isHighlightActive,
    isFetching,
    isEmptyDueToFilter,
    isEmptyBecauseNoWebsites,
    showTvExitMessage,
}) => {
    // Define grid styles, potentially adjustable for TV mode
    const gridContainerSx = {
        display: 'grid',
        gap: { xs: 1, sm: 2 }, // Maybe slightly less gap for TV mode? Adjust as needed.
        // Use a slightly different minmax for TV mode if desired, or keep consistent
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', // Example: slightly smaller min width for potentially more columns on large TV screens
        p: { xs: 1, sm: 2 }, // Add padding around the grid
        boxSizing: 'border-box',
    };

    return (
        <Box
            sx={{
                cursor: 'default',
                minHeight: '100vh',
                width: '100%',
                // Remove padding here, apply it to the grid container instead
                // p: { xs: 1, sm: 2, md: 0 }, // REMOVED
                boxSizing: 'border-box',
                bgcolor: 'background.default',
                outline: 'none',
                position: 'relative',
            }}
            tabIndex={-1}
        >
            {/* Loading state */}
            {isLoading && websiteCards.length === 0 && (
                 <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
                    <CircularProgress />
                </Box>
            )}

            {/* Grid Container for Website Cards - Render only when cards exist */}
            {!isLoading && !isEmptyBecauseNoWebsites && !isEmptyDueToFilter && (
                // Apply the grid layout styles here
                <Box sx={gridContainerSx}>
                    <WebsiteGrid
                        websiteCards={websiteCards}
                        isLoading={false} // Already handled loading above
                        lastIncidentWebsiteId={lastIncidentWebsiteId}
                        isHighlightActive={isHighlightActive}
                        isTvMode={true} // Pass TV mode flag down
                    />
                </Box>
            )}

            {/* Empty State Messages - Render outside the grid container */}
            {!isLoading && isEmptyDueToFilter && (
                 <Box sx={{ p: { xs: 1, sm: 2 } }}> {/* Add padding if needed */}
                     <EmptyFilterResults isTvMode={true}/>
                 </Box>
            )}
            {!isLoading && isEmptyBecauseNoWebsites && (
                <Box sx={{ p: { xs: 1, sm: 2 } }}> {/* Add padding if needed */}
                    <NoWebsitesAdded isTvMode={true} />
                </Box>
            )}


            {/* Snackbar and Fetching Indicator */}
            <Snackbar
                open={showTvExitMessage}
                message="Press any key or click to exit TV Mode"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                sx={{ bottom: { xs: 16, sm: 24 } }}
            />
            {isFetching && !isLoading && (
                <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: 1300 }}>
                    <CircularProgress size={24} />
                </Box>
            )}

        </Box>
    );
};

export default TvModeView;