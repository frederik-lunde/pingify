/* src/components/details/WebsiteDetails.tsx (Refactored) */
import React, { useState, useMemo, useCallback, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
    Container, Box, Alert, Button, Skeleton, Paper, SelectChangeEvent, CircularProgress,
    // Removed AlertTitle, Link, Stack, Typography, Tooltip, FormControl, InputLabel, Select, MenuItem - moved/simplified
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { keepPreviousData } from '@tanstack/react-query';
// Removed incident/check icons - moved to subcomponents

// Adjust paths as needed
import { useWebsiteDetailsQuery, useWebsiteCheckMutation } from '../hooks'; // Keep hooks
import { TimeframeKey, ApiError } from '../types'; // Keep types needed here
import WebsiteDetailsHeader from '../components/details/WebsiteDetailsHeader'; // Keep existing subcomponent
import RecentChecksList from '../components/details/RecentCheckList'; // Keep existing subcomponent
import RecentIncidentsList from '../components/details/RecentIncidentsList'; // Keep existing subcomponent
// Removed statusUtils/useTimeSince imports - moved to WebsiteCurrentIncidentAlert
import WebsiteCurrentIncidentAlert from '../components/details/CurrentIncidentAlert'; // Import new component
import WebsiteDetailsControls from '../components/details/WebsiteDetailsControls'; // Import new component

// Lazy load charts - keep this here
const LazyWebsiteCharts = React.lazy(() => import('../components/details/WebsiteCharts')); // Adjusted path

// Keep types for check list sorting state
export type SortableColumn = 'isAvailable' | 'timestamp' | 'statusCode' | 'responseTime';
export type SortDirection = 'asc' | 'desc';

// --- Skeletons & Fallbacks (Keep PageSkeleton and LoadingFallback here) ---
const PageSkeleton = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 2, mb: 3 }}><Skeleton variant="rectangular" height={80} /></Paper>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2, gap: 2 }}>
            <Skeleton variant="rectangular" width={120} height={40} />
            <Skeleton variant="rectangular" width={150} height={40} />
        </Box>
        <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 6 }}><Paper sx={{ p: 2 }}><Skeleton variant="rectangular" height={300} /></Paper></Grid>
            <Grid size={{ xs: 12, md: 6 }}><Paper sx={{ p: 2 }}><Skeleton variant="rectangular" height={300} /></Paper></Grid>
        </Grid>
        <Paper sx={{ p: 2, mb: 3 }}>
             <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Skeleton variant="text" width={150} height={30} />
            </Box>
            <Skeleton variant="rectangular" height={150} />
        </Paper>
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
// --- Helper getIncidentAlertProps removed - moved to WebsiteCurrentIncidentAlert ---

const WebsiteDetails: React.FC = () => {
    const { websiteId: websiteIdParam } = useParams<{ websiteId: string }>();
    const navigate = useNavigate();

    const numericWebsiteId = useMemo(() => {
        const id = parseInt(websiteIdParam || '', 10);
        return isNaN(id) || id <= 0 ? undefined : id;
    }, [websiteIdParam]);

    // --- Local UI State (Keep state needed for query or passed to multiple children) ---
    const [timeframeKey, setTimeframeKey] = useState<TimeframeKey>('day');
    const [checkLimit, setCheckLimit] = useState<number>(25);
    const [sortBy, setSortBy] = useState<SortableColumn>('timestamp');
    const [sortDir, setSortDir] = useState<SortDirection>('desc');

    // --- Data Fetching (Keep as is) ---
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
        incidentLimit: 15,
    }, {
        enabled: !!numericWebsiteId,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: true,
        placeholderData: keepPreviousData,
    });

    // --- Mutation (Keep as is) ---
    const { mutate: checkWebsite, isPending: isChecking } = useWebsiteCheckMutation();

    // --- Event Handlers (Keep handlers controlling state here) ---
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

    // --- Derived Data & Loading States (Simplify - Extract data needed by children) ---
    const name = websiteDetails?.name ?? (isInitialLoading ? 'Loading...' : 'N/A');
    const url = websiteDetails?.url ?? '';
    const latestResult = websiteDetails?.latestResult ?? null;
    const chartData = websiteDetails?.chartData ?? [];
    const recentChecks = websiteDetails?.recentChecks ?? [];
    const uptimePercent = websiteDetails?.uptimePercent ?? null;
    const currentIncident = websiteDetails?.currentIncident ?? null; // Pass this down
    const recentIncidents = websiteDetails?.recentIncidents ?? [];

    const isProcessingData = isDetailsRefetching || isChecking; // Used by Controls and Lists
    const isManualChecking = isChecking; // Used by Controls
    const isBackgroundRefetching = isDetailsRefetching && !isChecking; // Used by Header

    // --- Derived data for alert moved to WebsiteCurrentIncidentAlert ---

    // --- Render Logic (Keep top-level loading/error) ---
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
            {/* Partial Error Alert */}
            {showInlineError && (
                <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => refetchDetails()}>Retry</Button>}>
                    Could not refresh data: {(detailsError as ApiError)?.message || 'Unknown error'}. Displaying last known data.
                </Alert>
            )}

            {/* Header Component */}
            <WebsiteDetailsHeader
                name={name}
                url={url}
                latestResult={latestResult}
                isRefetching={isBackgroundRefetching}
                onSettingsClick={handleSettingsClick}
            />

             {/* Current Incident Alert Component */}
             <WebsiteCurrentIncidentAlert incident={currentIncident} />

            {/* Controls Area Component */}
            <WebsiteDetailsControls
                timeframeKey={timeframeKey}
                onTimeframeChange={handleTimeframeChange}
                onCheckNow={handleCheckNow}
                isChecking={isManualChecking}
                isProcessingData={isProcessingData}
            />

            {/* Charts Component (Lazy Loaded) */}
             <Suspense fallback={<LoadingFallback />}>
                <LazyWebsiteCharts
                    chartData={chartData}
                    uptimePercent={uptimePercent}
                    timeframeKey={timeframeKey}
                    isLoading={isProcessingData}
                />
            </Suspense>

            {/* Recent Incidents List Component */}
             <RecentIncidentsList
                incidents={recentIncidents}
                isLoading={isProcessingData}
             />

            {/* Recent Checks List Component */}
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