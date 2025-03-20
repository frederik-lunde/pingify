// src/components/dashboard/AlertsSection.tsx
import React from 'react';
import { Paper, Typography, Box, CircularProgress, Table, TableHead, TableRow, TableCell, TableBody, Chip } from '@mui/material';
import { useAlerts } from '../../api/hooks';
import { getAlertTypeColor } from '../../utils/statusUtils';

const AlertsSection: React.FC = () => {
  const { alerts, loading } = useAlerts(5);
  
  return (
    <>
      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        Recent Alerts
      </Typography>
      <Paper sx={{ p: 2, mb: 4 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={24} />
          </Box>
        ) : !alerts || alerts.length === 0 ? (
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
    </>
  );
};

export default AlertsSection;