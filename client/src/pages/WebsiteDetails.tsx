import React, { useState, useMemo, useCallback, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
    Container, Box, Alert, Button, Skeleton, Paper, SelectChangeEvent, CircularProgress,
} from '@mui/material';
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

/**
 * Renders a skeleton UI for the page while loading.
 */
const PageSkeleton = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {}
        <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
             <Skeleton variant="circular" width={40} height={40} /> {}
             <Box sx={{ flexGrow: 1 }}>
                <Skeleton variant="text" width="60%" height={30} />
                <Skeleton variant="text" width="80%" height={20} />
             </Box>
             <Skeleton variant="rectangular" width={150} height={40} /> {}
        </Paper>
        {}
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

/**
 * Renders a loading spinner for Suspense fallback.
 */
const LoadingFallback = () => (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <CircularProgress />
    </Box>
);

/**
 * Displays detailed information and monitoring data for a specific website.
 */
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

    /**
     * Handles change in the selected timeframe.
     */
    const handleTimeframeChange = useCallback((event: SelectChangeEvent<TimeframeKey>) => {
        setTimeframeKey(event.target.value as TimeframeKey);
    }, []);

    /**
     * Handles change in the number of checks to display.
     */
    const handleCheckLimitChange = useCallback((event: SelectChangeEvent<number | string>) => {
        const newLimit = Number(event.target.value);
        if (!isNaN(newLimit) && newLimit > 0) { setCheckLimit(newLimit); }
    }, []);

    /**
     * Handles sorting of the recent checks list.
     */
    const handleSort = useCallback((column: SortableColumn) => {
        setSortDir(currentDir => (column === sortBy && currentDir === 'desc' ? 'asc' : 'desc'));
        setSortBy(column);
    }, [sortBy]);

    /**
     * Triggers a manual check for the website.
     */
    const handleCheckNow = useCallback(() => {
        if (numericWebsiteId && !isChecking) {
            checkWebsite(numericWebsiteId);
        }
    }, [numericWebsiteId, isChecking, checkWebsite]);

    /**
     * Navigates to the website settings page.
     */
    const handleSettingsClick = useCallback(() => {
        if (numericWebsiteId) { navigate(`/website/${numericWebsiteId}/settings`); }
    }, [navigate, numericWebsiteId]);

    /**
     * Navigates back to the dashboard.
     */
    const handleBackClick = useCallback(() => {
        navigate('/');
    }, [navigate]);

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

    if (websiteIdParam !== undefined && numericWebsiteId === undefined) {
        return (
            <Container sx={{ mt: 4 }}>
                {}
                <Alert severity="error">Invalid Website ID provided in URL.</Alert>
            </Container>
        );
    }

    if (isInitialLoading) {
        return <PageSkeleton />;
    }

    if (detailsError && !websiteDetails && !isInitialLoading) {
        return (
            <Container sx={{ mt: 4 }}>
                 {}
                 <DataFetchError
                    error={detailsError as ApiError}
                    onRetry={refetchDetails}
                    context="Website Details"
                 />
            </Container>
        );
    }

    if (!isInitialLoading && !websiteDetails && !detailsError) {
       return (
            <Container sx={{ mt: 4 }}>
                {}
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

    const showInlineError = detailsError && !!websiteDetails;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            {}
            {showInlineError && (
                <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => refetchDetails()}>Retry</Button>}>
                    Could not refresh data: {(detailsError as ApiError)?.message || 'Unknown error'}. Displaying last known data.
                </Alert>
            )}
            {}
            <WebsiteDetailsHeader
                name={name}
                url={url}
                latestResult={latestResult}
                isRefetching={isBackgroundRefetching}
                onSettingsClick={handleSettingsClick}
                onBackClick={handleBackClick}
            />
             {}
             <WebsiteCurrentIncidentAlert incident={currentIncident} />
            {}
            <WebsiteDetailsControls
                timeframeKey={timeframeKey}
                onTimeframeChange={handleTimeframeChange}
                onCheckNow={handleCheckNow}
                isChecking={isManualChecking}
                isProcessingData={isProcessingData}
            />
            {}
             <Suspense fallback={<LoadingFallback />}>
                <LazyWebsiteCharts
                    chartData={chartData}
                    uptimePercent={uptimePercent}
                    timeframeKey={timeframeKey}
                    isLoading={isProcessingData}
                />
            </Suspense>
            {}
             <RecentIncidentsList
                incidents={recentIncidents}
                isLoading={isProcessingData}
             />
            {}
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