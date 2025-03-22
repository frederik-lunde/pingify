import React from 'react';
import { Link } from 'react-router';
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
  TableContainer,
  Chip
} from '@mui/material';
import { 
  CheckCircleOutline as CheckIcon,
  ErrorOutline as ErrorIcon 
} from '@mui/icons-material';
import { MonitoringResult, UserWebsite } from '../../types';

interface WebsiteWithResult {
  userWebsite: UserWebsite;
  latestResult?: MonitoringResult;
}

interface WebsiteStatusSectionProps {
  websitesWithLatestResults: WebsiteWithResult[];
  loading?: boolean;
}

const WebsiteStatusSection: React.FC<WebsiteStatusSectionProps> = ({ 
  websitesWithLatestResults,
  loading = false
}) => {
  return (
    <>
      <Typography variant="h5" gutterBottom>
        Website Status
      </Typography>
      <Paper sx={{ p: 2, mb: 4 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={24} />
          </Box>
        ) : !websitesWithLatestResults || websitesWithLatestResults.length === 0 ? (
          <Typography variant="body1" color="textSecondary" align="center" py={2}>
            No websites found
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Website</TableCell>
                  <TableCell>URL</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Response Time</TableCell>
                  <TableCell>Last Checked</TableCell>
                  <TableCell>Interval</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {websitesWithLatestResults.map(({ userWebsite, latestResult }) => (
                  <TableRow key={userWebsite.websiteId}>
                    <TableCell>
                      <Link 
                        to={`/website/${userWebsite.websiteId}`} 
                        style={{ textDecoration: 'none', color: 'inherit', fontWeight: 500 }}
                      >
                        {userWebsite.name || `Website #${userWebsite.websiteId}`}
                      </Link>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <Typography variant="body2" noWrap>
                        {userWebsite.website.url}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {latestResult ? (
                        latestResult.isAvailable ? (
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
                        )
                      ) : (
                        <Chip label="Unknown" size="small" />
                      )}
                    </TableCell>
                    <TableCell>
                      {latestResult?.responseTime ? `${latestResult.responseTime}ms` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {latestResult ? new Date(latestResult.checkedAt).toLocaleString() : 'Never checked'}
                    </TableCell>
                    <TableCell>
                      {userWebsite.interval} sec
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </>
  );
};

export default WebsiteStatusSection;