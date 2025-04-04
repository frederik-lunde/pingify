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
    WebsiteUser,
} from "../../types"; // Adjust path to your shared types file

// --- Import Hook-specific Type (Adjust path as needed) ---
// This type likely comes from the useWebsiteData hook file itself or a related types file
import { WebsiteWithResults } from "../../hooks/domain/useWebsiteData"; // Make sure this uses the shared WebsiteUser type internally


interface WebsiteGridProps {
  websitesWithResults: WebsiteWithResults[]; // This should internally use the shared WebsiteUser
  loading?: boolean; // Loading state for the overall grid data fetch
  error?: ApiError | null; // Uses the shared ApiError type
}

/**
 * A grid component that displays website cards using MUI Grid v2.
 */
const WebsiteGrid: React.FC<WebsiteGridProps> = React.memo(
  ({ websitesWithResults, loading = false, error = null }) => {
    const navigate = useNavigate();

    // --- Sorting Logic ---
    const sortedWebsites = useMemo(() => {
      // Guard against null/undefined input
      if (!websitesWithResults?.length) return [];

      // Create a shallow copy before sorting
      return [...websitesWithResults].sort((a, b) => {
         // Handle potential null items in the array if necessary (though ideally filter upstream)
        if (!a || !b) return 0;

        // Sort primarily by availability (Down first)
        const aStatus = a.latestResult?.isAvailable ?? false; // Default to down if no result
        const bStatus = b.latestResult?.isAvailable ?? false;
        if (aStatus !== bStatus) {
          return aStatus ? 1 : -1; // false (down) comes before true (up)
        }

        // Sort secondarily by name (user name or URL)
        // Use optional chaining and nullish coalescing for safety
        const nameA = a.userWebsite?.name ?? a.userWebsite?.website?.url ?? '';
        const nameB = b.userWebsite?.name ?? b.userWebsite?.website?.url ?? '';
        return nameA.localeCompare(nameB);
      });
    }, [websitesWithResults]);

    // --- Skeleton Rendering ---
    const renderSkeletonCards = (count = 4) => {
      // Create a more realistic (but still dummy) WebsiteUser for the skeleton card
      // Match the structure of the WebsiteUser type from your shared types file
      const dummyWebsiteUser: WebsiteUser = {
          id: -1,
          userId: -1,
          websiteId: -1,
          name: 'Loading website...', // Placeholder name
          interval: null, // Use null/defaults matching your type
          alertEnabled: false,
          alertThreshold: null,
          notifyEmail: null,
          createdAt: new Date().toISOString(),
          website: { // Needs the nested Website object
            id: -1,
            url: 'http://loading.com',
            isActive: true,
            lastChecked: null,
            globalInterval: 300, // Example default
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
      };

      return Array(count)
        .fill(0)
        .map((_, i) => (
          <Grid key={`skeleton-${i}`} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            {/* Pass the dummy WebsiteUser and empty results array */}
            {/* WebsiteCard now expects `WebsiteUser` type */}
            <WebsiteCard
                userWebsite={dummyWebsiteUser}
                results={[]} // Pass empty array for results prop
                // latestResult is optional, will be undefined
            />
          </Grid>
        ));
    };

    // --- Event Handlers ---
    const handleAddWebsite = () => {
      navigate("/add-website");
    };

    // --- Render Logic ---

    // Show skeletons if loading AND there's no data yet to display
    if (loading && sortedWebsites.length === 0) {
      return (
        <Grid container spacing={2}>
          {renderSkeletonCards(8)} {/* Render a few more skeletons initially */}
        </Grid>
      );
    }

    // Show error message if an error occurred
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

    // Show "No websites" message if not loading and the array is empty
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

    // Render the actual website cards
    return (
      <Grid container spacing={2}>
        {sortedWebsites.map((item) => {
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
                {/* Pass the correct props to WebsiteCard */}
                <WebsiteCard
                  userWebsite={item.userWebsite} // Pass the WebsiteUser object
                  latestResult={item.latestResult}
                  results={item.recentResults || []} // Pass recentResults array, default to empty
                />
              </Grid>
           );
        })}
      </Grid>
    );
  },
);
WebsiteGrid.displayName = 'WebsiteGrid'; // Optional: for better debugging

export default WebsiteGrid;