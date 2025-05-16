import React from 'react';
import { Box, CircularProgress, Snackbar } from '@mui/material';
import WebsiteGrid from './WebsiteGrid';
import { WebsiteUser } from '../../types';
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

/**
 * Renders the dashboard in TV mode, displaying website cards in a grid.
 */
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
    const gridContainerSx = {
        display: 'grid',
        gap: { xs: 1, sm: 2 },
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        p: { xs: 1, sm: 2 },
        boxSizing: 'border-box',
    };
    return (
        <Box
            sx={{
                cursor: 'default',
                minHeight: '100vh',
                width: '100%',
                boxSizing: 'border-box',
                bgcolor: 'background.default',
                outline: 'none',
                position: 'relative',
            }}
            tabIndex={-1}
        >
            {}
            {isLoading && websiteCards.length === 0 && (
                 <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
                    <CircularProgress />
                </Box>
            )}
            {}
            {!isLoading && !isEmptyBecauseNoWebsites && !isEmptyDueToFilter && (
                <Box sx={gridContainerSx}>
                    <WebsiteGrid
                        websiteCards={websiteCards}
                        isLoading={false}
                        lastIncidentWebsiteId={lastIncidentWebsiteId}
                        isHighlightActive={isHighlightActive}
                        isTvMode={true}
                    />
                </Box>
            )}
            {}
            {!isLoading && isEmptyDueToFilter && (
                 <Box sx={{ p: { xs: 1, sm: 2 } }}> {}
                     <EmptyFilterResults isTvMode={true}/>
                 </Box>
            )}
            
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