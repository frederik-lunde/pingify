// client/src/components/details/WebsiteDetails.tsx
import React, { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import {
  Container, Typography, Box, Paper, Grid, Button, Chip, List, ListItem, Divider, CircularProgress, Select, MenuItem, FormControl,
  InputLabel, useTheme, IconButton, Tooltip, Stack, ButtonBase, Alert, Skeleton, SelectChangeEvent
} from "@mui/material";
import {
  CheckCircleOutline as CheckIcon, ErrorOutline as ErrorIcon, Timeline as TimelineIcon,
  ListAlt as ListAltIcon, BarChart as BarChartIcon, NetworkCheck as NetworkCheckIcon,
  Settings as SettingsIcon, ArrowUpward as ArrowUpwardIcon, ArrowDownward as ArrowDownwardIcon,
  CalendarToday as CalendarTodayIcon, Code as CodeIcon, Timer as TimerIcon, SwapVert as SwapVertIcon,
} from "@mui/icons-material";
import { Line, Bar } from "react-chartjs-2"; // Keep chart component imports
// Import TanStack Query hooks directly
import { useWebsiteDetailsQuery, useWebsiteCheckMutation } from "../hooks"; // Adjusted path assuming hooks are in src/hooks
import { TimeframeKey, ApiError, MonitoringResult } from "../types"; // Adjusted path assuming types are in src/types
import { formatResponseTime, formatUptime, getStatusColor } from "../utils/statusUtils"; // Adjusted path assuming utils are in src/utils

// Import ONLY Chart.js types needed for configuration/callbacks, NOT ChartJS itself or registration components
import { ChartOptions, TooltipItem } from "chart.js";
// REMOVE ChartJS.register(...) call from here

// Define possible sortable columns and direction
type SortableColumn = 'isAvailable' | 'timestamp' | 'statusCode' | 'responseTime';
type SortDirection = 'asc' | 'desc';

const WebsiteDetails: React.FC = () => {
  const { websiteId: websiteIdParam } = useParams<{ websiteId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();

  // Validate and convert URL param to number
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
      enabled: !!numericWebsiteId && numericWebsiteId > 0
  });

  // --- TanStack Mutation Hook ---
  const { mutate: checkWebsite, isPending: isChecking } = useWebsiteCheckMutation();

  // --- Event Handlers ---
  const handleTimeframeChange = useCallback((event: SelectChangeEvent<TimeframeKey>) => {
    setTimeframeKey(event.target.value as TimeframeKey);
  }, []);

  const handleCheckLimitChange = useCallback((event: SelectChangeEvent<number | string>) => { // Allow string from Select
      const newLimit = Number(event.target.value); // Convert to number
      if (!isNaN(newLimit)) {
        setCheckLimit(newLimit);
      }
  }, []);

  const handleSort = useCallback((column: SortableColumn) => {
        setSortBy(prevSortBy => { // Use functional update if depending on previous state for toggle
            setSortDir(prevDir => (prevSortBy === column && prevDir === 'desc' ? 'asc' : 'desc'));
            return column;
        });
    }, []); // Removed sortBy dependency as it's implicitly handled by functional update


  const handleCheckNow = useCallback(() => {
      if (!isChecking && numericWebsiteId) {
          checkWebsite(numericWebsiteId); // Simplified mutation call
      }
  }, [isChecking, numericWebsiteId, checkWebsite]);

  const handleSettingsClick = useCallback(() => {
        if (numericWebsiteId) {
            navigate(`/website/${numericWebsiteId}/settings`);
        }
    }, [navigate, numericWebsiteId]);

   // --- Derived Data & Chart Config ---
   const { name, url, latestResult, chartDataForTimeframe, recentChecks, uptimePercentage } = useMemo(() => ({
        name: websiteDetails?.name ?? 'Loading...',
        url: websiteDetails?.url ?? '',
        latestResult: websiteDetails?.latestResult,
        chartDataForTimeframe: websiteDetails?.chartData ?? [],
        recentChecks: websiteDetails?.recentChecks ?? [],
        uptimePercentage: websiteDetails?.uptimePercent ?? 0,
   }), [websiteDetails]);

   const isOnline = useMemo(() => latestResult?.isAvailable ?? false, [latestResult]);
   const currentStatusCode = useMemo(() => latestResult?.statusCode, [latestResult]);
   const statusColor = isOnline ? "success" : "error";
   const statusText = isOnline ? "Up" : "Down";
   const formattedUptime = useMemo(() => formatUptime(uptimePercentage), [uptimePercentage]);

    // Uptime Status Bar Chart Data
   const uptimeChartData = useMemo(() => {
        if (!chartDataForTimeframe || chartDataForTimeframe.length === 0) {
             return { labels: [], datasets: [] }; // Return empty structure if no data
        }
        const labels = chartDataForTimeframe.map((d) =>
            new Date(d.checkedAt).toLocaleTimeString([], timeframeKey === 'hour' ? { hour: '2-digit', minute: '2-digit' } : { hour: 'numeric' })
        );
        const data = chartDataForTimeframe.map((d) => (d.isAvailable ? 1 : -1));
        const backgroundColors = chartDataForTimeframe.map((d) =>
            d.isAvailable ? theme.palette.success.light : theme.palette.error.light
        );

        return {
            labels,
            datasets: [{ label: "Status", data, backgroundColor: backgroundColors, barPercentage: 1.0, categoryPercentage: 1.0 }],
        };
   }, [chartDataForTimeframe, theme.palette.success.light, theme.palette.error.light, timeframeKey]);

   // Uptime Status Bar Chart Options
   const uptimeChartOptions: ChartOptions<'bar'> = useMemo(() => ({
        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: {
            label: (context: TooltipItem<'bar'>) => (context.parsed.y > 0 ? 'Status: Up' : 'Status: Down'),
            title: (context: TooltipItem<'bar'>[]) => {
                const index = context[0]?.dataIndex;
                return (index !== undefined && chartDataForTimeframe?.[index]) ? new Date(chartDataForTimeframe[index].checkedAt).toLocaleString() : '';
            }
        }}},
        scales: { x: { title: { display: false }, ticks: { autoSkip: true, maxTicksLimit: 15, maxRotation: 0, minRotation: 0 } }, y: { display: false, min: -1.5, max: 1.5 } },
        indexAxis: 'x',
   }), [chartDataForTimeframe]); // Removed theme dependency if not directly used in options

   // Response Time Line Chart Data
   const responseTimeChartData = useMemo(() => {
        // Ensure chartDataForTimeframe exists before filtering
        if (!chartDataForTimeframe) return { labels: [], datasets: [{ data: [] }] }; // Return empty structure

        const responseData = chartDataForTimeframe.filter(d => d.isAvailable && d.responseTime != null);
        // Ensure responseData has items before proceeding
        if (responseData.length === 0) return { labels: [], datasets: [{ data: [] }] };

        const labels = responseData.map((d) =>
            new Date(d.checkedAt).toLocaleTimeString([], timeframeKey === 'hour' ? { hour: '2-digit', minute: '2-digit' } : { hour: 'numeric' })
        );
        const data = responseData.map((d) => d.responseTime);

        return {
            labels,
            datasets: [{ label: "Response Time (ms)", data, borderColor: theme.palette.primary.main, backgroundColor: theme.palette.primary.light + '33', fill: true, tension: 0.1, pointRadius: 2 }],
        };
   }, [chartDataForTimeframe, theme.palette.primary, timeframeKey]);

   // Response Time Line Chart Options
   const responseTimeChartOptions: ChartOptions<'line'> = useMemo(() => ({
       responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: {
           label: (context: TooltipItem<'line'>) => `Response Time: ${context.parsed.y} ms`,
           title: (context: TooltipItem<'line'>[]) => {
               const responseData = chartDataForTimeframe?.filter(d => d.isAvailable && d.responseTime != null) ?? []; // Add null check
               const index = context[0]?.dataIndex;
               return (index !== undefined && responseData[index]) ? new Date(responseData[index].checkedAt).toLocaleString() : '';
           }
       }}},
       scales: { x: { title: { display: false }, ticks: { autoSkip: true, maxTicksLimit: 15, maxRotation: 0, minRotation: 0 } }, y: { title: { display: true, text: "ms" }, beginAtZero: true } },
       interaction: { mode: 'index', intersect: false },
   }), [chartDataForTimeframe]); // Removed theme dependency if not directly used in options

    // Helper to render sort icon
    const renderSortIcon = (column: SortableColumn) => {
        if (sortBy !== column) {
            return <SwapVertIcon fontSize="inherit" sx={{ ml: 0.5, color: 'text.disabled', opacity: 0.5 }} />;
        }
        return sortDir === 'asc'
            ? <ArrowUpwardIcon fontSize="inherit" sx={{ ml: 0.5, color: 'text.primary' }} />
            : <ArrowDownwardIcon fontSize="inherit" sx={{ ml: 0.5, color: 'text.primary' }} />;
    };

    // --- Render Logic ---
    // (Loading, Error, No Data states remain the same)
    if (websiteIdParam !== undefined && numericWebsiteId === undefined) {
        return <Container sx={{mt: 4}}><Alert severity="error">Invalid Website ID provided in URL.</Alert></Container>;
    }

    if (isDetailsLoading && !websiteDetails) {
        // Skeleton rendering code... (kept as is)
        return (
             <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                 {/* Header Skeleton */}
                 <Paper sx={{ p: 2, mb: 3 }}><Skeleton variant="rectangular" height={80} /></Paper>
                 {/* Controls Skeleton */}
                 <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}><Skeleton variant="rectangular" width={150} height={40} /></Box>
                 {/* Charts Skeleton */}
                 <Grid container spacing={3} sx={{ mb: 3 }}>
                     <Grid item xs={12} md={6}><Paper sx={{ p: 2 }}><Skeleton variant="rectangular" height={300} /></Paper></Grid>
                     <Grid item xs={12} md={6}><Paper sx={{ p: 2 }}><Skeleton variant="rectangular" height={300} /></Paper></Grid>
                 </Grid>
                  {/* Checks List Skeleton */}
                  <Paper sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                           <Skeleton variant="text" width={150} height={30}/>
                           <Skeleton variant="rectangular" width={100} height={40}/>
                      </Box>
                      <Skeleton variant="rectangular" height={200}/>
                  </Paper>
             </Container>
        );
    }

    if (detailsError) {
         return (
            <Container sx={{mt: 4}}>
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => refetchDetails()}>Retry</Button>}>
                    Error loading website details: {detailsError.message}
                </Alert>
            </Container>
        );
    }

    if (!isDetailsLoading && !websiteDetails) {
       return <Container sx={{mt: 4}}><Alert severity="warning">Could not find data for this website.</Alert></Container>;
    }

  // --- Render Page Content ---
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header Section */}
      <Paper sx={{ p: 2, mb: 3, position: 'relative' }}>
            {/* ... Header content ... (kept as is) */}
             <Tooltip title="Website Settings">
                <IconButton size="medium" onClick={handleSettingsClick} sx={{ position: 'absolute', top: theme.spacing(1), right: theme.spacing(1), zIndex: 1 }}>
                  <SettingsIcon />
                </IconButton>
            </Tooltip>
            <Box sx={{ pt: { xs: 4, sm: 0 } }}>
                <Grid container spacing={2} alignItems="center">
                     <Grid item xs={12} md={8}>
                        <Typography variant="h4" component="h1" noWrap gutterBottom>{name}</Typography>
                        <Typography variant="body1" color="textSecondary" noWrap sx={{ mb: 1 }}>{url}</Typography>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Chip icon={isOnline ? <CheckIcon /> : <ErrorIcon />} label={statusText} color={statusColor} size="small" sx={{ fontWeight: "bold" }} />
                            <Chip label={`HTTP ${currentStatusCode ?? "N/A"}`} variant="outlined" size="small" />
                            {latestResult?.checkedAt && (
                                <Tooltip title={`Last checked: ${new Date(latestResult.checkedAt).toLocaleString()}`}>
                                     <Typography variant="caption" color="textSecondary">
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
                        {isDetailsRefetching && !isChecking && <CircularProgress size={24} sx={{ ml: 2 }} />}
                    </Grid>
                </Grid>
            </Box>
      </Paper>

      {/* Controls: Timeframe Selector */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          {/* ... Timeframe Select ... (kept as is) */}
           <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel id="timeframe-select-label">Chart Timeframe</InputLabel>
              <Select labelId="timeframe-select-label" id="timeframe-select" value={timeframeKey} label="Chart Timeframe" onChange={handleTimeframeChange}>
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
                 {/* ... Uptime Header ... (kept as is) */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                     <Stack direction="row" alignItems="center" spacing={1}>
                        <BarChartIcon sx={{ color: 'text.secondary' }} />
                        <Typography variant="h6" component="h2">Uptime Status</Typography>
                     </Stack>
                     <Chip label={`${formattedUptime}%`} size="small" variant="outlined" color={getStatusColor(uptimePercentage)} />
                 </Box>
                <Box sx={{ flexGrow: 1, position: 'relative' }}>
                    {/* Check datasets exist before rendering Bar */}
                    {uptimeChartData.datasets.length > 0 && uptimeChartData.labels.length > 0 ? (
                        <Bar data={uptimeChartData} options={uptimeChartOptions} />
                    ) : (
                        <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                             <Typography color="textSecondary">No uptime data for this period.</Typography>
                        </Box>
                    )}
                </Box>
            </Paper>
        </Grid>

        {/* Response Time Chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 300, display: 'flex', flexDirection: 'column' }}>
             {/* ... Response Time Header ... (kept as is) */}
             <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TimelineIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="h6" component="h2">Response Time</Typography>
            </Box>
             <Box sx={{ flexGrow: 1, position: 'relative' }}>
                {/* Check datasets AND data points exist before rendering Line */}
                {responseTimeChartData.datasets?.[0]?.data?.length > 0 ? (
                    <Line data={responseTimeChartData} options={responseTimeChartOptions} />
                ) : (
                    <Box display="flex" alignItems="center" justifyContent="center" height="100%">
                        <Typography color="textSecondary">No response time data for this period.</Typography>
                    </Box>
                )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Checks List Section */}
      <Paper sx={{ p: 2, overflow: 'hidden' }}>
          {/* ... Recent Checks Header & Controls ... (kept as is) */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', mb: 2, gap: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
                 <ListAltIcon sx={{ color: 'text.secondary' }} />
                <Typography variant="h6" component="h2">Recent Checks</Typography>
            </Stack>
             <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel id="check-limit-label">Show Checks</InputLabel>
                <Select labelId="check-limit-label" id="check-limit-select" value={checkLimit} label="Show Checks" onChange={handleCheckLimitChange}>
                    <MenuItem value={10}>Last 10</MenuItem>
                    <MenuItem value={25}>Last 25</MenuItem>
                    <MenuItem value={50}>Last 50</MenuItem>
                    <MenuItem value={100}>Last 100</MenuItem>
                </Select>
            </FormControl>
          </Box>

          {/* ... Column Headers ... (kept as is) */}
           <Grid container spacing={1} sx={{ borderBottom: 1, borderColor: 'divider', pb: 1, mb: 1, display: { xs: 'none', sm: 'flex'}, alignItems: 'center', background: theme.palette.background.default, borderRadius: 1 }}>
             <Grid item sm={1} sx={{ textAlign: 'center' }}>
                 <ButtonBase onClick={() => handleSort('isAvailable')} sx={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', borderRadius: 1, p: 0.5 }}>
                    <Tooltip title="Sort by Status (Up/Down)"><CheckIcon fontSize="small" sx={{ color: 'text.secondary' }}/></Tooltip>
                    {renderSortIcon('isAvailable')}
                 </ButtonBase>
            </Grid>
             <Grid item sm={5}>
                 <ButtonBase onClick={() => handleSort('timestamp')} sx={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', borderRadius: 1, p: 0.5, width: '100%', justifyContent: 'center' }}>
                    <CalendarTodayIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5 }}/>
                    <Typography variant="caption" color="textSecondary" fontWeight="bold">Date & Time</Typography>
                    {renderSortIcon('timestamp')}
                </ButtonBase>
            </Grid>
            <Grid item sm={3} sx={{ textAlign: 'center' }}>
                <ButtonBase onClick={() => handleSort('statusCode')} sx={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', borderRadius: 1, p: 0.5, width: '100%', justifyContent: 'center' }}>
                    <CodeIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5 }}/>
                    <Typography variant="caption" color="textSecondary" fontWeight="bold">HTTP Status</Typography>
                    {renderSortIcon('statusCode')}
                </ButtonBase>
            </Grid>
            <Grid item sm={3} sx={{ textAlign: 'center' }}>
                <ButtonBase onClick={() => handleSort('responseTime')} sx={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', borderRadius: 1, p: 0.5, width: '100%', justifyContent: 'center' }}>
                    <TimerIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5 }}/>
                    <Typography variant="caption" color="textSecondary" fontWeight="bold">Response (ms)</Typography>
                    {renderSortIcon('responseTime')}
                 </ButtonBase>
            </Grid>
          </Grid>

          {/* ... Check List ... (kept as is) */}
          <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
           <List dense disablePadding>
             {recentChecks.length > 0 ? (
               recentChecks.map((check, index) => (
                <React.Fragment key={check.id ?? `check-${index}`}>
                  <ListItem sx={{ py: 1.5, '&:hover': { bgcolor: 'action.hover' } }}>
                      <Grid container spacing={1} alignItems="center">
                          <Grid item xs={1} sm={1} sx={{ textAlign: 'center' }}>
                               {check.isAvailable ? <Tooltip title="Up"><CheckIcon color="success" fontSize="small" /></Tooltip> : <Tooltip title="Down"><ErrorIcon color="error" fontSize="small" /></Tooltip>}
                          </Grid>
                          <Grid item xs={11} sm={5}>
                              <Typography variant="body2" noWrap>
                                  {new Date(check.checkedAt).toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </Typography>
                          </Grid>
                          <Grid item xs={6} sm={3} sx={{ textAlign: { xs: 'left', sm: 'center' } }}>
                              <Typography component="span" sx={{ display: { xs: 'inline', sm: 'none' }, mr: 0.5, fontSize: '0.75rem', color: 'text.secondary' }}>Status:</Typography>
                              <Typography variant="body2" component="span" color="textSecondary">{check.statusCode ?? 'N/A'}</Typography>
                          </Grid>
                          <Grid item xs={6} sm={3} sx={{ textAlign: { xs: 'left', sm: 'center' } }}>
                              <Typography component="span" sx={{ display: { xs: 'inline', sm: 'none' }, mr: 0.5, fontSize: '0.75rem', color: 'text.secondary' }}>Resp:</Typography>
                              <Typography variant="body2" component="span" color="textSecondary">{check.responseTime != null ? `${check.responseTime} ms` : 'N/A'}</Typography>
                          </Grid>
                      </Grid>
                  </ListItem>
                  {index < recentChecks.length - 1 && <Divider component="li" variant="inset" sx={{ ml: { xs: 0, sm: '72px' } }} />}
                </React.Fragment>
              ))
            ) : (
              <ListItem><Typography sx={{textAlign: 'center', width: '100%', p: 3, color: 'text.secondary'}}>No checks found for the selected criteria.</Typography></ListItem>
            )}
          </List>
        </Box>
      </Paper>
    </Container>
  );
};

export default WebsiteDetails;