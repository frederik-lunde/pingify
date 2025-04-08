// src/components/dashboard/StatsHeader.tsx
// No changes needed based on the merge, assuming the provided version is correct.
// It already accepts and uses the highlighting props.

import React from 'react';
//
import Box from '@mui/material/Box';
//
import Grid from '@mui/material/Grid';
//
import Typography from '@mui/material/Typography';
//
import Tooltip from '@mui/material/Tooltip';
//
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
//
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
//
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
//
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
//
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
//
import HistoryIcon from '@mui/icons-material/History';
//
import { useTheme, Theme, alpha } from '@mui/material/styles';
//
import CircularProgress from '@mui/material/CircularProgress'; // Import CircularProgress
//
import Alert from '@mui/material/Alert'; // Import Alert
//
import { ApiError } from '../../types'; // Adjust path if needed
//
import { getStatusColor, formatUptime } from '../../utils/statusUtils'; // Adjust path if needed
//
import { useTimeSince } from '../../hooks'; // Adjust path if needed

type StatusColorKey = 'success' | 'warning' | 'error' | 'default';

interface StatsHeaderProps {
    isLoading: boolean;
    //
    error: ApiError | null;
    //
    upCount: number;
    //
    totalCount: number;
    //
    uptime: number | null | undefined;
    //
    incidentsLast24h: number | null | undefined;
    //
    lastIncidentTimestamp: string | null | undefined;
    //
    center?: boolean; // true = Navbar layout, false = Dashboard layout
    //
    // Props for highlighting (only used effectively when center=false)
    lastIncidentWebsiteId?: number | null | undefined;
    //
    onToggleHighlight?: () => void;
    //
    isHighlightActive?: boolean;
}

// Helper: getTextColor
const getTextColor = (theme: Theme, colorKey: StatusColorKey, isNavbar: boolean): string => {
    if (isNavbar) {
        // Navbar text is often white or inherited based on theme
        return colorKey === 'default' ? 'inherit' : theme.palette.common.white;
        //
    }
    // Dashboard text colors
    if (colorKey === 'default') {
        return theme.palette.text.secondary;
        //
    }
    // Use theme colors, fallback to primary text
    return theme.palette[colorKey]?.main || theme.palette.text.primary;
    //
};

// Helper: getIncidentProps
const getIncidentProps = (theme: Theme, count: number | null | undefined, isNavbar: boolean) => {
    let iconComponent: React.ReactNode = null;
    //
    let valueColor: string;
    //
    let text: string;
    //

    if (count === null || count === undefined) {
        // Data not loaded or unavailable
        valueColor = getTextColor(theme, 'default', isNavbar);
        //
        if (!isNavbar) { iconComponent = <ReportProblemOutlinedIcon fontSize="inherit" sx={{ color: theme.palette.action.disabled }} />; }
        //
        text = '-';
        //
    } else if (count > 0) {
        // Incidents occurred
        valueColor = isNavbar ? theme.palette.common.white : theme.palette.warning.main; // Use warning color in dashboard
        //
        if (!isNavbar) { iconComponent = <ReportProblemOutlinedIcon fontSize="inherit" sx={{ color: valueColor }} />; }
        //
        text = count.toString();
        //
    } else {
        // No incidents
        valueColor = isNavbar ? 'inherit' : theme.palette.success.main; // Use success color in dashboard
        //
        if (!isNavbar) { iconComponent = <CheckCircleOutlineIcon fontSize="inherit" sx={{ color: valueColor }} />; }
        //
        text = '0';
        //
    }
    return { icon: iconComponent, valueColor, text };
    //
};


const StatsHeader: React.FC<StatsHeaderProps> = ({
    isLoading,
    //
    error,
    //
    upCount,
    //
    totalCount,
    //
    uptime,
    //
    incidentsLast24h,
    //
    lastIncidentTimestamp,
    //
    center = false, // Default to dashboard layout
    //
    lastIncidentWebsiteId,
    //
    onToggleHighlight,
    //
    isHighlightActive = false,
    //
}) => {
    const theme = useTheme();
    //
    const isNavbarLayout = center;
    //

    // Hook to format time since last incident
    const timeSinceLastIncident = useTimeSince(lastIncidentTimestamp, {
        noIncidentText: isNavbarLayout ? 'None' : 'No recent incidents' // Different text for layouts
        //
    });
    //

    // --- Status Props Calculation ---
    const getStatusProps = () => {
        let iconComponent: React.ReactNode = null;
        //
        let valueColor: string;
        //
        let text: string;
        //
        let tooltip: string;
        //

        if (totalCount === 0 && !isLoading) {
            // No websites monitored state
            const iconColor = isNavbarLayout ? 'inherit' : theme.palette.action.disabled;
            //
            valueColor = isNavbarLayout ? 'inherit' : theme.palette.text.disabled;
            //
            if (!isNavbarLayout) { iconComponent = <ErrorOutlineIcon fontSize="inherit" sx={{ color: iconColor }} />; }
            //
            text = "0 / 0"; tooltip = 'No websites monitored';
            //
        } else if (upCount === totalCount && totalCount > 0) {
            // All websites are up
            const iconColor = isNavbarLayout ? theme.palette.common.white : theme.palette.success.main;
            //
            valueColor = isNavbarLayout ? theme.palette.common.white : theme.palette.success.main;
            //
            if (!isNavbarLayout) iconComponent = <CheckCircleOutlineIcon fontSize="inherit" sx={{ color: iconColor }} />;
            //
            text = `${upCount} / ${totalCount}`; tooltip = 'All websites are up';
            //
        } else {
            // Some websites are down or having issues
            const iconColor = isNavbarLayout ? theme.palette.common.white : theme.palette.error.main;
            //
            valueColor = isNavbarLayout ? theme.palette.common.white : theme.palette.error.main;
            //
            if (!isNavbarLayout) iconComponent = <WarningAmberIcon fontSize="inherit" sx={{ color: iconColor }} />;
            //
            text = `${upCount} / ${totalCount}`; tooltip = `${totalCount - upCount} website(s) are down or having issues`;
            //
        }
        return { icon: iconComponent, valueColor, text, tooltip };
        //
    };
    const statusProps = getStatusProps();
    //
    const uptimeColorKey = getStatusColor(uptime); // Get color key based on uptime value
    //
    const incidentProps = getIncidentProps(theme, incidentsLast24h, isNavbarLayout); // Get incident display props
    //

    // --- Container Styling ---
    const containerSx = isNavbarLayout
        ? { // Navbar: Center content vertically and horizontally
            display: { xs: 'none', md: 'flex' }, // Hide on small screens, flex on medium+
            //
            alignItems: 'center',
            //
            justifyContent: 'center',
            //
            width: '100%',
            //
            height: '100%', // Fill AppBar height
            //
            px: 1,
            //
            minHeight: 'auto', // Override default minHeight
            //
            overflow: 'hidden', // Prevent content overflow
            //
          }
        : { // Dashboard: Standard block layout with padding
            display: 'flex',
            //
            alignItems: 'center',
            //
            justifyContent: 'center',
            //
            width: '100%',
            //
            py: 2.25, // Vertical padding
            //
            px: { xs: 1, sm: 2, md: 3 }, // Responsive horizontal padding
            //
            minHeight: '76px' // Ensure consistent height
            //
          };
    //

    // --- Dynamic Font Sizes & Spacing ---
    const valueVariant = isNavbarLayout ? 'body2' : 'h6';
    //
    const labelVariant = isNavbarLayout ? 'caption' : 'body2';
    //
    const iconSize = isNavbarLayout ? '0.9rem' : '1.4rem';
    //
    const gridSpacing = isNavbarLayout ? 1.2 : { xs: 1.5, sm: 2, md: 3 };
    //
    const valueTopMargin = isNavbarLayout ? 0 : 0.5; // No top margin needed in navbar (no icon above)
    //
    const valueLabelMargin = isNavbarLayout ? 0.2 : 0.5;
    //

    // --- Loading State ---
    if (isLoading) {
        return (
            <Box sx={{ ...containerSx, justifyContent: 'center', alignItems: 'center' }}>
                <CircularProgress size={isNavbarLayout ? 20 : 24} color={isNavbarLayout ? 'inherit' : 'primary'} />
            </Box>
        );
    }
    //

    // --- Error State ---
    // Display a compact error message within the header area
    if (error && !isNavbarLayout) { // Only show detailed error in Dashboard header
        return (
             <Box sx={{ ...containerSx, alignItems: 'center', justifyContent: 'center', py: 1 }}>
                 <Alert severity="error" icon={<ErrorOutlineIcon fontSize="inherit" />} sx={{ width: '100%', justifyContent: 'center' }}>
                     Stats unavailable: {error.message || 'Loading error'}
                 </Alert>
             </Box>
        );
        //
    }
     // In Navbar, we might just show default/disabled state instead of a full alert
     if (error && isNavbarLayout) {
         // Optionally return a minimal error indicator or just let the stats show '-'
         // For simplicity, let's allow the normal render with '-' values
     }
     //


    // --- Grid Item Size (Always 4 items) ---
    const gridItemSize = 3; // Each item takes 3 out of 12 columns
    //

    // Determine if the Last Incident stat is interactive (only in Dashboard layout)
    const canHighlight = !isNavbarLayout && !!lastIncidentWebsiteId && !!onToggleHighlight;
    //

    // --- Render Grid Layout ---
    return (
        <Box sx={containerSx}>
            {/* Constrain Grid width in Navbar for better alignment */}
            <Grid
                container
                //
                spacing={gridSpacing}
                //
                justifyContent="center"
                //
                alignItems="center"
                //
                sx={ isNavbarLayout ? { maxWidth: 420, width: '100%' } : {} } // Max width only for Navbar
                //
            >

                {/* Stat 1: Status (Up/Total) */}
                <Grid item xs={gridItemSize} textAlign="center">
                    <Tooltip title={statusProps.tooltip}>
                        {/* Wrapper Box: Remove hover effect for Navbar */}
                        <Box sx={isNavbarLayout ? { p: 0.5, borderRadius: 1 } : {}}>
                           {/* Icon only shown in Dashboard layout */}
                           {!isNavbarLayout && statusProps.icon && (
                               <Typography component="span" variant="inherit" sx={{ fontSize: iconSize, lineHeight: 1.1, display: 'block', color: statusProps.valueColor }}>
                                  {statusProps.icon}
                               </Typography>
                           )}
                           {/* Value */}
                          <Typography
                            variant={valueVariant} component="div" fontWeight="medium"
                            //
                            sx={{ color: statusProps.valueColor, lineHeight: 1.2, mt: valueTopMargin }}
                            //
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
                     {/* Wrapper Box: Remove hover effect for Navbar */}
                     <Box sx={isNavbarLayout ? { p: 0.5, borderRadius: 1 } : {}}>
                        {/* Icon only shown in Dashboard layout */}
                        {!isNavbarLayout && (
                            <Typography component="span" variant="inherit" sx={{ fontSize: iconSize, lineHeight: 1.1, display: 'block', color: getTextColor(theme, uptimeColorKey, isNavbarLayout) }}>
                               <NetworkCheckIcon fontSize="inherit" />
                            </Typography>
                        )}
                        {/* Value */}
                       <Typography
                            variant={valueVariant} component="div" fontWeight="medium"
                            //
                            sx={{ color: getTextColor(theme, uptimeColorKey, isNavbarLayout), lineHeight: 1.2, mt: valueTopMargin }}
                            //
                       >
                         {/* Format uptime value, handle null/undefined */}
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
                     {/* Wrapper Box: Remove hover effect for Navbar */}
                     <Box sx={isNavbarLayout ? { p: 0.5, borderRadius: 1 } : {}}>
                         {/* Icon only shown in Dashboard layout */}
                         {!isNavbarLayout && incidentProps.icon && (
                             <Typography component="span" variant="inherit" sx={{ fontSize: iconSize, lineHeight: 1.1, display: 'block', color: incidentProps.valueColor }}>
                                {incidentProps.icon}
                             </Typography>
                         )}
                         {/* Value */}
                       <Typography
                            variant={valueVariant} component="div" fontWeight="medium"
                            //
                            sx={{ color: incidentProps.valueColor, lineHeight: 1.2, mt: valueTopMargin }}
                            //
                        >
                         {/* Display incident count or '-' */}
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
                       // Dynamic tooltip based on whether highlighting is possible/active
                       title={canHighlight ? (isHighlightActive ? "Click to remove highlight" : "Click to highlight affected website") : `Time since last downtime (up to 30 days)`}
                       //
                       placement="top"
                       //
                       arrow
                       //
                    >
                     {/* Interactive Box only for Dashboard layout when highlight is possible */}
                     <Box
                         onClick={canHighlight ? onToggleHighlight : undefined} // Enable click only if highlightable
                         //
                         sx={{
                             cursor: canHighlight ? 'pointer' : 'default', // Pointer cursor only if highlightable
                             //
                             p: 0.5, borderRadius: 1,
                             //
                             // Apply hover/active styles only if highlightable (i.e., not in Navbar)
                             '&:hover': canHighlight ? { bgcolor: alpha(theme.palette.action.hover, 0.1) } : {},
                             //
                             bgcolor: canHighlight && isHighlightActive ? alpha(theme.palette.warning.light, 0.15) : 'transparent', // Background color when active
                             //
                             transition: theme.transitions.create('background-color') // Smooth transition for active state
                             //
                         }}
                     >
                         {/* Icon only shown in Dashboard layout */}
                         {!isNavbarLayout && (
                            <Typography component="span" variant="inherit" sx={{ fontSize: iconSize, lineHeight: 1.1, display: 'block', color: theme.palette.text.secondary }}>
                                <HistoryIcon fontSize="inherit" />
                            </Typography>
                         )}
                         {/* Value */}
                       <Typography
                            variant={valueVariant} component="div" fontWeight="medium"
                            //
                            // Use primary text color, potentially overridden by active state styling
                            sx={{ color: theme.palette.text.primary, lineHeight: 1.2, mt: valueTopMargin }}
                            //
                       >
                         {/* Display formatted time since last incident */}
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
    //
};

export default StatsHeader;