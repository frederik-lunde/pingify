// src/pages/Dashboard.tsx
import React, { useMemo } from "react";
import { Container, Box, CircularProgress, Typography, Button } from "@mui/material";
import Grid from "@mui/material/Grid2"; // Using Grid v2
import { getStatusColor, getResponseTimeColor, formatUptime, formatResponseTime } from "../utils/statusUtils";
import StatsCard from "../components/StatsCard";
import WebsiteGrid from "../components/dashboard/WebsiteGrid"; // Assumes this component is also fixed
import { useWebsiteData } from "../hooks/domain/useWebsiteData";

const Dashboard: React.FC = () => {
  const {
    websitesWithResults,
    overallStats,
    isLoading,
    error,
    refetch,
  } = useWebsiteData(
      500,          // Limit
      'week',       // Period
      60000         // Refetch interval
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

  if (isLoading && !overallStats && websitesWithResults.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
      return (
           <Container maxWidth="lg" sx={{ mt: 4 }}>
               <Typography color="error">Error loading dashboard data: {error.message}</Typography>
               <Button onClick={() => refetch()} sx={{ mt: 1 }}>Retry</Button>
           </Container>
       );
  }

  return (
    <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2 }, mt: 2, mb: 4 }}>
       <Box sx={{ mb: 3 }}>
           {/* Grid v2 container props (container, spacing) are valid */}
           <Grid container spacing={2}>
             {/* Total Websites Card - CORRECT: Uses the 'size' prop */}
             <Grid size={{ xs: 12, sm: 6, md: 4 }}>
               <StatsCard
                   title="Total Websites"
                   value={statsValues.total}
                   subtitle={isLoading ? "Loading..." : undefined}
               />
             </Grid>
             {/* Overall Uptime Card - CORRECT: Uses the 'size' prop */}
             <Grid size={{ xs: 12, sm: 6, md: 4 }}>
               <StatsCard
                 title="Overall Uptime (7d)"
                 value={formatUptime(statsValues.uptime)}
                 color={getStatusColor(statsValues.uptime)}
                 subtitle={isLoading ? "Loading..." : undefined}
               />
             </Grid>
             {/* Average Response Time Card - CORRECT: Uses the 'size' prop */}
             <Grid size={{ xs: 12, sm: 12, md: 4 }}>
               <StatsCard
                 title="Avg. Response (7d)"
                 value={formatResponseTime(statsValues.responseTime)}
                 color={getResponseTimeColor(statsValues.responseTime)}
                 subtitle={isLoading ? "Loading..." : undefined}
               />
             </Grid>
           </Grid>
       </Box>

      {/* WebsiteGrid component should also be using Grid v2 correctly internally */}
      <WebsiteGrid
        websitesWithResults={websitesWithResults}
        loading={isLoading}
        error={error}
      />
    </Container>
  );
};

export default Dashboard;