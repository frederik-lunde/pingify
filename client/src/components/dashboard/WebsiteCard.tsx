// src/components/dashboard/WebsiteCard.tsx
import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Card, CardContent, Typography, Box, Chip, IconButton,
  Tooltip, useTheme, CircularProgress
} from "@mui/material";
import {
  CheckCircleOutline as CheckIcon,
  ErrorOutline as ErrorIcon, // Keep for general offline status icon
  ShowChart as ChartIcon,
  // CloudOff as CloudOffIcon, // No longer needed here
  HourglassEmpty as PendingIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  TimerOff as TimerOffIcon // Good icon for the detailed downtime info
} from "@mui/icons-material";
import { Line } from "react-chartjs-2";
import { useCardChartData } from "../../hooks";
import { useWebsiteMutations } from "../../hooks"; // Adjust path

import {
  getStatusColor,
  getResponseTimeColor,
  formatResponseTime,
  formatUptime, // Returns number string now
  formatDowntimeDuration
} from "../../utils/statusUtils"; // Adjust path

import {
    MonitoringResult,
    WebsiteUser,
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
    const { setPinStatus, isSettingPin, errorSettingPin } = useWebsiteMutations();

    const hasPinError = !!errorSettingPin;

    // --- Internal State Determination ---
    const hasMonitoringData = latestResult !== undefined && latestResult !== null;
    const hasRecentResults = results && results.length > 0;
    const isPinned = userWebsite.isPinned;

    // Derived status info
    const isOnline = latestResult?.isAvailable ?? null;
    const responseTime = latestResult?.responseTime ?? null;
    const statusCode = latestResult?.statusCode;

    // Downtime Information
    const consecutiveFailures = isOnline === false ? userWebsite.consecutiveFailures : undefined;
    const downtimeStartedAt = isOnline === false ? userWebsite.downtimeStartedAt : null;
    const downtimeDuration = formatDowntimeDuration(downtimeStartedAt);

    // Calculate uptime (number)
    const uptimeValue = useMemo(() => {
      if (!hasRecentResults) return null;
      const total = results.length;
      const available = results.filter((r) => r.isAvailable).length;
      return total > 0 ? (available / total) * 100 : null;
    }, [results, hasRecentResults]);

    // Format uptime (string) using the updated utility
    const formattedUptime = formatUptime(uptimeValue); // Gets "99.95" or "100" or "N/A"

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

    const handlePinClick = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
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
        if (hasPinError) return `Error: ${errorSettingPin?.message || 'Pin action failed'}. Click to retry.`;
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
          // Add slight padding bottom to ensure content doesn't touch edge
          pb: 1,
        }}
        onClick={handleClick}
        aria-label={`View details for ${displayName}${isPinned ? ', Pinned' : ''}${isOnline === false ? ', Offline' : ''}`}
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
                        {isSettingPin ? (
                            <CircularProgress size={20} color="inherit" />
                        ) : isPinned ? (
                            <PinIcon fontSize="small" />
                        ) : (
                            <PinOutlinedIcon fontSize="small" />
                        )}
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
                     {/* Show Response Time only if Online */}
                     {isOnline && responseTime !== null && (
                         <Tooltip title={`Last Response Time: ${formatResponseTime(responseTime)}`}>
                            <Chip size="small" label={formatResponseTime(responseTime)} color={getResponseTimeColor(responseTime)} variant="outlined" />
                         </Tooltip>
                     )}
                     {/* Show Uptime only if Online */}
                     {isOnline && formattedUptime !== "N/A" && uptimeValue !== null && (
                        <Tooltip title={`Uptime (${results.length} checks): ${formattedUptime}%`}>
                            <Chip
                                size="small"
                                icon={<ChartIcon fontSize="inherit" />}
                                label={`${formattedUptime}%`}
                                color={getStatusColor(uptimeValue)}
                                variant="outlined"
                            />
                        </Tooltip>
                     )}
                     {/* --- REMOVED DOWNTIME CHIP --- */}
                 </>
             )}
          </Box>

          {/* Chart or Downtime Info Area */}
          <Box sx={{ flexGrow: 1, minHeight: 60, maxHeight: 80, mt: "auto", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             {/* Show chart if online and data available */}
             {canShowChart ? (
                 <ResponseTimeChart data={chartData} options={chartOptions} key={`chart-${userWebsite.websiteId}`} />
             ) : (
                 // Show Placeholder/Downtime Info
                 <Box sx={{ color: 'text.secondary', textAlign: 'center', width: '100%' }}>
                    {!hasMonitoringData ? (
                        // Pending State
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                            <PendingIcon fontSize="small" />
                            <Typography variant="caption">Awaiting first check...</Typography>
                        </Box>
                    ) : !isOnline ? (
                        // --- NEW: Offline State - Display Detailed Downtime Info ---
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, color: theme.palette.warning.dark }}>
                             <TimerOffIcon sx={{ fontSize: '1.3rem', mb: 0.2 }} />
                             {/* Display duration prominently */}
                             <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                 {downtimeDuration || 'Currently Offline'} {/* Fallback text */}
                             </Typography>
                             {/* Display failures and start time */}
                             <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                 {consecutiveFailures !== undefined && `Failures: ${consecutiveFailures}`}
                                 {consecutiveFailures !== undefined && downtimeStartedAt && ' • '} {/* Separator */}
                                 {downtimeStartedAt && `Started: ${new Date(downtimeStartedAt).toLocaleString()}`}
                             </Typography>
                        </Box>
                        // --- END NEW ---
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
  },
);
WebsiteCard.displayName = 'WebsiteCard';

export default WebsiteCard;