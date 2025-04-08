/*
src/components/dashboard/WebsiteCard.tsx
*/
import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Card, CardContent, Typography, Box, Chip, IconButton,
  Tooltip, // Keep Tooltip import
  useTheme, // Keep useTheme import
  CircularProgress,
  alpha // Import alpha for transparency
} from "@mui/material";
import {
  CheckCircleOutline as CheckIcon,
  ErrorOutline as ErrorIcon,
  ShowChart as ChartIcon,
  HourglassEmpty as PendingIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  TimerOff as TimerOffIcon
} from "@mui/icons-material";
import { Line } from "react-chartjs-2";
// Ensure hooks/utils paths are correct for your project structure
import { useCardChartData } from "../../hooks"; // Example path adjustment
import { useWebsiteMutations } from "../../hooks/api/useWebsites"; // Example path adjustment

import {
  getStatusColor,
  getResponseTimeColor,
  formatResponseTime,
  formatUptime,
  formatDowntimeDuration
} from "../../utils/statusUtils"; // Example path adjustment

import {
    MonitoringResult,
    WebsiteUser,
} from "../../types"; // Example path adjustment


interface WebsiteCardProps {
  userWebsite: WebsiteUser; // Expecting full WebsiteUser object
  latestResult?: MonitoringResult | null;
  results: MonitoringResult[]; // Expecting recent results array
  // RENAMED PROP: Flag indicating if this specific card should be highlighted
  shouldHighlightThisCard?: boolean;
}

// Memoized chart component
const ResponseTimeChart = React.memo(
  ({ data, options }: { data: any; options: any }) => {
    // Added check for empty data array within the first dataset or only invalid points
    if (!data?.datasets?.[0]?.data?.length || data.datasets[0].data.every((d: number | null) => d === null || d === -1)) {
      return null; // Don't render chart if no valid data points
    }
    return <Line data={data} options={options} />;
  },
);
ResponseTimeChart.displayName = 'ResponseTimeChart';

const WebsiteCard = React.memo(
  ({
    userWebsite,
    latestResult,
    results, // This is the recentResults array passed from the grid
    // Use the new prop name, default to false
    shouldHighlightThisCard = false,
  }: WebsiteCardProps) => {
    const navigate = useNavigate();
    const theme = useTheme(); // Hook to access theme
    const { setPinStatus, isSettingPin, errorSettingPin } = useWebsiteMutations();

    // --- Internal State/Derived Values ---
    const hasPinError = !!errorSettingPin;
    const hasMonitoringData = latestResult !== undefined && latestResult !== null;
    const hasRecentResults = results && results.length > 0;
    const isPinned = userWebsite.isPinned;

    const isOnline = latestResult?.isAvailable ?? null;
    const responseTime = latestResult?.responseTime ?? null;
    const statusCode = latestResult?.statusCode;

    // Get downtime info directly from userWebsite prop
    const consecutiveFailures = isOnline === false ? userWebsite.consecutiveFailures : undefined;
    const downtimeStartedAt = isOnline === false ? userWebsite.downtimeStartedAt : null;
    const downtimeDuration = formatDowntimeDuration(downtimeStartedAt);

    // Calculate uptime based on the provided 'results' prop
    const uptimeValue = useMemo(() => {
      if (!hasRecentResults) return null;
      const total = results.length;
      const available = results.filter((r) => r.isAvailable).length;
      return total > 0 ? parseFloat(((available / total) * 100).toFixed(2)) : null;
    }, [results, hasRecentResults]);
    const formattedUptime = formatUptime(uptimeValue); // formatUptime handles null

    // Use the 'results' prop directly for the chart
    const { chartData, chartOptions } = useCardChartData(results);
    // Require > 1 point for a meaningful line chart
    const canShowChart = hasMonitoringData && isOnline === true && (chartData?.datasets?.[0]?.data?.length ?? 0) > 1;

    // Memoized handlers
    const handleClick = useCallback(() => {
      navigate(`/website/${userWebsite.websiteId}`);
    }, [navigate, userWebsite.websiteId]);

    const handlePinClick = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card navigation
        try {
          await setPinStatus({ websiteId: userWebsite.websiteId, isPinned: !isPinned });
        } catch (err) {
           console.error("Failed to set pin status from card:", err);
        }
      },
      [setPinStatus, userWebsite.websiteId, isPinned],
    );

    const displayName = userWebsite.name || userWebsite.website?.url || 'Website';
    const displayUrl = userWebsite.website?.url;

    // Tooltip text for Pin button
    const pinTooltipText = useMemo(() => {
        if (isSettingPin) return "Processing...";
        if (hasPinError) return `Error: ${errorSettingPin?.message || 'Pin action failed'}. Click to retry.`;
        return isPinned ? "Unpin Website" : "Pin Website";
    }, [isSettingPin, hasPinError, isPinned, errorSettingPin?.message]);

    // --- Highlighting Styles based on shouldHighlightThisCard ---
    const cardHighlightStyles = useMemo(() => {
        const baseSx = {
            transition: theme.transitions.create(['transform', 'box-shadow', 'border-color'], {
                duration: theme.transitions.duration.short,
            }),
             "&:hover": { transform: "translateY(-4px)", boxShadow: theme.shadows[6] },
        };

        // Apply highlight if the flag is true
        if (shouldHighlightThisCard) {
            return {
                ...baseSx,
                borderWidth: '2px', // Thicker border for highlight
                borderStyle: 'solid',
                borderColor: theme.palette.warning.main, // Highlight color
                // Subtle glow effect
                boxShadow: `0 0 10px -1px ${alpha(theme.palette.warning.main, 0.6)}`,
            };
        }
        // Default style (respecting pinned border) otherwise
        else {
            return {
                ...baseSx,
                borderWidth: isPinned ? '2px' : '1px', // Pinned or default width
                borderStyle: 'solid',
                borderColor: isPinned ? theme.palette.primary.main : theme.palette.divider, // Pinned or default color
            };
        }
    // Dependencies for recalculating styles
    }, [shouldHighlightThisCard, isPinned, theme]);

    // --- Render Logic ---

    // Store the main card rendering logic in a variable
    const cardContent = (
        <Card
            // Apply the calculated border/highlight styles
            sx={{
                cursor: "pointer",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                position: 'relative',
                pb: 1,
                // Apply calculated styles
                ...cardHighlightStyles,
            }}
            onClick={handleClick}
            // Add accessibility info about highlight status
            aria-label={`View details for ${displayName}${isPinned ? ', Pinned' : ''}${isOnline === false ? ', Offline' : ''}${shouldHighlightThisCard ? ', Highlighted as Last Incident Source' : ''}`}
        >
            <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", p: 2, pb: 1 }}>
               {/* Card Header Area: Title and Pin Button */}
               <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                 <Tooltip title={displayName} placement="top-start">
                     <Typography variant="h6" component="div" noWrap sx={{ maxWidth: 'calc(100% - 40px)', mr: 1 }}>
                        {displayName}
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
                            {/* Show spinner or appropriate pin icon */}
                            {isSettingPin ? <CircularProgress size={20} color="inherit" /> : isPinned ? <PinIcon fontSize="small" /> : <PinOutlinedIcon fontSize="small" />}
                        </IconButton>
                    </span>
                 </Tooltip>
               </Box>

               {/* URL (only if different from display name) */}
               {userWebsite.name && displayUrl && (
                   <Tooltip title={displayUrl} placement="bottom-start">
                     <Typography variant="body2" color="textSecondary" noWrap sx={{ mb: 1.5 }}>
                         {displayUrl}
                     </Typography>
                   </Tooltip>
               )}
               {/* Placeholder if URL is same as name or not shown, to maintain layout consistency */}
               {(!userWebsite.name || !displayUrl) && <Box sx={{ mb: 1.5 }} />}

               {/* Status Chips Area */}
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mb: 1.5, minHeight: '24px' }}>
                 {/* Show Pending Chip if no monitoring data yet */}
                 {!hasMonitoringData ? (
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
                         {isOnline && formattedUptime !== "N/A" && uptimeValue !== null && (
                            <Tooltip title={`Uptime (${results.length} checks): ${formattedUptime}%`}>
                                <Chip
                                    size="small"
                                    icon={<ChartIcon fontSize="inherit" />}
                                    label={`${formattedUptime}%`}
                                    color={getStatusColor(uptimeValue)} // getStatusColor should handle numbers
                                    variant="outlined"
                                />
                            </Tooltip>
                         )}
                     </>
                 )}
              </Box>

               {/* Chart or Downtime Info Area */}
               <Box sx={{ flexGrow: 1, minHeight: 60, maxHeight: 80, mt: "auto", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {/* Show chart if online and enough data exists */}
                  {canShowChart ? (
                      <ResponseTimeChart data={chartData} options={chartOptions} key={`chart-${userWebsite.websiteId}`} />
                  ) : (
                      // Show Placeholder/Downtime Info otherwise
                      <Box sx={{ color: 'text.secondary', textAlign: 'center', width: '100%' }}>
                         {!hasMonitoringData ? (
                             // Pending State Text
                             <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                 <PendingIcon fontSize="small" />
                                 <Typography variant="caption">Awaiting first check...</Typography>
                             </Box>
                         ) : !isOnline ? (
                            // Offline State - Display Detailed Downtime Info
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, color: theme.palette.warning.dark }}>
                                 <TimerOffIcon sx={{ fontSize: '1.3rem', mb: 0.2 }} />
                                 <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                     {/* Show formatted duration or fallback */}
                                     {downtimeDuration || 'Currently Offline'}
                                 </Typography>
                                 {/* Additional details: failures and start time */}
                                 <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                     {consecutiveFailures !== undefined && `Failures: ${consecutiveFailures}`}
                                     {/* Separator if both parts exist */}
                                     {consecutiveFailures !== undefined && downtimeStartedAt && ' • '}
                                     {/* Formatted start time */}
                                     {downtimeStartedAt && `Since: ${new Date(downtimeStartedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
                                 </Typography>
                            </Box>
                         ) : (
                              // Online but no chart data state
                              <Typography variant="caption">No recent chart data</Typography>
                         )}
                      </Box>
                  )}
               </Box>
            </CardContent>
        </Card>
    );

    // Conditionally wrap the card content with a Tooltip if it should be highlighted
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