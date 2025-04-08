// client/src/pages/Dashboard.tsx
import React, { useMemo } from "react";
import { Container, Box, CircularProgress, Typography, Button, Alert, Paper } from "@mui/material";
import WebsiteGrid from "../components/dashboard/WebsiteGrid";
import { useWebsiteData } from "../hooks/domain/useWebsiteData";
import StatsHeader from "../components/dashboard/StatsHeader";
// --- Import the NEW monitoring-based incident count hook ---
import { useUserIncidentCountQuery } from "../hooks/api/useMonitoring";
// --- Keep alert list hook ONLY if popover needs it ---
import { useUserAlertsQuery } from "../hooks";
import { subHours } from 'date-fns';

const Dashboard: React.FC = () => {
  const refetchInterval = 60000; // 1 minute

  // Fetch base website data (list, results, overall stats)
  const {
    websitesWithResults,
    overallStats, // Needed for uptime/response time in dashboard header
    isLoading: isLoadingData,
    isFetching: isFetchingData, // Get fetching state as well
    error: dataError,
    refetch,
    totalWebsitesCount, // Get counts
    upWebsitesCount,
  } = useWebsiteData(
      undefined, // Use default results limit
      'week',
      refetchInterval
  );

  // --- Use the NEW monitoring-based incident count hook ---
  const {
      data: incidentCountData,
      isLoading: isLoadingIncidentCount,
      isFetching: isFetchingIncidentCount,
      error: incidentCountError
  } = useUserIncidentCountQuery({ refetchInterval }); // Use the hook from useMonitoring.ts

  // Fetch the actual alert list for the last 24 hours (ONLY FOR POPOVER)
  // If the popover is removed or changed, this can be removed.
  const last24h = useMemo(() => subHours(new Date(), 24), []);
  const {
      data: incidentsLast24h, // Keep name for popover prop, but data source is alerts
      isLoading: isLoadingAlertList, // Separate loading state for the popover data
      isFetching: isFetchingAlertList,
      error: alertListError
  } = useUserAlertsQuery({ from: last24h, limit: 50 }, { refetchInterval }); // Fetch alerts from last 24h

  // --- Combined Loading/Error/Fetching States ---
  const dashboardUptime = useMemo(() => overallStats?.overallUptime ?? null, [overallStats]);
  const showInitialSpinner = isLoadingData || isLoadingIncidentCount; // Base data + incident count loading
  const primaryError = dataError || incidentCountError; // Combine errors, prioritizing data error
  const incidentCount = incidentCountData?.incidentCount; // Get count from the correct hook


  // --- Render Logic ---

  // 1. Show full-screen spinner ONLY during the very initial load phase
  if (showInitialSpinner && websitesWithResults.length === 0 && !overallStats) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  // 2. Show a global error message if loading failed catastrophically
  if (primaryError && websitesWithResults.length === 0 && !overallStats) {
      return (
           <Container maxWidth="lg" sx={{ mt: 4 }}>
               <Typography color="error">Error loading dashboard data: {primaryError.message}</Typography>
               <Button onClick={() => refetch()} sx={{ mt: 1 }}>Retry</Button>
           </Container>
       );
  }

  // 3. Render the main dashboard structure including the StatsHeader
  return (
    <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2 }, mt: 2, mb: 4 }}>
       {/* Render Header and Grid only if not showing initial spinner or error */}
       {(!showInitialSpinner || websitesWithResults.length > 0 || overallStats) && (!primaryError || websitesWithResults.length > 0 || overallStats) && (
          <>
            <Paper elevation={1} sx={{ mb: 2, overflow: 'hidden' }}>
              <StatsHeader
                  isLoading={isLoadingData} // Loading for base stats (Status, Uptime)
                  error={dataError} // Error for base stats
                  upCount={upWebsitesCount}
                  totalCount={totalWebsitesCount}
                  uptime={dashboardUptime}
                  // --- Pass props from the *new* monitoring-based incident count ---
                  isLoadingIncidents={isLoadingIncidentCount} // Loading specifically for the count
                  incidentsError={incidentCountError} // Error specifically for the count
                  incidentCount={incidentCount} // The count value
                  // --- Pass alert list props *only* for the popover ---
                  // Note: Error/Loading state for popover list is not explicitly shown in header display
                  incidentsLast24h={incidentsLast24h} // Alert list for the popover detail
                  center={false}
              />
            </Paper>

            {/* Less intrusive error */}
            {primaryError && (websitesWithResults.length > 0 || overallStats) && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    There might be issues displaying the latest data: {primaryError.message}.
                    <Button onClick={() => refetch()} size="small" sx={{ ml: 1 }}>Retry</Button>
                </Alert>
            )}

            <WebsiteGrid
              websitesWithResults={websitesWithResults}
              loading={isLoadingData} // Grid loading based on website list/results query
              error={null}
            />
          </>
       )}
    </Container>
  );
};

export default Dashboard;