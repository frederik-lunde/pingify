/*
src/components/dashboard/StatsHeader.tsx
*/
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
import { useTheme, Theme, alpha } from '@mui/material/styles';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { ApiError } from '../../types';
import { getStatusColor, formatUptime } from '../../utils/statusUtils';
import { useTimeSince } from '../../hooks';

type StatusColorKey = 'success' | 'warning' | 'error' | 'default';

interface StatsHeaderProps {
    isLoading: boolean;
    error: ApiError | null;
    upCount: number;
    totalCount: number;
    uptime: number | null | undefined;
    incidentsLast24h: number | null | undefined;
    lastIncidentTimestamp: string | null | undefined;
    center?: boolean;
    lastIncidentWebsiteId?: number | null | undefined;
    onToggleHighlight?: () => void;
    isHighlightActive?: boolean;
    onShowDownWebsites: () => void;
    showDownWebsites: boolean;
}

// Helper to get text color based on theme, status, and layout
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
    onShowDownWebsites,
    showDownWebsites,
}) => {
    const theme = useTheme();
    const isNavbarLayout = center;

    const timeSinceLastIncident = useTimeSince(lastIncidentTimestamp, {
        noIncidentText: isNavbarLayout ? 'None' : 'No recent incidents'
    });
    const uptimeColorKey = getStatusColor(uptime);
    const formattedUptimeValue = formatUptime(uptime);

    const statusProps = React.useMemo(() => {
        let iconType: React.ElementType | null = null;
        let valueColorKey: StatusColorKey = 'default';
        let text: string;
        let tooltip: string;

        if (totalCount === 0 && !isLoading) {
            iconType = ErrorOutlineIcon; valueColorKey = 'default'; text = "0 / 0"; tooltip = 'No websites monitored';
        } else if (upCount === totalCount && totalCount > 0) {
            iconType = CheckCircleOutlineIcon; valueColorKey = 'success'; text = `${upCount} / ${totalCount}`; tooltip = 'All websites are up';
        } else {
            iconType = WarningAmberIcon; valueColorKey = totalCount > 0 ? 'error' : 'default'; text = `${upCount} / ${totalCount}`; tooltip = `${totalCount - upCount} website(s) are down or having issues`;
        }
        const valueColor = getTextColor(theme, valueColorKey, isNavbarLayout);
        return { iconType, valueColor, text, tooltip };
    }, [totalCount, upCount, isLoading, theme, isNavbarLayout]);

    const incidentProps = React.useMemo(() => {
        let iconType: React.ElementType | null = null;
        let valueColorKey: StatusColorKey = 'default';
        let text: string;

        if (incidentsLast24h === null || incidentsLast24h === undefined) {
            iconType = ReportProblemOutlinedIcon; valueColorKey = 'default'; text = '-';
        } else if (incidentsLast24h > 0) {
            iconType = ReportProblemOutlinedIcon; valueColorKey = 'warning'; text = incidentsLast24h.toString();
        } else {
            iconType = CheckCircleOutlineIcon; valueColorKey = 'success'; text = '0';
        }
        const valueColor = getTextColor(theme, valueColorKey, isNavbarLayout);
        return { iconType, valueColor, text };
    }, [incidentsLast24h, theme, isNavbarLayout]);

    // --- Define Container Styles based on layout ---
    const containerSx = isNavbarLayout
        ? { display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', px: 1, minHeight: 'auto', overflow: 'hidden' }
        : { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', py: 2.25, px: { xs: 1, sm: 2, md: 3 }, minHeight: '76px' };

    // --- Define Responsive Styles based on layout ---
    const valueVariant = isNavbarLayout ? 'body2' : 'h6';
    const labelVariant = isNavbarLayout ? 'caption' : 'body2';
    const iconSize = isNavbarLayout ? '0.9rem' : '1.4rem';
    const gridSpacing = isNavbarLayout ? 1.2 : { xs: 1.5, sm: 2 };
    const valueLabelMargin = isNavbarLayout ? 0.2 : 0.5;

    // --- Loading State ---
    if (isLoading) {
        return (
            <Box sx={{ ...containerSx, justifyContent: 'center', alignItems: 'center' }}>
                <CircularProgress size={isNavbarLayout ? 20 : 24} color={isNavbarLayout ? 'inherit' : 'primary'} />
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
    const canHighlight = !isNavbarLayout && !!lastIncidentWebsiteId && !!onToggleHighlight;
    const canClickIncidents = !isNavbarLayout && incidentsLast24h !== null && incidentsLast24h !== undefined;

    // --- Base styles for the content box inside each grid item ---
    const gridItemContentSx = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center', // Ensure text is centered
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
        bgcolor: !isNavbarLayout && isActiveState ? alpha(theme.palette.warning.light, 0.15) : 'transparent',
        transition: theme.transitions.create('background-color'),
    });

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
                    {/* Tooltip provides details on hover */}
                    <Tooltip title={statusProps.tooltip}>
                        {/* Box containing icon and value */}
                        <Box sx={gridItemContentSx}>
                           {/* Render icon if available */}
                           {statusProps.iconType && getIcon(statusProps.iconType, statusProps.valueColor, isNavbarLayout, iconSize)}
                          {/* Display status value */}
                          <Typography variant={valueVariant} component="div" fontWeight="medium" sx={{ color: statusProps.valueColor, lineHeight: 1.2 }}>
                            {statusProps.text}
                          </Typography>
                        </Box>
                    </Tooltip>
                    {/* Display label */}
                    <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : 1 }}>
                        Status
                    </Typography>
                </Grid>

                {/* Stat 2: Uptime */}
                <Grid size={gridItemSize} display="flex" flexDirection="column" alignItems="center">
                   <Tooltip title="Overall Uptime (Last 7 Days)">
                     <Box sx={gridItemContentSx}>
                        {/* Uptime icon */}
                        {getIcon(NetworkCheckIcon, getTextColor(theme, uptimeColorKey, isNavbarLayout), isNavbarLayout, iconSize)}
                       {/* Uptime value */}
                       <Typography variant={valueVariant} component="div" fontWeight="medium" sx={{ color: getTextColor(theme, uptimeColorKey, isNavbarLayout), lineHeight: 1.2 }}>
                         {formattedUptimeValue}%
                       </Typography>
                     </Box>
                   </Tooltip>
                   {/* Uptime label */}
                   <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : 1 }}>
                       Uptime (7d)
                   </Typography>
                </Grid>

                {/* Stat 3: Incidents Last 24 Hours */}
                <Grid size={gridItemSize} display="flex" flexDirection="column" alignItems="center">
                   <Tooltip title={
                       // Different tooltip based on layout and state
                       isNavbarLayout ? `Incidents (24h): ${incidentProps.text}` :
                       showDownWebsites ? "Click to show all websites" :
                       (incidentsLast24h && incidentsLast24h > 0 ? "Click to show down websites" : "No incidents in last 24 hours")
                   }>
                     {/* Clickable box for incidents */}
                     <Box
                         // Attach click handler if applicable
                         onClick={canClickIncidents ? onShowDownWebsites : undefined}
                         // Apply clickable styles and active state if showing down websites
                         sx={clickableBoxSx(canClickIncidents, !isNavbarLayout && showDownWebsites)}
                     >
                         {/* Incident icon */}
                         {incidentProps.iconType && getIcon(incidentProps.iconType, incidentProps.valueColor, isNavbarLayout, iconSize)}
                       {/* Incident value */}
                       <Typography variant={valueVariant} component="div" fontWeight="medium" sx={{ color: incidentProps.valueColor, lineHeight: 1.2 }}>
                         {incidentProps.text}
                       </Typography>
                     </Box>
                   </Tooltip>
                   {/* Incident label */}
                   <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : 1 }}>
                        Incidents (24h)
                   </Typography>
                </Grid>

                {/* Stat 4: Time Since Last Incident */}
                <Grid size={gridItemSize} display="flex" flexDirection="column" alignItems="center">
                   <Tooltip
                       title={
                           // Different tooltip based on layout and state
                           isNavbarLayout ? `Last Incident: ${timeSinceLastIncident}` :
                           canHighlight ? (isHighlightActive ? "Click to remove highlight" : "Click to highlight affected website") :
                           `Time since last downtime (up to 30 days)`
                       }
                       placement="top" // Better placement for potentially longer text
                       arrow={!isNavbarLayout} // Show arrow only in dashboard
                    >
                     {/* Clickable box for highlight action */}
                     <Box
                         // Attach click handler if highlight is possible
                         onClick={canHighlight ? onToggleHighlight : undefined}
                         // Apply clickable styles and active state if highlight is on
                         sx={clickableBoxSx(canHighlight, canHighlight && isHighlightActive)}
                     >
                         {/* History icon */}
                         {getIcon(HistoryIcon, theme.palette.text.secondary, isNavbarLayout, iconSize)}
                       {/* Time since value */}
                       <Typography
                            variant={valueVariant} component="div" fontWeight="medium"
                            // Use inherit color for navbar, primary text for dashboard
                            sx={{ color: isNavbarLayout ? 'inherit' : theme.palette.text.primary, lineHeight: 1.2 }}
                       >
                         {timeSinceLastIncident}
                       </Typography>
                     </Box>
                   </Tooltip>
                   {/* Last incident label */}
                   <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : 1 }}>
                       Last Incident
                   </Typography>
                </Grid>
            </Grid>
        </Box>
    );
};

export default StatsHeader;