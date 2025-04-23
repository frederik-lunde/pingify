// src/pages/Dashboard.tsx
import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
    Container, Box, CircularProgress, Paper, IconButton, Tooltip, Stack, // Removed Button, Alert, Typography imports used only for old error display
} from "@mui/material";
import TvIcon from '@mui/icons-material/Tv';
import WebsiteGrid from "../components/dashboard/WebsiteGrid";
import DashboardSearchFilter from "../components/dashboard/DashboardSearchFilter";
import StatsHeader from "../components/dashboard/StatsHeader";
import DashboardSortControl from "../components/dashboard/SortControl";
import TvModeView from "../components/dashboard/TvModeView";
import EmptyFilterResults from "../components/dashboard/EmptyFilterResults";
import NoWebsitesAdded from "../components/dashboard/NoWebsitesAdded";
import DataFetchError from "../components/common/DataFetchError"; // Import the new error component
import { useWebsiteData } from "../hooks";
import { useTvMode } from "../context/TvModeContext";
import { useWebsiteListProcessor } from "../hooks/";
import { ApiError } from "../types";

const Dashboard: React.FC = () => {
    const { isTvMode, toggleTvMode } = useTvMode();
    const [isHighlightActive, setIsHighlightActive] = useState(false);
    const [showTvExitMessage, setShowTvExitMessage] = useState(false);

    const {
        websitesWithResults: allWebsites,
        overallStats,
        incidentsLast24h,
        lastIncidentTimestamp,
        lastIncidentWebsiteId,
        isLoading: isLoadingData,
        isFetching,
        error: dataError, // The error object from the hook
        refetch,
        totalWebsitesCount,
        upWebsitesCount,
    } = useWebsiteData(
        'week',
        60000
    );

    const {
        processedWebsites,
        filterTerm,
        setFilterTerm,
        sortOption,
        setSortOption,
    } = useWebsiteListProcessor(allWebsites);

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

    useEffect(() => {
        setIsHighlightActive(false);
    }, [lastIncidentWebsiteId, filterTerm]);

    useEffect(() => {
        const handleExitTvMode = () => {
            if (isTvMode) toggleTvMode();
        };
        // ... (rest of the effect remains the same) ...
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

    const headerUptime = useMemo(() => overallStats?.overallUptime ?? null, [overallStats]);

    const showLoadingSkeleton = isLoadingData && processedWebsites.length === 0 && !dataError; // Don't show skeleton if error
    const isListEmpty = !isLoadingData && processedWebsites.length === 0;
    const isEmptyDueToFilter = isListEmpty && !!filterTerm && allWebsites.length > 0;
    const isEmptyBecauseNoWebsites = isListEmpty && !filterTerm && !dataError; // Ensure no error

    // --- Initial Loading State ---
    // Display loading spinner ONLY if loading and there's NO error yet.
    if (isLoadingData && !dataError && !overallStats && allWebsites.length === 0) {
        return <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh"><CircularProgress data-testid="dashboard-initial-loading" /></Box>;
    }

    // --- CRITICAL ERROR STATE ---
    // If there's an error, display the DataFetchError component immediately.
    // This handles both initial load errors and errors during refetching.
    if (dataError) {
        return (
            <DataFetchError
                error={dataError as ApiError}
                onRetry={refetch}
                context="Dashboard Data"
            />
        );
    }

    // --- TV Mode Render ---
    // No error handling needed here anymore, as it's caught above.
    if (isTvMode) {
        return (
            <TvModeView
                websites={processedWebsites}
                isLoading={showLoadingSkeleton} // Pass skeleton loading state
                lastIncidentWebsiteId={lastIncidentWebsiteId}
                isHighlightActive={isHighlightActive}
                isFetching={isFetching}
                isEmptyDueToFilter={isEmptyDueToFilter}
                isEmptyBecauseNoWebsites={isEmptyBecauseNoWebsites}
                showTvExitMessage={showTvExitMessage}
                // errorMessage prop is removed as errors are handled globally now
            />
        );
    }

    // --- Standard Dashboard Render (only if no error and not initial loading) ---
    return (
        <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2, md: 3 }, mt: 2, mb: 4 }}>
            {/* Stats Header - Removed error prop */}
            <Paper elevation={1} sx={{ mb: 2 }}>
                <StatsHeader
                    isLoading={isLoadingData && !overallStats} // Show loading if stats specifically are loading
                    // error prop removed
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

            {/* Control Bar - Remains the same */}
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                mb={2}
            >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ width: 'auto' }}>
                    <Tooltip title={"TV Mode (Show only grid)"}>
                        <IconButton onClick={toggleTvMode} color="default" aria-label="toggle tv mode">
                             <TvIcon />
                        </IconButton>
                    </Tooltip>
                </Stack>
                <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', width: { xs: '100%', sm: 'auto' }, px: { sm: 2 } }}>
                    <DashboardSearchFilter onFilterChange={handleFilterChangeInternal} sx={{ width: { xs: '100%', sm: 300, md: 450 } }} />
                </Box>
                <DashboardSortControl
                    sortOption={sortOption}
                    onSortChange={setSortOption}
                    isFetching={isFetching && !isLoadingData}
                />
            </Stack>

            {/* Partial Data Error Alert REMOVED */}

            {/* Website Grid */}
            <WebsiteGrid
                websitesWithResults={processedWebsites}
                isLoading={showLoadingSkeleton} // Pass skeleton loading state
                lastIncidentWebsiteId={lastIncidentWebsiteId}
                isHighlightActive={isHighlightActive}
                isTvMode={false}
            />

            {/* Empty State Messages */}
            {isEmptyDueToFilter && <EmptyFilterResults />}
            {isEmptyBecauseNoWebsites && <NoWebsitesAdded isTvMode={false} />}
        </Container>
    );
};

export default Dashboard;