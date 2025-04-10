/*
src/components/details/WebsiteDetails.tsx
*/
import React, { useState, useMemo, useCallback, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
    Container, Box, Alert, Button, Skeleton, Paper, SelectChangeEvent, CircularProgress,
    FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { keepPreviousData } from '@tanstack/react-query';
import { NetworkCheck as NetworkCheckIcon } from '@mui/icons-material';

// Adjust paths as needed
import { useWebsiteDetailsQuery, useWebsiteCheckMutation } from '../hooks';
import { TimeframeKey, ApiError } from '../types';
import WebsiteDetailsHeader from '../components/details/WebsiteDetailsHeader'; 
import RecentChecksList from '../components/details/RecentCheckList'; 
const LazyWebsiteCharts = React.lazy(() => import('../components/details/WebsiteCharts'));

export type SortableColumn = 'isAvailable' | 'timestamp' | 'statusCode' | 'responseTime';
export type SortDirection = 'asc' | 'desc';

// --- Skeletons & Fallbacks ---
const PageSkeleton = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 2, mb: 3 }}><Skeleton variant="rectangular" height={80} /></Paper>
        {/* Skeleton for controls area */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2, gap: 2 }}>
            <Skeleton variant="rectangular" width={120} height={40} />
            <Skeleton variant="rectangular" width={150} height={40} />
        </Box>
        <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 6 }}><Paper sx={{ p: 2 }}><Skeleton variant="rectangular" height={300} /></Paper></Grid>
            <Grid size={{ xs: 12, md: 6 }}><Paper sx={{ p: 2 }}><Skeleton variant="rectangular" height={300} /></Paper></Grid>
        </Grid>
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
        return isNaN(id) || id <= 0 ? undefined : id;
    }, [websiteIdParam]);

    // --- Local UI State ---
    const [timeframeKey, setTimeframeKey] = useState<TimeframeKey>('day');
    const [checkLimit, setCheckLimit] = useState<number>(25);
    const [sortBy, setSortBy] = useState<SortableColumn>('timestamp');
    const [sortDir, setSortDir] = useState<SortDirection>('desc');

    // --- Data Fetching ---
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
        sortBy: sortBy,
        sortDir: sortDir,
    }, {
        enabled: !!numericWebsiteId,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: true,
        placeholderData: keepPreviousData,
    });

    // --- Mutation ---
    const { mutate: checkWebsite, isPending: isChecking } = useWebsiteCheckMutation();

    // --- Event Handlers ---
    const handleTimeframeChange = useCallback((event: SelectChangeEvent<TimeframeKey>) => {
        setTimeframeKey(event.target.value as TimeframeKey);
    }, []);

    const handleCheckLimitChange = useCallback((event: SelectChangeEvent<number | string>) => {
        const newLimit = Number(event.target.value);
        if (!isNaN(newLimit) && newLimit > 0) { setCheckLimit(newLimit); }
    }, []);

    const handleSort = useCallback((column: SortableColumn) => {
        setSortDir(currentDir => (column === sortBy && currentDir === 'desc' ? 'asc' : 'desc'));
        setSortBy(column);
    }, [sortBy]);

    const handleCheckNow = useCallback(() => {
        if (numericWebsiteId && !isChecking) {
            checkWebsite(numericWebsiteId);
        }
    }, [numericWebsiteId, isChecking, checkWebsite]);

    const handleSettingsClick = useCallback(() => {
        if (numericWebsiteId) { navigate(`/website/${numericWebsiteId}/settings`); }
    }, [navigate, numericWebsiteId]);

    // --- Derived Data & Loading States ---
    const name = websiteDetails?.name ?? (isInitialLoading ? 'Loading...' : 'N/A');
    const url = websiteDetails?.url ?? '';
    const latestResult = websiteDetails?.latestResult ?? null;
    const chartData = websiteDetails?.chartData ?? [];
    const recentChecks = websiteDetails?.recentChecks ?? [];
    const uptimePercent = websiteDetails?.uptimePercent ?? null;

    const isProcessingData = isDetailsRefetching || isChecking;
    const isManualChecking = isChecking;
    const isBackgroundRefetching = isDetailsRefetching && !isChecking;

    // --- Render Logic ---

    if (websiteIdParam !== undefined && numericWebsiteId === undefined) {
        return <Container sx={{ mt: 4 }}><Alert severity="error">Invalid Website ID provided in URL.</Alert></Container>;
    }
    if (isInitialLoading) {
        return <PageSkeleton />;
    }
    if (detailsError && !websiteDetails) {
        return (
            <Container sx={{ mt: 4 }}>
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => refetchDetails()}>Retry</Button>}>
                    Error loading website details: {(detailsError as ApiError).message || 'Unknown error'}
                </Alert>
            </Container>
        );
    }
    if (!isInitialLoading && !websiteDetails) {
       return <Container sx={{ mt: 4 }}><Alert severity="warning">Could not find data for this website.</Alert></Container>;
    }

    const showInlineError = detailsError && !!websiteDetails;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            {showInlineError && (
                <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => refetchDetails()}>Retry</Button>}>
                    Could not refresh data: {(detailsError as ApiError)?.message || 'Unknown error'}. Displaying last known data.
                </Alert>
            )}

            <WebsiteDetailsHeader
                name={name}
                url={url}
                latestResult={latestResult}
                isRefetching={isBackgroundRefetching}
                onSettingsClick={handleSettingsClick}
            />

            {/* Controls Area: Check Now Button and Timeframe Selector */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                 {/* Check Now Button */}
                 <Button
                    variant="contained"
                    color="primary"
                    startIcon={isManualChecking ? <CircularProgress size={20} color="inherit" /> : <NetworkCheckIcon />}
                    onClick={handleCheckNow}
                    disabled={isManualChecking}
                    size="medium"
                    sx={{ borderRadius: 2, whiteSpace: 'nowrap', minWidth: { xs: 'auto', sm: 110 } }}
                >
                    {isManualChecking ? "Checking..." : "Check Now"}
                </Button>

                {/* Timeframe Selector (This is the single source now) */}
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel id="timeframe-select-label">Chart Timeframe</InputLabel>
                    <Select
                        labelId="timeframe-select-label"
                        id="timeframe-select"
                        value={timeframeKey}
                        label="Chart Timeframe"
                        onChange={handleTimeframeChange}
                        disabled={isProcessingData}
                    >
                        <MenuItem value={'hour'}>Last Hour</MenuItem>
                        <MenuItem value={'day'}>Last 24 Hours</MenuItem>
                        <MenuItem value={'week'}>Last 7 Days</MenuItem>
                        <MenuItem value={'month'}>Last 30 Days</MenuItem>
                        <MenuItem value={'year'}>Last Year</MenuItem>
                    </Select>
                </FormControl>
            </Box>


            {/* Suspense for lazy charts */}
             <Suspense fallback={<LoadingFallback />}>
                {/* Use the renamed variable for the lazy component */}
                <LazyWebsiteCharts
                    chartData={chartData}
                    uptimePercent={uptimePercent}
                    timeframeKey={timeframeKey}
                    isLoading={isProcessingData}
                />
            </Suspense>

            {/* Recent Checks List */}
            <RecentChecksList
                recentChecks={recentChecks}
                checkLimit={checkLimit}
                sortBy={sortBy}
                sortDir={sortDir}
                isLoading={isProcessingData}
                onCheckLimitChange={handleCheckLimitChange}
                onSort={handleSort}
            />
        </Container>
    );
};

export default WebsiteDetails;