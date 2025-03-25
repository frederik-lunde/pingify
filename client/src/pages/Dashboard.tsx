import React from 'react';
import { Container, Box, CircularProgress, Button, Typography, Grid } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
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
  const { stats, loading: statsLoading } = useUserStats();
  const { websites, loading: websitesLoading, error: websitesError } = useWebsites();

  if (websitesError) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, textAlign: 'center' }}>
        <Typography color="error" variant="h6">
          Error loading websites: {websitesError.message}
        </Typography>
      </Container>
    );
  }

  if (statsLoading || websitesLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Website Monitoring Dashboard
        </Typography>
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
            value={stats?.totalWebsites || 0} 
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatsCard 
            title="Overall Uptime" 
            value={`${stats?.overallUptime?.toFixed(2) || 0}%`} 
            color={stats?.overallUptime ? getStatusColor(stats.overallUptime) : 'default'} 
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatsCard 
            title="Avg. Response Time" 
            value={`${stats?.overallResponseTime?.toFixed(0) || 0}ms`} 
            color={stats?.overallResponseTime ? getResponseTimeColor(stats.overallResponseTime) : 'default'} 
          />
        </Grid>
      </Grid>

      {/* Status and Alert Sections */}
      
      <AlertsSection />
      
      {stats?.websiteStats && stats.websiteStats.length > 0 && (
        <WebsiteStatsSection websiteStats={stats.websiteStats} />
      )}
    </Container>
  );
};

export default Dashboard;