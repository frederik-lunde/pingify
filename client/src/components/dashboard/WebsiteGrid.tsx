// src/components/dashboard/WebsiteGrid.tsx
// Updated version: Removed internal sorting, accepts highlight props

import React from "react";
//
import { Box, Alert, Typography } from "@mui/material";
//
import Grid from "@mui/material/Grid2"; // Using MUI Grid v2
//
import WebsiteCard from "./WebsiteCard";
//
//
//
import { ApiError, WebsiteUser } from "../../types"; // Adjust path if needed
//
import { WebsiteWithResults } from "../../hooks/domain/useWebsiteData"; // Adjust path if needed

interface WebsiteGridProps {
  // Use the already sorted/filtered list from Dashboard
  websitesWithResults: WebsiteWithResults[];
  //
  loading?: boolean;
  //
  error?: ApiError | null;
  //
  // Props for highlighting logic (passed down from Dashboard)
  lastIncidentWebsiteId?: number | null | undefined;
  //
  isHighlightActive?: boolean; // Is the highlight feature currently active?
}

/**
 * Grid component displaying website cards.
 * Assumes the incoming `websitesWithResults` prop is already sorted and filtered.
 * Handles highlighting based on props.
 */
const WebsiteGrid: React.FC<WebsiteGridProps> = React.memo(
  ({
      websitesWithResults, // This list is now pre-sorted/filtered
      //
      loading = false,
      //
      error = null,
      //
      lastIncidentWebsiteId,
      //
      isHighlightActive = false // Default highlight state
  }) => {
    //

    // --- REMOVED SORTING LOGIC ---
    // Sorting is now handled in the parent Dashboard component based on user selection.
    // We directly use the `websitesWithResults` prop now.

    // Skeleton Rendering (ensure dummy data has fields used by card)
    const renderSkeletonCards = (count = 8) => { // Increased default skeleton count
       const dummyWebsiteUser: WebsiteUser = {
          id: -1, userId: -1, websiteId: -1, name: 'Loading website...',
          //
          interval: null, alertEnabled: false, alertThreshold: null,
          //
          notifyEmail: null, createdAt: new Date().toISOString(), isPinned: false,
          //
          consecutiveFailures: 0, downtimeStartedAt: null,
          //
          website: {
            id: -1, url: 'http://loading.com', isActive: true, lastChecked: null,
            //
            globalInterval: 300, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            //
          }
      };
      //
      return Array(count).fill(0).map((_, i) => (
        <Grid key={`skeleton-${i}`} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <WebsiteCard
              userWebsite={dummyWebsiteUser}
              //
              results={[]}
              //
              shouldHighlightThisCard={false} // Skeletons are never highlighted
              //
          />
        </Grid>
      ));
    };
    //

    //

    // --- Render Logic ---
    // Use websitesWithResults directly as it's already sorted/filtered
    if (loading && websitesWithResults.length === 0) {
      return <Grid container spacing={2} sx={{ pt: 2 }}>{renderSkeletonCards()}</Grid>;
      //
    }
    //

    if (error) {
         const errorMessage = (error?.message) ?? 'An unknown error occurred';
         //
         return <Alert severity="error" sx={{ mt: 2, mb: 2 }}>Error loading websites: {errorMessage}</Alert>;
         //
    }
    //

    // Check the length of the *passed-in* (already filtered/sorted) list
    if (!loading && websitesWithResults.length === 0) {
        // Note: The message for "no results matching filter" or "no websites added yet"
        // is handled more specifically in Dashboard.tsx.
        // This is a fallback for cases where the Dashboard logic might not cover it.
         return (
             <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: { xs: 2, sm: 4 }, borderRadius: 2, bgcolor: "background.paper", boxShadow: 1, textAlign: "center", mt: 3 }}>
               <Typography variant="h6" gutterBottom>No websites to display</Typography>
               <Typography variant="body2" color="textSecondary" paragraph>Either no websites have been added, or the current filter/sort yielded no results.</Typography>
               {/* Consider removing button if Dashboard handles the "add first website" case */}
               {/* <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddWebsite} sx={{ mt: 2 }}>Add Website</Button> */}
             </Box>
           );
           //
    }
    //

    return (
      <Grid container spacing={2} sx={{ pt: 2 }}>
        {/* Iterate over the pre-sorted/filtered list */}
        {websitesWithResults.map((item) => {
           if (!item?.userWebsite) {
               console.warn("[WebsiteGrid] Skipping item due to missing userWebsite:", item);
               //
               return null;
               //
           }
           // Calculate if *this specific card* should be highlighted
           const shouldHighlight = isHighlightActive && item.userWebsite.websiteId === lastIncidentWebsiteId;
           //

           return (
              // Add the unique ID to the Grid item for scrolling
              <Grid
                // Use a stable and unique key
                key={`website-${item.userWebsite.websiteId}`}
                //
                id={`website-card-grid-${item.userWebsite.websiteId}`} // ID for scrolling
                //
                size={{ xs: 12, sm: 6, md: 4, lg: 3 }}
                //
              >
                <WebsiteCard
                  userWebsite={item.userWebsite}
                  //
                  latestResult={item.latestResult}
                  //
                  results={item.recentResults || []}
                  //
                  // Pass the boolean highlight flag down
                  shouldHighlightThisCard={shouldHighlight}
                  //
                />
              </Grid>
           );
           //
        })}
      </Grid>
    );
    //
  },
);

// Set display name for React DevTools
WebsiteGrid.displayName = 'WebsiteGrid';
//

export default WebsiteGrid;