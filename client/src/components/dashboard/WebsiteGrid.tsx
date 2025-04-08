// client/src/components/dashboard/WebsiteGrid.tsx
import React from "react"; // Removed useMemo as it's no longer needed for sorting here
import { Box, Alert, Button, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2"; // Using MUI Grid v2
import WebsiteCard from "./WebsiteCard"; // Ensure this path is correct
import { Add as AddIcon } from "@mui/icons-material"; // Keep if needed for empty state
import { useNavigate } from "react-router";

// --- Import SHARED Types (Adjust path as needed) ---
import {
    ApiError,
    WebsiteUser, // This type is nested within WebsiteWithResults
} from "../../types"; // Adjust path to your shared types file

// --- Import Hook-specific Type (Adjust path as needed) ---
// Use the type directly returned by the domain hook
import { WebsiteWithResults } from "../../hooks/domain/useWebsiteData"; // Adjust path if needed


interface WebsiteGridProps {
  // Use the correct type from the domain hook
  // This prop should now contain the pre-sorted and pre-filtered list from Dashboard
  websitesWithResults: WebsiteWithResults[];
  loading?: boolean; // Loading state for the overall grid data fetch
  error?: ApiError | null; // Uses the shared ApiError type
}

/**
 * A grid component that displays website cards using MUI Grid v2.
 * It expects the 'websitesWithResults' prop to be ALREADY SORTED AND FILTERED
 * by the parent component (e.g., Dashboard).
 */
const WebsiteGrid: React.FC<WebsiteGridProps> = React.memo(
  // Directly use the 'websitesWithResults' prop as the source list
  ({ websitesWithResults, loading = false, error = null }) => {
    const navigate = useNavigate();

    // --- REMOVED Internal Sorting Logic ---
    // The component now trusts the parent to provide a pre-sorted list
    // via the 'websitesWithResults' prop.
    // const sortedWebsites = useMemo(() => { ... }, [websitesWithResults]); // REMOVED

    // --- Skeleton Rendering ---
    // Renders placeholder cards while data is loading
    const renderSkeletonCards = (count = 8) => { // Default number of skeletons
      // Define dummy data structure matching WebsiteUser for skeleton props
      const dummyWebsiteUser: WebsiteUser = {
          id: -1, userId: -1, websiteId: -1, name: 'Loading website...',
          interval: null, alertEnabled: false, alertThreshold: null,
          notifyEmail: null, createdAt: new Date().toISOString(), isPinned: false,
          website: {
            id: -1, url: 'http://loading.com', isActive: true, lastChecked: null,
            globalInterval: 300, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          }
       };
      // Create an array of specified count and map to Grid items containing WebsiteCard skeletons
      return Array(count)
        .fill(0)
        .map((_, i) => (
          <Grid key={`skeleton-${i}`} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <WebsiteCard userWebsite={dummyWebsiteUser} results={[]} />
          </Grid>
        ));
    };

    // --- Event Handlers ---
    // Handler for the "Add Website" button in the empty state
    // Keep this function if the empty state below uses it
    const handleAddWebsite = () => {
      navigate("/add-website"); // Navigate to the add website page
    };

    // --- Render Logic ---

    // 1. Loading State
    // Show skeletons if loading is true and the received list is empty
    // (Parent component might pass loading=true even with filtered results)
    if (loading && websitesWithResults.length === 0) {
      return (
        // Grid container for skeletons, removed internal top padding (pt: 2)
        <Grid container spacing={2} sx={{}}>
          {renderSkeletonCards()}
        </Grid>
      );
    }

    // 2. Error State
    // Display an error alert if an error object is passed via props
    if (error) {
         // Safely extract error message
         const errorMessage = (error && typeof error === 'object' && 'message' in error)
            ? String(error.message)
            : 'An unknown error occurred';
         return (
            <Alert severity="error" sx={{ mt: 2, mb: 2 }}> {/* Standard margins */}
              Error loading websites: {errorMessage}
            </Alert>
          );
    }

    // 3. Empty State
    // Display this message if not loading and the final list (after parent filtering/sorting) is empty
    if (!loading && websitesWithResults.length === 0) {
        // Note: The parent Dashboard component might display a more specific
        // "No results match filter/sort" message. This block might only be
        // truly visible if the user has zero websites added initially.
         return (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: { xs: 2, sm: 4 }, borderRadius: 2, bgcolor: "background.paper", boxShadow: 1, textAlign: "center", mt: 3 }}>
              <Typography variant="h6" gutterBottom>No websites found</Typography>
              <Typography variant="body2" color="textSecondary" paragraph>Add your first website to start monitoring.</Typography>
              {/* Keep button here if desired only for initial empty state */}
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddWebsite} sx={{ mt: 2 }}>
                Add Website
              </Button>
            </Box>
          );
    }

    // 4. Render the actual website cards
    // Maps over the received 'websitesWithResults' prop (which is already sorted/filtered)
    return (
      // Grid container for the website cards, removed internal top padding (pt: 2)
      <Grid container spacing={2} sx={{}}>
        {/* --- Directly map over the 'websitesWithResults' prop --- */}
        {websitesWithResults.map((item) => {
           // Safety check: Ensure item and nested userWebsite exist before rendering
           if (!item?.userWebsite) {
               console.warn("[WebsiteGrid] Skipping rendering item due to missing userWebsite data:", item);
               return null; // Don't render anything for this invalid item
           }
           // Render a Grid item for each valid website result
           return (
              <Grid
                // Use a stable and unique key, websiteId is suitable
                key={`website-${item.userWebsite.websiteId}`}
                // Define responsive grid sizing
                size={{ xs: 12, sm: 6, md: 4, lg: 3 }}
              >
                {/* Render the WebsiteCard component, passing necessary data */}
                <WebsiteCard
                  userWebsite={item.userWebsite} // Contains user settings, name, pin status, nested website URL
                  latestResult={item.latestResult} // The most recent monitoring check result
                  results={item.recentResults || []} // Array of recent results (used for sparkline/history)
                />
              </Grid>
           );
        })}
      </Grid>
    );
  },
);

// Set display name for React DevTools
WebsiteGrid.displayName = 'WebsiteGrid';

export default WebsiteGrid;