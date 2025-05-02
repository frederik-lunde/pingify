// src/pages/Dashboard.tsx
import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
    Box, CircularProgress, Paper,
} from "@mui/material";
import WebsiteGrid from "../components/dashboard/WebsiteGrid";
import StatsHeader from "../components/dashboard/StatsHeader";
import TvModeView from "../components/dashboard/TvModeView";
import EmptyFilterResults from "../components/dashboard/EmptyFilterResults";
import AddWebsiteCard from "../components/dashboard/AddWebsiteCard";
import DataFetchError from "../components/common/DataFetchError";
import { useWebsiteData } from "../hooks";
import { useTvMode } from "../context/TvModeContext";
import { useWebsiteListProcessor } from "../hooks/";
import { ApiError } from "../types";

const Dashboard: React.FC = () => {
    // --- Hooks remain the same ---
    const { isTvMode, toggleTvMode } = useTvMode();
    const [isHighlightActive, setIsHighlightActive] = useState(false);
    const [showTvExitMessage, setShowTvExitMessage] = useState(false); // Keep for TvModeView

    const {
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
    } = useWebsiteData('week', 30000);

    const {
        processedWebsites,
        filterTerm,
        setFilterTerm,
        sortOption,
        setSortOption,
    } = useWebsiteListProcessor(allWebsites);

    const isBackgroundActivity = isFetching;

    // --- Callbacks and Effects remain largely the same ---
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

     // Effect for TV mode exit (using listeners directly in TvModeContext is often better)
     // Keep this one if TvModeView needs the showTvExitMessage prop specifically
    useEffect(() => {
        const handleExitTvMode = () => { if (isTvMode) toggleTvMode(); };
        if (isTvMode) {
            setShowTvExitMessage(true);
            const timer = setTimeout(() => setShowTvExitMessage(false), 5000);
            // Consider if listeners in Context are sufficient and remove these if redundant
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

    const showLoadingSkeleton = isLoadingData && processedWebsites.length === 0 && !dataError;
    const isListEmpty = !isLoadingData && processedWebsites.length === 0;
    const isEmptyDueToFilter = isListEmpty && !!filterTerm && allWebsites.length > 0;
    const isTrulyEmpty = isListEmpty && !filterTerm && !dataError && !showLoadingSkeleton;

    // --- Handle Initial Load / Error States (remain the same) ---
    if (isLoadingData && !dataError && !overallStats && allWebsites.length === 0) {
        return <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh"><CircularProgress data-testid="dashboard-initial-loading" /></Box>;
    }
    if (dataError) {
        return <DataFetchError error={dataError as ApiError} onRetry={refetch} context="Dashboard Data" />;
    }

    // --- *** MODIFIED RENDER LOGIC *** ---
    return (
        // Keep a single outer container, maybe removing padding if TvModeView handles its own
        <Box sx={{ width: '100%', /* Removed px here, apply within sections */ }}>

            {/* Standard Dashboard View Container */}
            <Box
                sx={{
                    display: isTvMode ? 'none' : 'block', // Hide if in TV mode
                    px: { xs: 1, sm: 2, md: 3 }, // Apply padding here
                    mt: 2,
                    mb: 4,
                }}
            >
                <Paper elevation={1} sx={{ mb: 1 }}>
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
                        layoutMode="dashboard"
                        filterTerm={filterTerm}
                        onFilterChange={handleFilterChangeInternal}
                        sortOption={sortOption}
                        onSortChange={setSortOption}
                        onToggleTvMode={toggleTvMode} // Keep toggle button here
                        isRefetching={isBackgroundActivity && !isLoadingData}
                    />
                </Paper>

                {/* Grid Container */}
                <Box
                    sx={{
                        display: 'grid',
                        gap: 2,
                        gridTemplateColumns: 'repeat(auto-fill, minmax(325px, 1fr))',
                        pt: 2,
                    }}
                    data-testid="website-grid-container"
                >
                    <WebsiteGrid
                        websiteCards={processedWebsites}
                        isLoading={showLoadingSkeleton}
                        lastIncidentWebsiteId={lastIncidentWebsiteId}
                        isHighlightActive={isHighlightActive}
                        isTvMode={false} // Explicitly false for standard grid
                    />
                    {!showLoadingSkeleton && !filterTerm && (
                        <AddWebsiteCard />
                    )}
                </Box>

                {isEmptyDueToFilter && <EmptyFilterResults />}
            </Box>

            {/* TV Mode View Container */}
            <Box
                sx={{
                    display: isTvMode ? 'block' : 'none', // Show ONLY if in TV mode
                    // Take up full space if needed, TvModeView might handle its own sizing/padding
                     minHeight: '100vh', // Ensure it can fill screen height
                     width: '100%',
                }}
            >
                {/* Render TvModeView unconditionally when its container is visible */}
                {/* Avoid passing isTvMode down if TvModeView doesn't use it directly */}
                <TvModeView
                    websiteCards={processedWebsites} // Pass processed data
                    isLoading={showLoadingSkeleton} // Pass loading state
                    lastIncidentWebsiteId={lastIncidentWebsiteId}
                    isHighlightActive={isHighlightActive} // Pass highlight state
                    isFetching={isBackgroundActivity} // Pass refetching state
                    isEmptyDueToFilter={isEmptyDueToFilter} // Pass empty state flags
                    isEmptyBecauseNoWebsites={isTrulyEmpty}
                    showTvExitMessage={showTvExitMessage} // Pass exit message flag
                />
            </Box>
        </Box>
    );
};

export default Dashboard;