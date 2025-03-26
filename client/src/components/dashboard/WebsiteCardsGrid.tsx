// client/src/components/dashboard/WebsiteCardsGrid.tsx
import React, { useState } from 'react';
import {
  Typography,
  Box,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
} from '@mui/material';
import Grid from '@mui/material/Grid2'; // Using Grid2 as in your project
import WebsiteCard from './WebsiteCard';
import { WebsiteWithResult } from '../../hooks/useWebsiteData';
import { useWebsiteCrud } from '../../api/hooks/useWebsites';

interface WebsiteCardsGridProps {
  websitesWithLatestResults: WebsiteWithResult[];
  loading?: boolean;
  onDeleted?: () => void;
}

const WebsiteCardsGrid: React.FC<WebsiteCardsGridProps> = ({
  websitesWithLatestResults,
  loading = false,
  onDeleted
}) => {
  const { remove, loading: deleteLoading } = useWebsiteCrud();
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Find the website being deleted to show its name in the confirmation dialog
  const websiteToDelete = websitesWithLatestResults.find(
    item => item.userWebsite.websiteId === deleteConfirm
  )?.userWebsite;

  const handleDeleteConfirm = (websiteId: number) => {
    setDeleteConfirm(websiteId);
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (deleteConfirm === null) return;
    
    try {
      await remove(deleteConfirm);
      setDeleteConfirm(null);
      setDeleteError(null);
      
      // Call the onDeleted callback to refresh the website list
      if (onDeleted) {
        onDeleted();
      }
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete website');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress />
      </Box>
    );
  }

  if (!websitesWithLatestResults || websitesWithLatestResults.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
        No websites found. Add your first website to start monitoring.
      </Alert>
    );
  }

  return (
    <>
      <Typography variant="h5" gutterBottom sx={{ mt: 4 }}>
        Your Websites
      </Typography>
      
      <Grid container spacing={3}>
        {websitesWithLatestResults.map((item) => (
          <Grid key={item.userWebsite.websiteId} size={{ xs: 12, sm: 6, md: 4 }}>
            <WebsiteCard
              userWebsite={item.userWebsite}
              latestResult={item.latestResult}
              results={item.results || []}
              onDelete={handleDeleteConfirm}
            />
          </Grid>
        ))}
      </Grid>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirm !== null}
        onClose={handleCancelDelete}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">
          Remove Website
        </DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {deleteError}
            </Alert>
          )}
          <Typography>
            Are you sure you want to remove "{websiteToDelete?.name || 'this website'}" from your dashboard?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} disabled={deleteLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleDelete} 
            color="error" 
            variant="contained"
            disabled={deleteLoading}
          >
            {deleteLoading ? 'Removing...' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default WebsiteCardsGrid;