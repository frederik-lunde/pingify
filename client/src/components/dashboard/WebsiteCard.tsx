import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Card, CardContent, Typography, Box, Chip, IconButton,
  Tooltip, useTheme
} from "@mui/material";
import {
  CheckCircleOutline as CheckIcon,
  ErrorOutline as ErrorIcon,
  Settings as SettingsIcon,
  ShowChart as ChartIcon,
  CloudOff as CloudOffIcon,
  HourglassEmpty as PendingIcon
} from "@mui/icons-material";
import { Line } from "react-chartjs-2";
import { useCardChartData } from "../../hooks";

import {
  getStatusColor,
  getResponseTimeColor,
  formatResponseTime,
  formatUptime,
} from "../../utils/statusUtils";

import {
    MonitoringResult,
    WebsiteUser
} from "../../types";


interface WebsiteCardProps {
  userWebsite: WebsiteUser; // This should always be present when card is rendered
  latestResult?: MonitoringResult | null; // This might be undefined/null initially
  results: MonitoringResult[]; // Array of recent results, might be empty initially
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

    // --- Internal State Determination ---
    // Check if we have *any* monitoring data yet for this specific card
    const hasMonitoringData = latestResult !== undefined && latestResult !== null;
    const hasRecentResults = results && results.length > 0;

    // Derived status info - provide defaults for pending state
    const isOnline = latestResult?.isAvailable ?? null; // Use null to differentiate from false (offline)
    const responseTime = latestResult?.responseTime ?? null;
    const statusCode = latestResult?.statusCode;

    // Calculate uptime based on the 'results' array
    const uptime = useMemo(() => {
      if (!hasRecentResults) return null;
      const total = results.length;
      const available = results.filter((r) => r.isAvailable).length;
      return total > 0 ? (available / total) * 100 : null; // Return null if no results
    }, [results, hasRecentResults]);

    // Get chart data/options using the hook based on 'results'
    const cardResultsLimit = 20;
    const chartInputResults = useMemo(() => results.slice(0, cardResultsLimit), [results]);
    const { chartData, chartOptions } = useCardChartData(chartInputResults); // Hook handles empty results

    // Determine if the chart should be shown
    const canShowChart = hasMonitoringData && isOnline === true && (chartData?.datasets?.[0]?.data?.length ?? 0) > 0;

    // Memoized handlers
    const handleClick = useCallback(() => {
      // Always allow navigation, even if pending
      navigate(`/website/${userWebsite.websiteId}`);
    }, [navigate, userWebsite.websiteId]);

    const handleSettingsClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click
        navigate(`/website/${userWebsite.websiteId}/settings`);
      },
      [navigate, userWebsite.websiteId],
    );

    // Derived display names
    const displayName = userWebsite.name || userWebsite.website?.url || 'Website';
    const displayUrl = userWebsite.website?.url;

    // --- Render Logic ---
    // No more skeleton logic here - parent grid handles initial load skeleton
    // This card renders immediately with available info (name/url) and placeholders for stats

    return (
      <Card
        sx={{
          cursor: "pointer",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          transition: "transform 0.2s, box-shadow 0.2s",
          "&:hover": { transform: "translateY(-4px)", boxShadow: theme.shadows[6] },
          // Optional: visual cue for pending state
          // border: !hasMonitoringData ? `1px dashed ${theme.palette.divider}` : 'none',
        }}
        onClick={handleClick}
        aria-label={`View details for ${displayName}`}
      >
        <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", p: 2 }}>
          {/* Header */}
           <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
             <Tooltip title={displayName} placement="top-start">
                 <Typography variant="h6" component="div" noWrap sx={{ maxWidth: 'calc(100% - 40px)' }}>
                    {displayName}
                 </Typography>
             </Tooltip>
             <Tooltip title="Website Settings">
               <IconButton size="small" onClick={handleSettingsClick} aria-label={`Settings for ${displayName}`}>
                 <SettingsIcon fontSize="small" />
               </IconButton>
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
           {(!userWebsite.name || !displayUrl) && <Box sx={{ mb: 1.5 }} />} {/* Placeholder if only URL is name */}

          {/* Status Chips - Render based on available data */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mb: 1.5, minHeight: '24px' }}>
             {!hasMonitoringData ? (
                 <Chip size="small" icon={<PendingIcon fontSize="inherit"/>} label="Pending" variant="outlined" color="warning" sx={{ fontWeight: 500 }}/>
             ) : (
                 <>
                     {/* Status Chip */}
                     <Tooltip title={isOnline ? "Website is online" : "Website is offline"}>
                         <Chip size="small" icon={isOnline ? <CheckIcon fontSize="inherit"/> : <ErrorIcon fontSize="inherit"/>} label={isOnline ? "Online" : "Offline"} color={isOnline ? "success" : "error"} sx={{ fontWeight: 500 }}/>
                     </Tooltip>
                     {/* Status Code Chip */}
                     {statusCode != null && (
                         <Tooltip title={`Last HTTP Status: ${statusCode}`}>
                            <Chip size="small" label={`${statusCode}`} variant="outlined" />
                         </Tooltip>
                     )}
                     {/* Response Time Chip: Show only if online and time exists */}
                     {isOnline && responseTime !== null && (
                         <Tooltip title={`Last Response Time: ${formatResponseTime(responseTime)}`}>
                            <Chip size="small" label={formatResponseTime(responseTime)} color={getResponseTimeColor(responseTime)} variant="outlined" />
                         </Tooltip>
                     )}
                     {/* Uptime Chip */}
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
                 // Render chart only if condition is met
                 <ResponseTimeChart data={chartData} options={chartOptions} key={`chart-${userWebsite.websiteId}`} />
             ) : (
                 // Placeholder text/icon when no chart should be shown
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
                         <Typography variant="caption">No recent chart data</Typography> // Online, but no chart points
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