// client/src/components/dashboard/WebsiteGrid.tsx
import React, { useMemo } from "react";
import { Box, Alert, Button, Typography, Skeleton } from "@mui/material";
import Grid from "@mui/material/Grid2"; // Using Grid2
import WebsiteCard from "./WebsiteCard";
// Updated import name to match the modified hook structure
import { WebsiteWithResults } from "../../hooks/domain/useWebsiteData";
import { Add as AddIcon } from "@mui/icons-material";
import { useNavigate } from "react-router";
import { ApiError } from "../../types"; // Import ApiError

interface WebsiteGridProps {
  // Updated prop name and type to match useWebsiteData return
  websitesWithResults: WebsiteWithResults[];
  loading?: boolean;
  error?: ApiError | null; // Use ApiError type
}

/**
 * A grid component that displays website cards.
 * Receives processed data including recent results for each card.
 */
const WebsiteGrid: React.FC<WebsiteGridProps> = React.memo(
  // Updated prop name in destructuring
  ({ websitesWithResults, loading = false, error = null }) => {
    const navigate = useNavigate();

    // Memoize the sorted websites for better performance
    const sortedWebsites = useMemo(() => {
      // Use the updated prop name
      if (!websitesWithResults?.length) return [];

      // Sort by online status first (offline websites first), then by name
      return [...websitesWithResults].sort((a, b) => {
        const aStatus = a.latestResult?.isAvailable ?? true; // Assume online if no result
        const bStatus = b.latestResult?.isAvailable ?? true;

        if (aStatus !== bStatus) {
          return aStatus ? 1 : -1; // Offline first (false comes before true)
        }

        // Then sort by name alphabetically
        return a.userWebsite.name.localeCompare(b.userWebsite.name);
      });
      // Dependency array uses the updated prop name
    }, [websitesWithResults]);

    // Function to render skeleton cards during loading
    const renderSkeletonCards = (count = 4) => {
      return Array(count)
        .fill(0)
        .map((_, i) => (
          <Grid key={`skeleton-${i}`} xs={12} sm={6} md={4} lg={3}> {/* Adjusted grid sizing */}
            <Box sx={{ height: "100%", bgcolor: "background.paper", borderRadius: 1, p: 2, boxShadow: 1 }}>
              <Skeleton variant="text" width="60%" height={32} />
              <Skeleton variant="text" width="80%" height={20} sx={{ mt: 1, mb: 2 }} />
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                <Skeleton variant="rounded" width={70} height={24} />
                <Skeleton variant="rounded" width={50} height={24} />
                <Skeleton variant="rounded" width={60} height={24} />
                <Skeleton variant="rounded" width={90} height={24} />
              </Box>
              <Skeleton variant="rectangular" width="100%" height={80} />
            </Box>
          </Grid>
        ));
    };

    // Handle navigation to add website page
    const handleAddWebsite = () => {
      navigate("/add-website");
    };

    // --- Render Logic ---

    // Loading state: Show skeletons if loading and no websites are displayed yet
    if (loading && sortedWebsites.length === 0) {
      return (
        <Grid container spacing={2}> {/* Reduced spacing */}
          {renderSkeletonCards()}
        </Grid>
      );
    }

    // Error state: Show error message
    if (error) {
      return (
        <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
          Error loading websites: {error.message}
        </Alert>
      );
    }

    // Empty state: Show prompt to add a website
    if (!sortedWebsites.length) {
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

    // Default state: Render the grid of website cards
    return (
      // Use Grid version 2 container
      <Grid container spacing={2}> {/* Reduced spacing */}
        {sortedWebsites.map((item) => (
          // Use Grid version 2 item with responsive sizing
          <Grid
            key={`website-${item.userWebsite.websiteId}`}
            xs={12} sm={6} md={4} lg={3} // Adjusted grid sizing for potentially 4 columns on larger screens
          >
            <WebsiteCard
              userWebsite={item.userWebsite}
              latestResult={item.latestResult}
              // Pass the recentResults array to the WebsiteCard
              results={item.recentResults || []} // Pass recent results, ensure it's an array
              // Loading prop can indicate if the parent is still loading/refetching
              loading={loading}
            />
          </Grid>
        ))}
      </Grid>
    );
  },
);

export default WebsiteGrid;