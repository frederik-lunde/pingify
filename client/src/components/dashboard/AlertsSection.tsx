// src/components/dashboard/AlertsSection.tsx
import React, { useState } from 'react';
import { 
  Paper, 
  Typography, 
  Box, 
  CircularProgress, 
  Table, 
  TableHead, 
  TableRow, 
  TableCell, 
  TableBody, 
  Chip,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from '@mui/material';
import { useUserAlerts } from '../../api/hooks/useAlerts';
import { useWebsites } from '../../api/hooks/useWebsites';
import { getAlertTypeColor } from '../../utils/statusUtils';
import { AlertType } from '../../types';

const AlertsSection: React.FC = () => {
  const [alertType, setAlertType] = useState<string>('');
  const [limit, setLimit] = useState<number>(5);
  
  // Update the hooks to use the new polling pattern
  const { 
    data: alerts, 
    loading, 
    error, 
  } = useUserAlerts(
    limit, 
    alertType as AlertType | undefined
  );
  
  const { data: websites } = useWebsites();
  
  // Ensure websites and alerts are never null for TypeScript
  const safeWebsites = websites || [];
  const safeAlerts = alerts || [];
  const websitesWithAlertsEnabled = safeWebsites.filter(w => w.alertEnabled);
  
  const handleTypeChange = (event: SelectChangeEvent) => {
    setAlertType(event.target.value);
  };
  
  const handleLimitChange = (event: SelectChangeEvent) => {
    setLimit(Number(event.target.value));
  };

  
  // Function to get website name by ID
  const getWebsiteName = (websiteId: number): string => {
    const website = safeWebsites.find(w => w.websiteId === websiteId);
    return website?.name || `Website #${websiteId}`;
  };
  
  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 4, mb: 1 }}>
        <Typography variant="h5">Recent Alerts</Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="alert-type-select-label">Type</InputLabel>
            <Select
              labelId="alert-type-select-label"
              value={alertType}
              label="Type"
              onChange={handleTypeChange}
            >
              <MenuItem value="">All Types</MenuItem>
              <MenuItem value="down">Down</MenuItem>
              <MenuItem value="slow">Slow</MenuItem>
              <MenuItem value="recovered">Recovered</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="limit-select-label">Limit</InputLabel>
            <Select
              labelId="limit-select-label"
              value={limit.toString()}
              label="Limit"
              onChange={handleLimitChange}
            >
              <MenuItem value={5}>5 Alerts</MenuItem>
              <MenuItem value={10}>10 Alerts</MenuItem>
              <MenuItem value={25}>25 Alerts</MenuItem>
              <MenuItem value={50}>50 Alerts</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>
      
      <Paper sx={{ p: 2, mb: 4 }}>
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
          >
            Error loading alerts: {error.message}
          </Alert>
        )}

        {websitesWithAlertsEnabled.length === 0 ? (
          <Alert 
            severity="info" 
          >
            No websites with alerts enabled. Enable alerts for a website to start receiving notifications.
          </Alert>
        ) : loading && !safeAlerts.length ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={24} />
          </Box>
        ) : safeAlerts.length === 0 ? (
          <Typography variant="body1" color="textSecondary" align="center" py={2}>
            No recent alerts {alertType && `of type "${alertType}"`}
          </Typography>
        ) : (
          <>
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
                {safeAlerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell>
                      <Chip 
                        label={alert.type} 
                        color={getAlertTypeColor(alert.type)} 
                        size="small" 
                      />
                    </TableCell>
                    <TableCell>
                      {getWebsiteName(alert.websiteId)}
                    </TableCell>
                    <TableCell>{alert.message}</TableCell>
                    <TableCell>{new Date(alert.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </Paper>  
    </>
  );
};

export default AlertsSection;