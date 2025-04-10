/*
src/pages/Dashboard.tsx
*/
import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
    Container,
    Box,
    CircularProgress,
    Typography,
    Button,
    Alert,
    Paper,
    IconButton,
    Menu,
    MenuItem,
    Tooltip,
    ListItemIcon,
    ListItemText,
    Stack
} from "@mui/material";
import FilterListIcon from '@mui/icons-material/FilterList';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import ViewCompactOutlinedIcon from '@mui/icons-material/ViewCompactOutlined';
import ViewAgendaOutlinedIcon from '@mui/icons-material/ViewAgendaOutlined';
import WebsiteGrid from "../components/dashboard/WebsiteGrid";
import DashboardSearchFilter from "../components/dashboard/DashboardSearchFilter";
import StatsHeader from "../components/dashboard/StatsHeader";
import { useWebsiteData } from "../hooks";
import { useFocusMode } from "../context/FocusModeContext";
import { Link } from "react-router";
import { SortOption, WebsiteUser } from "../types";

// Define Sort Options Config
interface SortOptionConfig {
    value: SortOption;
    label: string;
    icon: React.ReactElement;
}

// Keep secondary sort options
const sortOptionsConfig: SortOptionConfig[] = [
    { value: 'name-asc', label: 'Name (A-Z)', icon: <SortByAlphaIcon fontSize="small" /> },
    { value: 'name-desc', label: 'Name (Z-A)', icon: <SortByAlphaIcon fontSize="small" sx={{ transform: 'scaleY(-1)'}}/> },
    { value: 'response-asc', label: 'Response Time (Fastest)', icon: <ArrowUpwardIcon fontSize="small" /> },
    { value: 'response-desc', label: 'Response Time (Slowest)', icon: <ArrowDownwardIcon fontSize="small" /> },
];

const Dashboard: React.FC = () => {
    // --- State ---
    const [filterTerm, setFilterTerm] = useState<string>('');
    const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);
    // Default secondary sort option
    const [sortOption, setSortOption] = useState<SortOption>('name-asc');
    const { isFocusMode, toggleFocusMode } = useFocusMode();
    const [isHighlightActive, setIsHighlightActive] = useState(false);


    // --- Data Fetching Hook ---
    const {
        websitesWithResults: allWebsites,
        overallStats,
        incidentsLast24h,
        lastIncidentTimestamp,
        lastIncidentWebsiteId,
        isLoading: isLoadingData,
        isFetching,
        error: dataError,
        refetch,
        totalWebsitesCount,
        upWebsitesCount,
    } = useWebsiteData(
        'week',
        60000
    );

    // --- Derived State ---
    const openSortMenu = Boolean(sortAnchorEl);

    // --- Callbacks ---
    const handleFilterChange = useCallback((term: string) => {
        setFilterTerm(term.toLowerCase());
        if (term) setIsHighlightActive(false);
    }, []);
    const handleSortMenuClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
        setSortAnchorEl(event.currentTarget);
    }, []);
    const handleSortMenuClose = useCallback(() => {
        setSortAnchorEl(null);
    }, []);
    const handleSortOptionSelect = useCallback((option: SortOption) => {
        setSortOption(option);
        handleSortMenuClose();
    }, [handleSortMenuClose]);
    const handleToggleHighlight = useCallback(() => {
        const shouldActivate = !isHighlightActive;
        setIsHighlightActive(shouldActivate);
        if (shouldActivate && lastIncidentWebsiteId) {
            setTimeout(() => {
                const element = document.getElementById(`website-card-grid-${lastIncidentWebsiteId}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 150);
        }
    }, [isHighlightActive, lastIncidentWebsiteId]);

    // --- Effects ---
    useEffect(() => {
        setIsHighlightActive(false);
    }, [lastIncidentWebsiteId, filterTerm]);

    // --- Memoized Calculations ---
    // Filter websites based on search term
    const filteredWebsites = useMemo(() => {
        if (!filterTerm) return allWebsites;
        return allWebsites.filter(item => {
            const name = item.userWebsite?.name?.toLowerCase() || '';
            const url = item.userWebsite?.website?.url?.toLowerCase() || '';
            return name.includes(filterTerm) || url.includes(filterTerm);
        });
    }, [allWebsites, filterTerm]);

    // Sort the filtered websites based on primary (status/pin) and secondary (user selection) keys
    const sortedAndFilteredWebsites = useMemo(() => {
        const listToSort = [...filteredWebsites]; // Create a mutable copy

        // Helper function to get the primary sort order value
        // Lower numbers sort first
        const getPrimarySortOrder = (wu: WebsiteUser): number => {
            const isPinned = wu.isPinned;
            const incidentType = wu.currentIncident?.type;

            if (isPinned) {
                if (incidentType === 'down') return 0; // Pinned + Down
                if (incidentType === 'slow') return 1; // Pinned + Slow
                return 2; // Pinned + Up/Pending
            } else {
                if (incidentType === 'down') return 3; // Not Pinned + Down
                if (incidentType === 'slow') return 4; // Not Pinned + Slow
                return 5; // Not Pinned + Up/Pending
            }
        };

        return listToSort.sort((a, b) => {
             // Handle potential missing data defensively
             if (!a?.userWebsite || !b?.userWebsite) return 0;
             const wuA = a.userWebsite;
             const wuB = b.userWebsite;

             // --- Primary Sort Key (Pinned + Status) ---
             const primaryOrderA = getPrimarySortOrder(wuA);
             const primaryOrderB = getPrimarySortOrder(wuB);

             if (primaryOrderA !== primaryOrderB) {
                 return primaryOrderA - primaryOrderB; // Sort by primary key first
             }

             // --- Secondary Sort Key (User Selected Option) - Applied if primary keys are equal ---
             switch (sortOption) {
                 case 'name-asc': {
                     const nameA = wuA.name ?? wuA.website?.url ?? '';
                     const nameB = wuB.name ?? wuB.website?.url ?? '';
                     return nameA.localeCompare(nameB);
                 }
                 case 'name-desc': {
                     const nameA = wuA.name ?? wuA.website?.url ?? '';
                     const nameB = wuB.name ?? wuB.website?.url ?? '';
                     return nameB.localeCompare(nameA);
                 }
                 case 'response-asc': {
                     // Treat null/unavailable response time as Infinity for ascending sort
                     const respA = wuA.latestResult?.isAvailable ? (wuA.latestResult?.responseTime ?? Infinity) : Infinity;
                     const respB = wuB.latestResult?.isAvailable ? (wuB.latestResult?.responseTime ?? Infinity) : Infinity;
                     // If both are Infinity (e.g., both down), use name as tie-breaker
                     if (respA === Infinity && respB === Infinity) {
                         const nameA = wuA.name ?? wuA.website?.url ?? '';
                         const nameB = wuB.name ?? wuB.website?.url ?? '';
                         return nameA.localeCompare(nameB);
                     }
                     return respA - respB;
                 }
                 case 'response-desc': {
                      // Treat null/unavailable response time as -1 for descending sort
                     const respA = wuA.latestResult?.isAvailable ? (wuA.latestResult?.responseTime ?? -1) : -1;
                     const respB = wuB.latestResult?.isAvailable ? (wuB.latestResult?.responseTime ?? -1) : -1;
                     // If both are -1 (e.g., both down), use name as tie-breaker
                     if (respA === -1 && respB === -1) {
                         const nameA = wuA.name ?? wuA.website?.url ?? '';
                         const nameB = wuB.name ?? wuB.website?.url ?? '';
                         return nameA.localeCompare(nameB);
                     }
                     return respB - respA;
                 }
                 default: return 0;
             }
        });
    }, [filteredWebsites, sortOption]); // Depend on filtered list and secondary sort option

    // Memoize stats needed specifically for the header
    const headerUptime = useMemo(() => overallStats?.overallUptime ?? null, [overallStats]);

    // --- Render Logic ---
    const showLoadingSkeleton = isLoadingData && sortedAndFilteredWebsites.length === 0;
    const isListEmpty = !isLoadingData && sortedAndFilteredWebsites.length === 0;
    const isEmptyDueToFilter = isListEmpty && !!filterTerm && allWebsites.length > 0;
    const isEmptyBecauseNoWebsites = isListEmpty && !filterTerm && !dataError;

    // --- Initial Loading State ---
    if (isLoadingData && !overallStats && allWebsites.length === 0 && !dataError) {
        return <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh"><CircularProgress /></Box>;
    }

    // --- Initial Error State ---
    if (dataError && !overallStats && allWebsites.length === 0) {
        return (
            <Container maxWidth="sm" sx={{ mt: 4, textAlign: 'center' }}>
                <Alert severity="error" sx={{ mb: 2, justifyContent: 'center' }}>
                    Error loading dashboard data: {dataError.message || 'Unknown error'}
                </Alert>
                <Button variant="outlined" onClick={() => refetch()} sx={{ mt: 1 }}>Retry</Button>
            </Container>
        );
    }

    // --- Main Dashboard Render ---
    return (
        <Container maxWidth={false} sx={{ px: { xs: 1, sm: 2, md: 3 }, mt: 2, mb: 4 }}>
            {/* Statistics Header (Hidden in Focus Mode) */}
            {!isFocusMode && (
                <Paper elevation={1} sx={{ mb: 2 }}>
                    {/* Props passed to StatsHeader are correct */}
                    <StatsHeader
                        isLoading={isLoadingData && !overallStats}
                        error={dataError}
                        upCount={upWebsitesCount}
                        totalCount={totalWebsitesCount}
                        uptime={headerUptime}
                        incidentsLast24h={incidentsLast24h}
                        lastIncidentTimestamp={lastIncidentTimestamp}
                        lastIncidentWebsiteId={lastIncidentWebsiteId}
                        onToggleHighlight={handleToggleHighlight}
                        isHighlightActive={isHighlightActive}
                        center={false}
                    />
                </Paper>
            )}

            {/* Search and Controls Row */}
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                mb={2}
            >
                {/* Left side controls (Focus Toggle) */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ width: 'auto' }}>
                    <Tooltip title={isFocusMode ? "Show Full Dashboard" : "Focus Mode (Hide Stats)"}>
                        <IconButton onClick={toggleFocusMode} color="default" aria-label="toggle focus mode">
                            {isFocusMode ? <ViewAgendaOutlinedIcon /> : <ViewCompactOutlinedIcon />}
                        </IconButton>
                    </Tooltip>
                </Stack>

                {/* Center Search Bar Area */}
                <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', width: { xs: '100%', sm: 'auto' }, px: { sm: 2 } }}>
                    <DashboardSearchFilter onFilterChange={handleFilterChange} sx={{ width: { xs: '100%', sm: 300, md: 450 } }} />
                </Box>

                {/* Right side controls (Sort Button) */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ width: 'auto' }}>
                    <Tooltip title="Sort websites">
                        <IconButton id="sort-button" aria-controls={openSortMenu ? 'sort-menu' : undefined} aria-haspopup="true" aria-expanded={openSortMenu ? 'true' : undefined} onClick={handleSortMenuClick} color="primary">
                            <FilterListIcon />
                        </IconButton>
                    </Tooltip>
                </Stack>

                {/* Sort Menu */}
                <Menu
                    id="sort-menu"
                    anchorEl={sortAnchorEl}
                    open={openSortMenu}
                    onClose={handleSortMenuClose}
                    MenuListProps={{ 'aria-labelledby': 'sort-button' }}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    {/* Display secondary sort options */}
                    {sortOptionsConfig.map((option) => (
                        <MenuItem key={option.value} selected={option.value === sortOption} onClick={() => handleSortOptionSelect(option.value)}>
                            <ListItemIcon sx={{ minWidth: '36px' }}>{option.icon}</ListItemIcon>
                            <ListItemText primary={option.label} />
                        </MenuItem>
                    ))}
                </Menu>
            </Stack>


            {/* Inline Warning for partial data errors */}
            {!isFocusMode && dataError && (allWebsites.length > 0 || overallStats) && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    There might be issues displaying the latest data: {dataError.message}.
                    <Button onClick={() => refetch()} size="small" sx={{ ml: 1 }} variant="outlined" color="inherit">Retry</Button>
                </Alert>
            )}

            {/* Website Grid */}
            <WebsiteGrid
                // Pass the correctly sorted and filtered list
                websitesWithResults={sortedAndFilteredWebsites}
                isLoading={showLoadingSkeleton}
                lastIncidentWebsiteId={lastIncidentWebsiteId}
                isHighlightActive={isHighlightActive}
            />

            {/* Empty States */}
            {isEmptyDueToFilter && (
                <Typography sx={{ textAlign: 'center', mt: 4, color: 'text.secondary' }}>
                    No websites match your current filter.
                </Typography>
            )}
            {isEmptyBecauseNoWebsites && (
                 <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: { xs: 2, sm: 4 }, borderRadius: 2, bgcolor: "background.paper", boxShadow: 1, textAlign: "center", mt: 4 }}>
                   <Typography variant="h6" gutterBottom>No websites added yet</Typography>
                   <Typography variant="body2" color="text.secondary" paragraph>Add your first website to start monitoring its uptime and performance.</Typography>
                   {/* Ensure Link component is correctly imported and used */}
                   <Button variant="contained" component={Link} to="/add-website" sx={{ mt: 2 }}>Add Your First Website</Button>
                 </Box>
            )}
        </Container>
    );
};

export default Dashboard;