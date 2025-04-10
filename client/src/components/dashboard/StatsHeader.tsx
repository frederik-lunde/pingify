/*
src/components/dashboard/StatsHeader.tsx
*/
import React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid2'; // Use Grid2 for better spacing control
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import HistoryIcon from '@mui/icons-material/History';
import { useTheme, Theme, alpha } from '@mui/material/styles';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { ApiError } from '../../types';
import { getStatusColor, formatUptime } from '../../utils/statusUtils';
import { useTimeSince } from '../../hooks';
import { useNavigate } from 'react-router';

type StatusColorKey = 'success' | 'warning' | 'error' | 'default';

interface StatsHeaderProps {
    isLoading: boolean;
    error: ApiError | null;
    upCount: number; // Websites currently considered "up"
    totalCount: number; // Total websites monitored by the user
    uptime: number | null | undefined; // Overall uptime (e.g., last 7 days)
    incidentsLast24h: number | null | undefined; // Count of incidents started in last 24h
    lastIncidentTimestamp: string | null | undefined; // Timestamp of the most recent incident start
    center?: boolean; // Layout mode (true for navbar, false for dashboard header)
    lastIncidentWebsiteId?: number | null | undefined; // ID of website with the last incident
    onToggleHighlight?: () => void; // Callback to toggle highlight on the dashboard
    isHighlightActive?: boolean; // Whether the highlight is currently active
    // REMOVED: onShowDownWebsites, showDownWebsites - Replaced by navigating to incidents page
}

// Helper to get text color based on theme, status, and layout
const getTextColor = (theme: Theme, colorKey: StatusColorKey, isNavbar: boolean): string => {
    if (isNavbar) {
        // Use white for colored statuses in navbar, inherit (usually white) for default
        return colorKey === 'default' ? 'inherit' : theme.palette.common.white;
    }
    // Use theme colors for dashboard header
    if (colorKey === 'default') {
        return theme.palette.text.secondary;
    }
    // Ensure the color key exists before accessing it
    return theme.palette[colorKey]?.main || theme.palette.text.primary;
};

// Helper to render icons (or null if in navbar layout)
const getIcon = (IconComponent: React.ElementType, color: string, isNavbar: boolean, iconSize: string) => {
    if (isNavbar) return null; // No icons in the compact navbar version
    return <IconComponent fontSize="inherit" sx={{ color, fontSize: iconSize, lineHeight: 1, mb: 0.5 }} />;
};

const StatsHeader: React.FC<StatsHeaderProps> = ({
    isLoading,
    error,
    upCount,
    totalCount,
    uptime,
    incidentsLast24h,
    lastIncidentTimestamp,
    center = false,
    lastIncidentWebsiteId,
    onToggleHighlight,
    isHighlightActive = false,
}) => {
    const theme = useTheme();
    const navigate = useNavigate(); // Hook for navigation
    const isNavbarLayout = center;

    // Calculate time since last incident using the custom hook
    const timeSinceLastIncident = useTimeSince(lastIncidentTimestamp, {
        noIncidentText: isNavbarLayout ? 'None' : 'No recent incidents',
        errorText: 'Invalid Date',
        updateIntervalMs: 30000 // Update every 30 seconds for more freshness
    });

    // Determine color and format for uptime display
    const uptimeColorKey = getStatusColor(uptime);
    const formattedUptimeValue = formatUptime(uptime);

    // --- Memoized Props for Status Display ---
    const statusProps = React.useMemo(() => {
        let iconType: React.ElementType | null = null;
        let valueColorKey: StatusColorKey = 'default';
        let text: string;
        let tooltip: string;

        if (isLoading) { // Handle loading state explicitly
             iconType = null; valueColorKey = 'default'; text = "- / -"; tooltip = 'Loading status...';
        } else if (totalCount === 0) {
            iconType = ErrorOutlineIcon; valueColorKey = 'default'; text = "0 / 0"; tooltip = 'No websites monitored';
        } else if (upCount === totalCount) {
            // All websites are considered up (no 'down' incidents)
            iconType = CheckCircleOutlineIcon; valueColorKey = 'success'; text = `${upCount} / ${totalCount}`; tooltip = 'All monitored websites are currently up';
        } else {
            // If upCount < totalCount, indicate issues (at least one website has a 'down' incident)
            iconType = WarningAmberIcon; valueColorKey = 'error'; text = `${upCount} / ${totalCount}`; tooltip = `${totalCount - upCount} website(s) currently experiencing issues`;
        }
        const valueColor = getTextColor(theme, valueColorKey, isNavbarLayout);
        return { iconType, valueColor, text, tooltip };
    }, [totalCount, upCount, isLoading, theme, isNavbarLayout]);

    // --- Memoized Props for Incident Display ---
    const incidentProps = React.useMemo(() => {
        let iconType: React.ElementType | null = null;
        let valueColorKey: StatusColorKey = 'default';
        let text: string;
        let tooltip: string;

        if (isLoading || incidentsLast24h === null || incidentsLast24h === undefined) {
            iconType = null; valueColorKey = 'default'; text = '-'; tooltip = 'Loading incident count...';
        } else if (incidentsLast24h > 0) {
            // Incidents occurred in the last 24h
            iconType = ReportProblemOutlinedIcon; valueColorKey = 'warning'; text = incidentsLast24h.toString(); tooltip = `${incidentsLast24h} incident(s) started in the last 24 hours. Click to view incidents.`;
        } else {
            // No incidents in the last 24h
            iconType = CheckCircleOutlineIcon; valueColorKey = 'success'; text = '0'; tooltip = 'No new incidents started in the last 24 hours.';
        }
        const valueColor = getTextColor(theme, valueColorKey, isNavbarLayout);
        return { iconType, valueColor, text, tooltip };
    }, [incidentsLast24h, isLoading, theme, isNavbarLayout]);

    // --- Define Container Styles based on layout ---
    const containerSx = isNavbarLayout
        ? { display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', px: 1, minHeight: 'auto', overflow: 'hidden' }
        : { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', py: 2.25, px: { xs: 1, sm: 2, md: 3 }, minHeight: '76px' };

    // --- Define Responsive Styles based on layout ---
    const valueVariant = isNavbarLayout ? 'body2' : 'h6';
    const labelVariant = isNavbarLayout ? 'caption' : 'body2';
    const iconSize = isNavbarLayout ? '0.9rem' : '1.4rem'; // Icons only shown in dashboard header
    const gridSpacing = isNavbarLayout ? 1.2 : { xs: 1.5, sm: 2 };
    const valueLabelMargin = isNavbarLayout ? 0.2 : 0.5;

    // --- Loading State ---
    if (isLoading && isNavbarLayout) { // Simpler loading for navbar
        return <Box sx={containerSx}><CircularProgress size={20} color="inherit" /></Box>;
    }
    if (isLoading && !isNavbarLayout) { // Loading for dashboard header
        return (
            <Box sx={{ ...containerSx, justifyContent: 'center', alignItems: 'center' }}>
                <CircularProgress size={24} color='primary' />
            </Box>
        );
    }

    // --- Error State (only shown in dashboard header, not navbar) ---
    if (error && !isNavbarLayout) {
        return (
             <Box sx={{ ...containerSx, alignItems: 'center', justifyContent: 'center', py: 1 }}>
                 <Alert severity="error" icon={<ErrorOutlineIcon fontSize="inherit" />} sx={{ width: '100%', justifyContent: 'center' }}>
                     Stats unavailable: {error.message || 'Loading error'}
                 </Alert>
             </Box>
        );
    }

    // --- Define Responsive Grid Item Size ---
    const gridItemSize = isNavbarLayout ? 3 : { xs: 6, sm: 6, md: 3 };

    // Determine if highlight/click actions are enabled (only for dashboard header)
    const canHighlightLastIncident = !isNavbarLayout && !!lastIncidentWebsiteId && !!onToggleHighlight;
    // Determine if clicking incidents navigates (only for dashboard header)
    const canClickIncidents = !isNavbarLayout;

    // --- Base styles for the content box inside each grid item ---
    const gridItemContentSx = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        width: '100%',
        p: isNavbarLayout ? 0.5 : 0,
        borderRadius: isNavbarLayout ? 1 : 0,
        minHeight: isNavbarLayout ? 'auto' : 50,
    };

    // --- Styles for clickable boxes, applying hover/active states ---
    const clickableBoxSx = (isClickable: boolean, isActiveState: boolean = false) => ({
        ...gridItemContentSx,
        cursor: isClickable ? 'pointer' : 'default',
        '&:hover': isClickable ? { bgcolor: alpha(theme.palette.action.hover, 0.1) } : {},
        // Use warning color for highlight active state
        bgcolor: !isNavbarLayout && isActiveState ? alpha(theme.palette.warning.light, 0.15) : 'transparent',
        transition: theme.transitions.create('background-color'),
    });

    // --- Navigation Handler for Incidents ---
    const handleIncidentsClick = () => {
        if (canClickIncidents) {
            navigate('/incidents'); // Navigate to the incidents page (ensure this route exists)
        }
    };

    // --- Render the Stats Header ---
    return (
        <Box sx={containerSx}>
            <Grid
                container
                spacing={gridSpacing}
                justifyContent="space-around"
                alignItems="stretch"
                sx={isNavbarLayout ? { maxWidth: 420, width: '100%' } : { width: '100%' }}
            >
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
                    <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : 1 }}>
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
                   <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : 1 }}>
                       Uptime (7d)
                   </Typography>
                </Grid>

                {/* Stat 3: Incidents Last 24 Hours */}
                <Grid size={gridItemSize} display="flex" flexDirection="column" alignItems="center">
                   <Tooltip title={incidentProps.tooltip} placement="top">
                     {/* Clickable box for incidents */}
                     <Box
                         onClick={handleIncidentsClick} // Navigate on click in dashboard
                         sx={clickableBoxSx(canClickIncidents)} // Apply clickable style in dashboard
                     >
                         {incidentProps.iconType && getIcon(incidentProps.iconType, incidentProps.valueColor, isNavbarLayout, iconSize)}
                       <Typography variant={valueVariant} component="div" fontWeight="medium" sx={{ color: incidentProps.valueColor, lineHeight: 1.2 }}>
                         {incidentProps.text}
                       </Typography>
                     </Box>
                   </Tooltip>
                   <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : 1 }}>
                        Incidents (24h)
                   </Typography>
                </Grid>

                {/* Stat 4: Time Since Last Incident */}
                <Grid size={gridItemSize} display="flex" flexDirection="column" alignItems="center">
                   <Tooltip
                       title={
                           isNavbarLayout ? `Last Incident: ${timeSinceLastIncident}` :
                           canHighlightLastIncident ? (isHighlightActive ? "Click to remove highlight" : "Click to highlight affected website") :
                           `Time since last incident started` // Updated tooltip text
                       }
                       placement="top"
                       arrow={!isNavbarLayout}
                    >
                     {/* Clickable box for highlight action */}
                     <Box
                         onClick={canHighlightLastIncident ? onToggleHighlight : undefined}
                         sx={clickableBoxSx(canHighlightLastIncident, canHighlightLastIncident && isHighlightActive)} // Apply clickable and active styles
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
                   <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : 1 }}>
                       Last Incident
                   </Typography>
                </Grid>
            </Grid>
        </Box>
    );
};

export default StatsHeader;