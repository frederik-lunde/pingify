// src/components/details/WebsiteDetails.tsx
import React, { useState, useMemo, useCallback, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Container, Box, Alert, Button, Skeleton, Paper, Grid as MuiGrid, SelectChangeEvent, CircularProgress } from '@mui/material';
import { keepPreviousData } from '@tanstack/react-query';

import { useWebsiteDetailsQuery, useWebsiteCheckMutation } from '../hooks'; // Adjust path
import { TimeframeKey, MonitoringResult } from '../types'; // Adjust path, potentially add MonitoringResult if needed by types below

import WebsiteDetailsHeader from '../components/details/WebsiteDetailsHeader'; // Adjust path
import RecentChecksList from '../components/details/RecentCheckList'; // Adjust path
const WebsiteCharts = React.lazy(() => import('../components/details/WebsiteCharts')); // Adjust path

// --- Type Definitions ---
// Keep these types - they define the sortable columns and direction
export type SortableColumn = 'isAvailable' | 'timestamp' | 'statusCode' | 'responseTime';
export type SortDirection = 'asc' | 'desc';

// Skeleton for the whole page content area (Keep as is)
const PageSkeleton = () => (
    // ... skeleton JSX ...
     <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
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

// Fallback for lazy loaded components (Keep as is)
const LoadingFallback = () => (
    // ... fallback JSX ...
     <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <CircularProgress />
    </Box>
);


const WebsiteDetails: React.FC = () => {
    const { websiteId: websiteIdParam } = useParams<{ websiteId: string }>();
    const navigate = useNavigate();

    const numericWebsiteId = useMemo(() => {
        const id = parseInt(websiteIdParam || '', 10);
        return isNaN(id) ? undefined : id;
    }, [websiteIdParam]);

    // --- Local UI State ---
    const [timeframeKey, setTimeframeKey] = useState<TimeframeKey>('day');
    const [checkLimit, setCheckLimit] = useState<number>(25);
    // Set default sort state correctly
    const [sortBy, setSortBy] = useState<SortableColumn>('timestamp'); // Default sort column
    const [sortDir, setSortDir] = useState<SortDirection>('desc');      // Default sort direction

    // --- TanStack Query Hook (Keep as is, it receives the state) ---
    const {
        data: websiteDetails,
        isPending: isInitialLoading,
        error: detailsError,
        isFetching: isDetailsRefetching,
        refetch: refetchDetails,
    } = useWebsiteDetailsQuery({
        websiteId: numericWebsiteId!,
        timeframe: timeframeKey,
        limit: checkLimit,
        sortBy: sortBy,    // Pass current state
        sortDir: sortDir,   // Pass current state
    }, {
        enabled: !!numericWebsiteId && numericWebsiteId > 0,
        staleTime: 1000 * 60,
        refetchOnWindowFocus: true,
        placeholderData: keepPreviousData,
    });

    // --- TanStack Mutation Hook (Keep as is) ---
    const { mutate: checkWebsite, isPending: isChecking } = useWebsiteCheckMutation();

    // --- Event Handlers ---
    const handleTimeframeChange = useCallback((event: SelectChangeEvent<TimeframeKey>) => {
        setTimeframeKey(event.target.value as TimeframeKey);
    }, []);

    const handleCheckLimitChange = useCallback((event: SelectChangeEvent<number | string>) => {
        const newLimit = Number(event.target.value);
        if (!isNaN(newLimit)) { setCheckLimit(newLimit); }
    }, []);

    // --- CORRECTED Sorting Handler ---
    const handleSort = useCallback((column: SortableColumn) => {
        // Check if the column clicked is the currently sorted column
        if (column === sortBy) {
            // If yes, just toggle the direction
            setSortDir(currentDir => (currentDir === 'desc' ? 'asc' : 'desc'));
        } else {
            // If no, set the new column as sortBy and reset direction to 'desc' (or 'asc' if preferred)
            setSortBy(column);
            setSortDir('desc'); // Default direction for a newly selected column
        }
        // Dependencies: The logic inside DEPENDS on the current sortBy and sortDir
        // to make its decision. React needs to know this to ensure the callback
        // always has the latest values when it's called.
    }, [sortBy, sortDir]); // <-- Add sortBy and sortDir as dependencies

    const handleCheckNow = useCallback(() => {
        if (!isChecking && numericWebsiteId) { checkWebsite(numericWebsiteId); }
    }, [isChecking, numericWebsiteId, checkWebsite]);

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
    const isProcessing = isDetailsRefetching || isChecking;

    // --- Render Logic (Keep as is) ---
    if (websiteIdParam !== undefined && numericWebsiteId === undefined) {
        return <Container sx={{ mt: 4 }}><Alert severity="error">Invalid Website ID provided in URL.</Alert></Container>;
    }

    if (isInitialLoading) {
        return <PageSkeleton />;
    }

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

    const showInlineError = detailsError && !!websiteDetails;

    if (!isInitialLoading && !isDetailsRefetching && !websiteDetails) {
       return <Container sx={{ mt: 4 }}><Alert severity="warning">Could not find data for this website.</Alert></Container>;
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            {showInlineError && (
                 <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => refetchDetails()}>Retry</Button>}>
                     Could not refresh data: {(detailsError as any)?.message || 'Unknown error'}. Displaying last known data.
                 </Alert>
            )}

            <WebsiteDetailsHeader
                name={name}
                url={url}
                latestResult={latestResult}
                isChecking={isChecking}
                isRefetching={isDetailsRefetching}
                onCheckNow={handleCheckNow}
                onSettingsClick={handleSettingsClick}
            />

             <Suspense fallback={<LoadingFallback />}>
                <WebsiteCharts
                    chartData={chartData}
                    uptimePercent={uptimePercent}
                    timeframeKey={timeframeKey}
                    isLoading={isProcessing}
                    onTimeframeChange={handleTimeframeChange}
                />
            </Suspense>

            {/* Pass the corrected handleSort and current sort state */}
            <RecentChecksList
                recentChecks={recentChecks}
                checkLimit={checkLimit}
                sortBy={sortBy}              // Pass current sortBy
                sortDir={sortDir}             // Pass current sortDir
                isLoading={isProcessing}
                onCheckLimitChange={handleCheckLimitChange}
                onSort={handleSort}          // Pass the corrected handler
            />
        </Container>
    );
};

export default WebsiteDetails;