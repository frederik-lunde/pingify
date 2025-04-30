import React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import HistoryIcon from '@mui/icons-material/History';
import TvIcon from '@mui/icons-material/Tv';
import { useTheme, Theme, alpha, SxProps } from '@mui/material/styles';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import { getStatusColor, formatUptime } from '../../utils/statusUtils';
import { useTimeSince } from '../../hooks';
import { useNavigate } from 'react-router';
import DashboardSearchFilter from './DashboardSearchFilter';
import DashboardSortControl from './SortControl';
import { SortOption } from '../../types';

type StatusColorKey = 'success' | 'warning' | 'error' | 'default';
type LayoutMode = 'navbar' | 'dashboard';

interface StatsHeaderProps {
    isLoading: boolean; // Initial loading of stats/component
    upCount: number;
    totalCount: number;
    uptime: number | null | undefined;
    incidentsLast24h: number | null | undefined;
    lastIncidentTimestamp: string | null | undefined;
    layoutMode?: LayoutMode;
    lastIncidentWebsiteId?: number | null | undefined;
    onToggleHighlight?: () => void;
    isHighlightActive?: boolean;
    filterTerm?: string;
    onFilterChange?: (term: string) => void;
    sortOption?: SortOption;
    onSortChange?: (option: SortOption) => void;
    onToggleTvMode?: () => void;
    isRefetching?: boolean; // Prop for background data refresh indicator
}

const getTextColor = (theme: Theme, colorKey: StatusColorKey, isNavbar: boolean): string => {
    if (isNavbar) {
        return colorKey === 'default' ? 'inherit' : theme.palette.common.white;
    }
    if (colorKey === 'default') {
        return theme.palette.text.secondary;
    }
    return theme.palette[colorKey]?.main || theme.palette.text.primary;
};

const getIcon = (IconComponent: React.ElementType, color: string, isNavbar: boolean, iconSize: string) => {
    if (isNavbar) return null;
    return <IconComponent fontSize="inherit" sx={{ color, fontSize: iconSize, lineHeight: 1, mb: 0.5 }} />;
};

const StatsHeader: React.FC<StatsHeaderProps> = ({
    isLoading, // Represents initial loading of stats
    upCount,
    totalCount,
    uptime,
    incidentsLast24h,
    lastIncidentTimestamp,
    layoutMode = 'dashboard',
    lastIncidentWebsiteId,
    onToggleHighlight,
    isHighlightActive = false,
    filterTerm,
    onFilterChange,
    sortOption,
    onSortChange,
    onToggleTvMode,
    isRefetching = false, // Default to false
}) => {
    const theme = useTheme();
    const navigate = useNavigate();
    const isNavbarLayout = layoutMode === 'navbar';
    const showControls = layoutMode === 'dashboard' && onFilterChange && onSortChange && onToggleTvMode && sortOption !== undefined;

    const timeSinceLastIncident = useTimeSince(lastIncidentTimestamp, {
        noIncidentText: isNavbarLayout ? 'None' : 'No recent incidents',
        errorText: 'Invalid Date',
        updateIntervalMs: 30000
    });

    const uptimeColorKey = getStatusColor(uptime);
    const formattedUptimeValue = formatUptime(uptime);

    const statusProps = React.useMemo(() => {
        let iconType: React.ElementType | null = null;
        let valueColorKey: StatusColorKey = 'default';
        let text: string;
        let tooltip: string;

        // Show placeholders only during initial isLoading, not isRefetching
        if (isLoading) {
             iconType = null; valueColorKey = 'default'; text = "- / -"; tooltip = 'Loading status...';
        } else if (totalCount === 0) {
            iconType = ErrorOutlineIcon; valueColorKey = 'default'; text = "0 / 0"; tooltip = 'No websites monitored';
        } else if (upCount === totalCount) {
            iconType = CheckCircleOutlineIcon; valueColorKey = 'success'; text = `${upCount} / ${totalCount}`; tooltip = 'All monitored websites are currently up';
        } else {
            iconType = WarningAmberIcon; valueColorKey = 'error'; text = `${upCount} / ${totalCount}`; tooltip = `${totalCount - upCount} website(s) currently experiencing issues`;
        }
        const valueColor = getTextColor(theme, valueColorKey, isNavbarLayout);
        return { iconType, valueColor, text, tooltip };
    }, [totalCount, upCount, isLoading, theme, isNavbarLayout]); // Depend on isLoading for initial state

    const incidentProps = React.useMemo(() => {
        let iconType: React.ElementType | null = null;
        let valueColorKey: StatusColorKey = 'default';
        let text: string;
        let tooltip: string;

        // Show placeholders only during initial isLoading
        if (isLoading || incidentsLast24h === null || incidentsLast24h === undefined) {
            iconType = null; valueColorKey = 'default'; text = '-'; tooltip = 'Loading incident count...';
        } else if (incidentsLast24h > 0) {
            iconType = ReportProblemOutlinedIcon; valueColorKey = 'warning'; text = incidentsLast24h.toString(); tooltip = `${incidentsLast24h} incident(s) started in the last 24 hours. Click to view incidents.`;
        } else {
            iconType = CheckCircleOutlineIcon; valueColorKey = 'success'; text = '0'; tooltip = 'No new incidents started in the last 24 hours.';
        }
        const valueColor = getTextColor(theme, valueColorKey, isNavbarLayout);
        return { iconType, valueColor, text, tooltip };
    }, [incidentsLast24h, isLoading, theme, isNavbarLayout]); // Depend on isLoading for initial state

    const containerSx: SxProps<Theme> = isNavbarLayout
        ? { display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', px: 1, minHeight: 'auto', overflow: 'hidden' }
        : {
            position: 'relative', // Needed for absolute positioning of the spinner
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            py: { xs: 1.5, sm: 2 },
            px: { xs: 1, sm: 2, md: 3 },
            minHeight: '76px'
          };

    const valueVariant = isNavbarLayout ? 'body2' : 'h6';
    const labelVariant = isNavbarLayout ? 'caption' : 'body2';
    const iconSize = isNavbarLayout ? '0.9rem' : '1.4rem';
    const gridSpacing = isNavbarLayout ? 1.2 : { xs: 1.5, sm: 2 };
    const valueLabelMargin = isNavbarLayout ? 0.2 : 0.5;

    // Show spinner in navbar only during initial load
    if (isLoading && isNavbarLayout) {
        return <Box sx={containerSx}><CircularProgress size={20} color="inherit" /></Box>;
    }
    // Dim stats section only during initial dashboard load
    const showDashboardLoading = isLoading && layoutMode === 'dashboard';

    const gridItemSize = isNavbarLayout ? 3 : { xs: 6, sm: 6, md: 3 };
    const canHighlightLastIncident = !isNavbarLayout && !!lastIncidentWebsiteId && !!onToggleHighlight;
    const canClickIncidents = !isNavbarLayout;

    const gridItemContentSx: SxProps<Theme> = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        width: '100%',
        p: isNavbarLayout ? 0.5 : 0,
        borderRadius: isNavbarLayout ? 1 : 0,
        minHeight: isNavbarLayout ? 'auto' : 50,
        opacity: showDashboardLoading ? 0.5 : 1,
        transition: theme.transitions.create('opacity'),
    };

    const clickableBoxSx = (isClickable: boolean, isActiveState: boolean = false): SxProps<Theme> => ({
        ...gridItemContentSx,
        cursor: isClickable ? 'pointer' : 'default',
        '&:hover': isClickable ? { bgcolor: alpha(theme.palette.action.hover, 0.1) } : {},
        bgcolor: !isNavbarLayout && isActiveState ? alpha(theme.palette.warning.light, 0.15) : 'transparent',
        transition: theme.transitions.create(['background-color', 'opacity']),
        opacity: showDashboardLoading ? 0.5 : 1,
    });

    const handleIncidentsClick = () => {
        if (canClickIncidents) {
            navigate('/incidents');
        }
    };

    return (
        <Box sx={containerSx}>
            {/* Top Right Refetch Indicator (Only in Dashboard Mode during refetch) */}
            {layoutMode === 'dashboard' && isRefetching && (
                <CircularProgress
                    size={20}
                    thickness={4}
                    sx={{
                        position: 'absolute',
                        top: theme.spacing(1.5), // Adjust as needed
                        right: theme.spacing(1.5), // Adjust as needed
                        zIndex: 2,
                    }}
                    data-testid="stats-header-refetch-indicator"
                 />
            )}

            {/* Stats Row */}
            <Grid
                container
                spacing={gridSpacing}
                justifyContent="space-around"
                alignItems="stretch"
                sx={isNavbarLayout ? { maxWidth: 420, width: '100%' } : { width: '100%', position: 'relative' }}
            >
                 {/* Loading overlay for dashboard INITIAL stats load */}
                 {showDashboardLoading && (
                    <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1 }}>
                        <CircularProgress size={24} color='primary' />
                    </Box>
                 )}

                {/* Stat 1: Status (Up/Total) */}
                <Grid size={gridItemSize} display="flex" flexDirection="column" alignItems="center">
                    <Tooltip title={statusProps.tooltip} placement="top">
                        <Box sx={gridItemContentSx}>
                           {statusProps.iconType && getIcon(statusProps.iconType, statusProps.valueColor, isNavbarLayout, iconSize)}
                          <Typography variant={valueVariant} component="div" fontWeight="medium" sx={{ color: statusProps.valueColor, lineHeight: 1.2 }}>
                            {statusProps.text}
                          </Typography>
                        </Box>
                    </Tooltip>
                    <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : showDashboardLoading ? 0.5 : 1 }}>
                        Status
                    </Typography>
                </Grid>

                {/* Stat 2: Uptime */}
                <Grid size={gridItemSize} display="flex" flexDirection="column" alignItems="center">
                   <Tooltip title="Overall Uptime (Last 7 Days)" placement="top">
                     <Box sx={gridItemContentSx}>
                        {getIcon(NetworkCheckIcon, getTextColor(theme, uptimeColorKey, isNavbarLayout), isNavbarLayout, iconSize)}
                       <Typography variant={valueVariant} component="div" fontWeight="medium" sx={{ color: getTextColor(theme, uptimeColorKey, isNavbarLayout), lineHeight: 1.2 }}>
                         {formattedUptimeValue}%
                       </Typography>
                     </Box>
                   </Tooltip>
                   <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : showDashboardLoading ? 0.5 : 1 }}>
                       Uptime (7d)
                   </Typography>
                </Grid>

                {/* Stat 3: Incidents Last 24 Hours */}
                <Grid size={gridItemSize} display="flex" flexDirection="column" alignItems="center">
                   <Tooltip title={incidentProps.tooltip} placement="top">
                     <Box
                         onClick={handleIncidentsClick}
                         sx={clickableBoxSx(canClickIncidents)}
                     >
                         {incidentProps.iconType && getIcon(incidentProps.iconType, incidentProps.valueColor, isNavbarLayout, iconSize)}
                       <Typography variant={valueVariant} component="div" fontWeight="medium" sx={{ color: incidentProps.valueColor, lineHeight: 1.2 }}>
                         {incidentProps.text}
                       </Typography>
                     </Box>
                   </Tooltip>
                   <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : showDashboardLoading ? 0.5 : 1 }}>
                        Incidents (24h)
                   </Typography>
                </Grid>

                {/* Stat 4: Time Since Last Incident */}
                <Grid size={gridItemSize} display="flex" flexDirection="column" alignItems="center">
                   <Tooltip
                       title={
                           isNavbarLayout ? `Last Incident: ${timeSinceLastIncident}` :
                           canHighlightLastIncident ? (isHighlightActive ? "Click to remove highlight" : "Click to highlight affected website") :
                           `Time since last incident started`
                       }
                       placement="top"
                       arrow={!isNavbarLayout}
                    >
                     <Box
                         onClick={canHighlightLastIncident ? onToggleHighlight : undefined}
                         sx={clickableBoxSx(canHighlightLastIncident, canHighlightLastIncident && isHighlightActive)}
                     >
                         {getIcon(HistoryIcon, theme.palette.text.secondary, isNavbarLayout, iconSize)}
                       <Typography
                            variant={valueVariant} component="div" fontWeight="medium"
                            sx={{ color: isNavbarLayout ? 'inherit' : theme.palette.text.primary, lineHeight: 1.2 }}
                       >
                         {timeSinceLastIncident}
                       </Typography>
                     </Box>
                   </Tooltip>
                   <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : showDashboardLoading ? 0.5 : 1 }}>
                       Last Incident
                   </Typography>
                </Grid>
            </Grid>

            {/* Controls Section (Only in Dashboard Mode) */}
            {showControls && (
                <>
                    <Divider sx={{ my: { xs: 1.5, sm: 2 } }} />

                    {/* --- Desktop Layout (sm and up) --- */}
                    <Stack
                        direction="row"
                        spacing={2}
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ display: { xs: 'none', sm: 'flex' }, width: '100%' }}
                    >
                         <Tooltip title={"TV Mode (Show only grid)"}>
                            <span>
                                <IconButton
                                    onClick={onToggleTvMode}
                                    color="default"
                                    aria-label="toggle tv mode"
                                    disabled={isLoading} // Disable only during initial load
                                >
                                    <TvIcon />
                                </IconButton>
                            </span>
                        </Tooltip>

                        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', px: 2 }}>
                            <DashboardSearchFilter
                                onFilterChange={onFilterChange}
                                sx={{ width: '100%', maxWidth: { sm: 350, md: 450 } }}
                                initialValue={filterTerm}
                            />
                        </Box>

                        <DashboardSortControl
                            sortOption={sortOption}
                            onSortChange={onSortChange}
                            // isFetching prop removed
                        />
                    </Stack>

                    {/* --- Mobile Layout (xs) --- */}
                    <Box sx={{ display: { xs: 'block', sm: 'none' }, width: '100%' }}>
                        <Box sx={{ mb: 1.5 }}>
                           <DashboardSearchFilter
                                onFilterChange={onFilterChange}
                                sx={{ width: '100%', maxWidth: '100%' }}
                                initialValue={filterTerm}
                            />
                        </Box>

                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            spacing={1}
                        >
                             <Tooltip title={"TV Mode (Show only grid)"}>
                                <span>
                                    <IconButton
                                        onClick={onToggleTvMode}
                                        color="default"
                                        aria-label="toggle tv mode"
                                        disabled={isLoading} // Disable only during initial load
                                        size="medium"
                                    >
                                        <TvIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>

                             <DashboardSortControl
                                sortOption={sortOption}
                                onSortChange={onSortChange}
                                // isFetching prop removed
                            />
                        </Stack>
                    </Box>
                </>
            )}
        </Box>
    );
};

export default StatsHeader;