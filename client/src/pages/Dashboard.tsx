/*
src/pages/Dashboard.tsx
*/
import React, { useMemo, useState, useCallback, useEffect } from "react"; // Added useState, useCallback, useEffect
import { Container, Box, CircularProgress, Typography, Button, Alert, Paper } from "@mui/material";
import StatsHeader from "../components/dashboard/StatsHeader"; // Ensure this path is correct
import WebsiteGrid from "../components/dashboard/WebsiteGrid";
import { useWebsiteData } from "../hooks/domain/useWebsiteData";

const Dashboard: React.FC = () => {
  const {
    websitesWithResults,
    overallStats,
    incidentsLast24h,
    lastIncidentTimestamp,
    lastIncidentWebsiteId, // This ID determines *which* card to highlight
    isLoading: isLoadingData,
    error: dataError,
    refetch,
    totalWebsitesCount,
    upWebsitesCount,
  } = useWebsiteData(
      undefined,
      'week',
      60000
  );

  // --- State for Highlight Toggle ---
  const [isHighlightActive, setIsHighlightActive] = useState(false);

  // Memoize uptime
  const uptime = useMemo(() => {
      return overallStats?.overallUptime ?? null;
  }, [overallStats]);

  // --- Callback to Toggle Highlight and Scroll ---
  const handleToggleHighlight = useCallback(() => {
      const shouldActivate = !isHighlightActive; // Determine target state *before* updating
      setIsHighlightActive(shouldActivate);

      // Scroll only when activating the highlight AND we have an ID
      if (shouldActivate && lastIncidentWebsiteId) {
          // Use setTimeout to allow state update and DOM rerender
          setTimeout(() => {
              const elementId = `website-card-grid-${lastIncidentWebsiteId}`;
              const element = document.getElementById(elementId);
              if (element) {
                  element.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start', // Align top of card with top of viewport
                      inline: 'nearest'
                  });
                  console.log(`Scrolling to ${elementId}`);
              } else {
                  console.warn(`Element with ID ${elementId} not found for scrolling.`);
              }
          }, 100); // Small delay often helps ensure element is ready
      }
  }, [isHighlightActive, lastIncidentWebsiteId]); // Dependencies

   // Reset highlight if the last incident changes (e.g., after data refetch)
   useEffect(() => {
       setIsHighlightActive(false);
   }, [lastIncidentWebsiteId]);

  // --- Render Logic ---

  if (isLoadingData && websitesWithResults.length === 0 && !overallStats) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh"><CircularProgress /></Box>;
  }

  if (dataError && websitesWithResults.length === 0 && !overallStats) {
      return (
           <Container maxWidth="lg" sx={{ mt: 4 }}>
               <Typography color="error">Error loading dashboard data: {dataError.message}</Typography>
               <Button onClick={() => refetch()} sx={{ mt: 1 }}>Retry</Button>
           </Container>
       );
  }

  return (
    <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2 }, mt: 2, mb: 4 }}>
      <Paper elevation={1} sx={{ mb: 2, overflow: 'hidden' }}>
        <StatsHeader
            isLoading={isLoadingData && !overallStats}
            error={dataError}
            upCount={upWebsitesCount}
            totalCount={totalWebsitesCount}
            uptime={uptime}
            incidentsLast24h={incidentsLast24h}
            lastIncidentTimestamp={lastIncidentTimestamp}
            // Pass the ID and the toggle function
            lastIncidentWebsiteId={lastIncidentWebsiteId}
            onToggleHighlight={handleToggleHighlight} // Pass the callback
            isHighlightActive={isHighlightActive} // Pass current state for visual feedback if needed
            center={false}
        />
      </Paper>

      {dataError && (websitesWithResults.length > 0 || overallStats) && (
          <Alert severity="warning" sx={{ mb: 2 }}>
              There might be issues displaying the latest data: {dataError.message}.
              <Button onClick={() => refetch()} size="small" sx={{ ml: 1 }}>Retry</Button>
          </Alert>
      )}

      <WebsiteGrid
        websitesWithResults={websitesWithResults}
        loading={isLoadingData && websitesWithResults.length === 0}
        error={null}
        // Pass down the necessary info for highlighting
        lastIncidentWebsiteId={lastIncidentWebsiteId}
        isHighlightActive={isHighlightActive}
      />
    </Container>
  );
};

export default Dashboard;