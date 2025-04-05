// client/src/components/dashboard/WebsiteCard.tsx
import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Card, CardContent, Typography, Box, Chip, IconButton,
  Tooltip, useTheme, Skeleton
} from "@mui/material";
import {
  CheckCircleOutline as CheckIcon,
  ErrorOutline as ErrorIcon,
  Settings as SettingsIcon,
  ShowChart as ChartIcon,
  CloudOff as CloudOffIcon // Optional: Icon for offline state placeholder
} from "@mui/icons-material";
import { Line } from "react-chartjs-2";
// --- Import Hook (Adjust path as needed) ---
import { useCardChartData } from "../../hooks"; // Example path

// --- Import Utilities (Adjust path as needed) ---
import {
  getStatusColor,
  getResponseTimeColor,
  formatResponseTime,
  formatUptime,
} from "../../utils/statusUtils"; // Example path

// --- Import SHARED Types (Adjust path as needed) ---
import {
    MonitoringResult,
    WebsiteUser // <--- Use the merged WebsiteUser type here
} from "../../types"; // Adjust path to your shared types file


interface WebsiteCardProps {
  userWebsite: WebsiteUser; // Use the imported WebsiteUser type
  latestResult?: MonitoringResult | null; // Allow null from backend
  results: MonitoringResult[]; // Array of recent results
}

// Memoized chart component (remains the same)
const ResponseTimeChart = React.memo(
  ({ data, options }: { data: any; options: any }) => {
    // Ensure data is valid before rendering
    if (!data?.datasets?.[0]?.data?.length) {
      return null; // Render nothing if chart data is invalid/empty, placeholder handled by parent
    }
    return <Line data={data} options={options} />;
  },
);
ResponseTimeChart.displayName = 'ResponseTimeChart';

const WebsiteCard = React.memo(
  ({
    userWebsite, // Now typed as WebsiteUser
    latestResult,
    results,
  }: WebsiteCardProps) => {
    const navigate = useNavigate();
    const theme = useTheme();

    // --- Internal State Determination ---
    const isMonitoringDataMissing = !results || results.length === 0;

    // Derived status info from latestResult
    const isOnline = useMemo(() => latestResult?.isAvailable ?? false, [latestResult]);
    const responseTime = latestResult?.responseTime ?? null;
    const statusCode = latestResult?.statusCode;
    const statusChipColor = isOnline ? "success" : "error";
    const responseTimeColor = responseTime !== null ? getResponseTimeColor(responseTime) : "default";

    // Calculate uptime based on the 'results' array
    const uptime = useMemo(() => {
      if (isMonitoringDataMissing) return null;
      const total = results.length;
      const available = results.filter((r) => r.isAvailable).length;
      return total > 0 ? (available / total) * 100 : null;
    }, [results, isMonitoringDataMissing]);

    const uptimeColor = uptime !== null ? getStatusColor(uptime) : "default";

    // Get chart data/options using the hook based on 'results'
    const cardResultsLimit = 20;
    const chartInputResults = useMemo(() => results.slice(0, cardResultsLimit), [results]);
    const { chartData, chartOptions } = useCardChartData(chartInputResults);

    // UI States
    const showSkeleton = isMonitoringDataMissing;

    // *** MODIFIED: Show chart only if currently online AND chart data exists ***
    const showChart = !showSkeleton && isOnline && (chartData?.datasets?.[0]?.data?.length ?? 0) > 0;

    // Memoized handlers (remain the same)
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

    // Derived display names (remain the same)
    const displayName = userWebsite.name || userWebsite.website?.url || 'Website';
    const displayUrl = userWebsite.website?.url;

    // --- Render Logic ---

    // 1. Render Skeleton (remains the same)
    if (showSkeleton) {
        return (
            <Card sx={{ height: "100%" }}>
                <CardContent sx={{ display: "flex", flexDirection: "column", height: "100%", p: 2 }}>
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
                    {(!userWebsite.name || !displayUrl) && <Box sx={{ mb: 1.5 }} />}
                    {/* Skeletons for chips */}
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
          // Optional: Slightly dim the card if offline for stronger visual cue
          // opacity: isOnline ? 1 : 0.85,
        }}
        onClick={handleClick}
        aria-label={`View details for ${displayName}`}
      >
        <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", p: 2 }}>
          {/* Header (remains the same) */}
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

          {/* URL (remains the same) */}
          {userWebsite.name && displayUrl && (
              <Tooltip title={displayUrl} placement="bottom-start">
                <Typography variant="body2" color="textSecondary" noWrap sx={{ mb: 1.5 }}>
                    {displayUrl}
                </Typography>
              </Tooltip>
          )}
           {(!userWebsite.name || !displayUrl) && <Box sx={{ mb: 1.5 }} />}

          {/* Status Chips (remain the same - already reflect latestResult) */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mb: 1.5 }}>
             {/* Status Chip */}
             <Tooltip title={isOnline ? "Website is online" : "Website is offline"}>
                 <Chip size="small" icon={isOnline ? <CheckIcon fontSize="inherit"/> : <ErrorIcon fontSize="inherit"/>} label={isOnline ? "Online" : "Offline"} color={statusChipColor} sx={{ fontWeight: 500 }}/>
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
                    <Chip size="small" label={formatResponseTime(responseTime)} color={responseTimeColor} variant="outlined" />
                 </Tooltip>
             )}
             {/* Uptime Chip */}
             {uptime !== null && (
                <Tooltip title={`Uptime (${results.length} checks): ${formatUptime(uptime)}%`}> {/* Added % */}
                    <Chip size="small" icon={<ChartIcon fontSize="inherit" />} label={`${formatUptime(uptime)}%`} color={uptimeColor} variant="outlined" /> {/* Added % */}
                </Tooltip>
             )}
          </Box>

          {/* Response time chart area or placeholder */}
          <Box sx={{ flexGrow: 1, minHeight: 60, maxHeight: 80, mt: "auto" }}>
             {showChart ? (
                 // Render chart only if condition is met
                 <ResponseTimeChart data={chartData} options={chartOptions} key={`chart-${userWebsite.websiteId}`} />
             ) : (
                 // *** MODIFIED: Placeholder text when no chart should be shown ***
                 <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: 'text.secondary', gap: 0.5 }}>
                    {!isOnline && <CloudOffIcon fontSize="small" /> /* Optional icon */}
                    <Typography variant="caption">
                        {!isOnline
                            ? "Currently Offline" // Primary reason if offline
                            : results.length > 0
                                ? "No recent chart data" // Online, but hook yielded no points (e.g., all recent offline)
                                : "Awaiting check data..." // Online, but no results array yet
                        }
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