// src/components/dashboard/TvModeView.tsx
import React from 'react';
// Alert and Container imports removed
import { Box, CircularProgress, Snackbar } from '@mui/material';
import WebsiteGrid from './WebsiteGrid';
import { WebsiteWithResults } from '../../types';
import NoWebsitesAdded from './NoWebsitesAdded';
import EmptyFilterResults from './EmptyFilterResults';

interface TvModeViewProps {
    websites: WebsiteWithResults[];
    isLoading: boolean; // For skeleton/initial load display
    lastIncidentWebsiteId: number | null | undefined;
    isHighlightActive: boolean;
    isFetching: boolean; // For background fetch indicator
    isEmptyDueToFilter: boolean;
    isEmptyBecauseNoWebsites: boolean;
    showTvExitMessage: boolean;
    // errorMessage?: string; // REMOVED
}

const TvModeView: React.FC<TvModeViewProps> = ({
    websites,
    isLoading,
    lastIncidentWebsiteId,
    isHighlightActive,
    isFetching,
    isEmptyDueToFilter,
    isEmptyBecauseNoWebsites,
    showTvExitMessage,
    // errorMessage prop removed
}) => {
    return (
        <Box
            sx={{
                cursor: 'default',
                minHeight: '100vh',
                width: '100%',
                p: { xs: 1, sm: 2, md: 3 },
                boxSizing: 'border-box',
                bgcolor: 'background.default',
                outline: 'none',
                position: 'relative',
            }}
            tabIndex={-1}
        >
            {/* Error Alert REMOVED */}

            {/* Conditionally render grid or empty states */}
            {/* Show loading spinner ONLY during initial load (isLoading is true, but no websites yet) */}
            {isLoading && websites.length === 0 && (
                 <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
                    <CircularProgress />
                </Box>
            )}

            {/* Show Grid only if not initial loading AND not empty */}
            {!isLoading && !isEmptyBecauseNoWebsites && !isEmptyDueToFilter && (
                 <WebsiteGrid
                    websitesWithResults={websites}
                    isLoading={false} // Pass false as main loading handled above
                    lastIncidentWebsiteId={lastIncidentWebsiteId}
                    isHighlightActive={isHighlightActive}
                    isTvMode={true}
                />
            )}

            {/* Show empty states centered if no grid is shown and not initial loading */}
            {!isLoading && isEmptyDueToFilter && <EmptyFilterResults isTvMode={true}/>}
            {!isLoading && isEmptyBecauseNoWebsites && <NoWebsitesAdded isTvMode={true} />}

            <Snackbar
                open={showTvExitMessage}
                message="Press any key or click to exit TV Mode"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                sx={{ bottom: { xs: 16, sm: 24 } }}
            />

            {/* Loading indicator for background fetching (show only when not initial loading) */}
            {isFetching && !isLoading && (
                <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: 1300 }}>
                    <CircularProgress size={24} />
                </Box>
            )}

        </Box>
    );
};

export default TvModeView;