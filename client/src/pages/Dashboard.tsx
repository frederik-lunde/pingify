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
import WebsiteStatusSection from '../components/dashboard/WebsiteStatusSection';
import WebsiteStatsSection from '../components/dashboard/WebsiteStatsSection';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  // Using the updated hook name
  const { stats, loading: statsLoading } = useUserStats();
  const { websitesWithLatestResults, loading: websitesLoading } = useWebsiteData();

  if (statsLoading || websitesLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <h1>Website Monitoring Dashboard</h1>
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
            value={stats?.totalWebsites || 0} 
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatsCard 
            title="Overall Uptime" 
            value={`${stats?.overallUptime?.toFixed(2) || 0}%`} 
            color={stats?.overallUptime ? getStatusColor(stats.overallUptime) : 'default'} 
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatsCard 
            title="Avg. Response Time" 
            value={`${stats?.overallResponseTime?.toFixed(0) || 0}ms`} 
            color={stats?.overallResponseTime ? getResponseTimeColor(stats.overallResponseTime) : 'default'} 
          />
        </Grid>
      </Grid>

      <WebsiteStatusSection websitesWithLatestResults={websitesWithLatestResults} />

      <AlertsSection />
      
      {stats?.websiteStats && stats.websiteStats.length > 0 && (
        <WebsiteStatsSection websiteStats={stats.websiteStats} />
      )}
    </Container>
  );
};

export default Dashboard;