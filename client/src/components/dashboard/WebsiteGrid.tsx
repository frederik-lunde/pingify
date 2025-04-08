// client/src/components/dashboard/WebsiteGrid.tsx
import React, { useMemo } from "react";
import { Box, Alert, Button, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2"; // Using MUI Grid v2
import WebsiteCard from "./WebsiteCard"; // Ensure this path is correct
import { Add as AddIcon } from "@mui/icons-material";
import { useNavigate } from "react-router";

// --- Import SHARED Types (Adjust path as needed) ---
import {
    ApiError,
    WebsiteUser, // This type is nested within WebsiteWithResults
} from "../../types"; // Adjust path to your shared types file

// --- Import Hook-specific Type (Adjust path as needed) ---
// Use the type directly returned by the domain hook
import { WebsiteWithResults } from "../../hooks/domain/useWebsiteData"; // Correct import


interface WebsiteGridProps {
  // Use the correct type from the domain hook
  websitesWithResults: WebsiteWithResults[];
  loading?: boolean; // Loading state for the overall grid data fetch
  error?: ApiError | null; // Uses the shared ApiError type
}

/**
 * A grid component that displays website cards using MUI Grid v2.
 * Data is assumed to be primarily sorted by pin status from the API hook.
 * This component applies secondary sorting criteria.
 */
const WebsiteGrid: React.FC<WebsiteGridProps> = React.memo(
  ({ websitesWithResults, loading = false, error = null }) => {
    const navigate = useNavigate();

    // --- Sorting Logic ---
    // Apply secondary sorting criteria (availability, name)
    // The primary sort (pin status) is expected from the input data (websitesWithResults)
    const sortedWebsites = useMemo(() => {
      if (!websitesWithResults?.length) return [];

      // Create a shallow copy before sorting
      return [...websitesWithResults].sort((a, b) => {
        // Handle potential null items
        if (!a || !b || !a.userWebsite || !b.userWebsite) return 0;

        // 1. Prioritize Pinned Status (should already be sorted, but good for robustness)
        if (a.userWebsite.isPinned !== b.userWebsite.isPinned) {
            return a.userWebsite.isPinned ? -1 : 1; // Pinned first
        }

        // 2. Secondary Sort: Availability (Down first)
        const aStatus = a.latestResult?.isAvailable ?? false;
        const bStatus = b.latestResult?.isAvailable ?? false;
        if (aStatus !== bStatus) {
          return aStatus ? 1 : -1; // Down first
        }

        // 3. Tertiary Sort: Name
        const nameA = a.userWebsite.name ?? a.userWebsite.website?.url ?? '';
        const nameB = b.userWebsite.name ?? b.userWebsite.website?.url ?? '';
        return nameA.localeCompare(nameB);
      });
    }, [websitesWithResults]);

    // --- Skeleton Rendering ---
    const renderSkeletonCards = (count = 4) => {
      // Dummy data for skeleton card
      const dummyWebsiteUser: WebsiteUser = {
          id: -1, userId: -1, websiteId: -1, name: 'Loading website...',
          interval: null, alertEnabled: false, alertThreshold: null,
          notifyEmail: null, createdAt: new Date().toISOString(), isPinned: false,
          website: {
            id: -1, url: 'http://loading.com', isActive: true, lastChecked: null,
            globalInterval: 300, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          }
      };

      return Array(count)
        .fill(0)
        .map((_, i) => (
          <Grid key={`skeleton-${i}`} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            {/* Pass props matching WebsiteCard requirements */}
            <WebsiteCard
                userWebsite={dummyWebsiteUser}
                results={[]} // Pass empty array for results prop for skeleton
                // latestResult will be undefined
            />
          </Grid>
        ));
    };

    // --- Event Handlers ---
    const handleAddWebsite = () => {
      navigate("/add-website");
    };

    // --- Render Logic ---

    // Loading state
    if (loading && sortedWebsites.length === 0) {
      return (
        <Grid container spacing={2} sx={{ pt: 2 }}>
          {renderSkeletonCards(8)}
        </Grid>
      );
    }

    // Error state
    if (error) {
         const errorMessage = (error && typeof error === 'object' && 'message' in error)
            ? String(error.message)
            : 'An unknown error occurred';
         return (
            <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
              Error loading websites: {errorMessage}
            </Alert>
          );
    }

    // Empty state
    if (!loading && sortedWebsites.length === 0) {
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

    // Render the actual website cards using data from WebsiteWithResults
    return (
      <Grid container spacing={2} sx={{ pt: 2 }}>
        {sortedWebsites.map((item) => { // 'item' here is of type WebsiteWithResults
           // Add a check for item and item.userWebsite before rendering
           if (!item?.userWebsite) {
               console.warn("[WebsiteGrid] Skipping item due to missing userWebsite:", item);
               return null; // Skip rendering if essential data is missing
           }
           return (
              <Grid
                key={`website-${item.userWebsite.websiteId}`}
                size={{ xs: 12, sm: 6, md: 4, lg: 3 }}
              >
                {/* Pass the correct props extracted from the 'item' (WebsiteWithResults) */}
                <WebsiteCard
                  userWebsite={item.userWebsite}     // Pass the WebsiteUser object (includes isPinned)
                  latestResult={item.latestResult}   // Pass the latest result
                  results={item.recentResults || []} // Pass the recent results array
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