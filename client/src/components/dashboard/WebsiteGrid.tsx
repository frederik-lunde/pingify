// client/src/components/dashboard/WebsiteGrid.tsx
import React, { useMemo } from "react";
import { Box, Alert, Button, Typography, Skeleton } from "@mui/material";
import Grid from "@mui/material/Grid2"; // Using Grid2 as in your project
import WebsiteCard from "./WebsiteCard";
import { WebsiteWithResult } from "../../hooks/domain/useWebsiteData";
import { Add as AddIcon } from "@mui/icons-material";
import { useNavigate } from "react-router";

interface WebsiteGridProps {
  websitesWithLatestResults: WebsiteWithResult[];
  loading?: boolean;
  error?: Error | null;
}

/**
 * A grid component that displays website cards
 * Uses explicit data passing instead of hooks to make it more reusable
 */
const WebsiteGrid: React.FC<WebsiteGridProps> = React.memo(
  ({ websitesWithLatestResults, loading = false, error = null }) => {
    const navigate = useNavigate();

    // Memoize the sorted websites for better performance
    const sortedWebsites = useMemo(() => {
      if (!websitesWithLatestResults?.length) return [];

      // Sort by online status first (offline websites first), then by name
      return [...websitesWithLatestResults].sort((a, b) => {
        // First sort by status (offline websites first)
        const aStatus = a.latestResult?.isAvailable ?? true;
        const bStatus = b.latestResult?.isAvailable ?? true;

        if (aStatus !== bStatus) {
          return aStatus ? 1 : -1;
        }

        // Then by name
        return a.userWebsite.name.localeCompare(b.userWebsite.name);
      });
    }, [websitesWithLatestResults]);
    
    // Function to render skeleton cards during loading
    const renderSkeletonCards = () => {
      return Array(4)
        .fill(0)
        .map((_, i) => (
          <Grid key={`skeleton-${i}`} size={{ xs: 12, sm: 6, md: 3 }}>
            <Box
              sx={{
                height: "100%",
                bgcolor: "background.paper",
                borderRadius: 1,
                p: 2,
                boxShadow: 1,
              }}
            >
              <Skeleton variant="text" width="70%" height={28} />
              <Skeleton
                variant="text"
                width="90%"
                height={20}
                sx={{ mt: 1, mb: 2 }}
              />
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
                <Skeleton variant="rounded" width={80} height={24} />
                <Skeleton variant="rounded" width={60} height={24} />
                <Skeleton variant="rounded" width={70} height={24} />
              </Box>
              <Skeleton variant="rectangular" width="100%" height={100} />
            </Box>
          </Grid>
        ));
    };

    // Handle navigation to add website page
    const handleAddWebsite = () => {
      navigate("/add-website");
    };

    // Loading state
    if (loading && !sortedWebsites.length) {
      return (
        <Grid container spacing={3}>
          {renderSkeletonCards()}
        </Grid>
      );
    }

    // Error state
    if (error) {
      return (
        <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
          Error loading websites: {error.message}
        </Alert>
      );
    }

    // Empty state
    if (!sortedWebsites.length) {
      return (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            p: 4,
            borderRadius: 2,
            bgcolor: "background.paper",
            boxShadow: 1,
            textAlign: "center",
          }}
        >
          <Typography variant="h6" gutterBottom>
            No websites found
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Add your first website to start monitoring.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddWebsite}
            sx={{ mt: 2 }}
          >
            Add Website
          </Button>
        </Box>
      );
    }

    return (
      <Grid container spacing={3}>
        {sortedWebsites.map((item) => (
          <Grid
            key={`website-${item.userWebsite.websiteId}`}
            size={{ xs: 12, sm: 6, md: 3 }}
          >
            <WebsiteCard
              userWebsite={item.userWebsite}
              latestResult={item.latestResult}
              results={item.results || []}
              loading={loading}
            />
          </Grid>
        ))}
      </Grid>
    );
  },
);

export default WebsiteGrid;