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
// Removed WarningAmberIcon import as it's no longer used for the button

import WebsiteGrid from "../components/dashboard/WebsiteGrid";
import DashboardSearchFilter from "../components/dashboard/DashboardSearchFilter";
import StatsHeader from "../components/dashboard/StatsHeader";
// Removed DownWebsitesList import

// Removed useDownWebsitesLast24h import, keeping useWebsiteData
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
    const [sortOption, setSortOption] = useState<SortOption>('name-asc');
    const { isFocusMode, toggleFocusMode } = useFocusMode();
    const [isHighlightActive, setIsHighlightActive] = useState(false);
    // Removed showDownWebsitesList state


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

    const openSortMenu = Boolean(sortAnchorEl);

    // --- Callbacks ---
    const handleFilterChange = useCallback((term: string) => {
        setFilterTerm(term.toLowerCase());
        // No need to close down list anymore
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
        // No need to close down list anymore
    }, [handleSortMenuClose]);

    const handleToggleHighlight = useCallback(() => {
        const shouldActivate = !isHighlightActive;
        setIsHighlightActive(shouldActivate);
        if (shouldActivate && lastIncidentWebsiteId) {
            setTimeout(() => {
                const element = document.getElementById(`website-card-grid-${lastIncidentWebsiteId}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }, [isHighlightActive, lastIncidentWebsiteId]);

    // Removed toggleDownWebsitesView callback
    // Removed closeDownWebsitesList callback

    // --- Effects ---
    useEffect(() => {
        setIsHighlightActive(false);
    }, [lastIncidentWebsiteId]);

    // --- Memoized Calculations ---
    const filteredWebsites = useMemo(() => {
        if (!filterTerm) return allWebsites;
        return allWebsites.filter(item => {
            const name = item.userWebsite?.name?.toLowerCase() || '';
            const url = item.userWebsite?.website?.url?.toLowerCase() || '';
            return name.includes(filterTerm) || url.includes(filterTerm);
        });
    }, [allWebsites, filterTerm]);

    const sortedAndFilteredWebsites = useMemo(() => {
        // Start with the already filtered list
        const listToSort = [...filteredWebsites];

        // Removed filtering logic based on showDownWebsites

        return listToSort.sort((a, b) => {
             if (!a?.userWebsite || !b?.userWebsite) return 0;
             if (a.userWebsite.isPinned !== b.userWebsite.isPinned) return a.userWebsite.isPinned ? -1 : 1;
             const aIsAvailable = a.userWebsite.latestResult?.isAvailable ?? true;
             const bIsAvailable = b.userWebsite.latestResult?.isAvailable ?? true;
             if (aIsAvailable !== bIsAvailable) return aIsAvailable ? 1 : -1;
             switch (sortOption) {
                 case 'name-asc': { const nameA = a.userWebsite.name ?? a.userWebsite.website?.url ?? ''; const nameB = b.userWebsite.name ?? b.userWebsite.website?.url ?? ''; return nameA.localeCompare(nameB); }
                 case 'name-desc': { const nameA = a.userWebsite.name ?? a.userWebsite.website?.url ?? ''; const nameB = b.userWebsite.name ?? b.userWebsite.website?.url ?? ''; return nameB.localeCompare(nameA); }
                 case 'response-asc': { const respA = a.userWebsite.latestResult?.responseTime ?? Infinity; const respB = b.userWebsite.latestResult?.responseTime ?? Infinity; return respA - respB; }
                 case 'response-desc': { const respA = a.userWebsite.latestResult?.responseTime ?? -1; const respB = b.userWebsite.latestResult?.responseTime ?? -1; return respB - respA; }
                 default: return 0;
             }
        });
        // Removed showDownWebsites and downWebsites from dependencies
    }, [filteredWebsites, sortOption]);

    const headerStats = useMemo(() => ({
        uptime: overallStats?.overallUptime ?? null,
    }), [overallStats]);

    // --- Render Logic ---
    const showLoadingSkeleton = isLoadingData && sortedAndFilteredWebsites.length === 0;
    const isListEmpty = !isLoadingData && sortedAndFilteredWebsites.length === 0;
    const isEmptyDueToFilter = isListEmpty && !!filterTerm;
    const isEmptyBecauseNoWebsites = isListEmpty && !filterTerm && !dataError;

    if (isLoadingData && !overallStats && !dataError) {
        return <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh"><CircularProgress /></Box>;
    }
    if (dataError && !overallStats && allWebsites.length === 0) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
                <Alert severity="error" sx={{ mb: 2 }}>Error loading dashboard data: {dataError.message || 'Unknown error'}</Alert>
                <Button variant="outlined" onClick={() => refetch()} sx={{ mt: 1 }}>Retry</Button>
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2 }, mt: 2, mb: 2 }}>
            {/* Statistics Header */}
            {!isFocusMode && (
                // Removed position: relative and overflow: visible from Paper
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
                        // Removed props related to down websites list
                        onShowDownWebsites={() => { /* No-op or remove prop from StatsHeader if not needed */ }}
                        showDownWebsites={false}
                    />
                    {/* Removed conditional rendering of DownWebsitesList */}
                </Paper>
            )}

            {/* Search and Controls Row */}
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                justifyContent="space-between"
                mb={2}
            >
                <Stack direction="row" spacing={1} alignItems="center">
                    <Tooltip title={isFocusMode ? "Show Full Dashboard" : "Focus Mode (Hide Stats)"}>
                        <IconButton onClick={toggleFocusMode} color="default" aria-label="toggle focus mode">
                            {isFocusMode ? <ViewAgendaOutlinedIcon /> : <ViewCompactOutlinedIcon />}
                        </IconButton>
                    </Tooltip>
                    {/* Removed Button to show down websites */}
                </Stack>

                <DashboardSearchFilter
                    onFilterChange={handleFilterChange}
                    sx={{ flexGrow: 1, maxWidth: { xs: '100%', sm: 450 } }}
                />

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
                    <Button onClick={() => refetch()} size="small" sx={{ ml: 1 }}>Retry</Button>
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