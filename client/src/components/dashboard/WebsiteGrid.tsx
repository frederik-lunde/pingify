import React, { useMemo } from "react";
import { Box, Alert, Button, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import WebsiteCard from "./WebsiteCard"; // Ensure this path is correct
import { WebsiteWithResults } from "../../hooks/domain/useWebsiteData";
import { Add as AddIcon } from "@mui/icons-material";
import { useNavigate } from "react-router";
import { ApiError, UserWebsite } from "../../types"; // Import UserWebsite

interface WebsiteGridProps {
  websitesWithResults: WebsiteWithResults[];
  loading?: boolean; // Keep this prop for the grid's own skeleton logic
  error?: ApiError | null;
}

/**
 * A grid component that displays website cards using MUI Grid v2.
 * Receives processed data including recent results for each card.
 */
const WebsiteGrid: React.FC<WebsiteGridProps> = React.memo(
  ({ websitesWithResults, loading = false, error = null }) => {
    const navigate = useNavigate();

    // --- useMemo for sorting (keep as is) ---
    const sortedWebsites = useMemo(() => {
      if (!websitesWithResults?.length) return [];
      return [...websitesWithResults].sort((a, b) => {
        const aStatus = a?.latestResult?.isAvailable ?? true;
        const bStatus = b?.latestResult?.isAvailable ?? true;
        if (aStatus !== bStatus) {
          return aStatus ? 1 : -1;
        }
        const nameA = a?.userWebsite?.name ?? a?.userWebsite?.website?.url ?? '';
        const nameB = b?.userWebsite?.name ?? b?.userWebsite?.website?.url ?? '';
        return nameA.localeCompare(nameB);
      });
    }, [websitesWithResults]);

    // --- Skeleton Rendering ---
    const renderSkeletonCards = (count = 4) => {
      // Create a more structured (but still dummy) UserWebsite for type safety
      const dummyUserWebsite: UserWebsite = {
          id: -1, // Use temporary negative ID
          userId: -1,
          websiteId: -1,
          name: 'Loading...', // Placeholder name
          interval: 0,
          alertEnabled: false,
          alertThreshold: null,
          notifyEmail: null,
          createdAt: new Date().toISOString(),
          website: { // Need nested website object
            id: -1,
            url: 'http://loading.com',
            isActive: true,
            lastChecked: null,
            globalInterval: 0,
          }
      };

      return Array(count)
        .fill(0)
        .map((_, i) => (
          <Grid key={`skeleton-${i}`} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            {/* Pass dummy userWebsite and empty results array */}
            <WebsiteCard
                userWebsite={dummyUserWebsite}
                results={[]} // Pass empty array to satisfy the required prop
                // latestResult is optional, will be undefined
            />
          </Grid>
        ));
    };

    // --- Event Handlers (keep as is) ---
    const handleAddWebsite = () => {
      navigate("/add-website");
    };

    // --- Render Logic (keep as is) ---
    if (loading && sortedWebsites.length === 0) {
      console.log("[WebsiteGrid] Rendering skeleton cards because loading=true and sortedWebsites is empty.");
      // Adjust skeleton count logic if needed, e.g., use a fixed number or estimate
      return (
        <Grid container spacing={2}>
          {renderSkeletonCards(4)}
        </Grid>
      );
    }

    if (error) {
        // ... error handling ...
         return (
            <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
              Error loading websites: {error.message}
            </Alert>
          );
    }

    if (!sortedWebsites.length) {
        // ... no websites found handling ...
         console.log("[WebsiteGrid] Rendering 'No websites found' message.");
         return (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: { xs: 2, sm: 4 }, borderRadius: 2, bgcolor: "background.paper", boxShadow: 1, textAlign: "center", mt: 3 }}>
              <Typography variant="h6" gutterBottom>No websites found</Typography>
              <Typography variant="body2" color="textSecondary" paragraph>Add your first website to start monitoring.</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddWebsite} sx={{ mt: 2 }}>
                Add Website
              </Button>
            </Box>
          );
    }

    console.log(`[WebsiteGrid] Rendering ${sortedWebsites.length} actual WebsiteCards.`);
    return (
      <Grid container spacing={2}>
        {sortedWebsites.map((item) => {
           if (!item || !item.userWebsite) return null;
           return (
              <Grid
                key={`website-${item.userWebsite.websiteId}`}
                size={{ xs: 12, sm: 6, md: 4, lg: 3 }}
              >
                <WebsiteCard // NO loading prop passed here
                  userWebsite={item.userWebsite}
                  latestResult={item.latestResult}
                  results={item.recentResults || []}
                />
              </Grid>
           );
        })}
      </Grid>
    );
  },
);

export default WebsiteGrid;