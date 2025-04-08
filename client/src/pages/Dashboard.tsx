/*
* client/src/pages/Dashboard.tsx
*
* - Extracted `incidentsLast24h` from `useWebsiteData`.
* - Removed `responseTime` from `otherStatsValues` memo.
* - Passed `incidentsLast24h` to `StatsHeader` instead of `responseTime`.
*/
import React, { useMemo } from "react";
import { Container, Box, CircularProgress, Typography, Button, Alert, Paper } from "@mui/material";
import WebsiteGrid from "../components/dashboard/WebsiteGrid";
import { useWebsiteData } from "../hooks/domain/useWebsiteData";
import StatsHeader from "../components/dashboard/StatsHeader"; // Correct path

const Dashboard: React.FC = () => {
  const {
    websitesWithResults,
    overallStats, // Needed for uptime
    // Destructure the new incidents count
    incidentsLast24h,
    isLoading: isLoadingData,
    error: dataError,
    refetch,
    totalWebsitesCount,
    upWebsitesCount,
  } = useWebsiteData(
      undefined, // Use default results limit
      'week',    // Keep stats period as 'week' for uptime, incidents are always 24h
      60000      // Refetch interval
  );

  // Memoize uptime for the dashboard header
  // Removed responseTime as it's no longer needed for the header
  const otherStatsValues = useMemo(() => {
      return {
          uptime: overallStats?.overallUptime ?? null, // Use null if not loaded
      }
  }, [overallStats]);

  // --- Render Logic ---

  // 1. Show full-screen spinner ONLY during the very initial load phase
  if (isLoadingData && websitesWithResults.length === 0 && !overallStats) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  // 2. Show a global error message if loading failed catastrophically
  if (dataError && websitesWithResults.length === 0 && !overallStats) {
      return (
           <Container maxWidth="lg" sx={{ mt: 4 }}>
               <Typography color="error">Error loading dashboard data: {dataError.message}</Typography>
               <Button onClick={() => refetch()} sx={{ mt: 1 }}>Retry</Button>
           </Container>
       );
  }

  // 3. Render the main dashboard structure including the StatsHeader
  return (
    <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2 }, mt: 2, mb: 4 }}>

      {/* Dashboard Specific Stats Header */}
      <Paper elevation={1} sx={{ mb: 2, overflow: 'hidden' }}>
        <StatsHeader
            // Pass loading state - true if stats haven't loaded yet
            isLoading={isLoadingData && !overallStats}
            error={dataError}
            upCount={upWebsitesCount}
            totalCount={totalWebsitesCount}
            uptime={otherStatsValues.uptime}
            // Pass the incidents count instead of response time
            incidentsLast24h={incidentsLast24h}
            center={false} // Use left-aligned layout for Dashboard
        />
      </Paper>

      {/* Show a less intrusive error if data is partially loaded */}
      {dataError && (websitesWithResults.length > 0 || overallStats) && (
          <Alert severity="warning" sx={{ mb: 2 }}>
              There might be issues displaying the latest data: {dataError.message}.
              <Button onClick={() => refetch()} size="small" sx={{ ml: 1 }}>Retry</Button>
          </Alert>
      )}

      {/* WebsiteGrid remains */}
      <WebsiteGrid
        websitesWithResults={websitesWithResults}
        // Pass the overall loading state to WebsiteGrid for its internal skeletons
        loading={isLoadingData}
        error={null} // Global error handled above
      />
    </Container>
  );
};

export default Dashboard;