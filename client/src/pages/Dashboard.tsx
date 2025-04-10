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
import { SortOption } from "../types";

// Define Sort Options Config
interface SortOptionConfig {
    value: SortOption;
    label: string;
    icon: React.ReactElement;
}

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
    const [sortOption, setSortOption] = useState<SortOption>('name-asc'); // Default sort
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
        if (term) {
            setIsHighlightActive(false);
        }
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

    // Toggle highlight and scroll to the relevant card
    const handleToggleHighlight = useCallback(() => {
        const shouldActivate = !isHighlightActive;
        setIsHighlightActive(shouldActivate);
        // If activating highlight and an ID exists, scroll to it
        if (shouldActivate && lastIncidentWebsiteId) {
            // Use timeout to ensure element is rendered after state update
            setTimeout(() => {
                const element = document.getElementById(`website-card-grid-${lastIncidentWebsiteId}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100); // Small delay
        }
    }, [isHighlightActive, lastIncidentWebsiteId]);

    // --- Effects ---
    // Deactivate highlight if the last incident changes
    useEffect(() => {
        setIsHighlightActive(false);
    }, [lastIncidentWebsiteId]);

    // --- Memoized Calculations ---
    // Filter websites based on search term
    const filteredWebsites = useMemo(() => {
        if (!filterTerm) return allWebsites; // Return all if no filter
        return allWebsites.filter(item => {
            // Check against name and URL (case-insensitive)
            const name = item.userWebsite?.name?.toLowerCase() || '';
            const url = item.userWebsite?.website?.url?.toLowerCase() || '';
            return name.includes(filterTerm) || url.includes(filterTerm);
        });
    }, [allWebsites, filterTerm]);

    // Sort the filtered websites based on selected option
    const sortedAndFilteredWebsites = useMemo(() => {
        const listToSort = [...filteredWebsites]; // Create a mutable copy

        return listToSort.sort((a, b) => {
             // Handle potential missing data defensively
             if (!a?.userWebsite || !b?.userWebsite) return 0;

             // --- Primary Sort Keys (Pinned and Status) ---
             // 1. Pinned websites first
             if (a.userWebsite.isPinned !== b.userWebsite.isPinned) {
                 return a.userWebsite.isPinned ? -1 : 1; // Pinned (true) comes before not pinned (false)
             }
             // 2. Offline websites before Online websites
             const aIsAvailable = a.userWebsite.latestResult?.isAvailable ?? true; // Treat pending/no data as online for sorting initially
             const bIsAvailable = b.userWebsite.latestResult?.isAvailable ?? true;
             if (aIsAvailable !== bIsAvailable) {
                 return aIsAvailable ? 1 : -1; // Offline (false) comes before online (true)
             }

             // --- Secondary Sort Key (User Selected Option) ---
             switch (sortOption) {
                 case 'name-asc': {
                     const nameA = a.userWebsite.name ?? a.userWebsite.website?.url ?? '';
                     const nameB = b.userWebsite.name ?? b.userWebsite.website?.url ?? '';
                     return nameA.localeCompare(nameB);
                 }
                 case 'name-desc': {
                     const nameA = a.userWebsite.name ?? a.userWebsite.website?.url ?? '';
                     const nameB = b.userWebsite.name ?? b.userWebsite.website?.url ?? '';
                     return nameB.localeCompare(nameA);
                 }
                 case 'response-asc': {
                     // Treat null/offline response time as Infinity so they go last in ascending sort
                     const respA = a.userWebsite.latestResult?.responseTime ?? Infinity;
                     const respB = b.userWebsite.latestResult?.responseTime ?? Infinity;
                     return respA - respB;
                 }
                 case 'response-desc': {
                      // Treat null/offline response time as -1 so they go last in descending sort
                     const respA = a.userWebsite.latestResult?.responseTime ?? -1;
                     const respB = b.userWebsite.latestResult?.responseTime ?? -1;
                     return respB - respA;
                 }
                 default: return 0;
             }
        });
    }, [filteredWebsites, sortOption]);

    // Memoize stats needed specifically for the header
    const headerStats = useMemo(() => ({
        uptime: overallStats?.overallUptime ?? null,
    }), [overallStats]);

    // --- Render Logic ---
    const showLoadingSkeleton = isLoadingData && sortedAndFilteredWebsites.length === 0;
    const isListEmpty = !isLoadingData && sortedAndFilteredWebsites.length === 0;
    const isEmptyDueToFilter = isListEmpty && !!filterTerm && allWebsites.length > 0;
    const isEmptyBecauseNoWebsites = isListEmpty && !filterTerm && !dataError;

    // --- Initial Loading State ---
    // Show a full page spinner only if absolutely no data has loaded yet
    if (isLoadingData && !overallStats && allWebsites.length === 0 && !dataError) {
        return <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh"><CircularProgress /></Box>;
    }

    // --- Initial Error State ---
    // Show a full page error only if initial load failed completely
    if (dataError && !overallStats && allWebsites.length === 0) {
        return (
            // Use Container to constrain width of error message
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
                    <StatsHeader
                        isLoading={isLoadingData && !overallStats}
                        error={dataError}
                        upCount={upWebsitesCount}
                        totalCount={totalWebsitesCount}
                        uptime={headerStats.uptime}
                        incidentsLast24h={incidentsLast24h}
                        lastIncidentTimestamp={lastIncidentTimestamp}
                        lastIncidentWebsiteId={lastIncidentWebsiteId}
                        onToggleHighlight={handleToggleHighlight}
                        isHighlightActive={isHighlightActive}
                        center={false}
                        onShowDownWebsites={() => {}}
                        showDownWebsites={false}
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
                {/* This stack will take minimal width */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ width: 'auto' }}>
                    <Tooltip title={isFocusMode ? "Show Full Dashboard" : "Focus Mode (Hide Stats)"}>
                        <IconButton onClick={toggleFocusMode} color="default" aria-label="toggle focus mode">
                            {isFocusMode ? <ViewAgendaOutlinedIcon /> : <ViewCompactOutlinedIcon />}
                        </IconButton>
                    </Tooltip>
                </Stack>

                {/* Center Search Bar Area */}
                {/* This Box grows to fill available space and centers its content */}
                <Box sx={{
                    flexGrow: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    width: { xs: '100%', sm: 'auto' },
                    px: { sm: 2 }
                }}>
                    <DashboardSearchFilter
                        onFilterChange={handleFilterChange}
                        sx={{
                            width: { xs: '100%', sm: 300, md: 450 }
                        }}
                    />
                </Box>

                {/* Right side controls (Sort Button) */}
                {/* This stack will take minimal width */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ width: 'auto' }}>
                    <Tooltip title="Sort websites">
                        <IconButton
                            id="sort-button"
                            aria-controls={openSortMenu ? 'sort-menu' : undefined}
                            aria-haspopup="true"
                            aria-expanded={openSortMenu ? 'true' : undefined}
                            onClick={handleSortMenuClick}
                            color="primary"
                        >
                            <FilterListIcon />
                        </IconButton>
                    </Tooltip>
                </Stack>

                {/* Sort Menu - Rendered outside the layout flow */}
                <Menu
                    id="sort-menu"
                    anchorEl={sortAnchorEl}
                    open={openSortMenu}
                    onClose={handleSortMenuClose}
                    MenuListProps={{ 'aria-labelledby': 'sort-button' }}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    {sortOptionsConfig.map((option) => (
                        <MenuItem
                            key={option.value}
                            selected={option.value === sortOption}
                            onClick={() => handleSortOptionSelect(option.value)}
                        >
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
                   <Button variant="contained" component={Link} to="/add-website" sx={{ mt: 2 }}>Add Your First Website</Button>
                 </Box>
            )}
        </Container>
    );
};

export default Dashboard;