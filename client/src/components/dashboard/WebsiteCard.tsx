// src/components/dashboard/WebsiteCard.tsx
import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Card, CardContent, Typography, Box, Chip, IconButton,
  Tooltip,
  useTheme,
  CircularProgress,
  alpha,
  Skeleton, // Import Skeleton for loading state
  Stack // Import Stack for layout
} from "@mui/material";
import {
  CheckCircleOutline as CheckIcon,
  ErrorOutline as ErrorIcon,
  ShowChart as ChartIcon,
  HourglassEmpty as PendingIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  TimerOff as TimerOffIcon,
  InfoOutlined as InfoIcon, // Import InfoIcon for messages
  WarningAmber as WarningIcon // Import WarningIcon for errors
} from "@mui/icons-material";
// Lazy load chart to improve initial load performance
const Line = React.lazy(() => import('react-chartjs-2').then(module => ({ default: module.Line })));
import { ChartOptions, TooltipItem } from 'chart.js'; // Import chart types

import {
  getStatusColor,
  getResponseTimeColor,
  formatResponseTime,
  formatUptime,
  formatDowntimeDuration
} from "../../utils/statusUtils"; // Adjust path if needed

import {
  useWebsiteDetailsQuery, // Import the query hook used by WebsiteDetails
  useWebsiteMutations, // Assuming this hook handles pinning
} from "../../hooks"; // Adjust path if needed

import {
  MonitoringResult,
  WebsiteUser,
  TimeframeKey, // Import TimeframeKey type
  ChartDataPoint // Import ChartDataPoint type
} from "../../types"; // Adjust path if needed

interface WebsiteCardProps {
  userWebsite: WebsiteUser; // Expecting full WebsiteUser object (provides websiteId, isPinned etc.)
  shouldHighlightThisCard?: boolean; // Flag indicating if this specific card should be highlighted
  // Removed latestResult and results props, as data will be fetched internally
}

// Default timeframe for the card's data query
const CARD_TIMEFRAME: TimeframeKey = 'day'; // Use 'day' for a reasonable overview
const CARD_DATA_LIMIT = 24; // Limit data points for the card chart (e.g., 24 for hourly points in a day)

// Memoized chart component (can remain similar)
const ResponseTimeChart = React.memo(
  ({ data, options }: { data: any; options: any }) => {
    // Added check for empty data array within the first dataset or only invalid points
    if (!data?.datasets?.[0]?.data?.length || data.datasets[0].data.every((d: number | null) => d === null || d === -1 || isNaN(d))) {
      return null; // Don't render chart if no valid data points
    }
    return (
        // Wrap lazy loaded chart in Suspense
        <React.Suspense fallback={<Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress size={20} /></Box>}>
             <Line data={data} options={options} />
        </React.Suspense>
    );
  },
);
ResponseTimeChart.displayName = 'ResponseTimeChart';

// --- Helper Function to generate Chart Data/Options for the Card ---
const useCardChartConfig = (chartDataPoints: ChartDataPoint[] | undefined): { chartData: any, chartOptions: ChartOptions<'line'> } => {
    const theme = useTheme();

    const chartData = useMemo(() => {
        if (!chartDataPoints || chartDataPoints.length === 0) {
            return { labels: [], datasets: [] };
        }
        const labels = chartDataPoints.map(p => p.label); // Use labels from fetched data
        // Map avgResponseTime, use null for missing data points (handled by spanGaps)
        const data = chartDataPoints.map(p => p.avgResponseTime ?? null);

        return {
            labels,
            datasets: [{
                data,
                borderColor: theme.palette.primary.main,
                borderWidth: 1.5, // Thinner line for card
                pointRadius: 0, // No points on the card chart
                pointHoverRadius: 0,
                tension: 0.2, // Slight curve
                fill: false,
                spanGaps: true, // Connect line over null data points
            }]
        };
    }, [chartDataPoints, theme.palette.primary.main]);

    const chartOptions = useMemo((): ChartOptions<'line'> => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }, // No legend on card
            tooltip: { // Basic tooltip for card
                enabled: true,
                mode: 'index',
                intersect: false,
                displayColors: false, // Don't show color box
                callbacks: {
                     title: (tooltipItems: TooltipItem<'line'>[]) => {
                        if (!tooltipItems.length || !chartDataPoints) return '';
                        const index = tooltipItems[0].dataIndex;
                        return chartDataPoints[index]?.label ?? ''; // Show the time label
                     },
                     label: (tooltipItem: TooltipItem<'line'>) => {
                        const value = tooltipItem.parsed.y;
                        if (value === null || isNaN(value)) return 'No data';
                        return `Avg: ${value.toFixed(0)} ms`; // Show average response time
                    },
                }
            }
        },
        scales: { // Hide scales for card view
            x: { display: false },
            y: { display: false, beginAtZero: false}, // Adjust y-axis range if needed
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        },
        animation: {
             duration: 0 // Disable animation for performance on grid
        },
    }), [chartDataPoints]); // Re-calculate options if data points change

    return { chartData, chartOptions };
};
// --- End Helper Function ---

const WebsiteCard = React.memo(
  ({
    userWebsite,
    shouldHighlightThisCard = false,
  }: WebsiteCardProps) => {
    const navigate = useNavigate();
    const theme = useTheme();
    const { setPinStatus, isSettingPin, errorSettingPin } = useWebsiteMutations(); // Assume this handles pinning

    // --- Data Fetching using the same hook as WebsiteDetails ---
    const {
        data: websiteDetails,
        isPending: isLoading, // Use isPending for initial loading state
        error: queryError,
        isFetching, // Indicates background refetching
        // refetch // Can be used for a manual refresh button if needed
    } = useWebsiteDetailsQuery({
        websiteId: userWebsite.websiteId,
        timeframe: CARD_TIMEFRAME, // Use the fixed timeframe for cards
        limit: CARD_DATA_LIMIT, // Use the fixed limit for cards
        // Sorting isn't relevant for the card's primary display, use defaults
        // sortBy: 'timestamp',
        // sortDir: 'desc',
    }, {
        enabled: !!userWebsite.websiteId, // Only run query if ID is valid
        staleTime: 5 * 60 * 1000, // 5 minutes - data on card doesn't need to be super realtime
        refetchOnWindowFocus: true, // Refetch when window regains focus
        refetchInterval: 10 * 60 * 1000, // Optional: Refetch every 10 minutes in the background
        refetchIntervalInBackground: true,
        // Consider placeholderData: keepPreviousData if smoother transitions are needed during refetch
    });

    // --- Derived Values from Fetched Data ---
    const name = websiteDetails?.name ?? userWebsite.name ?? 'Loading...'; // Fallback name
    const url = websiteDetails?.url ?? userWebsite.website?.url;
    const latestResult = websiteDetails?.latestResult; // Can be null if no checks yet
    const uptimePercent = websiteDetails?.uptimePercent; // Can be null or 0
    const chartDataPoints = websiteDetails?.chartData; // Array of ChartDataPoint or undefined

    const hasPinError = !!errorSettingPin;
    const isPinned = userWebsite.isPinned; // Pin status comes from userWebsite prop

    const isOnline = latestResult?.isAvailable ?? null;
    const responseTime = latestResult?.responseTime ?? null;
    const statusCode = latestResult?.statusCode;

    // Downtime info still comes from userWebsite prop (updated via websockets/polling)
    const consecutiveFailures = isOnline === false ? userWebsite.consecutiveFailures : undefined;
    const downtimeStartedAt = isOnline === false ? userWebsite.downtimeStartedAt : null;
    const downtimeDuration = formatDowntimeDuration(downtimeStartedAt);

    const formattedUptime = formatUptime(uptimePercent); // Use uptimePercent from query

    // Generate chart config using the helper and fetched data
    const { chartData, chartOptions } = useCardChartConfig(chartDataPoints);
    // Require > 1 point for a meaningful line chart, and website must be online
    const canShowChart = latestResult !== undefined && isOnline === true && (chartData?.datasets?.[0]?.data?.filter((d: number | null) => d !== null && !isNaN(d)).length ?? 0) > 1;

    // Memoized handlers
    const handleClick = useCallback(() => {
      navigate(`/website/${userWebsite.websiteId}`);
    }, [navigate, userWebsite.websiteId]);

    const handlePinClick = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
          await setPinStatus({ websiteId: userWebsite.websiteId, isPinned: !isPinned });
        } catch (err) {
           console.error("Failed to set pin status from card:", err);
           // Optionally show feedback to the user here
        }
      },
      [setPinStatus, userWebsite.websiteId, isPinned],
    );

    const displayName = name || url || 'Website';
    const displayUrl = url;

    // Tooltip text for Pin button
    const pinTooltipText = useMemo(() => {
        if (isSettingPin) return "Processing...";
        if (hasPinError) return `Error: ${errorSettingPin?.message || 'Pin action failed'}. Click to retry.`;
        return isPinned ? "Unpin Website" : "Pin Website";
    }, [isSettingPin, hasPinError, isPinned, errorSettingPin?.message]);

    // --- Highlighting Styles (remains the same) ---
    const cardHighlightStyles = useMemo(() => {
        const baseSx = {
            transition: theme.transitions.create(['transform', 'box-shadow', 'border-color'], {
                duration: theme.transitions.duration.short,
            }),
             "&:hover": { transform: "translateY(-4px)", boxShadow: theme.shadows[6] },
        };
        if (shouldHighlightThisCard) {
            return {
                ...baseSx,
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: theme.palette.warning.main,
                boxShadow: `0 0 10px -1px ${alpha(theme.palette.warning.main, 0.6)}`,
            };
        } else {
            return {
                ...baseSx,
                borderWidth: isPinned ? '2px' : '1px',
                borderStyle: 'solid',
                borderColor: isPinned ? theme.palette.primary.main : theme.palette.divider,
            };
        }
    }, [shouldHighlightThisCard, isPinned, theme]);

    // --- Loading State ---
    if (isLoading && !websiteDetails) { // Show skeleton only on initial load without data
        return (
            <Card
                sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    p: 2,
                    pb: 1,
                    borderColor: theme.palette.divider, // Default border
                    borderWidth: '1px',
                    borderStyle: 'solid',
                }}
            >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                    <Skeleton variant="text" width="70%" height={28} />
                    <Skeleton variant="circular" width={24} height={24} />
                </Box>
                <Skeleton variant="text" width="50%" height={18} sx={{ mb: 1.5 }} />
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mb: 1.5, minHeight: '24px' }}>
                    <Skeleton variant="rounded" width={60} height={22} />
                    <Skeleton variant="rounded" width={50} height={22} />
                    <Skeleton variant="rounded" width={70} height={22} />
                </Box>
                <Box sx={{ flexGrow: 1, minHeight: 60, maxHeight: 80, mt: "auto" }}>
                    <Skeleton variant="rectangular" width="100%" height="100%" />
                </Box>
            </Card>
        );
    }

    // --- Error State ---
    if (queryError && !websiteDetails) { // Show error only if loading failed and we have no data
        return (
            <Card
                sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    p: 2,
                    borderColor: theme.palette.error.light, // Error border
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                }}
            >
                 <WarningIcon color="error" sx={{ mb: 1 }} />
                 <Typography variant="body2" color="textSecondary">
                      Failed to load data.
                 </Typography>
                 <Typography variant="caption" color="error">
                      {(queryError as Error)?.message || 'Unknown error'}
                 </Typography>
                 {/* Optionally add a retry button here:
                 <Button size="small" onClick={() => refetch()} sx={{ mt: 1 }}>Retry</Button>
                 */}
            </Card>
        );
    }

    // --- Main Card Render ---
    const cardContent = (
        <Card
            sx={{
                cursor: "pointer",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                position: 'relative',
                pb: 1,
                // Apply calculated styles (highlighting/pinning)
                ...cardHighlightStyles,
                // Add subtle opacity if fetching in background
                opacity: isFetching && !isLoading ? 0.85 : 1,
                transition: theme.transitions.create(['opacity', 'transform', 'box-shadow', 'border-color'], { // Include opacity in transition
                    duration: theme.transitions.duration.short,
                }),
            }}
            onClick={handleClick}
            aria-label={`View details for ${displayName}${isPinned ? ', Pinned' : ''}${isOnline === false ? ', Offline' : ''}${shouldHighlightThisCard ? ', Highlighted as Last Incident Source' : ''}`}
        >
            <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", p: 2, pb: 1 }}>
               {/* Card Header Area: Title and Pin Button */}
               <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                 <Tooltip title={displayName} placement="top-start">
                     <Typography variant="h6" component="div" noWrap sx={{ maxWidth: 'calc(100% - 40px)', mr: 1 }}>
                        {displayName}
                        {/* Subtle fetching indicator next to title */}
                        {isFetching && !isLoading && <CircularProgress size={12} sx={{ ml: 0.5, verticalAlign: 'middle', opacity: 0.7 }} color="inherit" />}
                     </Typography>
                 </Tooltip>
                 {/* Pin/Unpin Button */}
                 <Tooltip title={pinTooltipText} placement="top">
                    <span> {/* Span needed for disabled button tooltip */}
                        <IconButton
                            size="small"
                            onClick={handlePinClick}
                            disabled={isSettingPin}
                            aria-label={isPinned ? `Unpin ${displayName}` : `Pin ${displayName}`}
                            sx={{
                                color: hasPinError && !isSettingPin ? theme.palette.error.main :
                                       isPinned ? theme.palette.primary.main :
                                       'inherit',
                            }}
                        >
                            {isSettingPin ? <CircularProgress size={20} color="inherit" /> : isPinned ? <PinIcon fontSize="small" /> : <PinOutlinedIcon fontSize="small" />}
                        </IconButton>
                    </span>
                 </Tooltip>
               </Box>

               {/* URL (only if different from display name) */}
               {name && displayUrl && ( // Show URL if name exists AND url exists
                   <Tooltip title={displayUrl} placement="bottom-start">
                     <Typography variant="body2" color="textSecondary" noWrap sx={{ mb: 1.5, minHeight: '20px' }}> {/* Ensure min height */}
                         {displayUrl}
                     </Typography>
                   </Tooltip>
               )}
               {/* Placeholder if URL is same as name or not shown, to maintain layout consistency */}
               {(!name || !displayUrl) && <Box sx={{ mb: 1.5, minHeight: '20px' }} />} {/* Ensure min height */}

               {/* Status Chips Area */}
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mb: 1.5, minHeight: '24px' }}> {/* Ensure min height */}
                 {/* Show Pending Chip if NO latest result */}
                 {latestResult === undefined || latestResult === null ? (
                     <Chip size="small" icon={<PendingIcon fontSize="inherit"/>} label="Pending" variant="outlined" color="warning" sx={{ fontWeight: 500 }}/>
                 ) : (
                     // Show Online/Offline, Status Code, Response Time, Uptime Chips
                     <>
                         <Tooltip title={isOnline ? "Website is online" : "Website is offline"}>
                             <Chip size="small" icon={isOnline ? <CheckIcon fontSize="inherit"/> : <ErrorIcon fontSize="inherit"/>} label={isOnline ? "Online" : "Offline"} color={isOnline ? "success" : "error"} sx={{ fontWeight: 500 }}/>
                         </Tooltip>
                         {statusCode != null && (
                             <Tooltip title={`Last HTTP Status: ${statusCode}`}>
                                <Chip size="small" label={`${statusCode}`} variant="outlined" />
                             </Tooltip>
                         )}
                         {/* Show Response Time only if Online */}
                         {isOnline && responseTime !== null && (
                             <Tooltip title={`Last Response Time: ${formatResponseTime(responseTime)}`}>
                                <Chip size="small" label={formatResponseTime(responseTime)} color={getResponseTimeColor(responseTime)} variant="outlined" />
                             </Tooltip>
                         )}
                         {/* Show Uptime only if Online and value exists */}
                         {/* Use uptimePercent directly from query */}
                         {isOnline && formattedUptime !== "N/A" && uptimePercent !== null && uptimePercent !== undefined && (
                            <Tooltip title={`Uptime (${CARD_TIMEFRAME}): ${formattedUptime}%`}>
                                <Chip
                                    size="small"
                                    icon={<ChartIcon fontSize="inherit" />}
                                    label={`${formattedUptime}%`}
                                    color={getStatusColor(uptimePercent)} // Pass the number
                                    variant="outlined"
                                />
                            </Tooltip>
                         )}
                     </>
                 )}
                 {/* Show inline query error if refetch fails but we have stale data */}
                 {queryError && websiteDetails && (
                     <Tooltip title={`Error refreshing: ${(queryError as Error)?.message || 'Unknown'}`}>
                         <WarningIcon fontSize="small" color="warning" sx={{ ml: 'auto', alignSelf: 'center' }} />
                     </Tooltip>
                 )}
              </Box>

               {/* Chart or Downtime Info Area */}
               <Box sx={{ flexGrow: 1, minHeight: 60, maxHeight: 80, mt: "auto", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {/* Show chart if conditions met */}
                  {canShowChart ? (
                      // Pass key to ensure re-render if data identity changes
                      <ResponseTimeChart data={chartData} options={chartOptions} key={`chart-${userWebsite.websiteId}`} />
                  ) : (
                      // Show Placeholder/Downtime Info otherwise
                      <Box sx={{ color: 'text.secondary', textAlign: 'center', width: '100%' }}>
                         {/* Case 1: Still loading or no results yet */}
                         {(isLoading || latestResult === undefined || latestResult === null) && !queryError ? (
                             <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                                 <PendingIcon fontSize="small" />
                                 <Typography variant="caption">Awaiting check data...</Typography>
                             </Stack>
                         ) : !isOnline ? ( // Case 2: Explicitly Offline
                            <Stack alignItems="center" spacing={0.3} color={theme.palette.warning.dark}>
                                 <TimerOffIcon sx={{ fontSize: '1.3rem' }} />
                                 <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                     {downtimeDuration || 'Currently Offline'}
                                 </Typography>
                                 {/* Additional details */}
                                 {(consecutiveFailures !== undefined || downtimeStartedAt) && (
                                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                                        {consecutiveFailures !== undefined && `Failures: ${consecutiveFailures}`}
                                        {(consecutiveFailures !== undefined && downtimeStartedAt) && ' • '}
                                        {downtimeStartedAt && `Since: ${new Date(downtimeStartedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
                                      </Typography>
                                 )}
                            </Stack>
                         ) : ( // Case 3: Online, but not enough data for chart, or error fetching chart data
                              <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                                  <InfoIcon fontSize="small" />
                                  <Typography variant="caption">
                                    {chartDataPoints && chartDataPoints.length <= 1 ? 'Need more data for chart' : 'No recent chart data'}
                                  </Typography>
                              </Stack>
                         )}
                      </Box>
                  )}
               </Box>
            </CardContent>
        </Card>
    );

    // Conditionally wrap the card content with a Tooltip for highlighting
    return shouldHighlightThisCard ? (
        <Tooltip title="This website had the most recent downtime incident" placement="top" arrow>
            {/* Tooltip requires a DOM element child */}
            {cardContent}
        </Tooltip>
    ) : (
        // Render card content directly if not highlighted
        cardContent
    );
  },
);
WebsiteCard.displayName = 'WebsiteCard';

export default WebsiteCard;