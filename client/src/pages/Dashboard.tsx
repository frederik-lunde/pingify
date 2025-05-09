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

/**
 * Main dashboard component displaying website statistics and cards.
 */
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

    /**
     * Handles changes to the website filter term.
     */
    const handleFilterChangeInternal = useCallback((term: string) => {
        setFilterTerm(term);
        if (term) setIsHighlightActive(false);
    }, [setFilterTerm]);

    /**
     * Toggles highlighting of the last incident website.
     */
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
        /**
         * Exits TV mode on keydown or mousedown.
         */
        const handleExitTvMode = () => { if (isTvMode) toggleTvMode(); };
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
    const showLoadingSkeleton = isLoadingData && processedWebsites.length === 0 && !dataError;
    const isListEmpty = !isLoadingData && processedWebsites.length === 0;
    const isEmptyDueToFilter = isListEmpty && !!filterTerm && allWebsites.length > 0;
    const isTrulyEmpty = isListEmpty && !filterTerm && !dataError && !showLoadingSkeleton;

    if (isLoadingData && !dataError && !overallStats && allWebsites.length === 0) {
        return <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh"><CircularProgress data-testid="dashboard-initial-loading" /></Box>;
    }

    if (dataError) {
        return <DataFetchError error={dataError as ApiError} onRetry={refetch} context="Dashboard Data" />;
    }

    return (
        <Box sx={{ width: '100%',  }}>
            {}
            <Box
                sx={{
                    display: isTvMode ? 'none' : 'block',
                    px: { xs: 1, sm: 2, md: 3 },
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
                        onToggleTvMode={toggleTvMode}
                        isRefetching={isBackgroundActivity && !isLoadingData}
                    />
                </Paper>
                {}
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
                        isTvMode={false}
                    />
                    {!showLoadingSkeleton && !filterTerm && (
                        <AddWebsiteCard />
                    )}
                </Box>
                {isEmptyDueToFilter && <EmptyFilterResults />}
            </Box>
            {}
            <Box
                sx={{
                    display: isTvMode ? 'block' : 'none',
                     minHeight: '100vh',
                     width: '100%',
                }}
            >
                {}
                {}
                <TvModeView
                    websiteCards={processedWebsites}
                    isLoading={showLoadingSkeleton}
                    lastIncidentWebsiteId={lastIncidentWebsiteId}
                    isHighlightActive={isHighlightActive}
                    isFetching={isBackgroundActivity}
                    isEmptyDueToFilter={isEmptyDueToFilter}
                    isEmptyBecauseNoWebsites={isTrulyEmpty}
                    showTvExitMessage={showTvExitMessage}
                />
            </Box>
        </Box>
    );
};
export default Dashboard;