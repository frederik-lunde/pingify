// client/src/components/dashboard/DirectWebsiteGrid.tsx
import React, { useEffect } from 'react';
import {
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import Grid from '@mui/material/Grid2'; // Using Grid2 as in your project
import SimpleWebsiteCard from './WebsiteCard';
import { WebsiteWithResult } from '../../hooks/useWebsiteData';

interface DirectWebsiteGridProps {
  websitesWithLatestResults: WebsiteWithResult[];
  loading?: boolean;
}

/**
 * A simplified grid that directly uses the existing websitesWithLatestResults data
 * and passes it to a pure SimpleWebsiteCard component
 */
const DirectWebsiteGrid: React.FC<DirectWebsiteGridProps> = React.memo(({
  websitesWithLatestResults,
  loading = false,
}) => {

  // Debug output with useEffect for cleaner console
  useEffect(() => {
    if (websitesWithLatestResults.length > 0) {
      console.log('Grid has', websitesWithLatestResults.length, 'websites with data');
    }
  }, [websitesWithLatestResults.length]);

  if (loading && !websitesWithLatestResults.length) {
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress />
      </Box>
    );
  }

  if (!websitesWithLatestResults.length) {
    return (
      <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
        No websites found. Add your first website to start monitoring.
      </Alert>
    );
  }

  return (
    <>
      <Grid container spacing={3}>
        {websitesWithLatestResults.map((item) => (
          <Grid key={`website-${item.userWebsite.websiteId}`} size={{ xs: 12, sm: 6, md: 3 }}>
            <SimpleWebsiteCard
              userWebsite={item.userWebsite}
              latestResult={item.latestResult}
              results={item.results || []}
              loading={loading}
            />
          </Grid>
        ))}
      </Grid>

    </>
  );
});

export default DirectWebsiteGrid;