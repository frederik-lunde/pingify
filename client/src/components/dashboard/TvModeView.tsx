// src/components/dashboard/TvModeView.tsx
import React from 'react';
import { Box, CircularProgress, Snackbar } from '@mui/material';
import WebsiteGrid from './WebsiteGrid';
// --- MODIFIED: Remove WebsiteWithResults, use WebsiteUser ---
import { WebsiteUser } from '../../types';
import NoWebsitesAdded from './NoWebsitesAdded';
import EmptyFilterResults from './EmptyFilterResults';

interface TvModeViewProps {
    // --- MODIFIED: Changed prop name and type ---
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
    // --- MODIFIED: Use websiteCards ---
    websiteCards,
    isLoading,
    lastIncidentWebsiteId,
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
                p: { xs: 1, sm: 2, md: 0 },
                boxSizing: 'border-box',
                bgcolor: 'background.default',
                outline: 'none',
                position: 'relative',
            }}
            tabIndex={-1}
        >
            {/* --- MODIFIED: Check websiteCards.length --- */}
            {isLoading && websiteCards.length === 0 && (
                 <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
                    <CircularProgress />
                </Box>
            )}

            {!isLoading && !isEmptyBecauseNoWebsites && !isEmptyDueToFilter && (
                 <WebsiteGrid
                    // --- MODIFIED: Pass websiteCards ---
                    websiteCards={websiteCards}
                    isLoading={false}
                    lastIncidentWebsiteId={lastIncidentWebsiteId}
                    isHighlightActive={isHighlightActive}
                    isTvMode={true}
                />
            )}

            {!isLoading && isEmptyDueToFilter && <EmptyFilterResults isTvMode={true}/>}
            {!isLoading && isEmptyBecauseNoWebsites && <NoWebsitesAdded isTvMode={true} />}

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