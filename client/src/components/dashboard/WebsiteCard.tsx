// client/src/components/dashboard/WebsiteCard.tsx
import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Card, CardContent, Typography, Box, Chip, IconButton,
  Tooltip, useTheme, CircularProgress, Skeleton, // Added Skeleton
} from "@mui/material";
import {
  CheckCircleOutline as CheckIcon,
  ErrorOutline as ErrorIcon,
  Settings as SettingsIcon,
  ShowChart as ChartIcon, // Example icon for uptime chip
} from "@mui/icons-material";
import { Line } from "react-chartjs-2";
import { MonitoringResult, UserWebsite } from "../../types"; // Correct types
import {
  getStatusColor, // Calculates color based on uptime %
  getResponseTimeColor, // Calculates color based on response time value
  formatResponseTime, // Formats response time (e.g., "123 ms")
  formatUptime, // Formats uptime percentage (e.g., "99.95%")
} from "../../utils/statusUtils";
// Use the specific hook for card charts
import { useCardChartData } from "../../hooks/"; // Corrected import path

// Import and register Chart.js components (ensure this happens, maybe in App.tsx or a central config)
import {
  Chart as ChartJS, Filler, CategoryScale, LinearScale, PointElement, LineElement, Tooltip as ChartTooltip,
} from "chart.js";
ChartJS.register( Filler, CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip );

interface WebsiteCardProps {
  userWebsite: UserWebsite;
  latestResult?: MonitoringResult; // The single most recent result
  results: MonitoringResult[]; // Array of recent results (e.g., last 20) for chart/uptime
  loading?: boolean; // Indicates if the parent grid is loading
}

// Memoized chart component to prevent re-renders if data/options haven't changed
const ResponseTimeChart = React.memo(
  ({ data, options }: { data: any; options: any }) => {
    // Add a check for null data before rendering
    if (!data) {
      return (
           <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
               {/* Optionally show a placeholder or nothing */}
           </Box>
       );
    }
    return <Line data={data} options={options} />;
  },
);
ResponseTimeChart.displayName = 'ResponseTimeChart'; // Add display name

const WebsiteCard = React.memo(
  ({
    userWebsite,
    latestResult,
    results, // This now receives the `recentResults` from the parent
    loading = false,
  }: WebsiteCardProps) => {
    const navigate = useNavigate();
    const theme = useTheme();

    // Calculate uptime percentage based on the provided 'results' array
    const uptime = useMemo(() => {
      // Use the potentially limited 'results' array for calculation
      if (!results || results.length === 0) return 100; // Assume 100% if no recent results provided
      const total = results.length;
      const available = results.filter((r) => r.isAvailable).length;
      // Prevent division by zero
      return total > 0 ? (available / total) * 100 : 100;
    }, [results]); // Dependency is the 'results' array

    // Determine color for the uptime chip
    const uptimeColor = getStatusColor(uptime);

    // Use the chart hook with the provided 'results' array
    // Limit data points directly in the hook call if needed, or rely on hook's internal limit
    const { chartData, chartOptions } = useCardChartData(results, 10); // Use results array, limit to 10 points

    // Determine loading status for UI elements
    // Show skeleton if parent is loading AND we don't have any results yet to display
    const showSkeleton = loading && !latestResult && results.length === 0;
    // Show chart if we are not showing the skeleton AND we have chart data prepared
    const showChart = !showSkeleton && chartData && results.length > 0;

    // Memoize event handlers
    const handleClick = useCallback(() => {
      navigate(`/website/${userWebsite.websiteId}`);
    }, [navigate, userWebsite.websiteId]);

    const handleSettingsClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click
        navigate(`/website/${userWebsite.websiteId}/settings`);
      },
      [navigate, userWebsite.websiteId],
    );

    // Calculate status information from the latestResult
    const isOnline = useMemo(() => latestResult?.isAvailable ?? false, [latestResult]);
    const statusColor = isOnline ? "success" : "error";
    const responseTime = latestResult?.responseTime ?? null; // Use null if undefined
    const responseTimeColor = responseTime !== null ? getResponseTimeColor(responseTime) : "default";
    const statusCode = latestResult?.statusCode;

    // --- Render Logic ---

    // Show Skeleton Card if loading and no data available yet
    if (showSkeleton) {
        return (
            <Card sx={{ height: "100%" }}>
                <CardContent>
                    <Skeleton variant="text" width="60%" height={32} />
                    <Skeleton variant="text" width="80%" height={20} sx={{ mt: 1, mb: 2 }} />
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                        <Skeleton variant="rounded" width={70} height={24} />
                        <Skeleton variant="rounded" width={50} height={24} />
                        <Skeleton variant="rounded" width={60} height={24} />
                        <Skeleton variant="rounded" width={90} height={24} />
                    </Box>
                    <Skeleton variant="rectangular" width="100%" height={80} />
                </CardContent>
            </Card>
        );
    }

    // Render the actual card content
    return (
      <Card
        sx={{
          cursor: "pointer",
          height: "100%", // Ensure card takes full height of grid item
          display: "flex",
          flexDirection: "column",
          transition: "transform 0.2s, box-shadow 0.2s",
          "&:hover": { transform: "translateY(-4px)", boxShadow: theme.shadows[6] },
        }}
        onClick={handleClick}
        aria-label={`View details for ${userWebsite.name}`}
      >
        <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", p: 2 }}> {/* Reduced padding */}
          {/* Header */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
            <Tooltip title={userWebsite.name} placement="top-start">
                 <Typography variant="h6" component="div" noWrap sx={{ maxWidth: 'calc(100% - 40px)' }}> {/* Limit width */}
                    {userWebsite.name}
                 </Typography>
            </Tooltip>
            <Tooltip title="Website Settings">
              <IconButton size="small" onClick={handleSettingsClick} aria-label={`Settings for ${userWebsite.name}`}>
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* URL */}
          <Tooltip title={userWebsite.website.url} placement="bottom-start">
            <Typography variant="body2" color="textSecondary" noWrap sx={{ mb: 1.5 }}>
                {userWebsite.website.url}
            </Typography>
          </Tooltip>

          {/* Status Chips */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mb: 1.5 }}> {/* Reduced gap/margin */}
            <Tooltip title={isOnline ? "Website is online" : "Website is offline"}>
                 <Chip size="small" icon={isOnline ? <CheckIcon fontSize="inherit"/> : <ErrorIcon fontSize="inherit"/>} label={isOnline ? "Online" : "Offline"} color={statusColor} sx={{ fontWeight: 500 }}/>
            </Tooltip>
            {statusCode && (
                 <Tooltip title={`Last HTTP Status: ${statusCode}`}>
                    <Chip size="small" label={`${statusCode}`} variant="outlined" />
                 </Tooltip>
            )}
            {responseTime !== null && (
                 <Tooltip title={`Last Response Time: ${formatResponseTime(responseTime)}`}>
                    <Chip size="small" label={formatResponseTime(responseTime)} color={responseTimeColor} variant="outlined" />
                 </Tooltip>
            )}
             {/* Only show uptime if results were provided */}
             {results.length > 0 && (
                <Tooltip title={`Uptime (last ${results.length} checks): ${formatUptime(uptime)}`}>
                    <Chip size="small" icon={<ChartIcon fontSize="inherit" />} label={formatUptime(uptime)} color={uptimeColor} variant="outlined" />
                </Tooltip>
             )}
          </Box>

          {/* Response time chart area */}
          <Box sx={{ flexGrow: 1, minHeight: 60, maxHeight: 80, mt: "auto" }}> {/* Adjusted height */}
             {showChart ? (
                 <ResponseTimeChart data={chartData} options={chartOptions} key={`chart-${userWebsite.websiteId}`} />
             ) : (
                 <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography variant="caption" color="textSecondary">
                       {loading ? <CircularProgress size={20} /> : "No recent data"}
                    </Typography>
                 </Box>
             )}
          </Box>
        </CardContent>
      </Card>
    );
  },
);
WebsiteCard.displayName = 'WebsiteCard'; // Add display name

export default WebsiteCard;