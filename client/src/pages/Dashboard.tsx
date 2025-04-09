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
import { Link } from "react-router";

// Type Imports
import { SortOption } from "../types";

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
        undefined,
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
        return allWebsites.filter(item => {
            if (!item?.userWebsite) return false;
            const name = item.userWebsite.name?.toLowerCase() || '';
            const url = item.userWebsite.website?.url?.toLowerCase() || '';
            return name.includes(filterTerm) || url.includes(filterTerm);
        });
    }, [allWebsites, filterTerm]);

    const sortedAndFilteredWebsites = useMemo(() => {
        if (showDownWebsites && downWebsites.length > 0) {
            const downWebsiteIds = new Set(downWebsites.map(website => website.id));
            return filteredWebsites.filter(website => 
                downWebsiteIds.has(website.userWebsite.websiteId)
            );
        }
        return [...filteredWebsites].sort((a, b) => {
            if (!a?.userWebsite || !b?.userWebsite) return 0;

            // 1. Pinned sites first
            if (a.userWebsite.isPinned !== b.userWebsite.isPinned) {
                return a.userWebsite.isPinned ? -1 : 1;
            }

            // 2. Down sites come before up sites
            const aIsAvailable = a.latestResult?.isAvailable ?? true;
            const bIsAvailable = b.latestResult?.isAvailable ?? true;
            if (aIsAvailable !== bIsAvailable) {
                return aIsAvailable ? 1 : -1;
            }

            // 3. Apply user-selected sort
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
                    const respA = a.latestResult?.responseTime ?? Infinity;
                    const respB = b.latestResult?.responseTime ?? Infinity;
                    return respA - respB;
                }
                case 'response-desc': {
                    const respA = a.latestResult?.responseTime ?? -1;
                    const respB = b.latestResult?.responseTime ?? -1;
                    return respB - respA;
                }
                default:
                    return 0;
            }
        });
    }, [filteredWebsites, sortOption, showDownWebsites, downWebsites]);

    const headerStats = useMemo(() => ({
        uptime: overallStats?.overallUptime ?? null,
    }), [overallStats]);

    // Render Logic
    if (isLoadingData && allWebsites.length === 0 && !overallStats) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
                <CircularProgress />
            </Box>
        );
    }

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
        <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2 }, mt: 2, mb: 2 }}>
            {/* Statistics Header Section */}
            {!isFocusMode && (
                <Paper elevation={1} sx={{ mb: 2, overflow: 'hidden' }}>
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
                    Failed to load down websites: {downWebsitesError.message}
                    <Button onClick={() => refetchDownWebsites()} size="small" sx={{ ml: 1 }}>
                        Retry
                    </Button>
                </Alert>
            )}

            {!isFocusMode && dataError && (allWebsites.length > 0 || overallStats) && (
                <Alert severity="warning" sx={{ mb: 1 }}>
                    There might be issues displaying the latest data: {dataError.message}.
                    <Button onClick={() => refetch()} size="small" sx={{ ml: 1 }}>Retry</Button>
                </Alert>
            )}

            {/* Website Grid */}
            <WebsiteGrid
                websitesWithResults={sortedAndFilteredWebsites}
                loading={isLoadingData && sortedAndFilteredWebsites.length === 0 && (!!filterTerm || sortOption !== 'name-asc')}
                error={null}
                lastIncidentWebsiteId={lastIncidentWebsiteId}
                isHighlightActive={isHighlightActive}
            />

            {/* Empty States */}
            {!isLoadingData && sortedAndFilteredWebsites.length === 0 && (!!filterTerm || sortOption !== 'name-asc') && (
                <Typography sx={{ textAlign: 'center', mt: 4, color: 'text.secondary' }}>
                    No websites match your current filter or sort criteria.
                </Typography>
            )}

            {!isLoadingData && allWebsites.length === 0 && !filterTerm && sortOption === 'name-asc' && !dataError && (
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