/*
src/components/dashboard/WebsiteGrid.tsx
*/
import React, { useMemo } from "react";
import { Box, Alert, Button, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2"; // Using MUI Grid v2
import WebsiteCard from "./WebsiteCard"; // Ensure this path is correct
import { Add as AddIcon } from "@mui/icons-material";
import { useNavigate } from "react-router";
import { ApiError, WebsiteUser } from "../../types";
import { WebsiteWithResults } from "../../hooks/domain/useWebsiteData";

interface WebsiteGridProps {
  websitesWithResults: WebsiteWithResults[];
  loading?: boolean;
  error?: ApiError | null;
  // Props for highlighting logic
  lastIncidentWebsiteId?: number | null | undefined;
  isHighlightActive?: boolean; // Is the highlight feature currently active?
}

/**
 * Grid component applying sorting and passing highlight info.
 */
const WebsiteGrid: React.FC<WebsiteGridProps> = React.memo(
  ({
      websitesWithResults,
      loading = false,
      error = null,
      lastIncidentWebsiteId,
      isHighlightActive = false // Default highlight state
  }) => {
    const navigate = useNavigate();

    // Sorting Logic (remains the same)
    const sortedWebsites = useMemo(() => {
      if (!websitesWithResults?.length) return [];
      return [...websitesWithResults].sort((a, b) => {
        if (!a?.userWebsite || !b?.userWebsite) return 0;
        if (a.userWebsite.isPinned !== b.userWebsite.isPinned) {
            return a.userWebsite.isPinned ? -1 : 1;
        }
        const aStatus = a.latestResult?.isAvailable ?? false;
        const bStatus = b.latestResult?.isAvailable ?? false;
        if (aStatus !== bStatus) {
          return aStatus ? 1 : -1;
        }
        const nameA = a.userWebsite.name ?? a.userWebsite.website?.url ?? '';
        const nameB = b.userWebsite.name ?? b.userWebsite.website?.url ?? '';
        return nameA.localeCompare(nameB);
      });
    }, [websitesWithResults]);

    // Skeleton Rendering (ensure dummy data has fields used by card)
    const renderSkeletonCards = (count = 4) => {
       const dummyWebsiteUser: WebsiteUser = {
          id: -1, userId: -1, websiteId: -1, name: 'Loading website...',
          interval: null, alertEnabled: false, alertThreshold: null,
          notifyEmail: null, createdAt: new Date().toISOString(), isPinned: false,
          consecutiveFailures: 0, downtimeStartedAt: null, // Add defaults
          website: {
            id: -1, url: 'http://loading.com', isActive: true, lastChecked: null,
            globalInterval: 300, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          }
      };
      return Array(count).fill(0).map((_, i) => (
        <Grid key={`skeleton-${i}`} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <WebsiteCard
              userWebsite={dummyWebsiteUser}
              results={[]}
              shouldHighlightThisCard={false} // Skeletons are never highlighted
          />
        </Grid>
      ));
    };

    const handleAddWebsite = () => { navigate("/add-website"); };

    // --- Render Logic ---
    if (loading && sortedWebsites.length === 0) {
      return <Grid container spacing={2} sx={{ pt: 2 }}>{renderSkeletonCards(8)}</Grid>;
    }
    if (error) {
         const errorMessage = (error?.message) ?? 'An unknown error occurred';
         return <Alert severity="error" sx={{ mt: 2, mb: 2 }}>Error loading websites: {errorMessage}</Alert>;
    }
    if (!loading && sortedWebsites.length === 0) {
         return (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: { xs: 2, sm: 4 }, borderRadius: 2, bgcolor: "background.paper", boxShadow: 1, textAlign: "center", mt: 3 }}>
              <Typography variant="h6" gutterBottom>No websites found</Typography>
              <Typography variant="body2" color="textSecondary" paragraph>Add your first website to start monitoring.</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddWebsite} sx={{ mt: 2 }}>Add Website</Button>
            </Box>
          );
    }

    return (
      <Grid container spacing={2} sx={{ pt: 2 }}>
        {sortedWebsites.map((item) => { // item is WebsiteWithResults
           if (!item?.userWebsite) {
               console.warn("[WebsiteGrid] Skipping item due to missing userWebsite:", item);
               return null;
           }
           // --- Step 3: Calculate if *this specific card* should be highlighted ---
           const shouldHighlight = isHighlightActive && item.userWebsite.websiteId === lastIncidentWebsiteId;

           return (
              // --- Step 4: Add the unique ID to the Grid item for scrolling ---
              <Grid
                key={`website-${item.userWebsite.websiteId}`}
                id={`website-card-grid-${item.userWebsite.websiteId}`} // <-- Add ID here
                size={{ xs: 12, sm: 6, md: 4, lg: 3 }}
              >
                <WebsiteCard
                  userWebsite={item.userWebsite}
                  latestResult={item.latestResult}
                  results={item.recentResults || []}
                  // Pass the boolean highlight flag down
                  shouldHighlightThisCard={shouldHighlight} // <-- Pass the calculated flag
                />
              </Grid>
           );
        })}
      </Grid>
    );
  },
);
WebsiteGrid.displayName = 'WebsiteGrid';

export default WebsiteGrid;