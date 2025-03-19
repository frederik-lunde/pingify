import React from 'react';
import { Grid, Card, CardContent, Typography } from '@mui/material';
import { MonitoringResult } from '../../types';

interface WebsiteStatsCardsProps {
  latestResult: MonitoringResult | null;
}

const WebsiteStatsCards: React.FC<WebsiteStatsCardsProps> = ({ latestResult }) => {
  return (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Response Time
            </Typography>
            <Typography variant="h5" component="div">
              {latestResult?.responseTime ? `${latestResult.responseTime}ms` : 'N/A'}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Status Code
            </Typography>
            <Typography variant="h5" component="div">
              {latestResult?.statusCode || 'N/A'}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography color="textSecondary" gutterBottom>
              Last Checked
            </Typography>
            <Typography variant="h5" component="div">
              {latestResult?.checkedAt 
                ? new Date(latestResult.checkedAt).toLocaleTimeString() 
                : 'Never'}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default WebsiteStatsCards;