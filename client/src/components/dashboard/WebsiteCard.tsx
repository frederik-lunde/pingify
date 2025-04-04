// client/src/components/dashboard/WebsiteCard.tsx
import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Card, CardContent, Typography, Box, Chip, IconButton,
  Tooltip, useTheme, Skeleton, // Keep Skeleton import
} from "@mui/material";
import {
  CheckCircleOutline as CheckIcon,
  ErrorOutline as ErrorIcon,
  Settings as SettingsIcon,
  ShowChart as ChartIcon,
} from "@mui/icons-material";
import { Line } from "react-chartjs-2"; // Keep chart component import
import { MonitoringResult, UserWebsite } from "../../types"; // Correct types
import {
  getStatusColor,
  getResponseTimeColor,
  formatResponseTime,
  formatUptime,
} from "../../utils/statusUtils"; // Correct path if needed
import { useCardChartData } from "../../hooks/"; // Corrected import path if needed

interface WebsiteCardProps {
  userWebsite: UserWebsite;
  latestResult?: MonitoringResult; // Received from useWebsiteData processing
  results: MonitoringResult[];     // Received from useWebsiteData (recentResults)
  // REMOVED loading prop: State derived internally from received data
}

// Memoized chart component (keep as is)
const ResponseTimeChart = React.memo(
  ({ data, options }: { data: any; options: any }) => {
    if (!data || !data.datasets || data.datasets.length === 0 || data.datasets[0].data.length === 0) {
      return (
           <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
               {/* Placeholder handled in parent */}
           </Box>
       );
    }
    return <Line data={data} options={options} />;
  },
);
ResponseTimeChart.displayName = 'ResponseTimeChart';

const WebsiteCard = React.memo(
  ({
    userWebsite,
    latestResult,
    results, // This is the recentResults array
  }: WebsiteCardProps) => {
    const navigate = useNavigate();
    const theme = useTheme();

    // --- Internal State Determination ---
    // Determine if the essential monitoring data for THIS card is truly missing.
    // This is the case if the parent hook processed this website
    // but found no corresponding results in the fetched batch.
    const isMonitoringDataMissing = !latestResult && (!results || results.length === 0);

    // Calculate uptime based on the 'results' array passed in
    const uptime = useMemo(() => {
      if (!results || results.length === 0) return null; // Return null if no data for calculation
      const total = results.length;
      const available = results.filter((r) => r.isAvailable).length;
      return total > 0 ? (available / total) * 100 : null; // Return null if total is somehow 0
    }, [results]);

    // Only calculate uptimeColor if uptime is not null
    const uptimeColor = uptime !== null ? getStatusColor(uptime) : "default";

    // Get chart data/options using the hook based on 'results'
    const { chartData, chartOptions } = useCardChartData(results, 10); // Pass the recent results

    // UI States
    // Show skeleton ONLY if the monitoring data is determined to be missing for this specific card.
    const showSkeleton = isMonitoringDataMissing;
    // Show chart only if not showing skeleton AND chart hook provided valid data
    const showChart = !showSkeleton && (chartData?.datasets?.[0]?.data?.length ?? 0) > 0;

    // Memoized handlers (keep as is)
    const handleClick = useCallback(() => {
      navigate(`/website/${userWebsite.websiteId}`);
    }, [navigate, userWebsite.websiteId]);

    const handleSettingsClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        navigate(`/website/${userWebsite.websiteId}/settings`);
      },
      [navigate, userWebsite.websiteId],
    );

    // Derived status info (use defaults/fallbacks if latestResult is missing)
    const isOnline = useMemo(() => latestResult?.isAvailable ?? false, [latestResult]); // Default to offline if no data
    const statusChipColor = isOnline ? "success" : "error";
    const responseTime = latestResult?.responseTime ?? null;
    const responseTimeColor = responseTime !== null ? getResponseTimeColor(responseTime) : "default";
    const statusCode = latestResult?.statusCode; // Will be undefined if latestResult is missing

    // --- Render Logic ---

    // 1. Render Skeleton if monitoring data is missing
    if (showSkeleton) {
        // Render skeleton, but include basic info available from userWebsite
        return (
            <Card sx={{ height: "100%" }}>
                <CardContent sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
                     {/* Header is always known */}
                     <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                         <Tooltip title={userWebsite.name || userWebsite.website.url} placement="top-start">
                             <Typography variant="h6" component="div" noWrap sx={{ maxWidth: 'calc(100% - 40px)' }}>
                                {userWebsite.name || userWebsite.website.url}
                             </Typography>
                         </Tooltip>
                         <Tooltip title="Website Settings">
                           <IconButton size="small" onClick={handleSettingsClick} aria-label={`Settings for ${userWebsite.name || userWebsite.website.url}`}>
                             <SettingsIcon fontSize="small" />
                           </IconButton>
                         </Tooltip>
                     </Box>
                    {/* URL (only if name exists) */}
                    {userWebsite.name && (
                         <Tooltip title={userWebsite.website.url} placement="bottom-start">
                             <Typography variant="body2" color="textSecondary" noWrap sx={{ mb: 1.5 }}>
                                {userWebsite.website.url}
                             </Typography>
                         </Tooltip>
                    )}
                    {!userWebsite.name && <Box sx={{ mb: 1.5 }} />}

                    {/* Skeletons for the parts that depend on monitoring results */}
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                        <Skeleton variant="rounded" width={70} height={24} />
                        <Skeleton variant="rounded" width={50} height={24} />
                        <Skeleton variant="rounded" width={60} height={24} />
                        <Skeleton variant="rounded" width={90} height={24} />
                    </Box>
                    {/* Skeleton for chart area */}
                    <Skeleton variant="rectangular" width="100%" sx={{ flexGrow: 1, minHeight: 60, mt: 'auto' }} />
                </CardContent>
            </Card>
        );
    }

    // 2. Render the card with available data
    return (
      <Card
        sx={{
          cursor: "pointer",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          transition: "transform 0.2s, box-shadow 0.2s",
          "&:hover": { transform: "translateY(-4px)", boxShadow: theme.shadows[6] },
        }}
        onClick={handleClick}
        aria-label={`View details for ${userWebsite.name || userWebsite.website.url}`}
      >
        <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", p: 2 }}>
          {/* Header (identical to skeleton) */}
           <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
             <Tooltip title={userWebsite.name || userWebsite.website.url} placement="top-start">
                 <Typography variant="h6" component="div" noWrap sx={{ maxWidth: 'calc(100% - 40px)' }}>
                    {userWebsite.name || userWebsite.website.url}
                 </Typography>
             </Tooltip>
             <Tooltip title="Website Settings">
               <IconButton size="small" onClick={handleSettingsClick} aria-label={`Settings for ${userWebsite.name || userWebsite.website.url}`}>
                 <SettingsIcon fontSize="small" />
               </IconButton>
             </Tooltip>
           </Box>

          {/* URL (identical to skeleton) */}
          {userWebsite.name && (
              <Tooltip title={userWebsite.website.url} placement="bottom-start">
                <Typography variant="body2" color="textSecondary" noWrap sx={{ mb: 1.5 }}>
                    {userWebsite.website.url}
                </Typography>
              </Tooltip>
          )}
          {!userWebsite.name && <Box sx={{ mb: 1.5 }} />}


          {/* Status Chips - Conditionally render based on available data */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mb: 1.5 }}>
             {/* Status Chip: Show based on latestResult presence */}
             {latestResult && (
                 <Tooltip title={isOnline ? "Website is online" : "Website is offline"}>
                     <Chip size="small" icon={isOnline ? <CheckIcon fontSize="inherit"/> : <ErrorIcon fontSize="inherit"/>} label={isOnline ? "Online" : "Offline"} color={statusChipColor} sx={{ fontWeight: 500 }}/>
                 </Tooltip>
             )}
             {/* Status Code Chip: Show if available */}
             {statusCode != null && ( // Check for null/undefined explicitly
                 <Tooltip title={`Last HTTP Status: ${statusCode}`}>
                    <Chip size="small" label={`${statusCode}`} variant="outlined" />
                 </Tooltip>
             )}
             {/* Response Time Chip: Show if available */}
             {responseTime !== null && (
                 <Tooltip title={`Last Response Time: ${formatResponseTime(responseTime)}`}>
                    <Chip size="small" label={formatResponseTime(responseTime)} color={responseTimeColor} variant="outlined" />
                 </Tooltip>
             )}
             {/* Uptime Chip: Show if uptime was calculated (results array wasn't empty) */}
             {uptime !== null && ( // Render only if uptime calculation was successful
                <Tooltip title={`Uptime (last ${results.length} checks): ${formatUptime(uptime)}`}>
                    <Chip size="small" icon={<ChartIcon fontSize="inherit" />} label={formatUptime(uptime)} color={uptimeColor} variant="outlined" />
                </Tooltip>
             )}
             {/* Fallback message if absolutely no monitoring data exists for card */}
             {isMonitoringDataMissing && ( // Should not render if skeleton is shown, but as safety
                 <Typography variant="caption" color="textSecondary">Awaiting check data...</Typography>
             )}
          </Box>

          {/* Response time chart area */}
          <Box sx={{ flexGrow: 1, minHeight: 60, maxHeight: 80, mt: "auto" }}>
             {showChart ? (
                 <ResponseTimeChart data={chartData} options={chartOptions} key={`chart-${userWebsite.websiteId}`} />
             ) : (
                 <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography variant="caption" color="textSecondary">
                       {/* Provide context: is data loading elsewhere, or just no data? */}
                       {results.length > 0 ? "No chart data" : "No recent results"}
                    </Typography>
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