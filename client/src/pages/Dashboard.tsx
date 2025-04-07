//client\src\pages\Dashboard.tsx
import React, { useMemo } from "react"; // Added useMemo
import { Container, Box, CircularProgress, Typography, Button, Alert, Paper } from "@mui/material"; // Added Paper
import WebsiteGrid from "../components/dashboard/WebsiteGrid";
import { useWebsiteData } from "../hooks/domain/useWebsiteData";
import StatsHeader from "../components/dashboard/StatsHeader"; // Import the new component

const Dashboard: React.FC = () => {
  const {
    websitesWithResults,
    overallStats, // Needed for uptime/response time in dashboard header
    isLoading: isLoadingData,
    error: dataError,
    refetch,
    totalWebsitesCount, // Get counts
    upWebsitesCount,
  } = useWebsiteData(
      undefined, // Use default results limit
      'week',
      60000
  );

  // Memoize uptime/response time for the dashboard header
  const otherStatsValues = useMemo(() => {
      const safeStats = overallStats || {
          overallUptime: 0,
          overallResponseTime: 0,
      };
      return {
          uptime: safeStats.overallUptime ?? 0,
          responseTime: safeStats.overallResponseTime ?? 0,
      }
  }, [overallStats]);

  // --- Render Logic ---

  // 1. Show full-screen spinner ONLY during the very initial load phase
  //    (Before even the header can be shown meaningfully)
  if (isLoadingData && websitesWithResults.length === 0 && !overallStats) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  // 2. Show a global error message if loading failed catastrophically
  //    (Before even the header can be shown meaningfully)
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
    // Use maxWidth="xl" for consistency if Navbar uses it
    <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2 }, mt: 2, mb: 4 }}>

      {/* Dashboard Specific Stats Header */}
      {/* Wrap in Paper for slight visual separation */}
      <Paper elevation={1} sx={{ mb: 2, overflow: 'hidden' }}>
        <StatsHeader
            // Pass loading/error states specific to the data needed for the header
            isLoading={isLoadingData && (totalWebsitesCount === 0 && !overallStats)} // More specific loading for header
            error={dataError} // Pass the general data error
            upCount={upWebsitesCount}
            totalCount={totalWebsitesCount}
            uptime={otherStatsValues.uptime}
            responseTime={otherStatsValues.responseTime}
            center={false} // Use left-aligned layout for Dashboard
        />
      </Paper>

      {/* Show a less intrusive error if data is partially loaded but header could render */}
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
        error={null} // Grid handles its own errors based on props, global error handled above
      />
    </Container>
  );
};

export default Dashboard;