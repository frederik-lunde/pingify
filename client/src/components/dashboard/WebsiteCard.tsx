// client/src/components/dashboard/WebsiteCard.tsx
import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Card, CardContent, Typography, Box, Chip, IconButton,
  Tooltip, useTheme, CircularProgress, Skeleton,
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

// Import ONLY Chart.js types needed for configuration/callbacks
// REMOVE ChartJS import and registration call from here

interface WebsiteCardProps {
  userWebsite: UserWebsite;
  latestResult?: MonitoringResult;
  results: MonitoringResult[]; // Expects `recentResults` from parent
  loading?: boolean;
}

// Memoized chart component
const ResponseTimeChart = React.memo(
  ({ data, options }: { data: any; options: any }) => {
    // Ensure data is valid before rendering
    if (!data || !data.datasets || data.datasets.length === 0 || data.datasets[0].data.length === 0) {
      return (
           <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
               {/* Placeholder for empty/loading chart state handled in parent */}
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
    results,
    loading = false,
  }: WebsiteCardProps) => {
    const navigate = useNavigate();
    const theme = useTheme();

    // Calculate uptime based on provided 'results'
    const uptime = useMemo(() => {
      if (!results || results.length === 0) return 100;
      const total = results.length;
      const available = results.filter((r) => r.isAvailable).length;
      return total > 0 ? (available / total) * 100 : 100;
    }, [results]);

    const uptimeColor = getStatusColor(uptime);

    // Get chart data/options using the hook
    const { chartData, chartOptions } = useCardChartData(results, 10);

    // UI States
    const showSkeleton = loading && !latestResult && (!results || results.length === 0);
    // Check chartData itself and ensure it has points
    const showChart = !showSkeleton && chartData?.datasets?.[0]?.data?.length > 0;

    // Memoized handlers
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

    // Derived status info
    const isOnline = useMemo(() => latestResult?.isAvailable ?? false, [latestResult]);
    const statusChipColor = isOnline ? "success" : "error"; // Renamed to avoid conflict
    const responseTime = latestResult?.responseTime ?? null;
    const responseTimeColor = responseTime !== null ? getResponseTimeColor(responseTime) : "default";
    const statusCode = latestResult?.statusCode;

    // --- Render Logic ---
    if (showSkeleton) {
        // Skeleton rendering code... (kept as is)
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
        aria-label={`View details for ${userWebsite.name || userWebsite.website.url}`} // Improved label
      >
        <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", p: 2 }}>
          {/* Header */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
            <Tooltip title={userWebsite.name || userWebsite.website.url} placement="top-start">
                 <Typography variant="h6" component="div" noWrap sx={{ maxWidth: 'calc(100% - 40px)' }}>
                    {userWebsite.name || userWebsite.website.url} {/* Display URL if name is missing */}
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
          {/* Adjust margin if URL isn't shown */}
          {!userWebsite.name && <Box sx={{ mb: 1.5 }} />}


          {/* Status Chips */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mb: 1.5 }}>
             {/* ... Chips ... (kept as is) */}
             <Tooltip title={isOnline ? "Website is online" : "Website is offline"}>
                 <Chip size="small" icon={isOnline ? <CheckIcon fontSize="inherit"/> : <ErrorIcon fontSize="inherit"/>} label={isOnline ? "Online" : "Offline"} color={statusChipColor} sx={{ fontWeight: 500 }}/>
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
             {results.length > 0 && (
                <Tooltip title={`Uptime (last ${results.length} checks): ${formatUptime(uptime)}`}>
                    <Chip size="small" icon={<ChartIcon fontSize="inherit" />} label={formatUptime(uptime)} color={uptimeColor} variant="outlined" />
                </Tooltip>
             )}
          </Box>

          {/* Response time chart area */}
          <Box sx={{ flexGrow: 1, minHeight: 60, maxHeight: 80, mt: "auto" }}>
             {showChart ? (
                 <ResponseTimeChart data={chartData} options={chartOptions} key={`chart-${userWebsite.websiteId}`} />
             ) : (
                 <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography variant="caption" color="textSecondary">
                       {/* Show loading only if parent indicated loading, otherwise 'No data' */}
                       {loading && !latestResult ? <CircularProgress size={20} /> : "No recent data"}
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