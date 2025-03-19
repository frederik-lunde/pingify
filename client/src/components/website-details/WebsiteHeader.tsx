import React from 'react';
import { 
  Grid, 
  Typography, 
  Chip, 
  Button, 
  CircularProgress, 
  Paper 
} from '@mui/material';
import { 
  CheckCircleOutline as CheckIcon, 
  ErrorOutline as ErrorIcon, 
  Refresh as RefreshIcon 
} from '@mui/icons-material';

interface WebsiteHeaderProps {
  websiteId: number;
  websiteName: string;
  currentStatus: string;
  statusColor: 'success' | 'error' | 'info';
  isChecking: boolean;
  onCheckNow: () => Promise<void>;
}

const WebsiteHeader: React.FC<WebsiteHeaderProps> = ({
  websiteId,
  websiteName,
  currentStatus,
  statusColor,
  isChecking,
  onCheckNow
}) => {
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} md={8}>
          <Typography variant="h4" component="h1">
            {websiteName}
          </Typography>
          <Typography variant="body1" color="textSecondary" sx={{ mt: 1 }}>
            {`ID: ${websiteId}`}
          </Typography>
        </Grid>
        <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
          <Chip 
            icon={statusColor === 'success' ? <CheckIcon /> : <ErrorIcon />}
            label={currentStatus}
            color={statusColor}
            sx={{ mr: 1 }}
          />
          <Button
            variant="contained"
            onClick={onCheckNow}
            disabled={isChecking}
            startIcon={isChecking ? <CircularProgress size={20} /> : <RefreshIcon />}
          >
            {isChecking ? 'Checking...' : 'Check Now'}
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default WebsiteHeader;