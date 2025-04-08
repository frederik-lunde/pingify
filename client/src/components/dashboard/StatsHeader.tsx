/*
src/components/StatsHeader.tsx
*/
import React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import HistoryIcon from '@mui/icons-material/History';
import { useTheme, Theme, alpha } from '@mui/material/styles';
import { ApiError } from '../../types'; // Adjust path if needed
import { getStatusColor, formatUptime } from '../../utils/statusUtils'; // Adjust path if needed
import { useTimeSince } from '../../hooks'; // Adjust path if needed

type StatusColorKey = 'success' | 'warning' | 'error' | 'default';

interface StatsHeaderProps {
    isLoading: boolean;
    error: ApiError | null;
    upCount: number;
    totalCount: number;
    uptime: number | null | undefined;
    incidentsLast24h: number | null | undefined;
    lastIncidentTimestamp: string | null | undefined;
    center?: boolean; // true = Navbar layout, false = Dashboard layout
    // Props for highlighting (only used effectively when center=false)
    lastIncidentWebsiteId?: number | null | undefined;
    onToggleHighlight?: () => void;
    isHighlightActive?: boolean;
}

// Helper: getTextColor (unchanged)
const getTextColor = (theme: Theme, colorKey: StatusColorKey, isNavbar: boolean): string => {
    if (isNavbar) {
        return colorKey === 'default' ? 'inherit' : theme.palette.common.white;
    }
    if (colorKey === 'default') {
        return theme.palette.text.secondary;
    }
    return theme.palette[colorKey]?.main || theme.palette.text.primary;
};

// Helper: getIncidentProps (unchanged)
const getIncidentProps = (theme: Theme, count: number | null | undefined, isNavbar: boolean) => {
    let iconComponent: React.ReactNode = null;
    let valueColor: string;
    let text: string;

    if (count === null || count === undefined) {
        valueColor = getTextColor(theme, 'default', isNavbar);
        if (!isNavbar) { iconComponent = <ReportProblemOutlinedIcon fontSize="inherit" sx={{ color: theme.palette.action.disabled }} />; }
        text = '-';
    } else if (count > 0) {
        valueColor = isNavbar ? theme.palette.common.white : theme.palette.warning.main;
        if (!isNavbar) { iconComponent = <ReportProblemOutlinedIcon fontSize="inherit" sx={{ color: valueColor }} />; }
        text = count.toString();
    } else {
        valueColor = isNavbar ? 'inherit' : theme.palette.success.main;
        if (!isNavbar) { iconComponent = <CheckCircleOutlineIcon fontSize="inherit" sx={{ color: valueColor }} />; }
        text = '0';
    }
    return { icon: iconComponent, valueColor, text };
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
    const isNavbarLayout = center;

    const timeSinceLastIncident = useTimeSince(lastIncidentTimestamp, {
        noIncidentText: isNavbarLayout ? 'None' : 'No recent incidents'
    });

    // --- Status Props (unchanged) ---
    const getStatusProps = () => {
        let iconComponent: React.ReactNode = null;
        let valueColor: string;
        let text: string;
        let tooltip: string;

        if (totalCount === 0 && !isLoading) {
            const iconColor = isNavbarLayout ? 'inherit' : theme.palette.action.disabled;
            valueColor = isNavbarLayout ? 'inherit' : theme.palette.text.disabled;
            if (!isNavbarLayout) { iconComponent = <ErrorOutlineIcon fontSize="inherit" sx={{ color: iconColor }} />; }
            text = "0 / 0"; tooltip = 'No websites monitored';
        } else if (upCount === totalCount) {
            const iconColor = isNavbarLayout ? theme.palette.common.white : theme.palette.success.main;
            valueColor = isNavbarLayout ? theme.palette.common.white : theme.palette.success.main;
            if (!isNavbarLayout) iconComponent = <CheckCircleOutlineIcon fontSize="inherit" sx={{ color: iconColor }} />;
            text = `${upCount} / ${totalCount}`; tooltip = 'All websites are up';
        } else {
            const iconColor = isNavbarLayout ? theme.palette.common.white : theme.palette.error.main;
            valueColor = isNavbarLayout ? theme.palette.common.white : theme.palette.error.main;
            if (!isNavbarLayout) iconComponent = <WarningAmberIcon fontSize="inherit" sx={{ color: iconColor }} />;
            text = `${upCount} / ${totalCount}`; tooltip = `${totalCount - upCount} website(s) are down or having issues`;
        }
        return { icon: iconComponent, valueColor, text, tooltip };
    };
    const statusProps = getStatusProps();
    const uptimeColorKey = getStatusColor(uptime);
    const incidentProps = getIncidentProps(theme, incidentsLast24h, isNavbarLayout);

    // --- Container Styling ---
    const containerSx = isNavbarLayout
        ? { // Navbar: Center content vertically and horizontally within its allocated space
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center', // Vertically center the Grid container
            justifyContent: 'center', // Horizontally center the Grid container
            width: '100%', // Use full width of its parent flex item
            height: '100%', // Use full height of the AppBar
            px: 1,
            minHeight: 'auto',
            overflow: 'hidden',
          }
        : { // Dashboard styles
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            py: 2.25,
            px: { xs: 1, sm: 2, md: 3 },
            minHeight: '76px'
          };

    // --- Dynamic Font Sizes & Spacing ---
    // Slightly larger Navbar fonts, tighter spacing
    const valueVariant = isNavbarLayout ? 'body2' : 'h6'; // body2 is a bit larger than caption
    const labelVariant = isNavbarLayout ? 'caption' : 'body2';
    const iconSize = isNavbarLayout ? '0.9rem' : '1.4rem';
    const gridSpacing = isNavbarLayout ? 1.2 : { xs: 1.5, sm: 2, md: 3 }; // Slightly more navbar spacing
    const valueTopMargin = isNavbarLayout ? 0 : 0.5; // No top margin in navbar (no icon)
    const valueLabelMargin = isNavbarLayout ? 0.2 : 0.5; // Slightly more margin below value in navbar

    // --- Loading / Error Display (unchanged) ---
    if (isLoading) { /* ... */ }
    if (error) { /* ... */ }

    // --- Grid Item Size (Always 4 items) ---
    const gridItemSize = 3;

    // Determine if the Last Incident stat is interactive (only in Dashboard)
    const canHighlight = !isNavbarLayout && !!lastIncidentWebsiteId && !!onToggleHighlight;

    // --- Render Grid Layout ---
    return (
        <Box sx={containerSx}>
            {/* Constrain Grid width in Navbar for better alignment/appearance */}
            <Grid
                container
                spacing={gridSpacing}
                justifyContent="center" // Center items within the grid
                alignItems="center" // Vertically align items within the grid row
                sx={ isNavbarLayout ? { maxWidth: 420, width: '100%' } : {} } // Constrain max width in Navbar
            >

                {/* Stat 1: Status (Up/Total) */}
                <Grid item xs={gridItemSize} textAlign="center">
                    <Tooltip title={statusProps.tooltip}>
                        {/* Remove hover effect for Navbar */}
                        <Box sx={isNavbarLayout ? { p: 0.5, borderRadius: 1 } : {}}>
                           {/* Icon only in Dashboard */}
                           {!isNavbarLayout && statusProps.icon && (
                               <Typography component="span" variant="inherit" sx={{ fontSize: iconSize, lineHeight: 1.1, display: 'block', color: statusProps.valueColor }}>
                                  {statusProps.icon}
                               </Typography>
                           )}
                           {/* Value */}
                          <Typography
                            variant={valueVariant} component="div" fontWeight="medium"
                            sx={{ color: statusProps.valueColor, lineHeight: 1.2, mt: valueTopMargin }}
                          >
                            {statusProps.text}
                          </Typography>
                        </Box>
                    </Tooltip>
                    {/* Label */}
                    <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : 1 }}>
                        Status
                    </Typography>
                </Grid>

                {/* Stat 2: Uptime */}
                <Grid item xs={gridItemSize} textAlign="center">
                   <Tooltip title="Overall Uptime (Last 7 Days)">
                     {/* Remove hover effect for Navbar */}
                     <Box sx={isNavbarLayout ? { p: 0.5, borderRadius: 1 } : {}}>
                        {/* Icon only in Dashboard */}
                        {!isNavbarLayout && (
                            <Typography component="span" variant="inherit" sx={{ fontSize: iconSize, lineHeight: 1.1, display: 'block', color: getTextColor(theme, uptimeColorKey, isNavbarLayout) }}>
                               <NetworkCheckIcon fontSize="inherit" />
                            </Typography>
                        )}
                        {/* Value */}
                       <Typography
                            variant={valueVariant} component="div" fontWeight="medium"
                            sx={{ color: getTextColor(theme, uptimeColorKey, isNavbarLayout), lineHeight: 1.2, mt: valueTopMargin }}
                       >
                         {formatUptime(uptime)}%
                       </Typography>
                     </Box>
                   </Tooltip>
                    {/* Label */}
                   <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : 1 }}>
                       Uptime (7d)
                   </Typography>
                </Grid>

                {/* Stat 3: Incidents Last 24 Hours */}
                <Grid item xs={gridItemSize} textAlign="center">
                   <Tooltip title="Incidents (Down) reported in the last 24 hours">
                     {/* Remove hover effect for Navbar */}
                     <Box sx={isNavbarLayout ? { p: 0.5, borderRadius: 1 } : {}}>
                         {/* Icon only in Dashboard */}
                         {!isNavbarLayout && incidentProps.icon && (
                             <Typography component="span" variant="inherit" sx={{ fontSize: iconSize, lineHeight: 1.1, display: 'block', color: incidentProps.valueColor }}>
                                {incidentProps.icon}
                             </Typography>
                         )}
                         {/* Value */}
                       <Typography
                            variant={valueVariant} component="div" fontWeight="medium"
                            sx={{ color: incidentProps.valueColor, lineHeight: 1.2, mt: valueTopMargin }}
                        >
                         {incidentProps.text}
                       </Typography>
                     </Box>
                   </Tooltip>
                    {/* Label */}
                   <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : 1 }}>
                        Incidents (24h)
                   </Typography>
                </Grid>

                {/* Stat 4: Time Since Last Incident */}
                <Grid item xs={gridItemSize} textAlign="center">
                   <Tooltip
                       title={canHighlight ? (isHighlightActive ? "Click to remove highlight" : "Click to highlight affected website") : `Time elapsed since the last detected downtime incident (up to 30 days)`}
                       placement="top"
                       arrow
                    >
                     {/* Interactive Box for Dashboard, Static Box for Navbar */}
                     <Box
                         onClick={canHighlight ? onToggleHighlight : undefined} // Click only if canHighlight
                         sx={{
                             cursor: canHighlight ? 'pointer' : 'default', // Pointer only if canHighlight
                             p: 0.5, borderRadius: 1,
                             // Hover and active styles ONLY if canHighlight (i.e., not in Navbar)
                             '&:hover': canHighlight ? { bgcolor: alpha(theme.palette.action.hover, 0.1) } : {}, // NO hover in Navbar
                             bgcolor: canHighlight && isHighlightActive ? alpha(theme.palette.warning.light, 0.15) : 'transparent', // Active bg only if canHighlight
                             transition: theme.transitions.create('background-color') // Keep transition for active state change
                         }}
                     >
                         {/* Icon only in Dashboard */}
                         {!isNavbarLayout && (
                            <Typography component="span" variant="inherit" sx={{ fontSize: iconSize, lineHeight: 1.1, display: 'block', color: theme.palette.text.secondary }}>
                                <HistoryIcon fontSize="inherit" />
                            </Typography>
                         )}
                         {/* Value */}
                       <Typography
                            variant={valueVariant} component="div" fontWeight="medium"
                            sx={{ color: theme.palette.text.primary, lineHeight: 1.2, mt: valueTopMargin }}
                       >
                         {timeSinceLastIncident}
                       </Typography>
                     </Box>
                   </Tooltip>
                   {/* Label */}
                   <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : 1 }}>
                       Last Incident
                   </Typography>
                </Grid>

            </Grid>
        </Box>
    );
};

export default StatsHeader;