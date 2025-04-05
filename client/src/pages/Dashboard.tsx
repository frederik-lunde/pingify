//client\src\pages\Dashboard.tsx
import React, { useMemo } from "react";
import { Container, Box, CircularProgress, Typography, Button, Alert } from "@mui/material";
import Grid from "@mui/material/Grid2"; // Using Grid v2
import { getStatusColor, getResponseTimeColor, formatUptime, formatResponseTime } from "../utils/statusUtils";
import StatsCard from "../components/StatsCard";
import WebsiteGrid from "../components/dashboard/WebsiteGrid"; // Assumes this component is also fixed
import { useWebsiteData } from "../hooks/domain/useWebsiteData";

const Dashboard: React.FC = () => {
  const {
    websitesWithResults,
    overallStats,
    isLoading, // True during the initial load of any underlying query
    // isFetching, // True during initial load OR background refetches
    error,
    refetch,
    // Optional: Use granular loading states if needed for very specific UI
    // isLoadingWebsites,
    // isLoadingResults,
    // isLoadingStats,
  } = useWebsiteData(
      500,          // Limit
      'week',       // Period
      60000         // Refetch interval: 1 minute
  );

  const statsValues = useMemo(() => {
      const safeStats = overallStats || {
          totalWebsites: 0,
          activeWebsites: 0,
          overallUptime: 0,
          overallResponseTime: 0,
          websiteStats: [],
      };
      return {
          total: safeStats.totalWebsites,
          uptime: safeStats.overallUptime,
          responseTime: safeStats.overallResponseTime,
      }
  }, [overallStats]);

  // --- Render Logic ---

  // 1. Show full-screen spinner ONLY during the very initial load phase
  //    when we don't even have the website list structure yet.
  if (isLoading && websitesWithResults.length === 0 && !overallStats) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  // 2. Show a global error message if loading failed catastrophically
  //    (e.g., couldn't fetch websites list) AND we have nothing to display.
  if (error && websitesWithResults.length === 0) {
      return (
           <Container maxWidth="lg" sx={{ mt: 4 }}>
               <Typography color="error">Error loading dashboard data: {error.message}</Typography>
               <Button onClick={() => refetch()} sx={{ mt: 1 }}>Retry</Button>
           </Container>
       );
  }

  // 3. Render the main dashboard structure.
  //    Components inside will handle their specific loading states based on props.
  return (
    <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2 }, mt: 2, mb: 4 }}>
       <Box sx={{ mb: 3 }}>
           <Grid container spacing={2}>
             {/* Pass isLoading to StatsCards so they can show "Loading..." subtitle */}
             <Grid size={{ xs: 12, sm: 6, md: 4 }}>
               <StatsCard
                   title="Total Websites"
                   // Show value even if loading, subtitle indicates loading status
                   value={statsValues.total}
                   // Subtitle depends on whether the *stats* specifically are loading
                   // Using combined `isLoading` here for simplicity, but could use `isLoadingStats` if needed
                   subtitle={isLoading && !overallStats ? "Loading..." : undefined}
               />
             </Grid>
             <Grid size={{ xs: 12, sm: 6, md: 4 }}>
               <StatsCard
                 title="Overall Uptime (7d)"
                 value={formatUptime(statsValues.uptime)}
                 color={getStatusColor(statsValues.uptime)}
                 subtitle={isLoading && !overallStats ? "Loading..." : undefined}
               />
             </Grid>
             <Grid size={{ xs: 12, sm: 12, md: 4 }}>
               <StatsCard
                 title="Avg. Response (7d)"
                 value={formatResponseTime(statsValues.responseTime)}
                 color={getResponseTimeColor(statsValues.responseTime)}
                 subtitle={isLoading && !overallStats ? "Loading..." : undefined}
               />
             </Grid>
           </Grid>
       </Box>

      {/* Show a less intrusive error if data is partially loaded */}
      {error && websitesWithResults.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
              There might be issues displaying the latest data: {error.message}.
              <Button onClick={() => refetch()} size="small" sx={{ ml: 1 }}>Retry</Button>
          </Alert>
      )}

      {/* Pass `isLoading` down to WebsiteGrid. */}
      {/* The grid itself might show skeletons initially if loading=true and websitesWithResults is empty. */}
      {/* If loading=true but websitesWithResults has items (without monitoring data yet), */}
      {/* WebsiteCard's internal logic should handle showing its skeleton or "No data". */}
      <WebsiteGrid
        websitesWithResults={websitesWithResults}
        // Pass the combined initial loading state.
        // WebsiteCard uses this to help decide whether to show a skeleton.
        loading={isLoading}
        // Grid handles its own errors based on props, global error handled above
        error={null} // Or pass a specific error related *only* to the grid if applicable
      />
    </Container>
  );
};

export default Dashboard;