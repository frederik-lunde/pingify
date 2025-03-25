import React from 'react';
import { Container, Box, CircularProgress, Button, Typography } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import Grid from '@mui/material/Grid2'; // Using Grid2 instead of legacy Grid
import { useNavigate } from 'react-router';
import { useUserStats } from '../api/hooks/useMonitoring';
import { getStatusColor, getResponseTimeColor } from '../utils/statusUtils';
import StatsCard from '../components/StatsCard';
import AlertsSection from '../components/dashboard/AlertsSection';
import WebsiteStatsSection from '../components/dashboard/WebsiteStatsSection';
import WebsiteMonitoringCard from '../components/WebsiteMonitoringCard';
import { useWebsites } from '../api/hooks/useWebsites';


const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // Using the updated hook names
  const { data: stats, loading: statsLoading } = useUserStats();
  const { websitesWithLatestResults, loading: websitesLoading } = useWebsiteData();

  // Safety checks for TypeScript
  const safeStats = stats || { 
    totalWebsites: 0, 
    overallUptime: 0, 
    overallResponseTime: 0,
    websiteStats: [] 
  };


  if (websitesLoading) {
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

      {/* Website Monitoring Cards Grid */}
      <Box mb={4}>
        <Grid container spacing={3}>
          {websites.map(website => (
            <Grid item key={website.websiteId} xs={12} sm={6} md={4} lg={3}>
              <WebsiteMonitoringCard website={website} />
            </Grid>
          ))}
        </Grid>

        {websites.length === 0 && (
          <Box sx={{ 
            textAlign: 'center', 
            py: 4, 
            bgcolor: 'background.paper', 
            borderRadius: 1,
            mt: 2
          }}>
            <Typography variant="body1" color="text.secondary">
              No websites found. Add your first website to start monitoring.
            </Typography>
          </Box>
        )}
      </Box>

      {/* Summary Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <StatsCard 
            title="Total Websites" 
            value={safeStats.totalWebsites} 
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatsCard 
            title="Overall Uptime" 
            value={`${safeStats.overallUptime.toFixed(2)}%`} 
            color={getStatusColor(safeStats.overallUptime)} 
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatsCard 
            title="Avg. Response Time" 
            value={`${safeStats.overallResponseTime.toFixed(0)}ms`} 
            color={getResponseTimeColor(safeStats.overallResponseTime)} 
          />
        </Grid>
      </Grid>

      {/* Status and Alert Sections */}
      
      <AlertsSection />
      
      {safeStats.websiteStats && safeStats.websiteStats.length > 0 && (
        <WebsiteStatsSection websiteStats={safeStats.websiteStats} />
      )}
    </Container>
  );
};

export default Dashboard;