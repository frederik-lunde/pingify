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

// Memoized chart component
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
    // Consider missing if no results are passed *at all* for this website
    const isMonitoringDataMissing = !results || results.length === 0;

    // Calculate uptime based on the 'results' array passed in
    const uptime = useMemo(() => {
      if (isMonitoringDataMissing) return null; // No results, no uptime
      const total = results.length;
      const available = results.filter((r) => r.isAvailable).length;
      // Avoid division by zero, return 100 if no checks but not missing data? (Edge case)
      // Or return null if total is 0. Returning null seems safer.
      return total > 0 ? (available / total) * 100 : null;
    }, [results, isMonitoringDataMissing]);
 
    const uptimeColor = uptime !== null ? getStatusColor(uptime) : "default";

    // Get chart data/options using the hook based on 'results'
    // Pass only results needed for the mini-chart (e.g., last 10-20)
    const cardResultsLimit = 20; // How many points for the card chart
    const chartInputResults = useMemo(() => results.slice(0, cardResultsLimit), [results]);
    const { chartData, chartOptions } = useCardChartData(chartInputResults); // Hook takes MonitoringResult[]

    // UI States
    // Show skeleton ONLY if there are no results AT ALL.
    const showSkeleton = isMonitoringDataMissing;
    // Show chart only if not skeleton AND chart hook provided valid data
    const showChart = !showSkeleton && (chartData?.datasets?.[0]?.data?.length ?? 0) > 0;

    // Memoized handlers
    const handleClick = useCallback(() => {
      // Access websiteId from the WebsiteUser prop
      navigate(`/website/${userWebsite.websiteId}`);
    }, [navigate, userWebsite.websiteId]);

    const handleSettingsClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
         // Access websiteId from the WebsiteUser prop
        navigate(`/website/${userWebsite.websiteId}/settings`);
      },
      [navigate, userWebsite.websiteId],
    );

    // Derived status info (use defaults/fallbacks if latestResult is missing)
    // Access properties from latestResult (MonitoringResult type)
    const isOnline = useMemo(() => latestResult?.isAvailable ?? false, [latestResult]);
    const statusChipColor = isOnline ? "success" : "error";
    const responseTime = latestResult?.responseTime ?? null;
    const responseTimeColor = responseTime !== null ? getResponseTimeColor(responseTime) : "default";
    const statusCode = latestResult?.statusCode;

    // Determine display name (user custom name or URL)
    // Access name from WebsiteUser, nested URL from WebsiteUser.website
    const displayName = userWebsite.name || userWebsite.website?.url || 'Website'; // Fallback needed?
    const displayUrl = userWebsite.website?.url; // Optional chaining needed if website might be missing

    // --- Render Logic ---

    // 1. Render Skeleton if monitoring data is missing entirely for this card
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
                    {/* URL (only if different from name) */}
                    {userWebsite.name && displayUrl && (
                         <Tooltip title={displayUrl} placement="bottom-start">
                             <Typography variant="body2" color="textSecondary" noWrap sx={{ mb: 1.5 }}>
                                {displayUrl}
                             </Typography>
                         </Tooltip>
                    )}
                    {(!userWebsite.name || !displayUrl) && <Box sx={{ mb: 1.5 }} />} {/* Placeholder space */}

                    {/* Skeletons for status chips */}
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

          {/* URL (only if name is set and URL exists) */}
          {userWebsite.name && displayUrl && (
              <Tooltip title={displayUrl} placement="bottom-start">
                <Typography variant="body2" color="textSecondary" noWrap sx={{ mb: 1.5 }}>
                    {displayUrl}
                </Typography>
              </Tooltip>
          )}
           {(!userWebsite.name || !displayUrl) && <Box sx={{ mb: 1.5 }} />} {/* Placeholder space */}

          {/* Status Chips */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mb: 1.5 }}>
             {/* Status Chip: Always show based on latestResult */}
             <Tooltip title={isOnline ? "Website is online" : "Website is offline"}>
                 <Chip size="small" icon={isOnline ? <CheckIcon fontSize="inherit"/> : <ErrorIcon fontSize="inherit"/>} label={isOnline ? "Online" : "Offline"} color={statusChipColor} sx={{ fontWeight: 500 }}/>
             </Tooltip>
             {/* Status Code Chip: Show if available */}
             {statusCode != null && (
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
             {/* Uptime Chip: Show if uptime was calculated */}
             {uptime !== null && (
                <Tooltip title={`Uptime (${results.length} checks): ${formatUptime(uptime)}`}>
                    <Chip size="small" icon={<ChartIcon fontSize="inherit" />} label={formatUptime(uptime)} color={uptimeColor} variant="outlined" />
                </Tooltip>
             )}
          </Box>

          {/* Response time chart area */}
          <Box sx={{ flexGrow: 1, minHeight: 60, maxHeight: 80, mt: "auto" }}>
             {showChart ? (
                 // Pass key to ensure re-render if data identity changes significantly
                 <ResponseTimeChart data={chartData} options={chartOptions} key={`chart-${userWebsite.websiteId}`} />
             ) : (
                 // Placeholder text when no chart data is available (but results exist)
                 <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography variant="caption" color="textSecondary">
                       {results.length > 0 ? "No chart data" : "Awaiting check data..."}
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