/* src/pages/WebsiteDetails.tsx */
import React, { useState, useMemo, useCallback, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
    Container, Box, Alert, Button, Skeleton, Paper, SelectChangeEvent, CircularProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { keepPreviousData } from '@tanstack/react-query';

import { useWebsiteDetailsQuery, useWebsiteCheckMutation } from '../hooks'; // Corrected path if needed
import { TimeframeKey, ApiError } from '../types';
import WebsiteDetailsHeader from '../components/details/WebsiteDetailsHeader';
import RecentChecksList from '../components/details/RecentCheckList';
import RecentIncidentsList from '../components/details/RecentIncidentsList';
import WebsiteCurrentIncidentAlert from '../components/details/CurrentIncidentAlert';
import WebsiteDetailsControls from '../components/details/WebsiteDetailsControls';
import DataFetchError from '../components/common/DataFetchError'; // Import the common error component

const LazyWebsiteCharts = React.lazy(() => import('../components/details/WebsiteCharts'));

export type SortableColumn = 'isAvailable' | 'timestamp' | 'statusCode' | 'responseTime';
export type SortDirection = 'asc' | 'desc';

const PageSkeleton = () => ( /* Skeleton remains the same */
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

const LoadingFallback = () => ( /* Fallback remains the same */
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <CircularProgress />
    </Box>
);

const WebsiteDetails: React.FC = () => {
    const { websiteId: websiteIdParam } = useParams<{ websiteId: string }>();
    const navigate = useNavigate();

    const numericWebsiteId = useMemo(() => {
        const id = parseInt(websiteIdParam || '', 10);
        return isNaN(id) || id <= 0 ? undefined : id;
    }, [websiteIdParam]);

    const [timeframeKey, setTimeframeKey] = useState<TimeframeKey>('day');
    const [checkLimit, setCheckLimit] = useState<number>(25);
    const [sortBy, setSortBy] = useState<SortableColumn>('timestamp');
    const [sortDir, setSortDir] = useState<SortDirection>('desc');

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

    const { mutate: checkWebsite, isPending: isChecking } = useWebsiteCheckMutation();

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

    // Derived Data & Loading States
    const name = websiteDetails?.name ?? (isInitialLoading ? 'Loading...' : 'N/A');
    const url = websiteDetails?.url ?? '';
    const latestResult = websiteDetails?.latestResult ?? null;
    const chartData = websiteDetails?.chartData ?? [];
    const recentChecks = websiteDetails?.recentChecks ?? [];
    const uptimePercent = websiteDetails?.uptimePercent ?? null;
    const currentIncident = websiteDetails?.currentIncident ?? null;
    const recentIncidents = websiteDetails?.recentIncidents ?? [];

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

    // Initial Load Error Check - Use DataFetchError
    if (detailsError && !websiteDetails && !isInitialLoading) { // Check !isInitialLoading to ensure it's a true error after attempting load
        return (
            <Container sx={{ mt: 4 }}>
                <DataFetchError
                    error={detailsError as ApiError}
                    onRetry={refetchDetails}
                    context="Website Details"
                />
            </Container>
        );
    }

    // Website Not Found (after load attempt, no error, but no data)
    if (!isInitialLoading && !websiteDetails && !detailsError) {
       return <Container sx={{ mt: 4 }}><Alert severity="warning">Could not find data for this website.</Alert></Container>;
    }

    // Check if data exists before proceeding (for TypeScript)
    if (!websiteDetails) {
        // This case should ideally be covered by the checks above, but acts as a fallback
        return <Container sx={{ mt: 4 }}><Alert severity="info">Loading website data...</Alert></Container>;
    }

    // Check for partial errors (refresh failed, but showing stale data)
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
                    isLoading={isProcessingData} // Indicate loading on charts if refetching/checking
                />
            </Suspense>

            {/* Recent Incidents List Component */}
             <RecentIncidentsList
                incidents={recentIncidents}
                isLoading={isProcessingData} // Indicate loading if refetching/checking
             />

            {/* Recent Checks List Component */}
            <RecentChecksList
                recentChecks={recentChecks}
                checkLimit={checkLimit}
                sortBy={sortBy}
                sortDir={sortDir}
                isLoading={isProcessingData} // Indicate loading if refetching/checking
                onCheckLimitChange={handleCheckLimitChange}
                onSort={handleSort}
            />
        </Container>
    );
};

export default WebsiteDetails;