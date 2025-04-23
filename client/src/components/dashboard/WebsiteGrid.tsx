/*
src/components/dashboard/WebsiteGrid.tsx
*/
import React from "react";
import Grid from "@mui/material/Grid2";
import WebsiteCard from "./WebsiteCard";
import { WebsiteUser, WebsiteWithResults } from "../../types";

interface WebsiteGridProps {
  websitesWithResults: WebsiteWithResults[];
  lastIncidentWebsiteId?: number | null | undefined;
  isHighlightActive?: boolean;
  isLoading?: boolean;
  // Add isTvMode prop
  isTvMode: boolean;
}

const WebsiteGrid: React.FC<WebsiteGridProps> = React.memo(
  ({
      websitesWithResults,
      lastIncidentWebsiteId,
      isHighlightActive = false,
      isLoading = false,
      // Receive isTvMode prop
      isTvMode,
  }) => {

    const gridItemSize = { xs: 12, sm: 6, md: 4, lg: 3, xl: 2.4 };

    const renderSkeletonCards = (count = 10) => {
       const dummyWebsiteUser: WebsiteUser = {
          id: -1, userId: -1, websiteId: -1, name: 'Loading website...',
          interval: 300, alertEnabled: false, alertThreshold: null,
          notifyEmail: null, createdAt: new Date().toISOString(), isPinned: false,
          latestResult: null, chartData: [], uptimePercent: 100,
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
              // Pass default false for skeletons
              isTvMode={false}
          />
        </Grid>
      ));
    };


    // --- Render Logic ---
    if (isLoading && websitesWithResults.length === 0) {
      return <Grid container spacing={2} sx={{ pt: 2 }}>{renderSkeletonCards()}</Grid>;
    }

    if (!isLoading && websitesWithResults.length === 0) {
        return null;
    }

    return (
      <Grid container spacing={2} sx={{ pt: 2 }}>
        {websitesWithResults.map((item) => {
           if (!item?.userWebsite) {
               console.warn("[WebsiteGrid] Skipping item due to missing userWebsite:", item);
               return null;
           }
           const shouldHighlight = isHighlightActive && item.userWebsite.websiteId === lastIncidentWebsiteId;

           return (
              <Grid
                key={`website-${item.userWebsite.websiteId}`}
                id={`website-card-grid-${item.userWebsite.websiteId}`}
                size={gridItemSize}
              >
                <WebsiteCard
                  userWebsite={item.userWebsite}
                  shouldHighlightThisCard={shouldHighlight}
                  // Pass isTvMode down to each card
                  isTvMode={isTvMode}
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