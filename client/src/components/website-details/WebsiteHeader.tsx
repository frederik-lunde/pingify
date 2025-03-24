import React from 'react';
import { 
  Typography, 
  Chip, 
  Button, 
  CircularProgress, 
  Paper,
  Box,
  Tooltip,
  IconButton
} from '@mui/material';
import Grid from '@mui/material/Grid2'; // Using Grid2 instead of legacy Grid
import { 
  CheckCircleOutline as CheckIcon, 
  ErrorOutline as ErrorIcon, 
  Refresh as RefreshIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { UserWebsite } from '../../types';
import { useNavigate } from 'react-router';

interface WebsiteHeaderProps {
  userWebsite: UserWebsite | null;
  currentStatus: string;
  statusColor: 'success' | 'error' | 'info';
  isChecking: boolean;
  onCheckNow: () => Promise<void>;
}

const WebsiteHeader: React.FC<WebsiteHeaderProps> = ({
  userWebsite,
  currentStatus,
  statusColor,
  isChecking,
  onCheckNow
}) => {
  const navigate = useNavigate();

  if (!userWebsite) {
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" component="h1">
          Loading website...
        </Typography>
      </Paper>
    );
  }

  const handleSettingsClick = () => {
    navigate(`/website/${userWebsite.websiteId}/settings`);
  };

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
        <Grid size={{ xs: 12, md: 5 }} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
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