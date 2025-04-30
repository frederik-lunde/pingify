// src/components/dashboard/WebsiteGrid.tsx
import React from "react";
import Grid from "@mui/material/Grid2";
import { Box } from "@mui/material";
import WebsiteCard from "./WebsiteCard";
import { WebsiteUser } from "../../types"; // Ensure correct path

interface WebsiteGridProps {
  websiteCards: WebsiteUser[];
  lastIncidentWebsiteId?: number | null | undefined;
  isHighlightActive?: boolean;
  isLoading?: boolean; // For skeleton cards on initial load
  isTvMode: boolean;
  // isRefetching prop is NOT included here as per Option 1 implementation
}

const WebsiteGrid: React.FC<WebsiteGridProps> = React.memo(
  ({
      websiteCards,
      lastIncidentWebsiteId,
      isHighlightActive = false,
      isLoading = false, // Corresponds to initial load state
      isTvMode,
      // isRefetching prop is NOT included here
  }) => {

    const gridItemSize = { xs: 12, sm: 6, md: 4, lg: 3, xl: 2.4 };

    // Skeleton generation logic
    const renderSkeletonCards = (count = 12) => {
       const dummyWebsiteUser: WebsiteUser = {
          id: -1, userId: "-1", websiteId: -1, name: 'Loading website...',
          interval: 300, alertEnabled: false, alertThreshold: null,
          notifyEmail: null, createdAt: new Date().toISOString(), isPinned: false,
          latestResult: null, chartData: [], uptimePercent: 100, currentIncident: null,
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
    if (isLoading && websiteCards.length === 0) {
      return (
            <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: 'repeat(auto-fill, minmax(325px, 1fr))',
                  pt: 2,
                }}
            >
               {renderSkeletonCards()}
            </Box>
       );
    }

    if (!isLoading && websiteCards.length === 0) {
      
        return null;
    }

    // Render the actual grid of website cards
    return (
      <Box
        sx={{
          display: 'grid',
          gap: 2, // Spacing between cards
          gridTemplateColumns: 'repeat(auto-fill, minmax(325px, 1fr))', // Responsive columns
          pt: 2, // Padding top for spacing below header
        }}
      >
        {websiteCards.map((item) => {
          // Ensure item is valid before rendering
          if (!item) return null;
          const shouldHighlight = isHighlightActive && item.websiteId === lastIncidentWebsiteId;

          return (
            // Each card is wrapped in a Box to be a grid item
            <Box
              key={`website-${item.websiteId}`}
              id={`website-card-grid-${item.websiteId}`} // ID for scrolling/highlighting
              sx={{ width: '100%' }} // Ensure card takes full width of grid cell
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