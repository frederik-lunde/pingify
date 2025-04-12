/* src/components/details/WebsiteDetails.tsx */
import React, { useState, useMemo, useCallback, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
    Container, Box, Alert, AlertTitle, Button, Skeleton, Paper, SelectChangeEvent, CircularProgress,
    FormControl, InputLabel, Select, MenuItem, Link, Stack, Typography, Tooltip // Added AlertTitle, Link, Stack, Typography, Tooltip
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { keepPreviousData } from '@tanstack/react-query';
import { NetworkCheck as NetworkCheckIcon, ErrorOutline as ErrorIcon, WarningAmber as SlowIcon } from '@mui/icons-material'; // Added incident icons

// Adjust paths as needed
import { useWebsiteDetailsQuery, useWebsiteCheckMutation } from '../hooks'; // Adjusted path
import { TimeframeKey, ApiError, IncidentType } from '../types'; // Adjusted path, Added IncidentType
import WebsiteDetailsHeader from '../components/details/WebsiteDetailsHeader'; // Adjusted path
import RecentChecksList from '../components/details/RecentCheckList'; // Adjusted path
// --- NEW: Import RecentIncidentsList ---
import RecentIncidentsList from '../components/details/RecentIncidentsList'; // Adjusted path
// --- Import Utils ---
import { formatIncidentDuration } from '../utils/statusUtils'; // Adjusted path
import { useTimeSince } from '../hooks'; // Adjusted path

const LazyWebsiteCharts = React.lazy(() => import('../components/details/WebsiteCharts')); // Adjusted path

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
        {/* Skeleton for Charts */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 6 }}><Paper sx={{ p: 2 }}><Skeleton variant="rectangular" height={300} /></Paper></Grid>
            <Grid size={{ xs: 12, md: 6 }}><Paper sx={{ p: 2 }}><Skeleton variant="rectangular" height={300} /></Paper></Grid>
        </Grid>
        {/* Skeleton for Incident List */}
        <Paper sx={{ p: 2, mb: 3 }}>
             <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Skeleton variant="text" width={150} height={30} />
            </Box>
            <Skeleton variant="rectangular" height={150} />
        </Paper>
        {/* Skeleton for Check List */}
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

// --- NEW: Helper for Current Incident Alert ---
const getIncidentAlertProps = (type: IncidentType): { severity: 'error' | 'warning', icon: React.ReactNode, title: string } => {
    switch (type) {
        case 'down': return { severity: 'error', icon: <ErrorIcon fontSize="inherit" />, title: "Website is Currently Down" };
        case 'slow': return { severity: 'warning', icon: <SlowIcon fontSize="inherit" />, title: "Website Performance Degradation" };
        default: return { severity: 'warning', icon: <SlowIcon fontSize="inherit" />, title: "Active Incident" }; // Fallback
    }
};

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
    // No separate incident limit state here, assuming the API fetches a reasonable amount for the details page

    // --- Data Fetching (useWebsiteDetailsQuery now includes incident data) ---
    const {
        data: websiteDetails,
        isPending: isInitialLoading,
        error: detailsError,
        isFetching: isDetailsRefetching,
        refetch: refetchDetails,
    } = useWebsiteDetailsQuery({
        websiteId: numericWebsiteId!,
        timeframe: timeframeKey, // For charts and uptime %
        limit: checkLimit, // For recent checks list
        sortBy: sortBy,
        sortDir: sortDir,
        incidentLimit: 15, // Request N recent incidents for the details page
    }, {
        enabled: !!numericWebsiteId,
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: true,
        placeholderData: keepPreviousData,
    });

    // --- Mutation ---
    const { mutate: checkWebsite, isPending: isChecking } = useWebsiteCheckMutation();

    // --- Event Handlers (Keep existing) ---
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
        // Only check if not already checking
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
    // --- NEW: Extract Incident Data ---
    const currentIncident = websiteDetails?.currentIncident ?? null;
    const recentIncidents = websiteDetails?.recentIncidents ?? [];

    const isProcessingData = isDetailsRefetching || isChecking;
    const isManualChecking = isChecking;
    const isBackgroundRefetching = isDetailsRefetching && !isChecking;

    // --- NEW: Format data for Current Incident Alert ---
    const currentIncidentDuration = formatIncidentDuration(currentIncident);
    const currentIncidentStartTimeRelative = useTimeSince(currentIncident?.startTime, { addSuffix: false });

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
                // Pass current incident status to header? Maybe later for a badge.
            />

             {/* --- NEW: Current Incident Alert --- */}
             {currentIncident && (
                 <Alert
                    severity={getIncidentAlertProps(currentIncident.type).severity}
                    icon={getIncidentAlertProps(currentIncident.type).icon}
                    variant="filled" // Use filled for more prominence
                    sx={{ mb: 3 }}
                 >
                    <AlertTitle>{getIncidentAlertProps(currentIncident.type).title}</AlertTitle>
                     <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 2 }} alignItems={{ sm: 'center' }}>
                        <Typography variant="body2">
                             Incident started: <Tooltip title={new Date(currentIncident.startTime).toLocaleString()}><Box component="span" sx={{ fontWeight: 'medium' }}>{currentIncidentStartTimeRelative} ago</Box></Tooltip>
                        </Typography>
                         {currentIncidentDuration && (
                              <Typography variant="body2">
                                  Duration so far: <Box component="span" sx={{ fontWeight: 'medium' }}>{currentIncidentDuration.replace('since ', '').replace(' ago', '')}</Box>
                             </Typography>
                         )}
                    </Stack>
                    {/* Optional: Add link to more details or troubleshooting steps */}
                 </Alert>
             )}


            {/* Controls Area: Check Now Button and Timeframe Selector */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                 <Button
                    variant="contained"
                    color="primary"
                    startIcon={isManualChecking ? <CircularProgress size={20} color="inherit" /> : <NetworkCheckIcon />}
                    onClick={handleCheckNow}
                    // --- MODIFICATION: Button is only disabled while checking ---
                    disabled={isManualChecking}
                    // --- END MODIFICATION ---
                    size="medium"
                    sx={{ borderRadius: 2, whiteSpace: 'nowrap', minWidth: { xs: 'auto', sm: 110 } }}
                    title={isManualChecking ? "Check in progress..." : "Trigger an immediate check"} // Updated title
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
                <LazyWebsiteCharts
                    chartData={chartData}
                    uptimePercent={uptimePercent}
                    timeframeKey={timeframeKey}
                    isLoading={isProcessingData}
                />
            </Suspense>

            {/* --- NEW: Recent Incidents List --- */}
             <RecentIncidentsList
                incidents={recentIncidents}
                isLoading={isProcessingData} // Pass loading state
             />


            {/* Recent Checks List */}
            <RecentChecksList
                recentChecks={recentChecks}
                checkLimit={checkLimit}
                sortBy={sortBy}
                sortDir={sortDir}
                isLoading={isProcessingData}
                onCheckLimitChange={handleCheckLimitChange}
                onSort={handleSort}
                // sx={{ mt: 3 }} // Optional margin if RecentIncidentsList is present
            />
        </Container>
    );
};

export default WebsiteDetails;