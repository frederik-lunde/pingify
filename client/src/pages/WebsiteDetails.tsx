/* src/pages/WebsiteDetails.tsx */
import React, { useState, useMemo, useCallback, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
    Container, Box, Alert, Button, Skeleton, Paper, SelectChangeEvent, CircularProgress,
} from '@mui/material';
// ArrowBackIcon import is no longer needed here
import Grid from '@mui/material/Grid2';
import { keepPreviousData } from '@tanstack/react-query';

import { useWebsiteDetailsQuery, useWebsiteCheckMutation } from '../hooks';
import { TimeframeKey, ApiError, MonitoringResultSortBy } from '../types';
import WebsiteDetailsHeader from '../components/details/WebsiteDetailsHeader';
import RecentChecksList from '../components/details/RecentCheckList';
import RecentIncidentsList from '../components/details/RecentIncidentsList';
import WebsiteCurrentIncidentAlert from '../components/details/CurrentIncidentAlert';
import WebsiteDetailsControls from '../components/details/WebsiteDetailsControls';
import DataFetchError from '../components/common/DataFetchError';

const LazyWebsiteCharts = React.lazy(() => import('../components/details/WebsiteCharts'));

export type SortableColumn = Extract<MonitoringResultSortBy, 'checkedAt' | 'isAvailable' | 'statusCode' | 'responseTime'>;
export type SortDirection = 'asc' | 'desc';

const PageSkeleton = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* Skeleton for the WebsiteDetailsHeader (inside Paper) */}
        <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
             <Skeleton variant="circular" width={40} height={40} /> {/* Placeholder for back button */}
             <Box sx={{ flexGrow: 1 }}>
                <Skeleton variant="text" width="60%" height={30} />
                <Skeleton variant="text" width="80%" height={20} />
             </Box>
             <Skeleton variant="rectangular" width={150} height={40} /> {/* Placeholder for status chips */}
        </Paper>

        {/* Rest of the skeleton remains the same */}
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

const WebsiteDetails: React.FC = () => {
    const { websiteId: websiteIdParam } = useParams<{ websiteId: string }>();
    const navigate = useNavigate();

    const numericWebsiteId = useMemo(() => {
        const id = parseInt(websiteIdParam || '', 10);
        return isNaN(id) || id <= 0 ? undefined : id;
    }, [websiteIdParam]);

    const [timeframeKey, setTimeframeKey] = useState<TimeframeKey>('day');
    const [checkLimit, setCheckLimit] = useState<number>(25);
    const [sortBy, setSortBy] = useState<SortableColumn>('checkedAt');
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

    // Keep the handler definition, it's passed to the header
    const handleBackClick = useCallback(() => {
        navigate('/'); // Navigate to root
    }, [navigate]);

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
        // Removed the separate back button here
        return (
            <Container sx={{ mt: 4 }}>
                {/* Just show the error */}
                <Alert severity="error">Invalid Website ID provided in URL.</Alert>
            </Container>
        );
    }
    if (isInitialLoading) {
        return <PageSkeleton />;
    }

    // Initial Load Error Check - Use DataFetchError
    if (detailsError && !websiteDetails && !isInitialLoading) {
        // Removed the separate back button here
        return (
            <Container sx={{ mt: 4 }}>
                 {/* Just show the DataFetchError component */}
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
        // Removed the separate back button here
       return (
            <Container sx={{ mt: 4 }}>
                {/* Just show the warning */}
                <Alert severity="warning">Could not find data for this website.</Alert>
            </Container>
        );
    }


    if (!websiteDetails) {
        return (
            <Container sx={{ mt: 4 }}>
                <Alert severity="info">Loading website data...</Alert>
            </Container>
        );
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

            {/* Website Specific Header (Includes Back Button) */}
            <WebsiteDetailsHeader
                name={name}
                url={url}
                latestResult={latestResult}
                isRefetching={isBackgroundRefetching}
                onSettingsClick={handleSettingsClick}
                onBackClick={handleBackClick} // Pass the handler down
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