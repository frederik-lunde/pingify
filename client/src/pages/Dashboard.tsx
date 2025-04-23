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
    Stack,
    Snackbar
} from "@mui/material";
import FilterListIcon from '@mui/icons-material/FilterList';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import TvIcon from '@mui/icons-material/Tv';
import ExitToAppIcon from '@mui/icons-material/ExitToApp'; // Keep if used elsewhere, otherwise remove
import WebsiteGrid from "../components/dashboard/WebsiteGrid";
import DashboardSearchFilter from "../components/dashboard/DashboardSearchFilter";
import StatsHeader from "../components/dashboard/StatsHeader";
import { useWebsiteData } from "../hooks";
import { useTvMode } from "../context/TvModeContext";
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
    const [sortOption, setSortOption] = useState<SortOption>('name-asc');
    const { isTvMode, toggleTvMode } = useTvMode();
    const [isHighlightActive, setIsHighlightActive] = useState(false);
    const [showTvExitMessage, setShowTvExitMessage] = useState(false);


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

    useEffect(() => {
        if (isTvMode) {
            setShowTvExitMessage(true);
            const timer = setTimeout(() => setShowTvExitMessage(false), 5000);
            return () => clearTimeout(timer);
        } else {
            setShowTvExitMessage(false);
        }
    }, [isTvMode]);

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
        const listToSort = [...filteredWebsites];

        const getPrimarySortOrder = (wu: WebsiteUser): number => {
            const isPinned = wu.isPinned;
            const incidentType = wu.currentIncident?.type;

            if (isPinned) {
                if (incidentType === 'down') return 0;
                if (incidentType === 'slow') return 1;
                return 2;
            } else {
                if (incidentType === 'down') return 3;
                if (incidentType === 'slow') return 4;
                return 5;
            }
        };

        return listToSort.sort((a, b) => {
             if (!a?.userWebsite || !b?.userWebsite) return 0;
             const wuA = a.userWebsite;
             const wuB = b.userWebsite;

             const primaryOrderA = getPrimarySortOrder(wuA);
             const primaryOrderB = getPrimarySortOrder(wuB);

             if (primaryOrderA !== primaryOrderB) {
                 return primaryOrderA - primaryOrderB;
             }

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
                     const respA = wuA.latestResult?.isAvailable ? (wuA.latestResult?.responseTime ?? Infinity) : Infinity;
                     const respB = wuB.latestResult?.isAvailable ? (wuB.latestResult?.responseTime ?? Infinity) : Infinity;
                     if (respA === Infinity && respB === Infinity) {
                         const nameA = wuA.name ?? wuA.website?.url ?? '';
                         const nameB = wuB.name ?? wuB.website?.url ?? '';
                         return nameA.localeCompare(nameB);
                     }
                     return respA - respB;
                 }
                 case 'response-desc': {
                     const respA = wuA.latestResult?.isAvailable ? (wuA.latestResult?.responseTime ?? -1) : -1;
                     const respB = wuB.latestResult?.isAvailable ? (wuB.latestResult?.responseTime ?? -1) : -1;
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
    }, [filteredWebsites, sortOption]);

    const headerUptime = useMemo(() => overallStats?.overallUptime ?? null, [overallStats]);

    // --- Render Logic ---
    const showLoadingSkeleton = isLoadingData && sortedAndFilteredWebsites.length === 0;
    const isListEmpty = !isLoadingData && sortedAndFilteredWebsites.length === 0;
    const isEmptyDueToFilter = isListEmpty && !!filterTerm && allWebsites.length > 0;
    const isEmptyBecauseNoWebsites = isListEmpty && !filterTerm && !dataError;

    if (isLoadingData && !overallStats && allWebsites.length === 0 && !dataError) {
        return <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh"><CircularProgress /></Box>;
    }

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

    // --- TV Mode Render ---
    if (isTvMode) {
        return (
            <Box
                // This onClick now *only* handles exiting TV mode.
                // Clicks originating on cards will be stopped by the card itself.
                onClick={toggleTvMode}
                sx={{
                    cursor: 'pointer',
                    minHeight: '100vh',
                    width: '100%',
                    p: { xs: 1, sm: 2, md: 3 },
                    boxSizing: 'border-box',
                    bgcolor: 'background.default',
                }}
            >
                <WebsiteGrid
                    websitesWithResults={sortedAndFilteredWebsites}
                    isLoading={showLoadingSkeleton}
                    lastIncidentWebsiteId={lastIncidentWebsiteId}
                    isHighlightActive={isHighlightActive}
                    // Pass TV mode status down
                    isTvMode={isTvMode}
                />

                <Snackbar
                    open={showTvExitMessage}
                    onClose={() => setShowTvExitMessage(false)}
                    message="Click anywhere to exit TV Mode"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    sx={{ bottom: { xs: 16, sm: 24 } }}
                />

                {isEmptyDueToFilter && (
                    <Typography sx={{ textAlign: 'center', mt: 4, color: 'text.secondary' }}>
                        No websites match your current filter.
                    </Typography>
                )}
                {isEmptyBecauseNoWebsites && (
                     <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: { xs: 2, sm: 4 }, borderRadius: 2, bgcolor: "background.paper", boxShadow: 1, textAlign: "center", mt: 4, mx: 'auto', maxWidth: 'sm' }}>
                       <Typography variant="h6" gutterBottom>No websites added yet</Typography>
                       <Typography variant="body2" color="text.secondary" paragraph>Add your first website to start monitoring.</Typography>
                     </Box>
                )}
                {isFetching && !isLoadingData && (
                    <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: 1300 }}>
                        <CircularProgress size={24} />
                    </Box>
                )}
            </Box>
        );
    }

    // --- Standard Dashboard Render ---
    return (
        <Container maxWidth={false} sx={{ px: { xs: 1, sm: 2, md: 3 }, mt: 2, mb: 4 }}>
            <Paper elevation={1} sx={{ mb: 2 }}>
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

            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                mb={2}
            >
                <Stack direction="row" spacing={1} alignItems="center" sx={{ width: 'auto' }}>
                    <Tooltip title={"TV Mode (Show only grid)"}>
                        <IconButton onClick={toggleTvMode} color="default" aria-label="toggle tv mode">
                             <TvIcon />
                        </IconButton>
                    </Tooltip>
                </Stack>

                <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', width: { xs: '100%', sm: 'auto' }, px: { sm: 2 } }}>
                    <DashboardSearchFilter onFilterChange={handleFilterChange} sx={{ width: { xs: '100%', sm: 300, md: 450 } }} />
                </Box>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ width: 'auto' }}>
                    <Tooltip title="Sort websites">
                        <IconButton id="sort-button" aria-controls={openSortMenu ? 'sort-menu' : undefined} aria-haspopup="true" aria-expanded={openSortMenu ? 'true' : undefined} onClick={handleSortMenuClick} color="primary">
                            <FilterListIcon />
                        </IconButton>
                    </Tooltip>
                    {isFetching && !isLoadingData && <CircularProgress size={20} sx={{ ml: 1 }} />}
                </Stack>

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
                        <MenuItem key={option.value} selected={option.value === sortOption} onClick={() => handleSortOptionSelect(option.value)}>
                            <ListItemIcon sx={{ minWidth: '36px' }}>{option.icon}</ListItemIcon>
                            <ListItemText primary={option.label} />
                        </MenuItem>
                    ))}
                </Menu>
            </Stack>


            {dataError && (allWebsites.length > 0 || overallStats) && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    There might be issues displaying the latest data: {dataError.message}.
                    <Button onClick={() => refetch()} size="small" sx={{ ml: 1 }} variant="outlined" color="inherit">Retry</Button>
                </Alert>
            )}

            <WebsiteGrid
                websitesWithResults={sortedAndFilteredWebsites}
                isLoading={showLoadingSkeleton}
                lastIncidentWebsiteId={lastIncidentWebsiteId}
                isHighlightActive={isHighlightActive}
                // Pass TV mode status down (will be false here)
                isTvMode={isTvMode}
            />

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