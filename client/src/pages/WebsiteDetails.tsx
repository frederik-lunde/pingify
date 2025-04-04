// client/src/components/details/WebsiteDetails.tsx
import React, { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import {
    Container, Typography, Box, Paper, Grid, Button, Chip, List, ListItem, Divider, CircularProgress, Select, MenuItem, FormControl,
    InputLabel, useTheme, IconButton, Tooltip, Stack, ButtonBase, Alert, Skeleton, SelectChangeEvent, alpha
} from "@mui/material";
import {
    CheckCircleOutline as CheckIcon, ErrorOutline as ErrorIcon, Timeline as TimelineIcon,
    ListAlt as ListAltIcon, BarChart as BarChartIcon, NetworkCheck as NetworkCheckIcon,
    Settings as SettingsIcon, ArrowUpward as ArrowUpwardIcon, ArrowDownward as ArrowDownwardIcon,
    CalendarToday as CalendarTodayIcon, Code as CodeIcon, Timer as TimerIcon, SwapVert as SwapVertIcon,
    InfoOutlined as InfoOutlinedIcon,
} from "@mui/icons-material";
import { Line, Bar } from "react-chartjs-2";
import { ChartOptions, TooltipItem } from "chart.js";
// NOTE: Ensure Chart.js is registered globally (App.tsx or index.tsx)
// E.g., import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip as ChartTooltip, Legend, Filler } from 'chart.js';
// ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, ChartTooltip, Legend, Filler);

// --- Import Hooks (adjust path as needed) ---
import { useWebsiteDetailsQuery, useWebsiteCheckMutation } from "../hooks"; // Example path

// --- Import Utilities (adjust path as needed) ---
import { formatResponseTime, formatUptime, getStatusColor } from "../utils/statusUtils"; // Example path

// --- !!! IMPORTANT: Import Types from your SHARED types file !!! ---
// Ensure these types are correctly defined in your shared types location.
import {
    TimeframeKey,
    MonitoringResult, // Needed for recentChecks and latestResult
    ChartDataPoint,   // The type for items in chartData array
     // The overall type returned by the query hook
} from "../types"; // Adjust path to your actual types file


type SortableColumn = 'isAvailable' | 'timestamp' | 'statusCode' | 'responseTime';
type SortDirection = 'asc' | 'desc';

const WebsiteDetails: React.FC = () => {
    const { websiteId: websiteIdParam } = useParams<{ websiteId: string }>();
    const navigate = useNavigate();
    const theme = useTheme();

    const numericWebsiteId = useMemo(() => {
        const id = parseInt(websiteIdParam || '', 10);
        return isNaN(id) ? undefined : id;
    }, [websiteIdParam]);

    // --- Local UI State ---
    const [timeframeKey, setTimeframeKey] = useState<TimeframeKey>('day');
    const [checkLimit, setCheckLimit] = useState<number>(25);
    const [sortBy, setSortBy] = useState<SortableColumn>('timestamp');
    const [sortDir, setSortDir] = useState<SortDirection>('desc');

    // --- TanStack Query Hook ---
    // Ensure useWebsiteDetailsQuery is correctly typed to return WebsiteDetailsData
    const {
        data: websiteDetails,
        isLoading: isDetailsLoading,
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
        enabled: !!numericWebsiteId && numericWebsiteId > 0,
        staleTime: 1000 * 60, // Cache data for 1 minute
        refetchOnWindowFocus: true, // Optional: refetch when window regains focus
    });

    // --- TanStack Mutation Hook ---
    const { mutate: checkWebsite, isPending: isChecking } = useWebsiteCheckMutation();

    // --- Event Handlers ---
    const handleTimeframeChange = useCallback((event: SelectChangeEvent<TimeframeKey>) => {
        setTimeframeKey(event.target.value as TimeframeKey);
    }, []);

    const handleCheckLimitChange = useCallback((event: SelectChangeEvent<number | string>) => {
        const newLimit = Number(event.target.value);
        if (!isNaN(newLimit)) { setCheckLimit(newLimit); }
        // Note: Refetch happens automatically because `checkLimit` is part of the queryKey
    }, []);

    const handleSort = useCallback((column: SortableColumn) => {
        setSortBy(prevSortBy => {
            setSortDir(prevDir => (prevSortBy === column && prevDir === 'desc' ? 'asc' : 'desc'));
            return column;
        });
        // Note: Refetch happens automatically because `sortBy`/`sortDir` are part of the queryKey
    }, []);

    const handleCheckNow = useCallback(() => {
        if (!isChecking && numericWebsiteId) { checkWebsite(numericWebsiteId); } // onSuccess invalidates query
    }, [isChecking, numericWebsiteId, checkWebsite]);

    const handleSettingsClick = useCallback(() => {
        if (numericWebsiteId) { navigate(`/website/${numericWebsiteId}/settings`); }
    }, [navigate, numericWebsiteId]);

    // --- Derived Data ---
    // Explicitly type chartDataForDisplay to help TS and catch errors earlier
    const chartDataForDisplay: ChartDataPoint[] = websiteDetails?.chartData ?? [];
    const recentChecks: MonitoringResult[] = websiteDetails?.recentChecks ?? []; // Keep this as MonitoringResult[]
    const latestResult: MonitoringResult | null = websiteDetails?.latestResult ?? null; // Keep this as MonitoringResult | null

    const name = websiteDetails?.name ?? 'Loading...';
    const url = websiteDetails?.url ?? '';
    const uptimePercentage = websiteDetails?.uptimePercent ?? 0;

    const isOnline = useMemo(() => latestResult?.isAvailable ?? false, [latestResult]);
    const currentStatusCode = useMemo(() => latestResult?.statusCode, [latestResult]);
    const statusColor = isOnline ? "success" : "error";
    const statusText = isOnline ? "Up" : "Down";
    const formattedUptime = useMemo(() => formatUptime(uptimePercentage), [uptimePercentage]);


    // --- Chart Config ---

    // Uptime Status Bar Chart Data
    const uptimeChartData = useMemo(() => {
        if (!chartDataForDisplay || chartDataForDisplay.length === 0) {
            return { labels: [], datasets: [] };
        }
        // Now TS knows chartDataForDisplay contains ChartDataPoint objects
        const labels = chartDataForDisplay.map((p: ChartDataPoint) => p.label);
        const threshold = (timeframeKey === 'hour' || timeframeKey === 'day') ? 1.0 : 0.5;
        const data = chartDataForDisplay.map((p: ChartDataPoint) => (p.uptimeRatio >= threshold ? 1 : -1));
        const backgroundColors = data.map(d =>
            d > 0 ? theme.palette.success.light : theme.palette.error.light
        );
        return { labels, datasets: [{ label: "Status", data, backgroundColor: backgroundColors, barPercentage: 1.0, categoryPercentage: 1.0 }] };
    }, [chartDataForDisplay, theme.palette.success.light, theme.palette.error.light, timeframeKey]);

    // Uptime Status Bar Chart Options
    const uptimeChartOptions: ChartOptions<'bar'> = useMemo(() => ({
        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: {
            label: (context: TooltipItem<'bar'>) => {
                 // Accessing chartDataForDisplay which is ChartDataPoint[]
                 const pointData: ChartDataPoint | undefined = chartDataForDisplay[context.dataIndex];
                 if (!pointData) return '';
                 const threshold = (timeframeKey === 'hour' || timeframeKey === 'day') ? 1.0 : 0.5;
                 const status = pointData.uptimeRatio >= threshold ? 'Up' : 'Down';
                 if (timeframeKey === 'hour' || timeframeKey === 'day') {
                     return `Status: ${status}`;
                 } else {
                     return `Status: ${status} (${(pointData.uptimeRatio * 100).toFixed(1)}%)`;
                 }
            },
            title: (context: TooltipItem<'bar'>[]) => {
                 const pointData: ChartDataPoint | undefined = chartDataForDisplay[context[0]?.dataIndex];
                 // Accessing properties of ChartDataPoint
                 return pointData ? `${pointData.label} (${pointData.checkCount} checks)` : '';
            }
        }}},
        scales: {
            x: { title: { display: false }, ticks: { autoSkip: true, maxTicksLimit: timeframeKey === 'hour' || timeframeKey === 'day' ? 12 : 15, maxRotation: 0, minRotation: 0 }, grid: { display: false } },
            y: { display: false, min: -1.5, max: 1.5 }
        },
        indexAxis: 'x',
    }), [chartDataForDisplay, timeframeKey]);

    // Response Time Line Chart Data
    const responseTimeChartData = useMemo(() => {
        if (!chartDataForDisplay || chartDataForDisplay.length === 0) {
            return { labels: [], datasets: [] };
        }
        // Accessing properties of ChartDataPoint
        const labels = chartDataForDisplay.map((p: ChartDataPoint) => p.label);
        const data = chartDataForDisplay.map((p: ChartDataPoint) => p.avgResponseTime); // Contains actual or avg, possibly null

        const datasetLabel = (timeframeKey === 'hour' || timeframeKey === 'day')
            ? "Response Time (ms)"
            : "Avg Response Time (ms)";

        return {
            labels: labels,
            datasets: [{
                label: datasetLabel,
                data, // Pass data array with potential nulls
                borderColor: theme.palette.primary.main,
                backgroundColor: alpha(theme.palette.primary.light, 0.2),
                // Fill only for 'hour' and 'day' where it's raw data
                fill: (timeframeKey === 'hour' || timeframeKey === 'day'),
                tension: 0.1, // Slightly smooth the line
                pointRadius: timeframeKey === 'hour' || timeframeKey === 'day' ? 2 : 3, // Smaller points for raw data
                pointHoverRadius: 5,
                spanGaps: true // Instruct Chart.js to draw lines across null points
             }],
        };
    }, [chartDataForDisplay, theme.palette.primary, timeframeKey]);

    // Response Time Line Chart Options
    const responseTimeChartOptions: ChartOptions<'line'> = useMemo(() => ({
        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: {
            label: (context: TooltipItem<'line'>) => {
                const value = context.parsed.y;
                // Check for null or NaN before formatting
                if (value === null || isNaN(value)) return 'No response time data';
                const prefix = (timeframeKey === 'hour' || timeframeKey === 'day') ? 'Response Time' : 'Avg Response Time';
                return `${prefix}: ${value.toFixed(0)} ms`; // Format to integer ms
            },
            title: (context: TooltipItem<'line'>[]) => {
                 if (!context.length) return '';
                 // Accessing chartDataForDisplay which is ChartDataPoint[]
                 const pointData: ChartDataPoint | undefined = chartDataForDisplay[context[0]?.dataIndex];
                 // Accessing properties of ChartDataPoint
                 // Display uptime and check count for context
                 return pointData ? `${pointData.label} (${(pointData.uptimeRatio * 100).toFixed(1)}% Up, ${pointData.checkCount} checks)` : '';
            }
        }}},
        scales: {
            x: { title: { display: false }, ticks: { autoSkip: true, maxTicksLimit: timeframeKey === 'hour' || timeframeKey === 'day' ? 12 : 15, maxRotation: 0, minRotation: 0 }, grid: { display: false } },
            // Ensure Y axis starts at zero for response time
            y: { title: { display: true, text: "ms" }, beginAtZero: true, grid: { color: theme.palette.divider } }
        },
        interaction: { mode: 'index', intersect: false }, // Show tooltips for all datasets at the same x-index
    }), [chartDataForDisplay, timeframeKey, theme.palette.divider]);

    // Helper to render sort icon
    const renderSortIcon = (column: SortableColumn) => {
        if (sortBy !== column) {
            return <SwapVertIcon fontSize="inherit" sx={{ ml: 0.5, color: 'text.disabled', opacity: 0.5, verticalAlign: 'middle' }} />;
        }
        return sortDir === 'asc'
            ? <ArrowUpwardIcon fontSize="inherit" sx={{ ml: 0.5, color: 'text.primary', verticalAlign: 'middle' }} />
            : <ArrowDownwardIcon fontSize="inherit" sx={{ ml: 0.5, color: 'text.primary', verticalAlign: 'middle' }} />;
    };

    // --- Render Logic ---
    if (websiteIdParam !== undefined && numericWebsiteId === undefined) {
        return <Container sx={{ mt: 4 }}><Alert severity="error">Invalid Website ID provided in URL.</Alert></Container>;
    }

    // Skeleton Loading State
    if (isDetailsLoading && !websiteDetails) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                <Paper sx={{ p: 2, mb: 3 }}><Skeleton variant="rectangular" height={80} /></Paper>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}><Skeleton variant="rectangular" width={150} height={40} /></Box>
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12} md={6}><Paper sx={{ p: 2 }}><Skeleton variant="rectangular" height={300} /></Paper></Grid>
                    <Grid item xs={12} md={6}><Paper sx={{ p: 2 }}><Skeleton variant="rectangular" height={300} /></Paper></Grid>
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
    }

    // Error State
    if (detailsError) {
        // Attempt to access message property safely
        const errorMessage = (detailsError && typeof detailsError === 'object' && 'message' in detailsError)
            ? String(detailsError.message)
            : 'An unknown error occurred';
        return (
            <Container sx={{ mt: 4 }}>
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => refetchDetails()}>Retry</Button>}>
                    Error loading website details: {errorMessage}
                </Alert>
            </Container>
        );
    }

    // No Data State (after loading, if query succeeded but returned nothing substantial)
    if (!isDetailsLoading && !websiteDetails) {
       return <Container sx={{mt: 4}}><Alert severity="warning">Could not find data for this website.</Alert></Container>;
    }

    // --- Render Page Content ---
    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            {/* Header Section */}
            <Paper sx={{ p: 2, mb: 3, position: 'relative', overflow: 'hidden' }}>
                <Tooltip title="Website Settings">
                    <IconButton size="medium" onClick={handleSettingsClick} sx={{ position: 'absolute', top: theme.spacing(1), right: theme.spacing(1), zIndex: 1 }}>
                        <SettingsIcon />
                    </IconButton>
                </Tooltip>
                <Box sx={{ pt: { xs: 4, sm: 0 } }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={8}>
                             <Tooltip title={name}>
                                <Typography variant="h4" component="h1" noWrap gutterBottom>{name}</Typography>
                            </Tooltip>
                            <Tooltip title={url}>
                             <Typography variant="body1" color="textSecondary" noWrap sx={{ mb: 1 }}>{url}</Typography>
                            </Tooltip>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                <Chip icon={isOnline ? <CheckIcon /> : <ErrorIcon />} label={statusText} color={statusColor} size="small" sx={{ fontWeight: "bold" }} />
                                <Chip label={`HTTP ${currentStatusCode ?? "N/A"}`} variant="outlined" size="small" />
                                {latestResult?.checkedAt && (
                                    <Tooltip title={`Last checked: ${new Date(latestResult.checkedAt).toLocaleString()}`}>
                                        <Typography variant="caption" color="textSecondary" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                                            <TimerIcon fontSize="inherit" sx={{ mr: 0.5, verticalAlign: 'middle' }}/>
                                            {new Date(latestResult.checkedAt).toLocaleTimeString()}
                                        </Typography>
                                    </Tooltip>
                                )}
                            </Stack>
                        </Grid>
                        <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, alignItems: 'center', mt: { xs: 2, md: 0 } }}>
                            <Button variant="contained" startIcon={isChecking ? <CircularProgress size={20} color="inherit" /> : <NetworkCheckIcon />} onClick={handleCheckNow} disabled={isChecking || isDetailsRefetching} size="medium">
                                {isChecking ? "Checking..." : "Check Now"}
                            </Button>
                            {/* Show refetching indicator only if not actively checking */}
                            {isDetailsRefetching && !isChecking && <CircularProgress size={24} sx={{ ml: 2 }} />}
                        </Grid>
                    </Grid>
                </Box>
            </Paper>

            {/* Controls: Timeframe Selector */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel id="timeframe-select-label">Chart Timeframe</InputLabel>
                    <Select
                        labelId="timeframe-select-label"
                        id="timeframe-select"
                        value={timeframeKey}
                        label="Chart Timeframe"
                        onChange={handleTimeframeChange}
                        // Disable controls during check or background refetch
                        disabled={isDetailsRefetching || isChecking}
                    >
                        <MenuItem value={'hour'}>Last Hour</MenuItem>
                        <MenuItem value={'day'}>Last 24 Hours</MenuItem>
                        <MenuItem value={'week'}>Last 7 Days</MenuItem>
                        <MenuItem value={'month'}>Last 30 Days</MenuItem>
                        <MenuItem value={'year'}>Last Year</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            {/* Charts Section */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                {/* Uptime Status Chart */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, height: 300, display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <BarChartIcon sx={{ color: 'text.secondary' }} />
                                <Typography variant="h6" component="h2">Uptime Status</Typography>
                            </Stack>
                            {/* Display overall uptime for the selected period */}
                            <Chip label={`${formattedUptime}%`} size="small" variant="outlined" color={getStatusColor(uptimePercentage)} />
                        </Box>
                        <Box sx={{ flexGrow: 1, position: 'relative', minHeight: 0 }}>
                            {uptimeChartData.datasets.length > 0 && uptimeChartData.labels.length > 0 ? (
                                <Bar data={uptimeChartData} options={uptimeChartOptions} />
                            ) : (
                                <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" height="100%" color="text.secondary">
                                    <InfoOutlinedIcon fontSize="small" />
                                    <Typography>No uptime data for this period.</Typography>
                                </Stack>
                            )}
                        </Box>
                    </Paper>
                </Grid>

                {/* Response Time Chart */}
                <Grid item xs={12} md={6}>
                     <Paper sx={{ p: 2, height: 300, display: 'flex', flexDirection: 'column' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <TimelineIcon sx={{ mr: 1, color: 'text.secondary' }} />
                            <Typography variant="h6" component="h2">Response Time</Typography>
                        </Box>
                        <Box sx={{ flexGrow: 1, position: 'relative', minHeight: 0 }}>
                            {/* Render chart if there are labels, even if data has nulls for spanGaps */}
                            {responseTimeChartData.labels?.length > 0 ? (
                                <Line data={responseTimeChartData} options={responseTimeChartOptions} />
                            ) : (
                                <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" height="100%" color="text.secondary">
                                    <InfoOutlinedIcon fontSize="small" />
                                    <Typography>No response time data for this period.</Typography>
                                </Stack>
                            )}
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* Recent Checks List Section */}
            <Paper sx={{ p: 2, overflow: 'hidden' }}>
                {/* Header & Controls */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', mb: 2, gap: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <ListAltIcon sx={{ color: 'text.secondary' }} />
                        <Typography variant="h6" component="h2">Recent Checks</Typography>
                    </Stack>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel id="check-limit-label">Show Checks</InputLabel>
                        <Select
                            labelId="check-limit-label"
                            id="check-limit-select"
                            value={checkLimit}
                            label="Show Checks"
                            onChange={handleCheckLimitChange}
                            // Disable controls during check or background refetch
                            disabled={isDetailsRefetching || isChecking}
                        >
                            <MenuItem value={10}>Last 10</MenuItem>
                            <MenuItem value={25}>Last 25</MenuItem>
                            <MenuItem value={50}>Last 50</MenuItem>
                            <MenuItem value={100}>Last 100</MenuItem>
                        </Select>
                    </FormControl>
                </Box>

                {/* Column Headers */}
                <Grid container spacing={1} sx={{
                    borderBottom: 1, borderColor: 'divider', pb: 1, mb: 1,
                    display: { xs: 'none', sm: 'flex' }, alignItems: 'center',
                    background: alpha(theme.palette.action.hover, 0.04),
                    borderRadius: 1, px: 1
                }}>
                    <Grid item sm={1} sx={{ textAlign: 'center' }}>
                        <Tooltip title="Sort by Status (Up/Down)">
                            <ButtonBase onClick={() => handleSort('isAvailable')} sx={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', borderRadius: 1, p: 0.5, '&:hover': { bgcolor: alpha(theme.palette.action.selected, 0.08)} }} aria-label="Sort by Status">
                                <CheckIcon fontSize="small" sx={{ color: 'text.secondary' }} />{renderSortIcon('isAvailable')}
                            </ButtonBase>
                        </Tooltip>
                    </Grid>
                    <Grid item sm={5} >
                         <Tooltip title="Sort by Date & Time">
                            <ButtonBase onClick={() => handleSort('timestamp')} sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', borderRadius: 1, p: 0.5, width: '100%', justifyContent: 'flex-start', '&:hover': { bgcolor: alpha(theme.palette.action.selected, 0.08) } }} aria-label="Sort by Date and Time">
                                <CalendarTodayIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5 }} /><Typography variant="caption" color="textSecondary" fontWeight="bold">Date & Time</Typography>{renderSortIcon('timestamp')}
                            </ButtonBase>
                        </Tooltip>
                    </Grid>
                    <Grid item sm={3} sx={{ textAlign: 'center' }}>
                        <Tooltip title="Sort by HTTP Status Code">
                            <ButtonBase onClick={() => handleSort('statusCode')} sx={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', borderRadius: 1, p: 0.5, width: '100%', justifyContent: 'center', '&:hover': { bgcolor: alpha(theme.palette.action.selected, 0.08) } }} aria-label="Sort by HTTP Status Code">
                                <CodeIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5 }} /><Typography variant="caption" color="textSecondary" fontWeight="bold">HTTP Status</Typography>{renderSortIcon('statusCode')}
                            </ButtonBase>
                         </Tooltip>
                    </Grid>
                    <Grid item sm={3} sx={{ textAlign: 'center' }}>
                        <Tooltip title="Sort by Response Time">
                            <ButtonBase onClick={() => handleSort('responseTime')} sx={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', borderRadius: 1, p: 0.5, width: '100%', justifyContent: 'center', '&:hover': { bgcolor: alpha(theme.palette.action.selected, 0.08) } }} aria-label="Sort by Response Time">
                                <TimerIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5 }} /><Typography variant="caption" color="textSecondary" fontWeight="bold">Response (ms)</Typography>{renderSortIcon('responseTime')}
                             </ButtonBase>
                        </Tooltip>
                    </Grid>
                </Grid>

                {/* Check List (uses recentChecks which are MonitoringResult[]) */}
                <Box sx={{ maxHeight: { xs: 300, sm: 400 }, overflowY: 'auto' }}>
                   <List dense disablePadding>
                     {recentChecks.length > 0 ? (
                       recentChecks.map((check: MonitoringResult, index) => ( // Explicit type here
                        <React.Fragment key={check.id ?? `check-${index}`}>
                          <ListItem sx={{
                                py: 1, px: { xs: 1, sm: 2 },
                                '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.04) },
                                // Highlight down checks
                                ...(!check.isAvailable && { bgcolor: alpha(theme.palette.error.light, 0.15) })
                            }}>
                              <Grid container spacing={1} alignItems="center">
                                  <Grid item xs={1} sm={1} sx={{ textAlign: 'center' }}>
                                       {check.isAvailable ? <Tooltip title="Up"><CheckIcon color="success" fontSize="small" /></Tooltip> : <Tooltip title="Down"><ErrorIcon color="error" fontSize="small" /></Tooltip>}
                                  </Grid>
                                  <Grid item xs={11} sm={5}>
                                      <Typography variant="body2" noWrap>
                                          {/* Use browser's locale settings for date/time format */}
                                          {new Date(check.checkedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' })}
                                      </Typography>
                                  </Grid>
                                  <Grid item xs={6} sm={3} sx={{ textAlign: { xs: 'left', sm: 'center' } }}>
                                      {/* Show label on mobile */}
                                      <Typography component="span" sx={{ display: { xs: 'inline', sm: 'none' }, mr: 0.5, fontSize: '0.75rem', color: 'text.secondary' }}>Status:</Typography>
                                      <Typography variant="body2" component="span" color="textSecondary">{check.statusCode ?? 'N/A'}</Typography>
                                  </Grid>
                                  <Grid item xs={6} sm={3} sx={{ textAlign: { xs: 'left', sm: 'center' } }}>
                                       {/* Show label on mobile */}
                                      <Typography component="span" sx={{ display: { xs: 'inline', sm: 'none' }, mr: 0.5, fontSize: '0.75rem', color: 'text.secondary' }}>Resp:</Typography>
                                      {/* Use utility function for consistent formatting */}
                                      <Typography variant="body2" component="span" color="textSecondary">{formatResponseTime(check.responseTime)}</Typography>
                                  </Grid>
                              </Grid>
                          </ListItem>
                          {index < recentChecks.length - 1 && <Divider component="li" variant="inset" sx={{ ml: { xs: 0, sm: '72px' } }} />}
                        </React.Fragment>
                      ))
                    ) : (
                      <ListItem>
                          <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" width="100%" p={3} color="text.secondary">
                            <InfoOutlinedIcon fontSize="small" />
                            <Typography>No checks found for the selected criteria.</Typography>
                          </Stack>
                      </ListItem>
                    )}
                  </List>
                </Box>
            </Paper>
        </Container>
    );
};

export default WebsiteDetails;