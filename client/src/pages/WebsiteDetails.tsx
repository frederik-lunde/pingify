// src/components/details/WebsiteDetails.tsx
import React, { useState, useMemo, useCallback, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Container, Box, Alert, Button, Skeleton, Paper, Grid as MuiGrid, SelectChangeEvent, CircularProgress } from '@mui/material';
// --- Import keepPreviousData ---
import { keepPreviousData } from '@tanstack/react-query';

// --- Import Hooks, Utils, Types ---
// Adjust paths as necessary for your project structure
import { useWebsiteDetailsQuery, useWebsiteCheckMutation } from '../hooks';
import { TimeframeKey } from '../types';

// --- Import Child Components ---
// Adjust paths as necessary for your project structure
import WebsiteDetailsHeader from '../components/details/WebsiteDetailsHeader';
import RecentChecksList from '../components/details/RecentCheckList';
// Lazy load charts component
const WebsiteCharts = React.lazy(() => import('../components/details/WebsiteCharts'));


type SortableColumn = 'isAvailable' | 'timestamp' | 'statusCode' | 'responseTime';
type SortDirection = 'asc' | 'desc';

// Skeleton for the whole page content area
const PageSkeleton = () => (
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

// Fallback for lazy loaded components
const LoadingFallback = () => (
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

    // --- Local UI State (Remains in parent) ---
    const [timeframeKey, setTimeframeKey] = useState<TimeframeKey>('day');
    const [checkLimit, setCheckLimit] = useState<number>(25);
    const [sortBy, setSortBy] = useState<SortableColumn>('timestamp');
    const [sortDir, setSortDir] = useState<SortDirection>('desc');

    // --- TanStack Query Hook (v5 specific flags) ---
    const {
        data: websiteDetails,
        // Use isPending for the initial "hard" loading state in v5
        isPending: isInitialLoading,
        error: detailsError,
        // isFetching indicates *any* fetch in progress (initial or background)
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
        // Keep showing old data while fetching new data triggered by parameter changes
        placeholderData: keepPreviousData,
    });

    // --- TanStack Mutation Hook (Remains in parent) ---
    const { mutate: checkWebsite, isPending: isChecking } = useWebsiteCheckMutation();

    // --- Event Handlers (Remain in parent, passed down) ---
    const handleTimeframeChange = useCallback((event: SelectChangeEvent<TimeframeKey>) => {
        setTimeframeKey(event.target.value as TimeframeKey);
    }, []);

    const handleCheckLimitChange = useCallback((event: SelectChangeEvent<number | string>) => {
        const newLimit = Number(event.target.value);
        if (!isNaN(newLimit)) { setCheckLimit(newLimit); }
    }, []);

    const handleSort = useCallback((column: SortableColumn) => {
        setSortBy(prevSortBy => {
            setSortDir(prevDir => (prevSortBy === column && prevDir === 'desc' ? 'asc' : 'desc'));
            return column;
        });
    }, []);

    const handleCheckNow = useCallback(() => {
        if (!isChecking && numericWebsiteId) { checkWebsite(numericWebsiteId); }
    }, [isChecking, numericWebsiteId, checkWebsite]);

    const handleSettingsClick = useCallback(() => {
        if (numericWebsiteId) { navigate(`/website/${numericWebsiteId}/settings`); }
    }, [navigate, numericWebsiteId]);

    // --- Derived Data (Extract necessary parts for children) ---
    // With placeholderData, `websiteDetails` will hold previous data during refetches.
    // Defaults primarily cover the absolute initial load or error states where data is truly absent.
    const name = websiteDetails?.name ?? (isInitialLoading ? 'Loading...' : 'N/A');
    const url = websiteDetails?.url ?? '';
    const latestResult = websiteDetails?.latestResult ?? null;
    const chartData = websiteDetails?.chartData ?? [];
    const recentChecks = websiteDetails?.recentChecks ?? [];
    const uptimePercent = websiteDetails?.uptimePercent ?? 0;

    // Combined loading state for disabling interactions during background fetches or mutations
    const isProcessing = isDetailsRefetching || isChecking;

    // --- Render Logic ---
    if (websiteIdParam !== undefined && numericWebsiteId === undefined) {
        return <Container sx={{ mt: 4 }}><Alert severity="error">Invalid Website ID provided in URL.</Alert></Container>;
    }

    // Skeleton Loading State (Only for the very first fetch using `isPending`)
    if (isInitialLoading) { // <-- Using isPending directly here
        return <PageSkeleton />;
    }

    // Error State (Handles fetch errors when no data/placeholder is available)
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

    // If we have an error but ALSO have placeholder data, show a less intrusive warning
    const showInlineError = detailsError && !!websiteDetails;

    // No Data State (after initial load, if query succeeded but returned nothing)
    if (!isInitialLoading && !isDetailsRefetching && !websiteDetails) {
         // This case might be less common if the backend always returns a basic structure,
         // but good to handle if the API might return truly nothing on success.
        return <Container sx={{ mt: 4 }}><Alert severity="warning">Could not find data for this website.</Alert></Container>;
    }

     // --- Render Page Content using Children ---
     // We should have `websiteDetails` here (potentially stale due to placeholderData)
     // if not in the initial loading or hard error state.
    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            {/* Show a non-blocking error if a refetch fails but we still have old data */}
            {showInlineError && (
                 <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => refetchDetails()}>Retry</Button>}>
                     Could not refresh data: {(detailsError as any)?.message || 'Unknown error'}. Displaying last known data.
                 </Alert>
            )}

            {/* Render header - it receives potentially stale data during refetch */}
            <WebsiteDetailsHeader
                name={name}
                url={url}
                latestResult={latestResult}
                isChecking={isChecking}
                // Pass isFetching to show the small spinner during background updates
                isRefetching={isDetailsRefetching}
                onCheckNow={handleCheckNow}
                onSettingsClick={handleSettingsClick}
            />

            {/* Suspense boundary for lazy-loaded charts */}
             <Suspense fallback={<LoadingFallback />}>
                 {/* Render charts - receives potentially stale data during refetch */}
                 {/* Pass isProcessing to disable controls within the charts component */}
                <WebsiteCharts
                    chartData={chartData}
                    uptimePercent={uptimePercent}
                    timeframeKey={timeframeKey}
                    isLoading={isProcessing}
                    onTimeframeChange={handleTimeframeChange}
                />
            </Suspense>

            {/* Render list - receives potentially stale data during refetch */}
            {/* Pass isProcessing to disable controls within the list component */}
            <RecentChecksList
                recentChecks={recentChecks}
                checkLimit={checkLimit}
                sortBy={sortBy}
                sortDir={sortDir}
                isLoading={isProcessing}
                onCheckLimitChange={handleCheckLimitChange}
                onSort={handleSort}
            />
        </Container>
    );
};

export default WebsiteDetails;