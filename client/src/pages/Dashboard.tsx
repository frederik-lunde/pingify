// src/pages/Dashboard.tsx
import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
    Container, Box, CircularProgress, Paper, IconButton, Tooltip, Stack,
} from "@mui/material";
import TvIcon from '@mui/icons-material/Tv';
import WebsiteGrid from "../components/dashboard/WebsiteGrid";
import DashboardSearchFilter from "../components/dashboard/DashboardSearchFilter";
import StatsHeader from "../components/dashboard/StatsHeader";
import DashboardSortControl from "../components/dashboard/SortControl";
import TvModeView from "../components/dashboard/TvModeView";
import EmptyFilterResults from "../components/dashboard/EmptyFilterResults";
import NoWebsitesAdded from "../components/dashboard/NoWebsitesAdded";
import DataFetchError from "../components/common/DataFetchError";
import { useWebsiteData } from "../hooks";
import { useTvMode } from "../context/TvModeContext";
import { useWebsiteListProcessor } from "../hooks/";
import { ApiError } from "../types";

const Dashboard: React.FC = () => {
    const { isTvMode, toggleTvMode } = useTvMode();
    const [isHighlightActive, setIsHighlightActive] = useState(false);
    const [showTvExitMessage, setShowTvExitMessage] = useState(false);

    const {
        // --- MODIFIED: Destructure using the correct property name ---
        websiteCards: allWebsites,
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
        'week', // Default stats period
        30000 // Refetch interval (e.g., 1 minute)
    );

    // useWebsiteListProcessor expects WebsiteUser[] which `allWebsites` now correctly is
    const {
        processedWebsites,
        filterTerm,
        setFilterTerm,
        sortOption,
        setSortOption,
    } = useWebsiteListProcessor(allWebsites); // Pass the correctly named variable

    const handleFilterChangeInternal = useCallback((term: string) => {
        setFilterTerm(term);
        if (term) setIsHighlightActive(false); // Disable highlight when filtering
    }, [setFilterTerm]);

    const handleToggleHighlight = useCallback(() => {
        const shouldActivate = !isHighlightActive;
        setIsHighlightActive(shouldActivate);
        if (shouldActivate && lastIncidentWebsiteId) {
            // Scroll to highlighted card after a short delay
            setTimeout(() => {
                const element = document.getElementById(`website-card-grid-${lastIncidentWebsiteId}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 150);
        }
    }, [isHighlightActive, lastIncidentWebsiteId]);

    // Effect to disable highlight when incident changes or filter is applied
    useEffect(() => {
        setIsHighlightActive(false);
    }, [lastIncidentWebsiteId, filterTerm]);

    // Effect for TV Mode exit handling
    useEffect(() => {
        const handleExitTvMode = () => {
            if (isTvMode) toggleTvMode();
        };
        if (isTvMode) {
            setShowTvExitMessage(true);
            const timer = setTimeout(() => setShowTvExitMessage(false), 5000);
            // Add event listeners
            document.addEventListener('keydown', handleExitTvMode);
            document.addEventListener('mousedown', handleExitTvMode);
            // Cleanup function
            return () => {
                clearTimeout(timer);
                document.removeEventListener('keydown', handleExitTvMode);
                document.removeEventListener('mousedown', handleExitTvMode);
                setShowTvExitMessage(false); // Hide message on exit
            };
        } else {
            setShowTvExitMessage(false); // Ensure message is hidden if not in TV mode
        }
    }, [isTvMode, toggleTvMode]);

    const headerUptime = useMemo(() => overallStats?.overallUptime ?? null, [overallStats]);

    const showLoadingSkeleton = isLoadingData && processedWebsites.length === 0 && !dataError;
    const isListEmpty = !isLoadingData && processedWebsites.length === 0;
    const isEmptyDueToFilter = isListEmpty && !!filterTerm && allWebsites.length > 0;
    const isEmptyBecauseNoWebsites = isListEmpty && !filterTerm && !dataError;

    // --- Initial Loading State ---
    if (isLoadingData && !dataError && !overallStats && allWebsites.length === 0) {
        return <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh"><CircularProgress data-testid="dashboard-initial-loading" /></Box>;
    }

    // --- CRITICAL ERROR STATE ---
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
    if (isTvMode) {
        return (
            <TvModeView
                // --- MODIFIED: Pass correct prop name ---
                websiteCards={processedWebsites}
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
        <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2, md: 3 }, mt: 2, mb: 4 }}>
            <Paper elevation={1} sx={{ mb: 2 }}>
                <StatsHeader
                    isLoading={isLoadingData && !overallStats}
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

            <WebsiteGrid
                // --- MODIFIED: Pass correct prop name ---
                websiteCards={processedWebsites}
                isLoading={showLoadingSkeleton}
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