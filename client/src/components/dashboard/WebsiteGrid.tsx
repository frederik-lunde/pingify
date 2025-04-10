/*
src/components/dashboard/WebsiteGrid.tsx
*/
import React from "react";
import Grid from "@mui/material/Grid2"; // <-- Use Grid v2

import WebsiteCard from "./WebsiteCard";

// Removed ApiError import as error prop is removed
import { WebsiteUser, WebsiteWithResults } from "../../types"; // Adjust path if needed
// Removed useWebsiteData import as it's not used here

interface WebsiteGridProps {
  // Use the already sorted/filtered list from Dashboard
  websitesWithResults: WebsiteWithResults[];
  // Props for highlighting logic (passed down from Dashboard)
  lastIncidentWebsiteId?: number | null | undefined;
  isHighlightActive?: boolean; // Is the highlight feature currently active?
  // Loading state passed from parent to show skeletons if needed
  isLoading?: boolean;
}

/**
 * Grid component displaying website cards.
 * Assumes the incoming `websitesWithResults` prop is already sorted and filtered.
 * Handles highlighting based on props.
 * Parent component should handle primary loading/error/empty states.
 */
const WebsiteGrid: React.FC<WebsiteGridProps> = React.memo(
  ({
      websitesWithResults,
      lastIncidentWebsiteId,
      isHighlightActive = false,
      isLoading = false, // Default to false
  }) => {

    // Skeleton Rendering (only shown if isLoading is true and list is empty)
    const renderSkeletonCards = (count = 8) => {
       const dummyWebsiteUser: WebsiteUser = {
          id: -1, userId: -1, websiteId: -1, name: 'Loading website...',
          interval: 300, alertEnabled: false, alertThreshold: null,
          notifyEmail: null, createdAt: new Date().toISOString(), isPinned: false,
          latestResult: null, chartData: [], uptimePercent: 100,
          consecutiveFailures: 0, downtimeStartedAt: null,
          website: {
            id: -1, url: 'http://loading.com', isActive: true, lastChecked: null,
            globalInterval: 300, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          }
      };
      return Array(count).fill(0).map((_, i) => (
        // Use Grid v2 for skeletons as well
        <Grid key={`skeleton-${i}`} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <WebsiteCard
              userWebsite={dummyWebsiteUser}
              shouldHighlightThisCard={false}
          />
        </Grid>
      ));
    };


    // --- Render Logic ---
    // Show skeletons only if explicitly loading AND the list is currently empty
    if (isLoading && websitesWithResults.length === 0) {
      return <Grid container spacing={2} sx={{ pt: 2 }}>{renderSkeletonCards()}</Grid>;
    }

    // Parent component handles the main empty state message.
    // This component just renders the grid if there are items.
    if (!isLoading && websitesWithResults.length === 0) {
        // Return null or an empty fragment if the parent handles the "No results" message
        return null;
    }

    return (
      // Use Grid v2 container
      <Grid container spacing={2} sx={{ pt: 2 }}>
        {websitesWithResults.map((item) => {
           if (!item?.userWebsite) {
               console.warn("[WebsiteGrid] Skipping item due to missing userWebsite:", item);
               return null;
           }
           const shouldHighlight = isHighlightActive && item.userWebsite.websiteId === lastIncidentWebsiteId;

           return (
              // Use Grid v2 item with size prop
              <Grid
                key={`website-${item.userWebsite.websiteId}`}
                id={`website-card-grid-${item.userWebsite.websiteId}`}
                size={{ xs: 12, sm: 6, md: 4, lg: 3 }} // size prop for Grid v2
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