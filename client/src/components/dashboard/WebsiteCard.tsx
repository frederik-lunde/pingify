// src/components/dashboard/WebsiteCard.tsx
import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Card, CardContent, Typography, Box, Chip, IconButton,
  Tooltip, useTheme, CircularProgress
} from "@mui/material";
import {
  CheckCircleOutline as CheckIcon,
  ErrorOutline as ErrorIcon, // Can be used for pin error state too
  ShowChart as ChartIcon,
  CloudOff as CloudOffIcon,
  HourglassEmpty as PendingIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon
} from "@mui/icons-material";
import { Line } from "react-chartjs-2";
import { useCardChartData } from "../../hooks";
// Import the mutations hook
import { useWebsiteMutations } from "../../hooks/api/useWebsites"; // Adjust path

import {
  getStatusColor,
  getResponseTimeColor,
  formatResponseTime,
  formatUptime,
} from "../../utils/statusUtils";

import {
    MonitoringResult,
    WebsiteUser,
    ApiError // Import ApiError if not already imported indirectly
} from "../../types";


interface WebsiteCardProps {
  userWebsite: WebsiteUser;
  latestResult?: MonitoringResult | null;
  results: MonitoringResult[];
}

// Memoized chart component (remains the same)
const ResponseTimeChart = React.memo(
  ({ data, options }: { data: any; options: any }) => {
    if (!data?.datasets?.[0]?.data?.length) {
      return null;
    }
    return <Line data={data} options={options} />;
  },
);
ResponseTimeChart.displayName = 'ResponseTimeChart';

const WebsiteCard = React.memo(
  ({
    userWebsite,
    latestResult,
    results,
  }: WebsiteCardProps) => {
    const navigate = useNavigate();
    const theme = useTheme();
    // Get mutation functions and state from the hook
    const { setPinStatus, isSettingPin, errorSettingPin } = useWebsiteMutations();

    // Determine if there was an error during the last pin attempt
    const hasPinError = !!errorSettingPin;

    // --- Internal State Determination ---
    const hasMonitoringData = latestResult !== undefined && latestResult !== null;
    const hasRecentResults = results && results.length > 0;
    const isPinned = userWebsite.isPinned;

    // Derived status info
    const isOnline = latestResult?.isAvailable ?? null;
    const responseTime = latestResult?.responseTime ?? null;
    const statusCode = latestResult?.statusCode;

    // Calculate uptime
    const uptime = useMemo(() => {
      if (!hasRecentResults) return null;
      const total = results.length;
      const available = results.filter((r) => r.isAvailable).length;
      return total > 0 ? (available / total) * 100 : null;
    }, [results, hasRecentResults]);

    // Get chart data/options
    const cardResultsLimit = 20;
    const chartInputResults = useMemo(() => results.slice(0, cardResultsLimit), [results]);
    const { chartData, chartOptions } = useCardChartData(chartInputResults);

    // Determine if the chart should be shown
    const canShowChart = hasMonitoringData && isOnline === true && (chartData?.datasets?.[0]?.data?.length ?? 0) > 0;

    // Memoized handlers
    const handleClick = useCallback(() => {
      navigate(`/website/${userWebsite.websiteId}`);
    }, [navigate, userWebsite.websiteId]);

    // Handler for the pin/unpin action
    const handlePinClick = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
          // The hook's mutation automatically clears the error state on a new attempt
          await setPinStatus({
            websiteId: userWebsite.websiteId,
            isPinned: !isPinned,
          });
        } catch (err) {
           console.error("Failed to set pin status from card:", err);
        }
      },
      [setPinStatus, userWebsite.websiteId, isPinned],
    );

    // Derived display names
    const displayName = userWebsite.name || userWebsite.website?.url || 'Website';
    const displayUrl = userWebsite.website?.url;

    // Determine Tooltip text based on state
    const pinTooltipText = useMemo(() => {
        if (isSettingPin) return "Processing...";
        // If there was an error on the last attempt
        if (hasPinError) return `Error: ${errorSettingPin?.message || 'Pin action failed'}. Click to retry.`;
        // Normal operation tooltips
        return isPinned ? "Unpin Website" : "Pin Website";
    }, [isSettingPin, hasPinError, isPinned, errorSettingPin?.message]);

    // --- Render Logic ---
    return (
      <Card
        sx={{
          cursor: "pointer",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          transition: "transform 0.2s, box-shadow 0.2s",
          "&:hover": { transform: "translateY(-4px)", boxShadow: theme.shadows[6] },
          border: isPinned ? `2px solid ${theme.palette.primary.main}` : `1px solid ${theme.palette.divider}`,
          position: 'relative',
        }}
        onClick={handleClick}
        aria-label={`View details for ${displayName}${isPinned ? ', Pinned' : ''}`}
      >
        <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", p: 2, pb: 1 }}>
           <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
             <Tooltip title={displayName} placement="top-start">
                 <Typography variant="h6" component="div" noWrap sx={{ maxWidth: 'calc(100% - 40px)', mr: 1 }}>
                    {displayName}
                 </Typography>
             </Tooltip>
             {/* Pin/Unpin Button */}
             <Tooltip title={pinTooltipText} placement="top">
                {/* Wrap IconButton in span to allow tooltip when disabled */}
                <span>
                    <IconButton
                        size="small"
                        onClick={handlePinClick}
                        disabled={isSettingPin} // Disable only while processing
                        aria-label={isPinned ? `Unpin ${displayName}` : `Pin ${displayName}`}
                        sx={{
                            // Set color based on state: error, pinned, or default
                            color: hasPinError && !isSettingPin ? theme.palette.error.main : // Error color if failed and not loading
                                   isPinned ? theme.palette.primary.main :                  // Pinned color
                                   'inherit',                                              // Default color
                        }}
                    >
                        {/* Show loading spinner, or the appropriate pin icon */}
                        {isSettingPin ? (
                            <CircularProgress size={20} color="inherit" />
                        ) : isPinned ? (
                            // Use PinIcon if currently pinned (even if last action failed - reflects DB state)
                            <PinIcon fontSize="small" />
                        ) : (
                            // Use PinOutlinedIcon if currently unpinned
                            <PinOutlinedIcon fontSize="small" />
                        )}
                        {/* Optional: Could overlay a small error badge/icon when hasPinError is true */}
                    </IconButton>
                </span>
             </Tooltip>
           </Box>

          {/* URL */}
          {userWebsite.name && displayUrl && (
              <Tooltip title={displayUrl} placement="bottom-start">
                <Typography variant="body2" color="textSecondary" noWrap sx={{ mb: 1.5 }}>
                    {displayUrl}
                </Typography>
              </Tooltip>
          )}
           {(!userWebsite.name || !displayUrl) && <Box sx={{ mb: 1.5 }} />} {/* Placeholder */}

          {/* Status Chips */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mb: 1.5, minHeight: '24px' }}>
             {!hasMonitoringData ? (
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
                     {uptime !== null && (
                        <Tooltip title={`Uptime (${results.length} checks): ${formatUptime(uptime)}%`}>
                            <Chip size="small" icon={<ChartIcon fontSize="inherit" />} label={`${formatUptime(uptime)}%`} color={getStatusColor(uptime)} variant="outlined" />
                        </Tooltip>
                     )}
                 </>
             )}
          </Box>

          {/* Response time chart area or placeholder */}
          <Box sx={{ flexGrow: 1, minHeight: 60, maxHeight: 80, mt: "auto", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             {canShowChart ? (
                 <ResponseTimeChart data={chartData} options={chartOptions} key={`chart-${userWebsite.websiteId}`} />
             ) : (
                 <Box sx={{ color: 'text.secondary', textAlign: 'center', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {!hasMonitoringData ? (
                        <>
                            <PendingIcon fontSize="small" />
                            <Typography variant="caption">Awaiting first check...</Typography>
                        </>
                    ) : !isOnline ? (
                         <>
                            <CloudOffIcon fontSize="small" />
                            <Typography variant="caption">Currently Offline</Typography>
                         </>
                    ) : (
                         <Typography variant="caption">No recent chart data</Typography>
                    )}
                 </Box>
             )}
          </Box>
        </CardContent>
      </Card>
    );
  },
);
WebsiteCard.displayName = 'WebsiteCard';

export default WebsiteCard;