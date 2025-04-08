/*
* client/src/pages/Dashboard.tsx
*
* - Cleaned up duplicate/incorrect StatsHeader rendering.
* - Removed undefined variables (primaryError, showInitialSpinner, etc.).
* - Ensured the single StatsHeader receives the correct props based on useWebsiteData.
*/
import React, { useMemo } from "react";
import { Container, Box, CircularProgress, Typography, Button, Alert, Paper } from "@mui/material";
import WebsiteGrid from "../components/dashboard/WebsiteGrid";
import { useWebsiteData } from "../hooks/domain/useWebsiteData";
import StatsHeader from "../components/dashboard/StatsHeader"; // Correct path

const Dashboard: React.FC = () => {
  // Fetch base website data (list, results, overall stats including incidents)
  const {
    websitesWithResults,
    overallStats, // Needed for uptime
    incidentsLast24h, // Correctly destructured incident count
    isLoading: isLoadingData,
    // isFetching: isFetchingData, // Can be removed if not used
    error: dataError,
    refetch,
    totalWebsitesCount,
    upWebsitesCount,
  } = useWebsiteData(
      undefined, // Use default results limit
      'week',    // Stats period for uptime calculation
      60000      // Refetch interval
  );

  // Memoize uptime for the dashboard header
  const otherStatsValues = useMemo(() => {
      return {
          // Use null if overallStats hasn't loaded yet
          uptime: overallStats?.overallUptime ?? null,
      }
  }, [overallStats]);

  // --- Render Logic ---

  // 1. Show full-screen spinner ONLY during the very initial load phase
  //    (Before any meaningful data, including stats, is available)
  if (isLoadingData && websitesWithResults.length === 0 && !overallStats) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  // 2. Show a global error message if loading failed catastrophically
  //    (And no data at all could be fetched)
  if (dataError && websitesWithResults.length === 0 && !overallStats) {
      return (
           <Container maxWidth="lg" sx={{ mt: 4 }}>
               {/* Use the actual error variable 'dataError' */}
               <Typography color="error">Error loading dashboard data: {dataError.message}</Typography>
               <Button onClick={() => refetch()} sx={{ mt: 1 }}>Retry</Button>
           </Container>
       );
  }

  // 3. Render the main dashboard structure including the StatsHeader
  return (
    <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2 }, mt: 2, mb: 4 }}>

      {/* Dashboard Specific Stats Header - Single Correct Instance */}
      <Paper elevation={1} sx={{ mb: 2, overflow: 'hidden' }}>
        <StatsHeader
            // Pass loading state: true if overall stats needed for the header are still loading
            isLoading={isLoadingData && !overallStats}
            // Pass the general data fetching error
            error={dataError}
            upCount={upWebsitesCount}
            totalCount={totalWebsitesCount}
            // Pass the memoized uptime value (can be null initially)
            uptime={otherStatsValues.uptime}
            // Pass the incidents count fetched by useWebsiteData (can be null initially)
            incidentsLast24h={incidentsLast24h}
            center={false} // Use left-aligned layout for Dashboard
        />
      </Paper>

      {/* Show a less intrusive error if data is partially loaded or an error occurred during refetch */}
      {/* Check dataError directly */}
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
        // This reflects loading of the website list and results
        loading={isLoadingData}
        error={null} // Grid doesn't need the global error; handled above
      />

    </Container>
  );
};

export default Dashboard;