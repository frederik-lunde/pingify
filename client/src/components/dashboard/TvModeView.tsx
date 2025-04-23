/*
src/components/dashboard/DashboardTvModeView.tsx
*/
import React from 'react';
import { Box, CircularProgress, Snackbar } from '@mui/material';
import WebsiteGrid from './WebsiteGrid'; // Adjust path
import { WebsiteWithResults } from '../../types'; // Adjust path
import NoWebsitesAdded from './NoWebsitesAdded'; // Import the correct empty state component
import EmptyFilterResults from './EmptyFilterResults'; // Import the correct empty state component


interface DashboardTvModeViewProps {
    websites: WebsiteWithResults[];
    isLoading: boolean;
    // --- FIX: Change type to match source and consumer ---
    lastIncidentWebsiteId: number | null | undefined;
    // --- END FIX ---
    isHighlightActive: boolean;
    isFetching: boolean;
    isEmptyDueToFilter: boolean;
    isEmptyBecauseNoWebsites: boolean;
    showTvExitMessage: boolean;
}

const DashboardTvModeView: React.FC<DashboardTvModeViewProps> = ({
    websites,
    isLoading,
    lastIncidentWebsiteId, // Type is now correct
    isHighlightActive,
    isFetching,
    isEmptyDueToFilter,
    isEmptyBecauseNoWebsites,
    showTvExitMessage,
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
            }}
            tabIndex={-1}
        >
            <WebsiteGrid
                websitesWithResults={websites}
                isLoading={isLoading}
                lastIncidentWebsiteId={lastIncidentWebsiteId} // Now passes the correct type
                isHighlightActive={isHighlightActive}
                isTvMode={true}
            />

            <Snackbar
                open={showTvExitMessage}
                message="Press any key or click to exit TV Mode"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                sx={{ bottom: { xs: 16, sm: 24 } }}
            />

            {/* Use correct empty state components */}
            {isEmptyDueToFilter && <EmptyFilterResults />}
            {isEmptyBecauseNoWebsites && <NoWebsitesAdded isTvMode={true} />}


            {isFetching && !isLoading && (
                <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: 1300 }}>
                    <CircularProgress size={24} />
                </Box>
            )}
        </Box>
    );
};

export default DashboardTvModeView;