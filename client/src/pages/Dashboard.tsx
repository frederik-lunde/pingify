// src/pages/Dashboard.tsx
import React, { useMemo } from "react"; // Added useMemo
import { Container, Box, CircularProgress, Typography, Button } from "@mui/material"; // Added Typography
import Grid from "@mui/material/Grid2"; // Using Grid2
import { getStatusColor, getResponseTimeColor, formatUptime, formatResponseTime } from "../utils/statusUtils"; // Added formatters
import StatsCard from "../components/StatsCard";
import WebsiteGrid from "../components/dashboard/WebsiteGrid";
// Import the specific domain hook for dashboard data
import { useWebsiteData } from "../hooks/domain/useWebsiteData"; // Ensure correct path

const Dashboard: React.FC = () => {
  // Get combined website data, results, and stats using the domain hook
  const {
    websitesWithResults, // Contains website list with latest/recent results
    overallStats,        // Contains overall uptime, response time etc.
    isLoading,           // Combined loading state from the hook
    error,               // Combined error state from the hook
    refetch,             // Function to refetch dashboard data
  } = useWebsiteData(
      500,          // Limit for fetching monitoring results
      'week',       // Period for overall stats calculation
      60000         // Optional: Refetch data every 60 seconds
  );

  // Memoize derived stats values to prevent recalculations on every render
  const statsValues = useMemo(() => {
      const safeStats = overallStats || {
          totalWebsites: 0,
          activeWebsites: 0,
          overallUptime: 0,
          overallResponseTime: 0,
          websiteStats: [], // Add default for websiteStats if used directly
      };
      return {
          total: safeStats.totalWebsites,
          uptime: safeStats.overallUptime,
          responseTime: safeStats.overallResponseTime,
      }
  }, [overallStats]);


  // --- Render Logic ---

  // Initial Loading State
  if (isLoading && !overallStats && websitesWithResults.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  // Error State (check after loading)
  if (error) {
      return (
           <Container maxWidth="lg" sx={{ mt: 4 }}>
               <Typography color="error">Error loading dashboard data: {error.message}</Typography>
               {/* Optionally add a retry button */}
               <Button onClick={() => refetch()} sx={{ mt: 1 }}>Retry</Button>
           </Container>
       );
  }

  // Render Dashboard Content
  return (
    <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2 }, mt: 2, mb: 4 }}>
      {/* Summary Statistics Cards */}
       <Box sx={{ mb: 3 }}> {/* Add margin below stats cards */}
           <Grid container spacing={2}>
             {/* Total Websites Card */}
             <Grid xs={12} sm={6} md={4}>
               <StatsCard
                   title="Total Websites"
                   value={statsValues.total}
                   subtitle={isLoading ? "Loading..." : undefined} // Indicate loading on card
               />
             </Grid>
             {/* Overall Uptime Card */}
             <Grid xs={12} sm={6} md={4}>
               <StatsCard
                 title="Overall Uptime (7d)"
                 value={formatUptime(statsValues.uptime)} // Use formatter
                 color={getStatusColor(statsValues.uptime)} // Use util for color
                 subtitle={isLoading ? "Loading..." : undefined}
               />
             </Grid>
             {/* Average Response Time Card */}
             <Grid xs={12} sm={12} md={4}> {/* Takes full width on small screens */}
               <StatsCard
                 title="Avg. Response (7d)"
                 value={formatResponseTime(statsValues.responseTime)} // Use formatter
                 color={getResponseTimeColor(statsValues.responseTime)} // Use util for color
                 subtitle={isLoading ? "Loading..." : undefined}
               />
             </Grid>
           </Grid>
       </Box>

      {/* Website Grid */}
      {/* Pass the processed data, loading, and error states to the grid */}
      <WebsiteGrid
        websitesWithResults={websitesWithResults} // Pass the correct data structure
        loading={isLoading} // Pass the combined loading state
        error={error}       // Pass the combined error state
      />
    </Container>
  );
};

export default Dashboard;