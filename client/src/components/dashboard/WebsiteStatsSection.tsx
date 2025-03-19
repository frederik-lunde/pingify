import React from 'react';
import { 
  Grid, 
  Paper, 
  Typography, 
  Divider, 
  Chip
} from '@mui/material';
import { 
  ErrorOutline as ErrorIcon 
} from '@mui/icons-material';
import { WebsiteStats } from '../../types';
import { Link } from 'react-router';

interface WebsiteStatsSectionProps {
  websiteStats: WebsiteStats[];
}

const WebsiteStatsSection: React.FC<WebsiteStatsSectionProps> = ({ websiteStats }) => {
  if (!websiteStats || websiteStats.length === 0) {
    return null;
  }

  return (
    <>
      <Typography variant="h5" gutterBottom>
        Website Performance
      </Typography>
      <Grid container spacing={3}>
        {websiteStats.map((site) => (
          <Grid item xs={12} md={4} key={site.websiteId}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="h6" gutterBottom noWrap component={Link} 
                to={`/website/${site.websiteId}`}
                sx={{ 
                  textDecoration: 'none', 
                  color: 'inherit',
                  '&:hover': { 
                    color: 'primary.main',
                    textDecoration: 'underline' 
                  }
                }}
              >
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
  );
};

export default WebsiteStatsSection;