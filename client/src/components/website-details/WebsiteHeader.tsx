import React, { useCallback } from 'react';
import { 
  Typography, 
  Chip, 
  Button, 
  CircularProgress, 
  Paper,
  Box,
  Tooltip,
  IconButton,
  Skeleton
} from '@mui/material';
import Grid from '@mui/material/Grid2'; // Using Grid2 instead of legacy Grid
import { 
  CheckCircleOutline as CheckIcon, 
  ErrorOutline as ErrorIcon, 
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { UserWebsite } from '../../types';
import { useNavigate } from 'react-router';

interface WebsiteHeaderProps {
  userWebsite: UserWebsite | null;
  currentStatus: string;
  statusColor: 'success' | 'error' | 'info';
  isChecking: boolean;
  onCheckNow: () => Promise<void>;
  isRefreshing?: boolean;
  loading?: boolean;
}

const WebsiteHeader: React.FC<WebsiteHeaderProps> = ({
  userWebsite,
  currentStatus,
  statusColor,
  isChecking,
  onCheckNow,
  isRefreshing = false,
  loading = false
}) => {
  const navigate = useNavigate();

  // Navigate to settings page
  const handleSettingsClick = useCallback(() => {
    if (userWebsite) {
      navigate(`/website/${userWebsite.websiteId}/settings`);
    }
  }, [navigate, userWebsite]);

  // Loading skeleton
  if (loading || !userWebsite) {
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 7 }}>
            <Skeleton variant="text" width="60%" height={40} />
            <Skeleton variant="text" width="80%" height={24} sx={{ mt: 1 }} />
          </Grid>
          <Grid size={{ xs: 12, md: 5 }} sx={{ 
            display: 'flex', 
            justifyContent: { xs: 'flex-start', md: 'flex-end' } 
          }}>
            <Skeleton variant="rounded" width={100} height={36} sx={{ mr: 1 }} />
            <Skeleton variant="rounded" width={120} height={36} />
          </Grid>
        </Grid>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid size={{ xs: 12, md: 7 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="h4" component="h1">
              {userWebsite.name}
            </Typography>
            <Tooltip title="Website Settings">
              <IconButton 
                onClick={handleSettingsClick} 
                size="small" 
                sx={{ ml: 1 }}
                aria-label="Website Settings"
              >
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <Typography variant="body1" color="textSecondary" sx={{ mt: 1 }}>
            {userWebsite.website.url}
          </Typography>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }} sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: { xs: 'flex-start', md: 'flex-end' }, 
          gap: 1, 
          flexWrap: 'wrap' 
        }}>
          <Chip 
            icon={statusColor === 'success' ? <CheckIcon /> : <ErrorIcon />}
            label={currentStatus}
            color={statusColor}
          />
          
          <Button
            variant="contained"
            onClick={onCheckNow}
            disabled={isChecking || isRefreshing}
            startIcon={isChecking ? <CircularProgress size={20} /> : <RefreshIcon />}
            size="medium"
          >
            {isChecking ? 'Checking...' : 'Check Now'}
          </Button>
  
        </Grid>
      </Grid>
    </Paper>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default React.memo(WebsiteHeader);