// src/components/Dashboard.tsx
import React from 'react';
import { Container, Box, CircularProgress } from '@mui/material';
import Grid from '@mui/material/Grid2'; // Using Grid2 instead of legacy Grid
import { useUserStats } from '../api/hooks/useMonitoring';
import { useWebsiteData } from '../hooks/useWebsiteData';
import { getStatusColor, getResponseTimeColor } from '../utils/statusUtils';
import StatsCard from '../components/StatsCard';
import WebsiteGrid from '../components/dashboard/WebsiteGrid';

const Dashboard: React.FC = () => {
  
  // Get stats and websites data
  const { data: stats, loading: statsLoading} = useUserStats();
  const { 
    websitesWithLatestResults, 
    loading: websitesLoading, 
  } = useWebsiteData();

  // Safety checks for TypeScript
  const safeStats = stats || { 
    totalWebsites: 0, 
    overallUptime: 0, 
    overallResponseTime: 0,
    websiteStats: [] 
  };

  // Debug output 
  console.log('Dashboard render with', websitesWithLatestResults.length, 'websites');

  // Loading states
  if (websitesLoading && !websitesWithLatestResults.length) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (statsLoading && !stats) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container 
      maxWidth={false} 
      disableGutters 
      sx={{ 
        px: { xs: 1, sm: 2 },  // Reduced horizontal padding
        mt: 2,                 // Reduced top margin
        mb: 2                  // Reduced bottom margin
      }}
    > 
      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>  {/* Reduced spacing between grid items */}
        <Grid size={{ xs: 12, md: 4 }}>
          <StatsCard 
            title="Total Websites" 
            value={safeStats.totalWebsites} 
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatsCard 
            title="Overall Uptime" 
            value={`${safeStats.overallUptime.toFixed(2)}%`} 
            color={getStatusColor(safeStats.overallUptime)} 
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatsCard 
            title="Avg. Response Time" 
            value={`${safeStats.overallResponseTime.toFixed(0)}ms`} 
            color={getResponseTimeColor(safeStats.overallResponseTime)} 
          />
        </Grid>
      </Grid>

      <WebsiteGrid 
        websitesWithLatestResults={websitesWithLatestResults} 
        loading={websitesLoading}
      />
    </Container>
  );
};

export default Dashboard;