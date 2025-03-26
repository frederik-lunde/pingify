// src/components/Dashboard.tsx
import React from 'react';
import { Container, Box, CircularProgress, Button } from '@mui/material';
import Grid from '@mui/material/Grid2'; // Using Grid2 instead of legacy Grid
import { Add as AddIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router';
import { useUserStats } from '../api/hooks/useMonitoring';
import { useWebsiteData } from '../hooks/useWebsiteData';
import { getStatusColor, getResponseTimeColor } from '../utils/statusUtils';
import StatsCard from '../components/StatsCard';
import AlertsSection from '../components/dashboard/AlertsSection';
import WebsiteCardsGrid from '../components/dashboard/WebsiteCardsGrid';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // Using the updated hook names
  const { data: stats, loading: statsLoading, refetch: refetchStats } = useUserStats();
  const { websitesWithLatestResults, loading: websitesLoading, refetch: refetchWebsites } = useWebsiteData();

  // Safety checks for TypeScript
  const safeStats = stats || { 
    totalWebsites: 0, 
    overallUptime: 0, 
    overallResponseTime: 0,
    websiteStats: [] 
  };

  // Handle refresh after website deletion
  const handleWebsiteDeleted = () => {
    refetchWebsites();
    refetchStats();
  };

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
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center">
          <h1>Website Monitoring Dashboard</h1>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => navigate('/add-website')}
        >
          Add Website
        </Button>
      </Box>
      
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
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

      {/* Website Cards Grid - New Component */}
      <WebsiteCardsGrid 
        websitesWithLatestResults={websitesWithLatestResults} 
        loading={websitesLoading}
        onDeleted={handleWebsiteDeleted}
      />

      {/* Alerts Section */}
      <AlertsSection />
      
      {/* Keep the WebsiteStatsSection for detailed stats */}
      {safeStats.websiteStats && safeStats.websiteStats.length > 0 && (
        <WebsiteStatsSection websiteStats={safeStats.websiteStats} />
      )}
    </Container>
  );
};

// We need to import this at the end to avoid circular import issues
import WebsiteStatsSection from '../components/dashboard/WebsiteStatsSection';

export default Dashboard;