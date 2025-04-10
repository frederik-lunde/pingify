// src/components/dashboard/WebsiteCard.tsx
import React, { useCallback, useMemo, Suspense } from "react";
import { useNavigate } from "react-router";
import {
  Card, CardContent, Typography, Box, Chip, IconButton,
  Tooltip,
  useTheme,
  CircularProgress,
  alpha,
  // Skeleton, // No longer needed here
  Stack
} from "@mui/material";
import {
  CheckCircleOutline as CheckIcon,
  ErrorOutline as ErrorIcon,
  ShowChart as ChartIcon,
  HourglassEmpty as PendingIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  TimerOff as TimerOffIcon,
  InfoOutlined as InfoIcon,
  // WarningAmber as WarningIcon // No longer needed here
} from "@mui/icons-material";
const Line = React.lazy(() => import('react-chartjs-2').then(module => ({ default: module.Line })));
import { ChartOptions, TooltipItem } from 'chart.js';

import {
  getStatusColor,
  getResponseTimeColor,
  formatResponseTime,
  formatUptime,
  formatDowntimeDuration
} from "../../utils/statusUtils";

// Remove useWebsiteDetailsQuery import
import {
    // useWebsiteDetailsQuery, // REMOVED
    useWebsiteMutations,
} from "../../hooks";

import {
  WebsiteUser,
  TimeframeKey,
  ChartDataPoint
} from "../../types";

interface WebsiteCardProps {
  userWebsite: WebsiteUser; // This prop now contains all necessary data
  shouldHighlightThisCard?: boolean;
}

// Constants remain the same
const CARD_TIMEFRAME: TimeframeKey = 'day'; // Used for Uptime tooltip text

// Memoized chart component (no changes)
const ResponseTimeChart = React.memo(
  ({ data, options }: { data: any; options: any }) => {
    const hasValidData = data?.datasets?.[0]?.data?.length > 0 &&
                         !data.datasets[0].data.every((d: number | null) => d === null || d === -1 || isNaN(d));

    if (!hasValidData) {
      return null;
    }

    return (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Suspense fallback={<CircularProgress size={20} />}>
                 <Line data={data} options={options} />
            </Suspense>
        </Box>
    );
  },
);
ResponseTimeChart.displayName = 'ResponseTimeChart';

// Helper Function to generate Chart Data/Options for the Card (no changes needed structurally)
// It now receives ChartDataPoint[] directly
const useCardChartConfig = (limitedChartDataPoints: ChartDataPoint[] | undefined): { chartData: any, chartOptions: ChartOptions<'line'> } => {
    const theme = useTheme();

    const chartData = useMemo(() => {
        if (!limitedChartDataPoints || limitedChartDataPoints.length === 0) {
            return { labels: [], datasets: [] };
        }
        // Assuming limitedChartDataPoints is already the correct ChartDataPoint[] structure
        const labels = limitedChartDataPoints.map(p => p.label);
        // Use avgResponseTime directly from ChartDataPoint
        const data = limitedChartDataPoints.map(p => p.avgResponseTime ?? null);

        return {
            labels,
            datasets: [{
                data,
                borderColor: theme.palette.primary.main,
                borderWidth: 1.5,
                pointRadius: 0,
                pointHoverRadius: 0,
                tension: 0.2,
                fill: false,
                spanGaps: true,
            }]
        };
    }, [limitedChartDataPoints, theme.palette.primary.main]);

    const chartOptions = useMemo((): ChartOptions<'line'> => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                enabled: true,
                mode: 'index',
                intersect: false,
                displayColors: false,
                callbacks: {
                     title: (tooltipItems: TooltipItem<'line'>[]) => {
                        if (!tooltipItems.length || !limitedChartDataPoints) return '';
                        const index = tooltipItems[0].dataIndex;
                        if (index >= limitedChartDataPoints.length) return '';
                        const point = limitedChartDataPoints[index];
                        const uptimePercentFormatted = (point && typeof point.uptimeRatio === 'number')
                            ? (point.uptimeRatio * 100).toFixed(1) + '%'
                            : 'N/A';
                        // Determine status text based on uptime ratio (100% = Up, <100% = Down)
                        const statusText = (point && typeof point.uptimeRatio === 'number')
                            ? (point.uptimeRatio === 1.0 ? 'Up' : 'Down')
                            : 'Unknown';
                        // Display label (e.g., 'HH:mm'), status, and uptime percentage
                        return `${point?.label ?? ''} (${statusText} - ${uptimePercentFormatted})`;
                     },
                     label: (tooltipItem: TooltipItem<'line'>) => {
                        const value = tooltipItem.parsed.y;
                        if (value === null || isNaN(value)) return 'No response data';
                        // Display average response time for the interval
                        return `Avg Response: ${value.toFixed(0)} ms`;
                    },
                }
            }
        },
        scales: {
            x: { display: false },
            y: { display: false, beginAtZero: true }
        },
        interaction: {
            mode: 'index',
            axis: 'x',
            intersect: false
        },
        animation: {
             duration: 0
        },
    }), [limitedChartDataPoints]);

    return { chartData, chartOptions };
};

const WebsiteCard = React.memo(
  ({
    userWebsite, // Main prop containing all data
    shouldHighlightThisCard = false,
  }: WebsiteCardProps) => {
    const navigate = useNavigate();
    const theme = useTheme();
    const { setPinStatus, isSettingPin, errorSettingPin } = useWebsiteMutations();

    // --- Data Fetching REMOVED ---
    // const { data: websiteDetails, ... } = useWebsiteDetailsQuery(...) // REMOVED

    // --- Derive Data Directly from userWebsite Prop ---
    const name = useMemo(() => userWebsite.name ?? userWebsite.website?.url ?? 'Website', [userWebsite.name, userWebsite.website?.url]);
    const url = useMemo(() => userWebsite.website?.url, [userWebsite.website?.url]);
    const latestResult = useMemo(() => userWebsite.latestResult, [userWebsite.latestResult]);
    // Use pre-calculated chart data from the prop
    const chartDataProp = useMemo(() => userWebsite.chartData, [userWebsite.chartData]);
    // Use pre-calculated uptime percent from the prop
    const uptimePercent = useMemo(() => userWebsite.uptimePercent, [userWebsite.uptimePercent]);
    const isPinned = useMemo(() => userWebsite.isPinned, [userWebsite.isPinned]);
    // Use downtime info directly from the prop
    const consecutiveFailures = useMemo(() => userWebsite.consecutiveFailures, [userWebsite.consecutiveFailures]);
    const downtimeStartedAt = useMemo(() => userWebsite.downtimeStartedAt, [userWebsite.downtimeStartedAt]);

    // Processed Data Points for Chart Config (using data from prop)
    // Ensure it's memoized based on the prop data
    const limitedChartDataPoints = useMemo(() => {
        // The data should already be limited by the backend
        return chartDataProp?.length ? chartDataProp : undefined;
    }, [chartDataProp]);

    // --- Derived Values (using data from prop) ---
    const hasPinError = !!errorSettingPin;

    const isOnline = latestResult?.isAvailable ?? null;
    const responseTime = latestResult?.responseTime ?? null;
    const statusCode = latestResult?.statusCode;

    const downtimeDuration = formatDowntimeDuration(downtimeStartedAt);
    const formattedUptime = formatUptime(uptimePercent); // Use uptimePercent from prop

    // Use the limited points for chart config
    const { chartData, chartOptions } = useCardChartConfig(limitedChartDataPoints);

    // --- Conditions for showing chart/ticks ---
    // Check if latestResult exists and indicates online status
    const isLatestResultAvailable = latestResult !== undefined && latestResult !== null;
    // Chart can show if latest result is available, indicates 'online', and chart data exists with more than one valid point
    const canShowChart = isLatestResultAvailable && isOnline === true &&
                         (chartData?.datasets?.[0]?.data?.filter((d: number | null) => d !== null && !isNaN(d)).length ?? 0) > 1;
    // Ticks can show if chart can show and points exist with uptimeRatio
    const canShowTicks = canShowChart &&
                         limitedChartDataPoints && limitedChartDataPoints.length > 0 &&
                         limitedChartDataPoints.every(p => typeof p.uptimeRatio === 'number');


    // --- Handlers (no changes) ---
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
        }
      },
      [setPinStatus, userWebsite.websiteId, isPinned],
    );

    const displayName = name || url || 'Website';
    const displayUrl = url;

    const pinTooltipText = useMemo(() => {
        if (isSettingPin) return "Processing...";
        if (hasPinError) return `Error: ${errorSettingPin?.message || 'Pin action failed'}. Click to retry.`;
        return isPinned ? "Unpin Website" : "Pin Website";
    }, [isSettingPin, hasPinError, isPinned, errorSettingPin?.message]);

    // --- Highlighting Styles (no changes) ---
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

    // --- Loading/Error States REMOVED ---
    // The parent grid/dashboard handles overall loading state.
    // Skeletons are rendered by the grid.
    // Card assumes `userWebsite` prop is always provided (even if with default/loading values initially).

    // Main Card Render
    const cardContent = (
        <Card
            sx={{
                cursor: "pointer",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                position: 'relative',
                pb: 1,
                ...cardHighlightStyles,
                // Opacity can still indicate parent-level fetching if desired,
                // but remove local isFetching check
                // opacity: isFetching && !isLoading ? 0.85 : 1, // REMOVED local check
                transition: theme.transitions.create(['opacity', 'transform', 'box-shadow', 'border-color'], {
                    duration: theme.transitions.duration.short,
                }),
            }}
            onClick={handleClick}
            aria-label={`View details for ${displayName}${isPinned ? ', Pinned' : ''}${isOnline === false ? ', Offline' : ''}${shouldHighlightThisCard ? ', Highlighted as Last Incident Source' : ''}`}
        >
            <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", p: 2, pb: 1 }}>
               {/* Header (no changes) */}
               <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                 <Tooltip title={displayName} placement="top-start">
                     <Typography variant="h6" component="div" noWrap sx={{ maxWidth: 'calc(100% - 40px)', mr: 1 }}>
                        {displayName}
                        {/* Remove local isFetching check */}
                        {/* {isFetching && !isLoading && <CircularProgress size={12} sx={{ ml: 0.5, verticalAlign: 'middle', opacity: 0.7 }} color="inherit" />} */}
                     </Typography>
                 </Tooltip>
                 <Tooltip title={pinTooltipText} placement="top">
                    <span>
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

               {/* URL (no changes) */}
               {name && displayUrl && (
                   <Tooltip title={displayUrl} placement="bottom-start">
                     <Typography variant="body2" color="textSecondary" noWrap sx={{ mb: 1.5, minHeight: '20px' }}>
                         {displayUrl}
                     </Typography>
                   </Tooltip>
               )}
               {(!name || !displayUrl) && <Box sx={{ mb: 1.5, minHeight: '20px' }} />}

               {/* Status Chips (uses data from prop) */}
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mb: 1.5, minHeight: '24px' }}>
                 {/* Use isLatestResultAvailable check */}
                 {!isLatestResultAvailable ? (
                     <Chip size="small" icon={<PendingIcon fontSize="inherit"/>} label="Pending" variant="outlined" color="warning" sx={{ fontWeight: 500 }}/>
                 ) : (
                     <>
                         <Tooltip title={isOnline ? "Website is online" : "Website is offline"}>
                             <Chip size="small" icon={isOnline ? <CheckIcon fontSize="inherit"/> : <ErrorIcon fontSize="inherit"/>} label={isOnline ? "Online" : "Offline"} color={isOnline ? "success" : "error"} sx={{ fontWeight: 500 }}/>
                         </Tooltip>
                         {statusCode != null && (
                             <Tooltip title={`Last HTTP Status: ${statusCode}`}>
                                <Chip size="small" label={`${statusCode}`} variant="outlined" />
                             </Tooltip>
                         )}
                         {isOnline && responseTime !== null && (
                             <Tooltip title={`Last Response Time: ${formatResponseTime(responseTime)}`}>
                                <Chip size="small" label={formatResponseTime(responseTime)} color={getResponseTimeColor(responseTime)} variant="outlined" />
                             </Tooltip>
                         )}
                         {/* Use uptimePercent from prop */}
                         {isOnline && formattedUptime !== "N/A" && typeof uptimePercent === 'number' && (
                            <Tooltip title={`Uptime (${CARD_TIMEFRAME}): ${formattedUptime}%`}>
                                <Chip
                                    size="small"
                                    icon={<ChartIcon fontSize="inherit" />}
                                    label={`${formattedUptime}%`}
                                    color={getStatusColor(uptimePercent)}
                                    variant="outlined"
                                />
                            </Tooltip>
                         )}
                     </>
                 )}
                 {/* Remove queryError check */}
                 {/* {queryError && websiteDetails && (...)} // REMOVED */}
              </Box>

               {/* --- Chart / Downtime / Ticks Area --- */}
               <Stack
                    sx={{
                        flexGrow: 1,
                        minHeight: 60,
                        maxHeight: 80,
                        mt: "auto",
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: '100%',
                    }}
                    spacing={0.5}
               >
                    {/* Box for Chart or Placeholder Text (uses data from prop) */}
                    <Box sx={{ width: '100%', flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
                        {canShowChart ? (
                            // Pass chartData/Options derived from limitedChartDataPoints (which comes from prop)
                            <ResponseTimeChart data={chartData} options={chartOptions} key={`chart-${userWebsite.websiteId}`} />
                        ) : (
                            // Display placeholder based on data from prop
                            <Box sx={{ color: 'text.secondary', textAlign: 'center', width: '100%', p: 1 }}>
                                {/* Check if latest result is available */}
                                {!isLatestResultAvailable ? (
                                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                                        <PendingIcon fontSize="small" />
                                        <Typography variant="caption">Awaiting check data...</Typography>
                                    </Stack>
                                // Check if offline
                                ) : !isOnline ? (
                                    <Stack alignItems="center" spacing={0.3} color={theme.palette.warning.dark}>
                                        <TimerOffIcon sx={{ fontSize: '1.3rem' }} />
                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                            {/* Use downtimeDuration derived from prop */}
                                            {downtimeDuration || 'Currently Offline'}
                                        </Typography>
                                        {/* Use consecutiveFailures/downtimeStartedAt from prop */}
                                        {(consecutiveFailures !== undefined || downtimeStartedAt) && (
                                            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                                                {consecutiveFailures !== undefined && `Failures: ${consecutiveFailures}`}
                                                {(consecutiveFailures !== undefined && downtimeStartedAt) && ' • '}
                                                {downtimeStartedAt && `Since: ${new Date(downtimeStartedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
                                            </Typography>
                                        )}
                                    </Stack>
                                // Else: Online but not enough data for chart
                                ) : (
                                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                                        <InfoIcon fontSize="small" />
                                        <Typography variant="caption">
                                            {/* Use limitedChartDataPoints derived from prop */}
                                            {!limitedChartDataPoints || limitedChartDataPoints.length <= 1 ? 'Need more data for chart' : 'No recent chart data'}
                                         </Typography>
                                    </Stack>
                                )}
                            </Box>
                        )}
                    </Box>

                    {/* Uptime Ticks Row (uses limitedChartDataPoints derived from prop) */}
                    {canShowTicks && limitedChartDataPoints && (
                        <Stack
                            direction="row"
                            spacing={0.5}
                            justifyContent="center"
                            alignItems="center"
                            sx={{
                                width: '95%',
                                height: '8px',
                                mb: 0.5,
                                // Ensure key updates if points change significantly
                                key: `ticks-${userWebsite.websiteId}-${limitedChartDataPoints.length}`
                            }}
                        >
                            {limitedChartDataPoints.map((point, index) => {
                                const uptimeRatio = point.uptimeRatio;
                                let tickColor = theme.palette.grey[400];
                                let tooltipStatus = 'Unknown'; // Default status text
                                let uptimePercentFormatted = 'N/A';

                                if (typeof uptimeRatio === 'number' && !isNaN(uptimeRatio)) {
                                    if (uptimeRatio === 1.0) { // Exactly 100% uptime
                                        tickColor = theme.palette.success.light;
                                        tooltipStatus = 'Up';
                                    } else { // Anything less than 100% (including 0%)
                                        tickColor = theme.palette.error.light; // Use RED
                                        tooltipStatus = 'Down'; // Treat as Down
                                    }
                                    uptimePercentFormatted = (uptimeRatio * 100).toFixed(1);
                                } else {
                                    tickColor = theme.palette.grey[300];
                                    tooltipStatus = 'Data Missing';
                                }

                                const tooltipTitle = `${point.label ?? ('Interval ' + index)}: ${tooltipStatus}${uptimePercentFormatted !== 'N/A' ? ` (${uptimePercentFormatted}%)` : ''}`;

                                const numberOfTicks = limitedChartDataPoints.length;
                                const tickMaxWidth = numberOfTicks > 0
                                    ? `calc(${100 / numberOfTicks}% - 2px)`
                                    : '0%';

                                return (
                                    <Tooltip key={`${userWebsite.websiteId}-tick-${index}`} title={tooltipTitle} placement="top">
                                        <Box
                                            sx={{
                                                flexGrow: 1,
                                                maxWidth: tickMaxWidth,
                                                height: '100%',
                                                bgcolor: tickColor, // Use updated color
                                                borderRadius: '1px',
                                            }}
                                        />
                                    </Tooltip>
                                );
                            })}
                        </Stack>
                    )}
               </Stack> {/* End of Chart/Ticks Stack */}

            </CardContent>
        </Card>
    );

    // Conditional Tooltip Wrapper (no changes)
    return shouldHighlightThisCard ? (
        <Tooltip title="This website had the most recent downtime incident" placement="top" arrow>
            {cardContent}
        </Tooltip>
    ) : (
        cardContent
    );
  },
);
WebsiteCard.displayName = 'WebsiteCard';

export default WebsiteCard;