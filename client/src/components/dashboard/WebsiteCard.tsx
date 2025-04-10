// src/components/dashboard/WebsiteCard.tsx
import React, { useCallback, useMemo, Suspense } from "react";
import { useNavigate } from "react-router";
import {
  Card, CardContent, Typography, Box, Chip, IconButton,
  Tooltip,
  useTheme,
  CircularProgress,
  alpha,
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
  InfoOutlined as InfoIcon, // Re-add InfoIcon for placeholder
  // AccessTime as AccessTimeIcon, // No longer needed for placeholder
} from "@mui/icons-material";
// Use specific chart types for better type safety
import { Line } from 'react-chartjs-2';
// Keep type imports from chart.js
import { ChartOptions, TooltipItem } from 'chart.js';
import { format } from "date-fns"; // Import date-fns for formatting fallback label

import {
  getStatusColor,
  getResponseTimeColor,
  formatResponseTime,
  formatUptime,
  formatDowntimeDuration
} from "../../utils/statusUtils"; // Adjust path if needed

import { useWebsiteMutations } from "../../hooks"; // Adjust path if needed

import {
  MonitoringResult,
  WebsiteUser,
  TimeframeKey,
  ChartDataPoint
} from "../../types"; // Adjust path if needed

interface WebsiteCardProps {
  userWebsite: WebsiteUser; // This prop now contains all necessary data
  shouldHighlightThisCard?: boolean;
}

const CARD_TIMEFRAME: TimeframeKey = 'day'; // Used for Uptime tooltip text

// Memoized chart component
const ResponseTimeChart = React.memo(
  ({ data, options }: { data: any; options: ChartOptions<'line'> }) => {
    // Check if there's any valid, non-null, non-NaN data point
    const hasValidData = data?.datasets?.[0]?.data?.length > 0 &&
                         !data.datasets[0].data.every((d: number | null | undefined) => d === null || d === undefined || d === -1 || isNaN(d));

    if (!hasValidData) {
      return null; // Don't render the chart if no valid data
    }

    return (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Suspense for lazy loading Line component */}
            <Suspense fallback={<CircularProgress size={20} />}>
                 <Line data={data} options={options} />
            </Suspense>
        </Box>
    );
  },
);
ResponseTimeChart.displayName = 'ResponseTimeChart';

// Helper Function to generate Chart Data/Options for the standard aggregated Card Chart
const useCardChartConfig = (limitedChartDataPoints: ChartDataPoint[] | undefined): { chartData: any, chartOptions: ChartOptions<'line'> } => {
    const theme = useTheme();

    const chartData = useMemo(() => {
        if (!limitedChartDataPoints || limitedChartDataPoints.length === 0) {
            return { labels: [], datasets: [] };
        }
        const labels = limitedChartDataPoints.map(p => p.label);
        const data = limitedChartDataPoints.map(p => p.avgResponseTime ?? null);

        return {
            labels,
            datasets: [{
                label: 'Response Time', // Add a label for dataset
                data,
                borderColor: theme.palette.primary.main,
                borderWidth: 1.5,
                pointRadius: 0, // Hide points for sparkline effect
                pointHoverRadius: 0,
                tension: 0.2, // Slight curve
                fill: false,
                spanGaps: true, // Connect lines over null points
            }]
        };
    }, [limitedChartDataPoints, theme.palette.primary.main]);

    const chartOptions = useMemo((): ChartOptions<'line'> => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }, // No legend for sparkline
            tooltip: {
                enabled: true, // Enable tooltips on hover
                mode: 'index',
                intersect: false,
                displayColors: false, // Don't show color box in tooltip
                callbacks: {
                     // Customize tooltip title
                     title: (tooltipItems: TooltipItem<'line'>[]) => {
                        if (!tooltipItems.length || !limitedChartDataPoints) return '';
                        const index = tooltipItems[0].dataIndex;
                        if (index < 0 || index >= limitedChartDataPoints.length) return ''; // Bounds check
                        const point = limitedChartDataPoints[index];
                        const uptimePercentFormatted = (point && typeof point.uptimeRatio === 'number')
                            ? (point.uptimeRatio * 100).toFixed(1) + '%'
                            : 'N/A';
                        const statusText = (point && typeof point.uptimeRatio === 'number')
                            ? (point.uptimeRatio === 1.0 ? 'Up' : 'Down')
                            : 'Unknown';
                        return `${point?.label ?? ''} (${statusText} - ${uptimePercentFormatted})`;
                     },
                     // Customize tooltip label (body)
                     label: (tooltipItem: TooltipItem<'line'>) => {
                        const value = tooltipItem.parsed.y;
                        if (value === null || isNaN(value)) return 'No response data';
                        return `Avg Response: ${value.toFixed(0)} ms`;
                    },
                }
            }
        },
        scales: { // Hide axes for sparkline
            x: { display: false },
            y: { display: false, beginAtZero: true }
        },
        interaction: { // Optimize interaction for sparkline
            mode: 'index',
            axis: 'x',
            intersect: false
        },
        animation: { // Disable animation for performance/simplicity
             duration: 0
        },
    }), [limitedChartDataPoints]);

    return { chartData, chartOptions };
};

// --- Main Component ---
const WebsiteCard = React.memo(
  ({
    userWebsite,
    shouldHighlightThisCard = false,
  }: WebsiteCardProps) => {
    const navigate = useNavigate();
    const theme = useTheme();
    const { setPinStatus, isSettingPin, errorSettingPin } = useWebsiteMutations();

    // --- Derive Data Directly from userWebsite Prop ---
    const name = useMemo(() => userWebsite.name ?? userWebsite.website?.url ?? 'Website', [userWebsite.name, userWebsite.website?.url]);
    const url = useMemo(() => userWebsite.website?.url, [userWebsite.website?.url]);
    const latestResult = useMemo(() => userWebsite.latestResult, [userWebsite.latestResult]);
    const aggregatedChartDataProp = useMemo(() => userWebsite.chartData, [userWebsite.chartData]);
    const uptimePercent = useMemo(() => userWebsite.uptimePercent, [userWebsite.uptimePercent]);
    const isPinned = useMemo(() => userWebsite.isPinned, [userWebsite.isPinned]);
    const consecutiveFailures = useMemo(() => userWebsite.consecutiveFailures, [userWebsite.consecutiveFailures]);
    const downtimeStartedAt = useMemo(() => userWebsite.downtimeStartedAt, [userWebsite.downtimeStartedAt]);

    // Use aggregated data from prop (already limited by backend)
    const limitedChartDataPoints = useMemo(() => {
        return aggregatedChartDataProp?.length ? aggregatedChartDataProp : undefined;
    }, [aggregatedChartDataProp]);

    // --- Chart Logic ---
    // Count valid points in the aggregated data
    const validAggregatedPointsCount = useMemo(() => {
        return limitedChartDataPoints?.filter(p => p.avgResponseTime !== null && !isNaN(p.avgResponseTime)).length ?? 0;
    }, [limitedChartDataPoints]);

    // Determine if we can show the standard aggregated chart
    const canShowAggregatedChart = validAggregatedPointsCount >= 2;

    // Generate config for the aggregated chart (only generate if needed)
    const aggregatedChartConfig = useCardChartConfig(canShowAggregatedChart ? limitedChartDataPoints : undefined);

    // --- Other Derived Values ---
    const hasPinError = !!errorSettingPin;
    const isOnline = latestResult?.isAvailable ?? null;
    const responseTime = latestResult?.responseTime ?? null;
    const statusCode = latestResult?.statusCode;
    const downtimeDuration = formatDowntimeDuration(downtimeStartedAt);
    const formattedUptime = formatUptime(uptimePercent); // Use pre-calculated uptime

    // Ticks show only if AGGREGATED chart data is sufficient
    const canShowTicks = canShowAggregatedChart &&
                         limitedChartDataPoints && limitedChartDataPoints.length > 0 &&
                         limitedChartDataPoints.every(p => typeof p.uptimeRatio === 'number');

    // Show single tick if full ticks cannot be shown AND latestResult exists
    const canShowSingleTick = !canShowTicks && latestResult !== null && latestResult !== undefined;

    // --- Handlers ---
    const handleClick = useCallback(() => {
      navigate(`/website/${userWebsite.websiteId}`);
    }, [navigate, userWebsite.websiteId]);

    const handlePinClick = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click
        try {
          await setPinStatus({ websiteId: userWebsite.websiteId, isPinned: !isPinned });
        } catch (err) {
           console.error("Failed to set pin status from card:", err);
           // Optionally: show error notification to user
        }
      },
      [setPinStatus, userWebsite.websiteId, isPinned],
    );

    // --- Display Values ---
    const displayName = name || url || 'Website'; // Fallback display name
    const displayUrl = url; // URL to display (if name exists)

    // Pin button tooltip text
    const pinTooltipText = useMemo(() => {
        if (isSettingPin) return "Processing...";
        if (hasPinError) return `Error: ${errorSettingPin?.message || 'Pin action failed'}. Click to retry.`;
        return isPinned ? "Unpin Website" : "Pin Website";
    }, [isSettingPin, hasPinError, isPinned, errorSettingPin?.message]);

    // Card highlighting styles
    const cardHighlightStyles = useMemo(() => {
        const baseSx = {
            transition: theme.transitions.create(['transform', 'box-shadow', 'border-color'], {
                duration: theme.transitions.duration.short,
            }),
             "&:hover": { transform: "translateY(-4px)", boxShadow: theme.shadows[6] },
        };
        if (shouldHighlightThisCard) {
            return { // Highlighted style
                ...baseSx,
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: theme.palette.warning.main,
                boxShadow: `0 0 10px -1px ${alpha(theme.palette.warning.main, 0.6)}`,
            };
        } else { // Normal style (pinned or default)
            return {
                ...baseSx,
                borderWidth: isPinned ? '2px' : '1px',
                borderStyle: 'solid',
                borderColor: isPinned ? theme.palette.primary.main : theme.palette.divider,
            };
        }
    }, [shouldHighlightThisCard, isPinned, theme]);

    // --- Main Card Render ---
    const cardContent = (
        <Card
            sx={{
                cursor: "pointer",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                position: 'relative',
                pb: 1, // Padding bottom inside card
                ...cardHighlightStyles, // Apply dynamic border/shadow styles
                // Add opacity transition for potential parent loading state indication
                transition: theme.transitions.create(['opacity', 'transform', 'box-shadow', 'border-color'], {
                    duration: theme.transitions.duration.short,
                }),
            }}
            onClick={handleClick}
            aria-label={`View details for ${displayName}${isPinned ? ', Pinned' : ''}${isOnline === false ? ', Offline' : ''}${shouldHighlightThisCard ? ', Highlighted as Last Incident Source' : ''}`}
        >
            <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", p: 2, pb: 1 }}>
               {/* Header: Title and Pin Button */}
               <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                 <Tooltip title={displayName} placement="top-start">
                     <Typography variant="h6" component="div" noWrap sx={{ maxWidth: 'calc(100% - 40px)', mr: 1 }}>
                        {displayName}
                     </Typography>
                 </Tooltip>
                 <Tooltip title={pinTooltipText} placement="top">
                    <span> {/* Span needed for tooltip when button is disabled */}
                        <IconButton
                            size="small"
                            onClick={handlePinClick}
                            disabled={isSettingPin}
                            aria-label={isPinned ? `Unpin ${displayName}` : `Pin ${displayName}`}
                            sx={{
                                color: hasPinError && !isSettingPin ? theme.palette.error.main :
                                       isPinned ? theme.palette.primary.main :
                                       'inherit', // Default icon color
                            }}
                        >
                            {isSettingPin ? <CircularProgress size={20} color="inherit" /> : isPinned ? <PinIcon fontSize="small" /> : <PinOutlinedIcon fontSize="small" />}
                        </IconButton>
                    </span>
                 </Tooltip>
               </Box>

               {/* URL (if name exists) */}
               {name && displayUrl && (
                   <Tooltip title={displayUrl} placement="bottom-start">
                     <Typography variant="body2" color="textSecondary" noWrap sx={{ mb: 1.5, minHeight: '20px' }}>
                         {displayUrl}
                     </Typography>
                   </Tooltip>
               )}
               {/* Placeholder for spacing if no URL shown */}
               {(!name || !displayUrl) && <Box sx={{ mb: 1.5, minHeight: '20px' }} />}

               {/* Status Chips Row */}
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mb: 1.5, minHeight: '24px' }}>
                 {latestResult === undefined || latestResult === null ? (
                     <Chip size="small" icon={<PendingIcon fontSize="inherit"/>} label="Pending" variant="outlined" color="warning" sx={{ fontWeight: 500 }}/>
                 ) : (
                     <>
                         {/* Online/Offline Chip */}
                         <Tooltip title={isOnline ? "Website is online" : "Website is offline"}>
                             <Chip size="small" icon={isOnline ? <CheckIcon fontSize="inherit"/> : <ErrorIcon fontSize="inherit"/>} label={isOnline ? "Online" : "Offline"} color={isOnline ? "success" : "error"} sx={{ fontWeight: 500 }}/>
                         </Tooltip>
                         {/* Status Code Chip */}
                         {statusCode != null && (
                             <Tooltip title={`Last HTTP Status: ${statusCode}`}>
                                <Chip size="small" label={`${statusCode}`} variant="outlined" />
                             </Tooltip>
                         )}
                         {/* Response Time Chip */}
                         {isOnline && responseTime !== null && (
                             <Tooltip title={`Last Response Time: ${formatResponseTime(responseTime)}`}>
                                <Chip size="small" label={formatResponseTime(responseTime)} color={getResponseTimeColor(responseTime)} variant="outlined" />
                             </Tooltip>
                         )}
                         {/* Uptime Chip */}
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
              </Box>

               {/* Chart / Downtime / Ticks Area */}
               <Stack
                    sx={{
                        flexGrow: 1, // Takes remaining vertical space
                        minHeight: 60, // Ensure minimum height for chart/placeholder
                        maxHeight: 80, // Limit maximum height
                        mt: "auto", // Pushes to bottom if space allows
                        justifyContent: 'center', // Center content vertically within stack
                        alignItems: 'center', // Center content horizontally
                        width: '100%', // Take full width
                    }}
                    spacing={0.5} // Space between chart/placeholder and ticks row
               >
                    {/* Box for Chart or Placeholder Text */}
                    <Box sx={{ width: '100%', flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
                        {canShowAggregatedChart ? (
                            // Render the standard aggregated chart
                            <ResponseTimeChart data={aggregatedChartConfig.chartData} options={aggregatedChartConfig.chartOptions} key={`chart-${userWebsite.websiteId}-agg`} />
                        ) : (
                            // --- Placeholder Area Logic ---
                            <Box sx={{ color: 'text.secondary', textAlign: 'center', width: '100%', p: 1 }}>
                                {latestResult === undefined || latestResult === null ? (
                                    // State: Awaiting first check
                                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                                        <PendingIcon fontSize="small" />
                                        <Typography variant="caption">Awaiting check data...</Typography>
                                    </Stack>
                                ) : !isOnline ? (
                                    // State: Offline
                                    <Stack alignItems="center" spacing={0.3} color={theme.palette.warning.dark}>
                                        <TimerOffIcon sx={{ fontSize: '1.3rem' }} />
                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                            {downtimeDuration || 'Currently Offline'}
                                        </Typography>
                                        {/* Optional: Show detailed downtime info */}
                                        {(consecutiveFailures !== undefined || downtimeStartedAt) && (
                                            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                                                {consecutiveFailures !== undefined && `Failures: ${consecutiveFailures}`}
                                                {(consecutiveFailures !== undefined && downtimeStartedAt) && ' • '}
                                                {downtimeStartedAt && `Since: ${new Date(downtimeStartedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
                                            </Typography>
                                        )}
                                    </Stack>
                                ) : (
                                    // --- State: Online, but not enough AGGREGATED data ---
                                    // Display informative message instead of latest response time
                                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                                        <InfoIcon fontSize="small" />
                                        <Typography variant="caption">
                                            Gathering data for chart...
                                         </Typography>
                                    </Stack>
                                )}
                            </Box>
                            // --- End Placeholder Area ---
                        )}
                    </Box>

                    {/* --- Ticks Area --- */}
                    {/* Render full ticks row if possible */}
                    {canShowTicks && limitedChartDataPoints && (
                        <Stack
                            direction="row"
                            spacing={0.5} // Adjust spacing between ticks
                            justifyContent="center"
                            alignItems="center"
                            sx={{ width: '95%', height: '8px', mb: 0.5, key: `ticks-${userWebsite.websiteId}-agg` }}
                        >
                            {limitedChartDataPoints.map((point, index) => {
                                // Calculate color/tooltip based on point.uptimeRatio
                                const uptimeRatio = point.uptimeRatio;
                                let tickColor = theme.palette.grey[400]; // Default grey
                                let tooltipStatus = 'Unknown';
                                let uptimePercentFormatted = 'N/A';

                                if (typeof uptimeRatio === 'number' && !isNaN(uptimeRatio)) {
                                    if (uptimeRatio === 1.0) { // 100% uptime
                                        tickColor = theme.palette.success.light;
                                        tooltipStatus = 'Up';
                                    } else { // Less than 100% uptime
                                        tickColor = theme.palette.error.light; // Use RED for any downtime
                                        tooltipStatus = 'Down';
                                    }
                                    uptimePercentFormatted = (uptimeRatio * 100).toFixed(1);
                                } else { // Data missing for interval
                                    tickColor = theme.palette.grey[300];
                                    tooltipStatus = 'Data Missing';
                                }

                                const tooltipTitle = `${point.label ?? ('Interval ' + index)}: ${tooltipStatus}${uptimePercentFormatted !== 'N/A' ? ` (${uptimePercentFormatted}%)` : ''}`;
                                const numberOfTicks = limitedChartDataPoints.length;
                                // Calculate max width based on number of ticks to fit container, accounting for spacing
                                const tickMaxWidth = numberOfTicks > 0 ? `calc(${100 / numberOfTicks}% - ${theme.spacing(0.5)})` : '0%';

                                return (
                                    <Tooltip key={`${userWebsite.websiteId}-tick-${index}`} title={tooltipTitle} placement="top">
                                        <Box
                                            sx={{
                                                flexGrow: 1, // Allow ticks to grow
                                                maxWidth: tickMaxWidth, // Limit width
                                                height: '100%', // Full height of parent stack
                                                bgcolor: tickColor, // Dynamic background color
                                                borderRadius: '1px', // Slight rounding
                                            }}
                                        />
                                    </Tooltip>
                                );
                            })}
                        </Stack>
                    )}

                    {/* Render SINGLE tick if full ticks not possible but latestResult exists */}
                    {canShowSingleTick && latestResult && (
                        <Stack
                            direction="row"
                            justifyContent="center"
                            alignItems="center"
                            sx={{ width: '95%', height: '8px', mb: 0.5, key: `ticks-${userWebsite.websiteId}-single` }}
                        >
                            <Tooltip
                                title={`Latest Check (${format(new Date(latestResult.checkedAt), 'HH:mm')}): ${latestResult.isAvailable ? 'Up' : 'Down'}`}
                                placement="top"
                            >
                                <Box
                                    sx={{
                                        width: '100%', // Full width for single tick
                                        height: '100%',
                                        // Color based on latest status
                                        bgcolor: latestResult.isAvailable ? theme.palette.success.light : theme.palette.error.light,
                                        borderRadius: '1px',
                                    }}
                                />
                            </Tooltip>
                        </Stack>
                    )}
                    {/* --- End Ticks Area --- */}

               </Stack> {/* End of Chart/Ticks Stack */}

            </CardContent>
        </Card>
    );

    // Conditional Tooltip Wrapper for highlighting
    return shouldHighlightThisCard ? (
        <Tooltip title="This website had the most recent downtime incident" placement="top" arrow>
            {cardContent}
        </Tooltip>
    ) : (
        cardContent // Render card directly if not highlighted
    );
  },
);
WebsiteCard.displayName = 'WebsiteCard';

export default WebsiteCard;