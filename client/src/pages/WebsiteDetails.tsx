// src/components/details/WebsiteDetails.tsx
import React, { useState, useMemo, useCallback, Suspense } from 'react'; // Added Suspense
import { useParams, useNavigate } from 'react-router';
import { Container, Box, Alert, Button, Skeleton, Paper, Grid as MuiGrid, SelectChangeEvent } from '@mui/material'; // Renamed Grid to avoid conflict

// --- Import Hooks, Utils, Types ---
import { useWebsiteDetailsQuery, useWebsiteCheckMutation } from '../hooks'; // Adjust path
import { TimeframeKey } from '../types'; // Adjust path

// --- Import Child Components ---
import WebsiteDetailsHeader from '../components/details/WebsiteDetailsHeader'; // Adjust path
import RecentChecksList from '../components/details/RecentCheckList'; // Adjust path
// Lazy load charts component
const WebsiteCharts = React.lazy(() => import('../components/details/WebsiteCharts')); // Adjust path


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

    // --- TanStack Query Hook (Remains in parent) ---
    const {
        data: websiteDetails,
        isLoading: isDetailsLoading, // Use this for initial skeleton
        error: detailsError,
        isFetching: isDetailsRefetching, // Use this for loading indicators on children
        refetch: refetchDetails,
    } = useWebsiteDetailsQuery({
        websiteId: numericWebsiteId!,
        timeframe: timeframeKey,
        limit: checkLimit,
        sortBy: sortBy,
        sortDir: sortDir,
    }, {
        enabled: !!numericWebsiteId && numericWebsiteId > 0,
        staleTime: 1000 * 60,
        refetchOnWindowFocus: true,
        // Consider placeholderData for TQv5+ for smoother loading
        // placeholderData: keepPreviousData // Example TQ v5 feature
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
    const name = websiteDetails?.name ?? 'Loading...';
    const url = websiteDetails?.url ?? '';
    const latestResult = websiteDetails?.latestResult ?? null;
    const chartData = websiteDetails?.chartData ?? [];
    const recentChecks = websiteDetails?.recentChecks ?? [];
    const uptimePercent = websiteDetails?.uptimePercent ?? 0;

    // Combined loading state for children that need to disable interactions
    const isProcessing = isDetailsRefetching || isChecking;

    // --- Render Logic ---
    if (websiteIdParam !== undefined && numericWebsiteId === undefined) {
        return <Container sx={{ mt: 4 }}><Alert severity="error">Invalid Website ID provided in URL.</Alert></Container>;
    }

    // Skeleton Loading State (Only for the very first load)
    if (isDetailsLoading && !websiteDetails) {
        return <PageSkeleton />;
    }

    // Error State
    if (detailsError) {
        const errorMessage = (detailsError as any)?.message || 'An unknown error occurred';
        return (
            <Container sx={{ mt: 4 }}>
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => refetchDetails()}>Retry</Button>}>
                    Error loading website details: {errorMessage}
                </Alert>
            </Container>
        );
    }

    // No Data State (Should ideally be handled by query returning null/empty data)
    if (!isDetailsLoading && !websiteDetails) {
        return <Container sx={{ mt: 4 }}><Alert severity="warning">Could not find data for this website.</Alert></Container>;
    }

    // --- Render Page Content using Children ---
    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <WebsiteDetailsHeader
                name={name}
                url={url}
                latestResult={latestResult}
                isChecking={isChecking}
                isRefetching={isDetailsRefetching} // Pass specifically for header indicator
                onCheckNow={handleCheckNow}
                onSettingsClick={handleSettingsClick}
            />

            {/* Suspense boundary for lazy-loaded charts */}
             <Suspense fallback={<PageSkeleton /> /* Or a more specific chart skeleton */}>
                <WebsiteCharts
                    chartData={chartData}
                    uptimePercent={uptimePercent}
                    timeframeKey={timeframeKey}
                    isLoading={isProcessing} // Use combined state for disabling controls
                    onTimeframeChange={handleTimeframeChange}
                />
            </Suspense>

            <RecentChecksList
                recentChecks={recentChecks}
                checkLimit={checkLimit}
                sortBy={sortBy}
                sortDir={sortDir}
                isLoading={isProcessing} // Use combined state for disabling controls
                onCheckLimitChange={handleCheckLimitChange}
                onSort={handleSort}
            />
        </Container>
    );
};

export default WebsiteDetails;