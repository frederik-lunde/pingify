import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
    Box, CircularProgress, Paper,
} from "@mui/material";
import WebsiteGrid from "../components/dashboard/WebsiteGrid";
import StatsHeader from "../components/dashboard/StatsHeader";
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
        websiteCards: allWebsites,
        overallStats,
        incidentsLast24h,
        lastIncidentTimestamp,
        lastIncidentWebsiteId,
        isLoading: isLoadingData, // Indicates initial data load
        isFetching, // Indicates background refetching
        error: dataError,
        refetch,
        totalWebsitesCount,
        upWebsitesCount,
    } = useWebsiteData(
        'week',
        30000 // Refetch interval (e.g., 30 seconds)
    );

    const {
        processedWebsites,
        filterTerm,
        setFilterTerm,
        sortOption,
        setSortOption,
    } = useWebsiteListProcessor(allWebsites);

    // isFetching indicates background data refetching
    const isBackgroundActivity = isFetching;

    const handleFilterChangeInternal = useCallback((term: string) => {
        setFilterTerm(term);
        if (term) setIsHighlightActive(false); // Clear highlight on filter change
    }, [setFilterTerm]);

    const handleToggleHighlight = useCallback(() => {
        const shouldActivate = !isHighlightActive;
        setIsHighlightActive(shouldActivate);
        if (shouldActivate && lastIncidentWebsiteId) {
            // Scroll to the highlighted card after a short delay
            setTimeout(() => {
                const element = document.getElementById(`website-card-grid-${lastIncidentWebsiteId}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 150);
        }
    }, [isHighlightActive, lastIncidentWebsiteId]);

    // Effect to deactivate highlight if the last incident changes or filter is applied
    useEffect(() => {
        setIsHighlightActive(false);
    }, [lastIncidentWebsiteId, filterTerm]);

    // Effect to handle TV Mode exit logic
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
                setShowTvExitMessage(false); // Ensure message is hidden on cleanup
            };
        } else {
            setShowTvExitMessage(false); // Ensure message is hidden if not in TV mode
        }
    }, [isTvMode, toggleTvMode]);

    const headerUptime = useMemo(() => overallStats?.overallUptime ?? null, [overallStats]);

    // Determine loading/empty states for the grid
    const showLoadingSkeleton = isLoadingData && processedWebsites.length === 0 && !dataError;
    const isListEmpty = !isLoadingData && processedWebsites.length === 0;
    const isEmptyDueToFilter = isListEmpty && !!filterTerm && allWebsites.length > 0;
    const isEmptyBecauseNoWebsites = isListEmpty && !filterTerm && !dataError;

    // --- Initial Loading State for the entire page ---
    if (isLoadingData && !dataError && !overallStats && allWebsites.length === 0) {
        return <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh"><CircularProgress data-testid="dashboard-initial-loading" /></Box>;
    }

    // --- Error State ---
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
                websiteCards={processedWebsites}
                isLoading={showLoadingSkeleton}
                lastIncidentWebsiteId={lastIncidentWebsiteId}
                isHighlightActive={isHighlightActive}
                // Pass isFetching for the spinner in TV mode corner
                isFetching={isBackgroundActivity}
                isEmptyDueToFilter={isEmptyDueToFilter}
                isEmptyBecauseNoWebsites={isEmptyBecauseNoWebsites}
                showTvExitMessage={showTvExitMessage}
            />
        );
    }

    // --- Standard Dashboard Render ---
    return (
        <Box sx={{ px: { xs: 1, sm: 2, md: 3 }, mt: 2, mb: 4, width: '100%' }}>

            <Paper elevation={1} sx={{ mb: 1 }}>
                <StatsHeader
                    // Stats Props
                    isLoading={isLoadingData && !overallStats} // Loading specifically for initial stats section rendering
                    upCount={upWebsitesCount}
                    totalCount={totalWebsitesCount}
                    uptime={headerUptime}
                    incidentsLast24h={incidentsLast24h}
                    lastIncidentTimestamp={lastIncidentTimestamp}
                    lastIncidentWebsiteId={lastIncidentWebsiteId}
                    onToggleHighlight={handleToggleHighlight}
                    isHighlightActive={isHighlightActive}
                    layoutMode="dashboard" // Explicitly set layout mode

                    // Control Props
                    filterTerm={filterTerm}
                    onFilterChange={handleFilterChangeInternal}
                    sortOption={sortOption}
                    onSortChange={setSortOption}
                    onToggleTvMode={toggleTvMode}
                    // Pass the background fetching state for the subtle indicator
                    // Show indicator only during background refetch, not initial load
                    isRefetching={isBackgroundActivity && !isLoadingData}
                />
            </Paper>

            <WebsiteGrid
                websiteCards={processedWebsites}
                isLoading={showLoadingSkeleton} // For skeleton cards on initial load
                lastIncidentWebsiteId={lastIncidentWebsiteId}
                isHighlightActive={isHighlightActive}
                isTvMode={false}
                // Optionally pass isRefetching here if you want grid dimming (Option 2)
                // isRefetching={isBackgroundActivity && !isLoadingData}
            />

            {/* Empty state messages */}
            {isEmptyDueToFilter && <EmptyFilterResults />}
            {isEmptyBecauseNoWebsites && <NoWebsitesAdded isTvMode={false} />}
        </Box>
    );
};

export default Dashboard;