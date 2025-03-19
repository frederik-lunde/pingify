import React from 'react';
import { 
  useWebsiteStats, 
  useMonitoringResults, 
  useAlerts
} from '../services/monitoringService';
import { MonitoringResult, Alert, OverallStats } from '../types';

// MUI Components
import { 
  Box, 
  Container,
  Grid, 
  Paper, 
  Typography, 
  CircularProgress,
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Card,
  CardContent,
  Chip,
  Divider
} from '@mui/material';
import { 
  CheckCircleOutline as CheckIcon,
  ErrorOutline as ErrorIcon,
  AccessTime as TimeIcon
} from '@mui/icons-material';

// Dashboard component using MUI
const Dashboard: React.FC = () => {
  // Use polling hooks from the monitoring service
  const { stats, loading: statsLoading } = useWebsiteStats();
  const { results, loading: resultsLoading } = useMonitoringResults(10);
  const { alerts, loading: alertsLoading } = useAlerts(5);

  if (statsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Website Monitoring Dashboard
      </Typography>
      
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
            value={`${stats?.overallUptime.toFixed(2) || 0}%`} 
            color={getStatusColor(stats?.overallUptime || 0)}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatsCard 
            title="Avg. Response Time" 
            value={`${stats?.overallResponseTime.toFixed(0) || 0}ms`} 
            color={getResponseTimeColor(stats?.overallResponseTime || 0)}
          />
        </Grid>
      </Grid>

      {/* Alerts Section */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        Recent Alerts
      </Typography>
      <Paper sx={{ p: 2, mb: 4 }}>
        {alertsLoading ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={24} />
          </Box>
        ) : alerts.length === 0 ? (
          <Typography variant="body1" color="textSecondary" align="center" py={2}>
            No recent alerts
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Website</TableCell>
                <TableCell>Message</TableCell>
                <TableCell>Time</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {alerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell>
                    <Chip 
                      label={alert.type} 
                      color={getAlertTypeColor(alert.type)} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>{`Website #${alert.websiteId}`}</TableCell>
                  <TableCell>{alert.message}</TableCell>
                  <TableCell>{new Date(alert.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Latest Monitoring Results */}
      <Typography variant="h5" gutterBottom>
        Latest Monitoring Results
      </Typography>
      <Paper sx={{ p: 2, mb: 4 }}>
        {resultsLoading ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Website</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Response Time</TableCell>
                  <TableCell>Status Code</TableCell>
                  <TableCell>Checked At</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell>{`Website #${result.websiteId}`}</TableCell>
                    <TableCell>
                      {result.isAvailable ? (
                        <Chip 
                          icon={<CheckIcon fontSize="small" />} 
                          label="Online" 
                          color="success" 
                          size="small" 
                        />
                      ) : (
                        <Chip 
                          icon={<ErrorIcon fontSize="small" />}
                          label="Offline" 
                          color="error" 
                          size="small" 
                        />
                      )}
                    </TableCell>
                    <TableCell>{result.responseTime ? `${result.responseTime}ms` : 'N/A'}</TableCell>
                    <TableCell>{result.statusCode || 'N/A'}</TableCell>
                    <TableCell>{new Date(result.checkedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Website Stats */}
      {stats?.websiteStats && (
        <>
          <Typography variant="h5" gutterBottom>
            Website Performance
          </Typography>
          <Grid container spacing={3}>
            {stats.websiteStats.map((site) => (
              <Grid item xs={12} md={4} key={site.websiteId}>
                <Paper sx={{ p: 2, height: '100%' }}>
                  <Typography variant="h6" gutterBottom noWrap>
                    {site.websiteName}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" noWrap>
                    {site.url}
                  </Typography>
                  <Divider sx={{ my: 1.5 }} />
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Uptime:
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" fontWeight="medium">
                        {site.uptime.toFixed(2)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Response Time:
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" fontWeight="medium">
                        {site.averageResponseTime.toFixed(0)}ms
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Total Checks:
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" fontWeight="medium">
                        {site.totalChecks}
                      </Typography>
                    </Grid>
                    {site.consecutiveFailures > 0 && (
                      <Grid item xs={12} sx={{ mt: 1 }}>
                        <Chip 
                          icon={<ErrorIcon fontSize="small" />}
                          label={`Down for ${site.consecutiveFailures} checks`}
                          color="error"
                          size="small"
                          sx={{ width: '100%' }}
                        />
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Container>
  );
};

// Stats Card Component
interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'default';
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, subtitle, color = 'primary' }) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="div" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h4" component="div" color={color !== 'default' ? color : undefined}>
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="textSecondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

// Helper functions
function getStatusColor(uptime: number): 'success' | 'warning' | 'error' | 'default' {
  if (uptime > 99) return 'success';
  if (uptime > 95) return 'warning';
  return 'error';
}

function getResponseTimeColor(time: number): 'success' | 'warning' | 'error' | 'default' {
  if (time < 300) return 'success';
  if (time < 1000) return 'warning';
  return 'error';
}

function getAlertTypeColor(type: string): 'success' | 'warning' | 'error' | 'info' {
  switch (type.toLowerCase()) {
    case 'down':
      return 'error';
    case 'recovered':
      return 'success';
    case 'slow':
      return 'warning';
    default:
      return 'info';
  }
}

export default Dashboard;