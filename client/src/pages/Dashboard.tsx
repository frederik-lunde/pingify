/*
src/pages/Dashboard.tsx
*/
import React, { useMemo, useState, useCallback, useEffect } from "react"; // Added useState, useCallback, useEffect
import { Container, Box, CircularProgress, Typography, Button, Alert, Paper } from "@mui/material";
// src/pages/Dashboard.tsx
import { useNavigate } from "react-router";
import {
    IconButton, // Import IconButton
    Menu,       // Import Menu
    MenuItem,   // Import MenuItem
    Tooltip,    // Import Tooltip
    ListItemIcon, // For icons in menu
    ListItemText // For text in menu
} from "@mui/material";

// --- Icons ---
import FilterListIcon from '@mui/icons-material/FilterList'; // Filter icon for the sort button
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'; // Icon for Ascending sort
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'; // Icon for Descending sort
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha'; // Icon for Name sorting
// --- Add Icons for Focus Mode Toggle ---
import ViewCompactOutlinedIcon from '@mui/icons-material/ViewCompactOutlined'; // Icon for entering focus mode
import ViewAgendaOutlinedIcon from '@mui/icons-material/ViewAgendaOutlined'; // Icon for exiting focus mode (showing full view)


// --- Component Imports ---
import WebsiteGrid from "../components/dashboard/WebsiteGrid"; // Adjust path if needed
import DashboardSearchFilter from "../components/dashboard/DashboardSearchFilter"; // Adjust path if needed
import StatsHeader from "../components/dashboard/StatsHeader"; // Adjust path if needed

// --- Hook Imports ---
import { useWebsiteData } from "../hooks/domain/useWebsiteData"; // Adjust path if needed
// *** Import useFocusMode hook ***
import { useFocusMode } from "../context/FocusModeContext"; // Adjust path as needed

// --- Type Imports ---
// Import WebsiteWithDetails for explicit typing in sort function if desired (Optional)
// import { WebsiteWithDetails } from "../hooks/domain/useWebsiteData"; // Adjust path if needed
// import { ApiError } from '../types'; // Uncomment if ApiError is used directly

// --- Define Sort Options ---
// Type definition for the possible sort option values
type SortOption =
    | 'name-asc'      // Sort by name A-Z
    | 'name-desc'     // Sort by name Z-A
    | 'response-asc'  // Sort by response time (fastest first)
    | 'response-desc'; // Sort by response time (slowest first)

// Interface describing the structure for configuring each sort option in the menu
interface SortOptionConfig {
    value: SortOption;          // The internal value representing the sort option
    label: string;              // The user-visible text label for the menu item
    icon: React.ReactElement;   // The icon to display next to the label in the menu
}

// Configuration array for the sort menu items (Default option removed)
const sortOptionsConfig: SortOptionConfig[] = [
    { value: 'name-asc', label: 'Name (A-Z)', icon: <SortByAlphaIcon fontSize="small" /> },
    // Icon flipped vertically for Z-A sorting representation
    { value: 'name-desc', label: 'Name (Z-A)', icon: <SortByAlphaIcon fontSize="small" sx={{ transform: 'scaleY(-1)'}}/> },
    { value: 'response-asc', label: 'Response Time (Fastest)', icon: <ArrowUpwardIcon fontSize="small" /> },
    { value: 'response-desc', label: 'Response Time (Slowest)', icon: <ArrowDownwardIcon fontSize="small" /> },
];
// --- End Sort Options ---

const Dashboard: React.FC = () => {
  const {
    websitesWithResults,
    overallStats,
    incidentsLast24h,
    lastIncidentTimestamp,
    lastIncidentWebsiteId, // This ID determines *which* card to highlight
    isLoading: isLoadingData,
    error: dataError,
    refetch,
    totalWebsitesCount,
    upWebsitesCount,
  } = useWebsiteData(
      undefined,
      'week',
      60000
  );

  // --- State for Highlight Toggle ---
  const [isHighlightActive, setIsHighlightActive] = useState(false);

  // Memoize uptime
  const uptime = useMemo(() => {
      return overallStats?.overallUptime ?? null;
  }, [overallStats]);
    const navigate = useNavigate(); // Hook for programmatic navigation

    // --- State Definitions ---
    // Local state for the search filter text
    const [filterTerm, setFilterTerm] = useState<string>('');
    // Local state for the sort menu's anchor element
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    // Local state for the selected sort option
    const [sortOption, setSortOption] = useState<SortOption>('name-asc');
    // --- Use Focus Mode state and toggle function from Context ---
    // Gets the current focus mode state and the function to toggle it from the global context
    const { isFocusMode, toggleFocusMode } = useFocusMode();

    // Derived boolean state indicating if the sort menu is currently open
    const open = Boolean(anchorEl);

    // --- Data Fetching Hook ---
    // Fetches all necessary dashboard data using the custom domain hook
    const {
        websitesWithResults: allWebsites, // Complete list of user's websites with their results
        overallStats,                     // Aggregate statistics (e.g., overall uptime)
        incidentsLast24h,                 // Count of incidents in the last 24 hours
        isLoading: isLoadingData,         // Loading state for the initial data fetch
        error: dataError,                 // Error object if fetching failed
        refetch,                          // Function to manually refetch data
        totalWebsitesCount,               // Total number of websites monitored by the user
        upWebsitesCount,                  // Number of websites currently considered "up"
    } = useWebsiteData(
        undefined, // Use the hook's default limit for recent results per website
        'week',    // Calculate statistics over a 'week' timeframe
        60000      // Automatically refetch data every 60 seconds
    );

    // --- Callback Handlers ---
    // Updates the filterTerm state when the search input changes (debounced)
    const handleFilterChange = useCallback((term: string) => {
        setFilterTerm(term.toLowerCase()); // Store as lowercase for case-insensitivity
    }, []); // Stable function reference

    // Opens the sort menu when the sort button is clicked
    const handleSortMenuClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget); // Set the button as the anchor
    }, []); // Stable function reference

    // Closes the sort menu
    const handleSortMenuClose = useCallback(() => {
        setAnchorEl(null); // Clear the anchor
    }, []); // Stable function reference

    // Updates the selected sort option and closes the menu
    const handleSortOptionSelect = useCallback((option: SortOption) => {
        setSortOption(option); // Update state
        handleSortMenuClose(); // Close the menu
    }, [handleSortMenuClose]); // Depends on handleSortMenuClose

    // Note: toggleFocusMode is now directly used from the useFocusMode hook context

    // --- Memoized Calculations ---

    // Memoized filtering: Filters 'allWebsites' based on 'filterTerm'
    const filteredWebsites = useMemo(() => {
        if (!filterTerm) return allWebsites; // Skip filtering if term is empty
        // Filter logic checks if term is included in name or URL
        return allWebsites.filter(item => {
            if (!item?.userWebsite) return false; // Basic data integrity check
            const name = item.userWebsite.name?.toLowerCase() || '';
            const url = item.userWebsite.website?.url?.toLowerCase() || '';
            return name.includes(filterTerm) || url.includes(filterTerm);
        });
    }, [allWebsites, filterTerm]); // Recalculate only when allWebsites or filterTerm changes

    // Memoized sorting: Sorts the 'filteredWebsites' based on 'sortOption'
    const sortedAndFilteredWebsites = useMemo(() => {
        const websitesToSort = [...filteredWebsites]; // Create a shallow copy to sort
        // Sort the array based on primary (Pin, Status) and secondary (selected option) criteria
        websitesToSort.sort((a, b) => { // Types are inferred from websitesToSort
            // --- Primary Sorting Rules (Applied First) ---
            if (!a?.userWebsite || !b?.userWebsite) return 0; // Safety check
            // 1. Pinned sites first
            if (a.userWebsite.isPinned !== b.userWebsite.isPinned) {
                return a.userWebsite.isPinned ? -1 : 1; // Pinned (-1) comes before not pinned (1)
            }
            // 2. Down sites first
            const aIsAvailable = a.latestResult?.isAvailable ?? true; // Treat unknown as available
            const bIsAvailable = b.latestResult?.isAvailable ?? true;
            if (aIsAvailable !== bIsAvailable) {
                return aIsAvailable ? 1 : -1; // Down (false, -1) comes before up (true, 1)
            }

            // --- Secondary Sorting Rules (Applied if primary rules are equal) ---
            switch (sortOption) {
                case 'name-asc': // Default secondary sort
                    { const nameA_asc = a.userWebsite.name ?? a.userWebsite.website?.url ?? '';
                    const nameB_asc = b.userWebsite.name ?? b.userWebsite.website?.url ?? '';
                    return nameA_asc.localeCompare(nameB_asc); } // Lexicographical compare A-Z

                case 'name-desc':
                    { const nameA_desc = a.userWebsite.name ?? a.userWebsite.website?.url ?? '';
                    const nameB_desc = b.userWebsite.name ?? b.userWebsite.website?.url ?? '';
                    return nameB_desc.localeCompare(nameA_desc); } // Reversed compare Z-A

                case 'response-asc': // Fastest first
                    { const respA_asc = a.latestResult?.responseTime ?? Infinity; // Place nulls (Infinity) last
                    const respB_asc = b.latestResult?.responseTime ?? Infinity;
                    return respA_asc - respB_asc; } // Numeric ascending sort

                case 'response-desc': // Slowest first
                    { const respA_desc = a.latestResult?.responseTime ?? Infinity; // Place nulls (Infinity) first
                    const respB_desc = b.latestResult?.responseTime ?? Infinity;
                    return respB_desc - respA_desc; } // Numeric descending sort

                default:
                    // This case should not be hit with the current setup, but good practice
                    console.warn("Unhandled sort option in Dashboard:", sortOption);
                    return 0; // Maintain original order if option is unknown
            }
        });
        return websitesToSort; // Return the sorted list
    }, [filteredWebsites, sortOption]); // Recalculate when filtered list or sort option changes

    // Memoize stats specifically needed only by the header
    const otherStatsValues = useMemo(() => ({
        uptime: overallStats?.overallUptime ?? null, // Extract overall uptime
    }), [overallStats]); // Recalculate only when overallStats data changes

  // --- Callback to Toggle Highlight and Scroll ---
  const handleToggleHighlight = useCallback(() => {
      const shouldActivate = !isHighlightActive; // Determine target state *before* updating
      setIsHighlightActive(shouldActivate);

      // Scroll only when activating the highlight AND we have an ID
      if (shouldActivate && lastIncidentWebsiteId) {
          // Use setTimeout to allow state update and DOM rerender
          setTimeout(() => {
              const elementId = `website-card-grid-${lastIncidentWebsiteId}`;
              const element = document.getElementById(elementId);
              if (element) {
                  element.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start', // Align top of card with top of viewport
                      inline: 'nearest'
                  });
                  console.log(`Scrolling to ${elementId}`);
              } else {
                  console.warn(`Element with ID ${elementId} not found for scrolling.`);
              }
          }, 100); // Small delay often helps ensure element is ready
      }
  }, [isHighlightActive, lastIncidentWebsiteId]); // Dependencies

   // Reset highlight if the last incident changes (e.g., after data refetch)
   useEffect(() => {
       setIsHighlightActive(false);
   }, [lastIncidentWebsiteId]);

  // --- Render Logic ---
    // --- Render Logic ---

  if (isLoadingData && websitesWithResults.length === 0 && !overallStats) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh"><CircularProgress /></Box>;
  }
    // 1. Initial Loading State: Show spinner if essential data isn't loaded yet
    if (isLoadingData && allWebsites.length === 0 && !overallStats) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
                <CircularProgress />
            </Box>
        );
    }

  if (dataError && websitesWithResults.length === 0 && !overallStats) {
      return (
           <Container maxWidth="lg" sx={{ mt: 4 }}>
               <Typography color="error">Error loading dashboard data: {dataError.message}</Typography>
               <Button onClick={() => refetch()} sx={{ mt: 1 }}>Retry</Button>
           </Container>
       );
  }
    // 2. Global Error State: Show error if initial fetch failed completely
    if (dataError && allWebsites.length === 0 && !overallStats) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
                <Alert severity="error" sx={{ mb: 2 }}>
                    Error loading dashboard data: {dataError.message || 'Unknown error'}
                </Alert>
                <Button variant="outlined" onClick={() => refetch()} sx={{ mt: 1 }}>
                    Retry
                </Button>
            </Container>
        );
    }

  return (
    <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2 }, mt: 2, mb: 4 }}>
      <Paper elevation={1} sx={{ mb: 2, overflow: 'hidden' }}>
        <StatsHeader
            isLoading={isLoadingData && !overallStats}
            error={dataError}
            upCount={upWebsitesCount}
            totalCount={totalWebsitesCount}
            uptime={uptime}
            incidentsLast24h={incidentsLast24h}
            lastIncidentTimestamp={lastIncidentTimestamp}
            // Pass the ID and the toggle function
            lastIncidentWebsiteId={lastIncidentWebsiteId}
            onToggleHighlight={handleToggleHighlight} // Pass the callback
            isHighlightActive={isHighlightActive} // Pass current state for visual feedback if needed
            center={false}
        />
      </Paper>

      {dataError && (websitesWithResults.length > 0 || overallStats) && (
          <Alert severity="warning" sx={{ mb: 2 }}>
              There might be issues displaying the latest data: {dataError.message}.
              <Button onClick={() => refetch()} size="small" sx={{ ml: 1 }}>Retry</Button>
          </Alert>
      )}
    // 3. Main Dashboard Layout
    return (
        // Main container controlling max width and padding
        <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2 }, mt: 2, mb: 4 }}>

            {/* Statistics Header Section - Conditionally Rendered based on Focus Mode */}
            {!isFocusMode && ( // Only render if focus mode is OFF
                <Paper elevation={1} sx={{ mb: 2, overflow: 'hidden' }}>
                    <StatsHeader
                        isLoading={isLoadingData && !overallStats}
                        error={dataError}
                        upCount={upWebsitesCount}
                        totalCount={totalWebsitesCount}
                        uptime={otherStatsValues.uptime}
                        incidentsLast24h={incidentsLast24h}
                        center={false} // Use dashboard-specific layout
                    />
                </Paper>
            )}

            {/* Search and Filter Controls Row */}
            <Box sx={{
                display: 'flex',         // Arrange controls in a row
                alignItems: 'center',    // Align vertically centered
                // justifyContent: 'flex-start', // Align group to the start (left) - Remove this for centering attempt
                gap: 1,                  // Space between controls
                mb: 2,                   // Margin below this row
                flexWrap: 'wrap'         // Allow controls to wrap onto next line if needed
            }}>
                 {/* Focus Mode Toggle Button */}
                 <Tooltip title={isFocusMode ? "Show Full Dashboard" : "Focus Mode (Hide Stats)"}>
                     {/* Button calls the toggle function from context */}
                     <IconButton onClick={toggleFocusMode} color="default" aria-label="toggle focus mode">
                         {/* Icon changes based on the focus mode state */}
                         {isFocusMode ? <ViewAgendaOutlinedIcon /> : <ViewCompactOutlinedIcon />}
                     </IconButton>
                 </Tooltip>

                 {/* Centering Wrapper for Search Bar */}
                 <Box sx={{
                    flexGrow: 1, // Allows this box to take up the available space
                    display: 'flex',
                    justifyContent: 'center', // Center the content (the SearchFilter) within this box
                    mx: 1 // Add some horizontal margin for spacing from buttons
                 }}>
                    {/* Search Input Component */}
                    <DashboardSearchFilter
                        onFilterChange={handleFilterChange}
                        // Control the width of the search bar itself
                        sx={{ maxWidth: { xs: '100%', sm: 450 }, width: '100%' }} // Ensure it can take full width up to maxWidth
                    />
                 </Box>

                 {/* Sort Button (No need for ml:auto wrapper now) */}
                <Tooltip title="Sort websites">
                    <IconButton
                        id="sort-button"
                        aria-controls={open ? 'sort-menu' : undefined}
                        aria-haspopup="true"
                        aria-expanded={open ? 'true' : undefined}
                        onClick={handleSortMenuClick} // Opens the menu
                        color="primary"
                    >
                        <FilterListIcon />
                    </IconButton>
                </Tooltip>

                {/* Sort Options Menu (Positioned relative to anchorEl - Sort Button) */}
                <Menu
                    id="sort-menu"
                    anchorEl={anchorEl} // Anchored to the sort button when open
                    open={open} // Controlled by state
                    onClose={handleSortMenuClose} // Closes when clicking outside
                    MenuListProps={{ 'aria-labelledby': 'sort-button' }} // Accessibility link
                    // Position menu below and aligned to the right of the button
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    {/* Create menu items dynamically */}
                    {sortOptionsConfig.map((option) => (
                        <MenuItem
                            key={option.value}
                            selected={option.value === sortOption} // Highlight current selection
                            onClick={() => handleSortOptionSelect(option.value)} // Set state on click
                        >
                             <ListItemIcon sx={{ minWidth: '36px' }}>{option.icon}</ListItemIcon>
                            <ListItemText primary={option.label} />
                        </MenuItem>
                    ))}
                </Menu>
            </Box>

            {/* Alert for Partial Errors during Refetch - Conditionally Rendered */}
            {!isFocusMode && dataError && (allWebsites.length > 0 || overallStats) && ( // Only show if not in focus mode
                <Alert severity="warning" sx={{ mb: 2 }}> {/* Consistent margin */}
                    There might be issues displaying the latest data: {dataError.message}.
                    <Button onClick={() => refetch()} size="small" sx={{ ml: 1 }}>Retry</Button>
                </Alert>
            )}

      <WebsiteGrid
        websitesWithResults={websitesWithResults}
        loading={isLoadingData && websitesWithResults.length === 0}
        error={null}
        // Pass down the necessary info for highlighting
        lastIncidentWebsiteId={lastIncidentWebsiteId}
        isHighlightActive={isHighlightActive}
      />
    </Container>
  );
            {/* Website Grid Component - Always Rendered */}
            <WebsiteGrid
                // Pass the final list after filtering and sorting
                websitesWithResults={sortedAndFilteredWebsites}
                // Adjust loading state display based on context
                loading={isLoadingData && sortedAndFilteredWebsites.length === 0 && (!!filterTerm || sortOption !== 'name-asc')}
                error={null} // Grid itself doesn't need the main fetch error
            />

            {/* Message: Filter/Sort yields no results */}
            {/* Shown if not loading, list is empty, AND a filter/non-default-sort is active */}
            {!isLoadingData && sortedAndFilteredWebsites.length === 0 && (!!filterTerm || sortOption !== 'name-asc') && (
                <Typography sx={{ textAlign: 'center', mt: 4, color: 'text.secondary' }}>
                    No websites match your current filter or sort criteria.
                </Typography>
            )}

            {/* Message: No websites added yet */}
            {/* Shown if not loading, initial data empty, AND no filter/sort active */}
             {!isLoadingData && allWebsites.length === 0 && !filterTerm && sortOption === 'name-asc' && !dataError && (
                 <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: { xs: 2, sm: 4 }, borderRadius: 2, bgcolor: "background.paper", boxShadow: 1, textAlign: "center", mt: 3 }}>
                     <Typography variant="h6" gutterBottom>No websites added yet</Typography>
                     <Typography variant="body2" color="textSecondary" paragraph>Add your first website to start monitoring.</Typography>
                     {/* Optional "Add" button can be placed here for the absolute empty state */}
                     {/* <Button variant="contained" onClick={() => navigate("/add-website")} sx={{ mt: 2 }}>Add Your First Website</Button> */}
                 </Box>
             )}

        </Container>
    );
};

export default Dashboard;