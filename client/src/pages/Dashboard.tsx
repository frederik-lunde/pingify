// src/pages/Dashboard.tsx
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
    ListItemText
} from "@mui/material";

// Icons
import FilterListIcon from '@mui/icons-material/FilterList';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import ViewCompactOutlinedIcon from '@mui/icons-material/ViewCompactOutlined';
import ViewAgendaOutlinedIcon from '@mui/icons-material/ViewAgendaOutlined';

// Component Imports
import WebsiteGrid from "../components/dashboard/WebsiteGrid";
import DashboardSearchFilter from "../components/dashboard/DashboardSearchFilter";
import StatsHeader from "../components/dashboard/StatsHeader";

// Hook Imports
import { useWebsiteData, useDownWebsitesLast24h } from "../hooks";
import { useFocusMode } from "../context/FocusModeContext";
// Correct Link import for react-router-dom v6+
import { Link } from "react-router";

// Type Imports
// Ensure SortOption is imported or defined in types.ts
import { SortOption, WebsiteWithResults } from "../types";

// Define Sort Options
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
    // State
    const [filterTerm, setFilterTerm] = useState<string>('');
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [sortOption, setSortOption] = useState<SortOption>('name-asc');
    const { isFocusMode, toggleFocusMode } = useFocusMode();
    const [isHighlightActive, setIsHighlightActive] = useState(false);
    const [showDownWebsites, setShowDownWebsites] = useState(false);

    // Data Hooks
    const {
        data: downWebsites = [],
        isLoading: isLoadingDownWebsites,
        error: downWebsitesError,
        refetch: refetchDownWebsites
    } = useDownWebsitesLast24h();

    const {
        websitesWithResults: allWebsites, // This is WebsiteWithResults[]
        overallStats,
        incidentsLast24h,
        lastIncidentTimestamp,
        lastIncidentWebsiteId,
        isLoading: isLoadingData,
        error: dataError,
        refetch,
        totalWebsitesCount,
        upWebsitesCount,
    } = useWebsiteData( // Remove the first 'undefined' argument
        'week',
        60000
    );

    const openSortMenu = Boolean(anchorEl);

    // Callbacks
    const handleFilterChange = useCallback((term: string) => {
        setFilterTerm(term.toLowerCase());
    }, []);

    const handleSortMenuClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    }, []);

    const handleSortMenuClose = useCallback(() => {
        setAnchorEl(null);
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
                const elementId = `website-card-grid-${lastIncidentWebsiteId}`;
                const element = document.getElementById(elementId);
                if (element) {
                    element.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                        inline: 'nearest'
                    });
                }
            }, 100);
        }
    }, [isHighlightActive, lastIncidentWebsiteId]);

    const toggleDownWebsitesView = useCallback(async () => {
        if (!showDownWebsites) {
            try {
                await refetchDownWebsites();
            } catch (error) {
                console.error("Failed to fetch down websites:", error);
                return;
            }
        }
        setShowDownWebsites(!showDownWebsites);
    }, [showDownWebsites, refetchDownWebsites]);

    // Effects
    useEffect(() => {
        setIsHighlightActive(false);
    }, [lastIncidentWebsiteId]);

    // Memoized Calculations
    const filteredWebsites = useMemo(() => {
        if (!filterTerm) return allWebsites;
        // Filter based on data within userWebsite
        return allWebsites.filter(item => {
            if (!item?.userWebsite) return false;
            const name = item.userWebsite.name?.toLowerCase() || '';
            const url = item.userWebsite.website?.url?.toLowerCase() || '';
            return name.includes(filterTerm) || url.includes(filterTerm);
        });
    }, [allWebsites, filterTerm]);

    const sortedAndFilteredWebsites = useMemo(() => {
        // Base list to sort
        let listToSort: WebsiteWithResults[] = [];

        // Filter for down websites if needed
        if (showDownWebsites && downWebsites.length > 0) {
            const downWebsiteIds = new Set(downWebsites.map(website => website.id));
            listToSort = filteredWebsites.filter(item =>
                item.userWebsite?.websiteId !== undefined && downWebsiteIds.has(item.userWebsite.websiteId)
            );
        } else {
            listToSort = filteredWebsites;
        }

        // Sort the determined list
        return [...listToSort].sort((a, b) => {
            // Ensure userWebsite exists on both items
            if (!a?.userWebsite || !b?.userWebsite) return 0;

            // 1. Pinned sites first
            if (a.userWebsite.isPinned !== b.userWebsite.isPinned) {
                return a.userWebsite.isPinned ? -1 : 1;
            }

            // 2. Down sites come before up sites
            // --- ACCESS LATEST RESULT WITHIN userWebsite ---
            const aIsAvailable = a.userWebsite.latestResult?.isAvailable ?? true; // Default to true if no result yet
            const bIsAvailable = b.userWebsite.latestResult?.isAvailable ?? true; // Default to true if no result yet
            if (aIsAvailable !== bIsAvailable) {
                return aIsAvailable ? 1 : -1; // Put false (down) first
            }

            // 3. Apply user-selected sort
            switch (sortOption) {
                case 'name-asc': {
                    // Name or URL from userWebsite
                    const nameA = a.userWebsite.name ?? a.userWebsite.website?.url ?? '';
                    const nameB = b.userWebsite.name ?? b.userWebsite.website?.url ?? '';
                    return nameA.localeCompare(nameB);
                }
                case 'name-desc': {
                    // Name or URL from userWebsite
                    const nameA = a.userWebsite.name ?? a.userWebsite.website?.url ?? '';
                    const nameB = b.userWebsite.name ?? b.userWebsite.website?.url ?? '';
                    return nameB.localeCompare(nameA);
                }
                case 'response-asc': {
                    // --- ACCESS LATEST RESULT WITHIN userWebsite ---
                    const respA = a.userWebsite.latestResult?.responseTime ?? Infinity; // Use Infinity for null/missing
                    const respB = b.userWebsite.latestResult?.responseTime ?? Infinity; // Use Infinity for null/missing
                    return respA - respB;
                }
                case 'response-desc': {
                    // --- ACCESS LATEST RESULT WITHIN userWebsite ---
                    const respA = a.userWebsite.latestResult?.responseTime ?? -1; // Use -1 for null/missing
                    const respB = b.userWebsite.latestResult?.responseTime ?? -1; // Use -1 for null/missing
                    return respB - respA;
                }
                default:
                    return 0;
            }
        });
        // Adjust dependencies: allWebsites is the raw data, filteredWebsites depends on it.
        // Use filteredWebsites here as the base for sorting.
    }, [filteredWebsites, sortOption, showDownWebsites, downWebsites]);

    const headerStats = useMemo(() => ({
        uptime: overallStats?.overallUptime ?? null,
    }), [overallStats]);

    // Render Logic
    // Check loading state based on the hook and whether the final list is empty
    const showLoadingSkeleton = isLoadingData && sortedAndFilteredWebsites.length === 0;

    if (showLoadingSkeleton && !dataError) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
                <CircularProgress />
            </Box>
        );
    }

    // Handle initial error state where nothing loaded
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

    // Determine if the list is empty due to filters or no websites added
    const isListEmpty = !isLoadingData && sortedAndFilteredWebsites.length === 0;
    const isEmptyDueToFilter = isListEmpty && (!!filterTerm || sortOption !== 'name-asc' || showDownWebsites);
    const isEmptyBecauseNoWebsites = isListEmpty && !filterTerm && sortOption === 'name-asc' && !showDownWebsites && !dataError;


    return (
        <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2 }, mt: 2, mb: 2 }}>
            {/* Statistics Header Section */}
            {!isFocusMode && (
                <Paper elevation={1} sx={{ mb: 2, overflow: 'hidden' }}>
                    <StatsHeader
                        // Pass loading state based on initial load OR background fetch if data exists
                        isLoading={isLoadingData && !overallStats}
                        error={dataError} // Pass dataError to StatsHeader if needed
                        upCount={upWebsitesCount}
                        totalCount={totalWebsitesCount}
                        uptime={headerStats.uptime}
                        incidentsLast24h={incidentsLast24h}
                        lastIncidentTimestamp={lastIncidentTimestamp}
                        lastIncidentWebsiteId={lastIncidentWebsiteId}
                        onToggleHighlight={handleToggleHighlight}
                        isHighlightActive={isHighlightActive}
                        center={false}
                        downWebsites={downWebsites}
                        onShowDownWebsites={toggleDownWebsitesView}
                        showDownWebsites={showDownWebsites}
                    />
                </Paper>
            )}

            {/* Search and Controls Row */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: { xs: 1, sm: 0 },
                mb: 1,
                flexWrap: 'wrap'
            }}>
                <Tooltip title={isFocusMode ? "Show Full Dashboard" : "Focus Mode (Hide Stats)"}>
                    <IconButton onClick={toggleFocusMode} color="default" aria-label="toggle focus mode">
                        {isFocusMode ? <ViewAgendaOutlinedIcon /> : <ViewCompactOutlinedIcon />}
                    </IconButton>
                </Tooltip>

                <DashboardSearchFilter
                    onFilterChange={handleFilterChange}
                    sx={{
                        maxWidth: { xs: 'calc(100% - 100px)', sm: 450 },
                        width: '100%',
                        mx: { xs: 0, sm: 1 },
                    }}
                />

                <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
                </Box>

                <Menu
                    id="sort-menu"
                    anchorEl={anchorEl}
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
            </Box>

            {/* Loading State for Down Websites */}
            {isLoadingDownWebsites && showDownWebsites && (
                <Box display="flex" justifyContent="center" sx={{ my: 4 }}>
                    <CircularProgress />
                </Box>
            )}

            {/* Error Alerts */}
            {downWebsitesError && showDownWebsites && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    Failed to load down websites: {downWebsitesError?.message || 'Unknown error'}
                    <Button onClick={() => refetchDownWebsites()} size="small" sx={{ ml: 1 }}>
                        Retry
                    </Button>
                </Alert>
            )}

            {/* General Data Error (if data is partially loaded) */}
            {!isFocusMode && dataError && (allWebsites.length > 0 || overallStats) && (
                <Alert severity="warning" sx={{ mb: 1 }}>
                    There might be issues displaying the latest data: {dataError.message}.
                    <Button onClick={() => refetch()} size="small" sx={{ ml: 1 }}>Retry</Button>
                </Alert>
            )}

            {/* Website Grid */}
            {/* Pass the correctly sorted/filtered list */}
            <WebsiteGrid
                websitesWithResults={sortedAndFilteredWebsites}
                // Pass loading=true only if it's the initial load AND the list is empty
                // This prevents the skeleton flash on background refetches/sorts
                loading={showLoadingSkeleton}
                error={null} // Main error handled above
                lastIncidentWebsiteId={lastIncidentWebsiteId}
                isHighlightActive={isHighlightActive}
            />

            {/* Empty States */}
            {isEmptyDueToFilter && (
                <Typography sx={{ textAlign: 'center', mt: 4, color: 'text.secondary' }}>
                    No websites match your current filter or sort criteria.
                </Typography>
            )}

            {isEmptyBecauseNoWebsites && (
                <Box sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    p: { xs: 2, sm: 4 },
                    borderRadius: 2,
                    bgcolor: "background.paper",
                    boxShadow: 1,
                    textAlign: "center",
                    mt: 4
                }}>
                    <Typography variant="h6" gutterBottom>No websites added yet</Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                        Add your first website to start monitoring its uptime and performance.
                    </Typography>
                    <Button variant="contained" component={Link} to="/add-website" sx={{ mt: 2 }}>
                        Add Your First Website
                    </Button>
                </Box>
            )}
        </Container>
    );
};

export default Dashboard;