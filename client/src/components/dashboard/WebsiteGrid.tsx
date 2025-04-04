// client/src/components/dashboard/WebsiteGrid.tsx
import React, { useMemo } from "react";
import { Box, Alert, Button, Typography, Skeleton } from "@mui/material";
import Grid from "@mui/material/Grid2"; // Using Grid2 (already imported correctly)
import WebsiteCard from "./WebsiteCard";
import { WebsiteWithResults } from "../../hooks/domain/useWebsiteData";
import { Add as AddIcon } from "@mui/icons-material";
import { useNavigate } from "react-router";
import { ApiError } from "../../types";

interface WebsiteGridProps {
  websitesWithResults: WebsiteWithResults[];
  loading?: boolean;
  error?: ApiError | null;
}

/**
 * A grid component that displays website cards using MUI Grid v2.
 * Receives processed data including recent results for each card.
 */
const WebsiteGrid: React.FC<WebsiteGridProps> = React.memo(
  ({ websitesWithResults, loading = false, error = null }) => {
    const navigate = useNavigate();

    const sortedWebsites = useMemo(() => {
      if (!websitesWithResults?.length) return [];
      return [...websitesWithResults].sort((a, b) => {
        const aStatus = a.latestResult?.isAvailable ?? true;
        const bStatus = b.latestResult?.isAvailable ?? true;
        if (aStatus !== bStatus) {
          return aStatus ? 1 : -1;
        }
        return a.userWebsite.name.localeCompare(b.userWebsite.name);
      });
    }, [websitesWithResults]);

    const renderSkeletonCards = (count = 4) => {
      return Array(count)
        .fill(0)
        .map((_, i) => (
          // Use Grid v2 size prop syntax
          <Grid key={`skeleton-${i}`} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
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

    const handleAddWebsite = () => {
      navigate("/add-website");
    };

    // --- Render Logic ---

    if (loading && sortedWebsites.length === 0) {
      return (
        // Grid v2 container props (container, spacing) are valid
        <Grid container spacing={2}>
          {renderSkeletonCards()}
        </Grid>
      );
    }

    if (error) {
      return (
        <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
          Error loading websites: {error.message}
        </Alert>
      );
    }

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

    return (
      // Grid v2 container props (container, spacing) are valid
      <Grid container spacing={2}>
        {sortedWebsites.map((item) => (
          // Use Grid v2 size prop syntax
          <Grid
            key={`website-${item.userWebsite.websiteId}`}
            size={{ xs: 12, sm: 6, md: 4, lg: 3 }} // Updated size prop
          >
            <WebsiteCard
              userWebsite={item.userWebsite}
              latestResult={item.latestResult}
              results={item.recentResults || []}
              loading={loading}
            />
          </Grid>
        ))}
      </Grid>
    );
  },
);

export default WebsiteGrid;