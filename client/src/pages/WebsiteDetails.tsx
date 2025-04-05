// src/components/details/WebsiteDetails.tsx
import React, { useState, useMemo, useCallback, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Container, Box, Alert, Button, Skeleton, Paper, Grid as MuiGrid, SelectChangeEvent, CircularProgress } from '@mui/material';
import { keepPreviousData } from '@tanstack/react-query';

import { useWebsiteDetailsQuery, useWebsiteCheckMutation } from '../hooks'; // Adjust path if needed
import { TimeframeKey, MonitoringResult } from '../types'; // Adjust path if needed

import WebsiteDetailsHeader from '../components/details/WebsiteDetailsHeader'; // Adjust path if needed
import RecentChecksList from '../components/details/RecentCheckList'; // Adjust path if needed
const WebsiteCharts = React.lazy(() => import('../components/details/WebsiteCharts')); // Adjust path if needed

export type SortableColumn = 'isAvailable' | 'timestamp' | 'statusCode' | 'responseTime';
export type SortDirection = 'asc' | 'desc';

// --- Skeletons & Fallbacks (Keep as is) ---
const PageSkeleton = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Example skeleton structure */}
        <Paper sx={{ p: 2, mb: 3 }}><Skeleton variant="rectangular" height={80} /></Paper>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}><Skeleton variant="rectangular" width={150} height={40} /></Box>
        <MuiGrid container spacing={3} sx={{ mb: 3 }}>
            <MuiGrid item xs={12} md={6}><Paper sx={{ p: 2 }}><Skeleton variant="rectangular" height={300} /></Paper></MuiGrid>
            <MuiGrid item xs={12} md={6}><Paper sx={{ p: 2 }}><Skeleton variant="rectangular" height={300} /></Paper></MuiGrid>
        </MuiGrid>
        <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Skeleton variant="text" width={150} height={30} />
                <Skeleton variant="rectangular" width={100} height={40} />
            </Box>
            <Skeleton variant="rectangular" height={200} />
        </Paper>
    </Container>
);

const LoadingFallback = () => (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <CircularProgress />
    </Box>
);
// --- End Skeletons & Fallbacks ---

const WebsiteDetails: React.FC = () => {
    const { websiteId: websiteIdParam } = useParams<{ websiteId: string }>();
    const navigate = useNavigate();

    const numericWebsiteId = useMemo(() => {
        const id = parseInt(websiteIdParam || '', 10);
        return isNaN(id) ? undefined : id;
    }, [websiteIdParam]);

    // --- Local UI State (Keep as is) ---
    const [timeframeKey, setTimeframeKey] = useState<TimeframeKey>('day');
    const [checkLimit, setCheckLimit] = useState<number>(25);
    const [sortBy, setSortBy] = useState<SortableColumn>('timestamp');
    const [sortDir, setSortDir] = useState<SortDirection>('desc');

    const {
        data: websiteDetails,
        isPending: isInitialLoading,
        error: detailsError,
        // Explicitly use isFetching for background loading states (e.g., refetch after mutation or window focus)
        isFetching: isDetailsRefetching,
        refetch: refetchDetails,
    } = useWebsiteDetailsQuery({
        websiteId: numericWebsiteId!,
        timeframe: timeframeKey,
        limit: checkLimit,
        sortBy: sortBy,
        sortDir: sortDir,
    }, {
        enabled: !!numericWebsiteId && numericWebsiteId > 0,
        staleTime: 1000 * 60, // 1 minute
        refetchOnWindowFocus: true,
        placeholderData: keepPreviousData, // Keep showing old data while fetching new
    });

    const { mutate: checkWebsite, isPending: isChecking } = useWebsiteCheckMutation();

    // --- Event Handlers (Keep as is, including corrected handleSort) ---
    const handleTimeframeChange = useCallback((event: SelectChangeEvent<TimeframeKey>) => {
        setTimeframeKey(event.target.value as TimeframeKey);
    }, []);

    const handleCheckLimitChange = useCallback((event: SelectChangeEvent<number | string>) => {
        const newLimit = Number(event.target.value);
        if (!isNaN(newLimit)) { setCheckLimit(newLimit); }
    }, []);

    const handleSort = useCallback((column: SortableColumn) => {
        if (column === sortBy) {
            setSortDir(currentDir => (currentDir === 'desc' ? 'asc' : 'desc'));
        } else {
            setSortBy(column);
            setSortDir('desc');
        }
    }, [sortBy]); // sortDir is implicitly handled by the logic, sortBy is the trigger

    const handleCheckNow = useCallback(() => {
        // Disable checkNow if a manual check is pending OR a background refetch is happening
        if (!isChecking && !isDetailsRefetching && numericWebsiteId) {
            checkWebsite(numericWebsiteId);
        }
    }, [isChecking, isDetailsRefetching, numericWebsiteId, checkWebsite]);

    const handleSettingsClick = useCallback(() => {
        if (numericWebsiteId) { navigate(`/website/${numericWebsiteId}/settings`); }
    }, [navigate, numericWebsiteId]);

    // --- Derived Data (Keep as is) ---
    const name = websiteDetails?.name ?? (isInitialLoading ? 'Loading...' : 'N/A');
    const url = websiteDetails?.url ?? '';
    const latestResult = websiteDetails?.latestResult ?? null;
    const chartData = websiteDetails?.chartData ?? [];
    const recentChecks = websiteDetails?.recentChecks ?? [];
    const uptimePercent = websiteDetails?.uptimePercent ?? 0;

    // *** Define loading states more granularly ***
    // General background processing (query refetch or mutation) - useful for disabling fetch-triggering controls
    const isProcessingData = isDetailsRefetching || isChecking;
    // Specific state for the manual "Check Now" action being in progress
    const isManualChecking = isChecking;
    // Specific state for background data refreshing (e.g., stale data refetch, window focus refetch)
    const isBackgroundRefetching = isDetailsRefetching && !isChecking; // Only true if refetching but not due to manual check


    if (websiteIdParam !== undefined && numericWebsiteId === undefined) {
        return <Container sx={{ mt: 4 }}><Alert severity="error">Invalid Website ID provided in URL.</Alert></Container>;
    }

    // Skeleton Loading State (Use isInitialLoading for the *first* load)
    if (isInitialLoading) {
        return <PageSkeleton />;
    }

    // Error State (Keep as is)
    if (detailsError && !websiteDetails) {
        const errorMessage = (detailsError as any)?.message || 'An unknown error occurred';
        return (
            <Container sx={{ mt: 4 }}>
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => refetchDetails()}>Retry</Button>}>
                    Error loading website details: {errorMessage}
                </Alert>
            </Container>
        );
    }

    // Handle case where refetch fails but we have placeholder data (from keepPreviousData)
    const showInlineError = detailsError && !!websiteDetails;

    // No Data State (Keep as is) - Check after initial load and potential refetches
    if (!isInitialLoading && !isDetailsRefetching && !websiteDetails) {
       return <Container sx={{ mt: 4 }}><Alert severity="warning">Could not find data for this website.</Alert></Container>;
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            {/* Inline error for failed refetches (Keep as is) */}
            {showInlineError && (
                <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => refetchDetails()}>Retry</Button>}>
                    Could not refresh data: {(detailsError as any)?.message || 'Unknown error'}. Displaying last known data.
                </Alert>
            )}

            {/* Pass specific loading states to Header */}
            <WebsiteDetailsHeader
                name={name}
                url={url}
                latestResult={latestResult}
                // isChecking specifically tracks the manual "Check Now" mutation
                isChecking={isManualChecking}
                // isRefetching tracks background data updates (not the manual check)
                isRefetching={isBackgroundRefetching}
                onCheckNow={handleCheckNow}
                onSettingsClick={handleSettingsClick}
                // Header internal logic should disable "Check Now" if isChecking or isRefetching is true.
                // Settings button might only be disabled during isChecking, or not at all.
            />

            {/* Suspense boundary for lazy-loaded charts */}
             <Suspense fallback={<LoadingFallback />}>
                 {/* Charts: Timeframe select SHOULD be disabled during any data processing */}
                <WebsiteCharts
                    chartData={chartData}
                    uptimePercent={uptimePercent}
                    timeframeKey={timeframeKey}
                    // Disable timeframe selection if any data fetch/mutation is in progress
                    isLoading={isProcessingData}
                    onTimeframeChange={handleTimeframeChange}
                />
            </Suspense>

            {/* Pass appropriate loading state to List */}
            <RecentChecksList
                recentChecks={recentChecks}
                checkLimit={checkLimit}
                sortBy={sortBy}
                sortDir={sortDir}
                // Disable limit selector if any data fetch/mutation is in progress
                isLoading={isProcessingData}
                onCheckLimitChange={handleCheckLimitChange}
                onSort={handleSort}
                // List internal logic should use `isLoading` to disable the 'Limit' Select.
                // Sorting headers should likely remain enabled even during loading.
            />
        </Container>
    );
};

export default WebsiteDetails;