/*
src/components/dashboard/WebsiteGrid.tsx
*/
import React from "react";
import Grid from "@mui/material/Grid2";
import { Box } from "@mui/material";
import WebsiteCard from "./WebsiteCard";
// --- MODIFIED: Remove WebsiteWithResults ---
import { WebsiteUser } from "../../types";

interface WebsiteGridProps {
  // --- MODIFIED: Changed prop name and type ---
  websiteCards: WebsiteUser[];
  lastIncidentWebsiteId?: number | null | undefined;
  isHighlightActive?: boolean;
  isLoading?: boolean;
  isTvMode: boolean;
}

const WebsiteGrid: React.FC<WebsiteGridProps> = React.memo(
  ({
      // --- MODIFIED: Use websiteCards ---
      websiteCards,
      lastIncidentWebsiteId,
      isHighlightActive = false,
      isLoading = false,
      isTvMode,
  }) => {

    const gridItemSize = { xs: 12, sm: 6, md: 4, lg: 3, xl: 2.4 };

    const renderSkeletonCards = (count = 10) => {
       // Skeleton generation logic remains the same
       const dummyWebsiteUser: WebsiteUser = {
          id: -1, userId: "-1", websiteId: -1, name: 'Loading website...', // userId as string
          interval: 300, alertEnabled: false, alertThreshold: null,
          notifyEmail: null, createdAt: new Date().toISOString(), isPinned: false,
          latestResult: null, chartData: [], uptimePercent: 100, currentIncident: null, // Added currentIncident
          website: {
            id: -1, url: 'http://loading.com', isActive: true, lastChecked: null,
            globalInterval: 300, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          }
      };
      return Array(count).fill(0).map((_, i) => (
        <Grid key={`skeleton-${i}`} size={gridItemSize}>
          <WebsiteCard
              userWebsite={dummyWebsiteUser}
              shouldHighlightThisCard={false}
              isTvMode={false}
          />
        </Grid>
      ));
    };


    // --- Render Logic ---
    // --- MODIFIED: Check websiteCards.length ---
    if (isLoading && websiteCards.length === 0) {
      return <Grid container spacing={2} sx={{ pt: 2 }}>{renderSkeletonCards()}</Grid>;
    }

    // --- MODIFIED: Check websiteCards.length ---
    if (!isLoading && websiteCards.length === 0) {
        return null; // Or render an empty state component if preferred
    }

    return (
      <Box
    sx={{
      display: 'grid',
      gap: 2,
      gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
      pt: 2,
    }}
  >
    {websiteCards.map((item) => {
      if (!item) return null;
      const shouldHighlight = isHighlightActive && item.websiteId === lastIncidentWebsiteId;

      return (
        <Box
          key={`website-${item.websiteId}`}
          id={`website-card-grid-${item.websiteId}`}
          sx={{ width: '100%' }}
        >
          <WebsiteCard
            userWebsite={item}
            shouldHighlightThisCard={shouldHighlight}
            isTvMode={isTvMode}
          />
        </Box>
      );
    })}
  </Box>
    );
  },
);

WebsiteGrid.displayName = 'WebsiteGrid';

export default WebsiteGrid;