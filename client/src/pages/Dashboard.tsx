// src/components/Dashboard.tsx
import React from 'react';
import { Container, Box, CircularProgress, Grid } from '@mui/material';
// Update import path for useWebsiteStats -> useMonitoringStats
import { useMonitoringStats } from '../api/hooks/useMonitoring';
import { useWebsiteData } from '../hooks/useWebsiteData';
import { getStatusColor, getResponseTimeColor } from '../utils/statusUtils';
import StatsCard from '../components/StatsCard';
import AlertsSection from '../components/dashboard/AlertsSection';
import WebsiteStatusSection from '../components/dashboard/WebsiteStatusSection';
import WebsiteStatsSection from '../components/dashboard/WebsiteStatsSection';

const Dashboard: React.FC = () => {
  // Rename to use new hook name
  const { stats, loading: statsLoading } = useMonitoringStats();
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
      <h1>Website Monitoring Dashboard</h1>
      
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <StatsCard 
            title="Total Websites" 
            value={stats?.totalWebsites || 0} 
            subtitle={`${stats?.activeWebsites || 0} active`} 
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

      <WebsiteStatusSection websitesWithLatestResults={websitesWithLatestResults} />

      <AlertsSection />
      
      {stats?.websiteStats && stats.websiteStats.length > 0 && (
        <WebsiteStatsSection websiteStats={stats.websiteStats} />
      )}
    </Container>
  );
};

export default Dashboard;