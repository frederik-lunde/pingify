/*
src/pages/Dashboard.tsx (Refactored)
*/
import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
    Container, Box, CircularProgress, Button, Alert, Paper, IconButton, Tooltip, Stack
} from "@mui/material";
// Removed Menu, MenuItem, ListItemIcon, ListItemText, Snackbar - moved to sub-components
// Removed specific sort icons - moved to DashboardSortControl
import TvIcon from '@mui/icons-material/Tv';
import WebsiteGrid from "../components/dashboard/WebsiteGrid";
import DashboardSearchFilter from "../components/dashboard/DashboardSearchFilter";
import StatsHeader from "../components/dashboard/StatsHeader";
import DashboardSortControl from "../components/dashboard/SortControl"; // Import new component
import DashboardTvModeView from "../components/dashboard/TvModeView"; // Import new component
import EmptyFilterResults from "../components/dashboard/EmptyFilterResults"; // Import new component
import NoWebsitesAdded from "../components/dashboard/NoWebsitesAdded"; // Import new component
import { useWebsiteData } from "../hooks";
import { useTvMode } from "../context/TvModeContext";
import { useWebsiteListProcessor } from "../hooks/"; // Keep this hook
// Removed Link from here - moved to NoWebsitesAdded
// Removed SortOption type from here - used in hook/SortControl

// --- Sort options config removed - moved to DashboardSortControl ---

const Dashboard: React.FC = () => {
    // --- State ---
    // sortAnchorEl removed - managed by DashboardSortControl
    const { isTvMode, toggleTvMode } = useTvMode();
    const [isHighlightActive, setIsHighlightActive] = useState(false);
    const [showTvExitMessage, setShowTvExitMessage] = useState(false); // Still needed for TV Mode View prop

    // --- Data Fetching Hook ---
    const {
        websitesWithResults: allWebsites,
        overallStats,
        incidentsLast24h,
        lastIncidentTimestamp,
        lastIncidentWebsiteId,
        isLoading: isLoadingData,
        isFetching,
        error: dataError,
        refetch,
        totalWebsitesCount,
        upWebsitesCount,
    } = useWebsiteData(
        'week',
        60000 // Fetch every 60 seconds
    );

    // --- List Processing Hook ---
    const {
        processedWebsites,
        filterTerm,
        setFilterTerm,
        sortOption,
        setSortOption,
    } = useWebsiteListProcessor(allWebsites);


    // --- Derived State ---
    // openSortMenu removed - managed by DashboardSortControl

    // --- Callbacks ---
    // handleSortMenuClick, handleSortMenuClose, handleSortOptionSelectInternal removed - managed by DashboardSortControl
    const handleFilterChangeInternal = useCallback((term: string) => {
        setFilterTerm(term);
        if (term) setIsHighlightActive(false);
    }, [setFilterTerm]);

    const handleToggleHighlight = useCallback(() => {
        const shouldActivate = !isHighlightActive;
        setIsHighlightActive(shouldActivate);
        if (shouldActivate && lastIncidentWebsiteId) {
            setTimeout(() => {
                const element = document.getElementById(`website-card-grid-${lastIncidentWebsiteId}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 150);
        }
    }, [isHighlightActive, lastIncidentWebsiteId]);

    // --- Effects ---
    useEffect(() => {
        setIsHighlightActive(false);
    }, [lastIncidentWebsiteId, filterTerm]);

    // TV Mode effect remains unchanged - still controls the global listeners and message state
    useEffect(() => {
        const handleExitTvMode = () => {
            if (isTvMode) toggleTvMode();
        };

        if (isTvMode) {
            setShowTvExitMessage(true);
            const timer = setTimeout(() => setShowTvExitMessage(false), 5000);
            document.addEventListener('keydown', handleExitTvMode);
            document.addEventListener('mousedown', handleExitTvMode);
            return () => {
                clearTimeout(timer);
                document.removeEventListener('keydown', handleExitTvMode);
                document.removeEventListener('mousedown', handleExitTvMode);
                setShowTvExitMessage(false);
            };
        } else {
            setShowTvExitMessage(false);
        }
    }, [isTvMode, toggleTvMode]);


    // --- Memoized Calculations ---
    const headerUptime = useMemo(() => overallStats?.overallUptime ?? null, [overallStats]);

    // --- Render Logic Variables ---
    const showLoadingSkeleton = isLoadingData && processedWebsites.length === 0;
    const isListEmpty = !isLoadingData && processedWebsites.length === 0;
    const isEmptyDueToFilter = isListEmpty && !!filterTerm && allWebsites.length > 0;
    const isEmptyBecauseNoWebsites = isListEmpty && !filterTerm && !dataError;

    // --- Initial Loading / Error States ---
    if (isLoadingData && !overallStats && allWebsites.length === 0 && !dataError) {
        return <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh"><CircularProgress /></Box>;
    }
    if (dataError && !overallStats && allWebsites.length === 0) {
        return (
            <Container maxWidth="sm" sx={{ mt: 4, textAlign: 'center' }}>
                <Alert severity="error" sx={{ mb: 2, justifyContent: 'center' }}>
                    Error loading dashboard data: {dataError.message || 'Unknown error'}
                </Alert>
                <Button variant="outlined" onClick={() => refetch()} sx={{ mt: 1 }}>Retry</Button>
            </Container>
        );
    }

    // --- TV Mode Render ---
    if (isTvMode) {
        return (
            <DashboardTvModeView
                websites={processedWebsites}
                isLoading={showLoadingSkeleton}
                lastIncidentWebsiteId={lastIncidentWebsiteId}
                isHighlightActive={isHighlightActive}
                isFetching={isFetching}
                isEmptyDueToFilter={isEmptyDueToFilter}
                isEmptyBecauseNoWebsites={isEmptyBecauseNoWebsites}
                showTvExitMessage={showTvExitMessage}
            />
        );
    }

    // --- Standard Dashboard Render ---
    return (
        <Container maxWidth={false} sx={{ px: { xs: 1, sm: 2, md: 3 }, mt: 2, mb: 4 }}>
            {/* Stats Header */}
            <Paper elevation={1} sx={{ mb: 2 }}>
                <StatsHeader
                    isLoading={isLoadingData && !overallStats}
                    error={dataError}
                    upCount={upWebsitesCount}
                    totalCount={totalWebsitesCount}
                    uptime={headerUptime}
                    incidentsLast24h={incidentsLast24h}
                    lastIncidentTimestamp={lastIncidentTimestamp}
                    lastIncidentWebsiteId={lastIncidentWebsiteId}
                    onToggleHighlight={handleToggleHighlight}
                    isHighlightActive={isHighlightActive}
                    center={false}
                />
            </Paper>

            {/* Control Bar */}
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                mb={2}
            >
                {/* TV Mode Toggle */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ width: 'auto' }}>
                    <Tooltip title={"TV Mode (Show only grid)"}>
                        <IconButton onClick={toggleTvMode} color="default" aria-label="toggle tv mode">
                             <TvIcon />
                        </IconButton>
                    </Tooltip>
                </Stack>

                {/* Search Filter */}
                <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', width: { xs: '100%', sm: 'auto' }, px: { sm: 2 } }}>
                    <DashboardSearchFilter onFilterChange={handleFilterChangeInternal} sx={{ width: { xs: '100%', sm: 300, md: 450 } }} />
                </Box>

                {/* Sort Control Component */}
                <DashboardSortControl
                    sortOption={sortOption}
                    onSortChange={setSortOption} // Pass setter from hook directly
                    isFetching={isFetching && !isLoadingData} // Pass fetching status
                />
            </Stack>

            {/* Partial Data Error Alert */}
            {dataError && (allWebsites.length > 0 || overallStats) && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    There might be issues displaying the latest data: {dataError.message}.
                    <Button onClick={() => refetch()} size="small" sx={{ ml: 1 }} variant="outlined" color="inherit">Retry</Button>
                </Alert>
            )}

            {/* Website Grid */}
            <WebsiteGrid
                websitesWithResults={processedWebsites}
                isLoading={showLoadingSkeleton}
                lastIncidentWebsiteId={lastIncidentWebsiteId}
                isHighlightActive={isHighlightActive}
                isTvMode={false} // Explicitly false here
            />

            {/* Empty State Messages */}
            {isEmptyDueToFilter && <EmptyFilterResults />}
            {isEmptyBecauseNoWebsites && <NoWebsitesAdded isTvMode={false} />} {/* Pass isTvMode prop */}
        </Container>
    );
};

export default Dashboard;