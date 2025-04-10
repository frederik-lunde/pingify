/*
src/components/dashboard/WebsiteGrid.tsx
*/
import React from "react";
import Grid from "@mui/material/Grid2"; // Using Grid2
import WebsiteCard from "./WebsiteCard"; // Import the updated card
import { WebsiteUser, WebsiteWithResults } from "../../types"; // Import types

interface WebsiteGridProps {
  websitesWithResults: WebsiteWithResults[]; // Expects the array containing enriched WebsiteUser objects
  lastIncidentWebsiteId?: number | null | undefined; // ID for highlighting
  isHighlightActive?: boolean; // State for highlighting
  isLoading?: boolean; // Loading state for skeleton display
}

/**
 * Grid component displaying website cards.
 * Assumes the incoming `websitesWithResults` prop is already sorted and filtered.
 * Handles highlighting based on props.
 */
const WebsiteGrid: React.FC<WebsiteGridProps> = React.memo(
  ({
      websitesWithResults,
      lastIncidentWebsiteId,
      isHighlightActive = false,
      isLoading = false,
  }) => {

    // Define responsive grid item sizes - Using integer for xl
    const gridItemSize = { xs: 12, sm: 6, md: 4, lg: 3, xl: 3 }; // 4 cards per row on xl

    // --- Skeleton Card Rendering ---
    const renderSkeletonCards = (count = 12) => { // Render more skeletons to fill width potentially
       const dummyWebsiteUser: WebsiteUser = {
          id: -1, userId: -1, websiteId: -1, name: 'Loading website...',
          interval: 300, alertEnabled: false, alertThreshold: null,
          notifyEmail: null, createdAt: new Date().toISOString(), isPinned: false,
          latestResult: null, chartData: [], uptimePercent: undefined, currentIncident: null,
          website: { id: -1, url: 'http://loading.com', isActive: true, lastChecked: null, globalInterval: 300, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      };
      return Array(count).fill(0).map((_, i) => (
        // Add display: 'flex' to the Grid item
        <Grid key={`skeleton-${i}`} {...gridItemSize} display="flex">
          <WebsiteCard
              userWebsite={dummyWebsiteUser}
              shouldHighlightThisCard={false}
          />
        </Grid>
      ));
    };


    // --- Render Logic ---
    if (isLoading && websitesWithResults.length === 0) {
      // Ensure container takes full width even when loading
      return <Grid container spacing={2} sx={{ pt: 2, width: '100%' }}>{renderSkeletonCards()}</Grid>;
    }

    if (!isLoading && websitesWithResults.length === 0) {
        return null; // Parent component (Dashboard) handles the empty state message
    }

    // Render the actual website cards
    return (
      // Ensure container takes full width
      <Grid container spacing={2} sx={{ pt: 2, width: '100%' }}>
        {websitesWithResults.map((item) => {
           if (!item?.userWebsite) {
               console.warn("[WebsiteGrid] Skipping item due to missing userWebsite:", item);
               return null;
           }
           const shouldHighlight = isHighlightActive && item.userWebsite.websiteId === lastIncidentWebsiteId;

           return (
              // Add display: 'flex' to the Grid item to allow card height: 100% to work
              <Grid
                key={`website-${item.userWebsite.websiteId}`}
                id={`website-card-grid-${item.userWebsite.websiteId}`}
                {...gridItemSize}
                display="flex" // Make the grid item a flex container
              >
                <WebsiteCard
                  userWebsite={item.userWebsite}
                  shouldHighlightThisCard={shouldHighlight}
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