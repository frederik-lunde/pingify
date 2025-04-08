/*
src/components/StatsHeader.tsx
*/
import React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import HistoryIcon from '@mui/icons-material/History';
import { useTheme, Theme, alpha } from '@mui/material/styles';
import { ApiError } from '../../types';
import { getStatusColor, formatUptime } from '../../utils/statusUtils';
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
    center?: boolean;
    // --- New Props for Highlighting ---
    lastIncidentWebsiteId?: number | null | undefined; // ID to potentially highlight
    onToggleHighlight?: () => void; // Callback to toggle highlight in parent
    isHighlightActive?: boolean; // Current highlight state (optional, for styling stat)
}

// Helper: getTextColor (no changes)
const getTextColor = (theme: Theme, colorKey: StatusColorKey, isNavbar: boolean): string => {
    if (isNavbar) {
        return colorKey === 'default' ? 'inherit' : theme.palette.common.white;
    }
    if (colorKey === 'default') {
        return theme.palette.text.secondary;
    }
    return theme.palette[colorKey]?.main || theme.palette.text.primary;
};

// Helper: getIncidentProps (no changes)
const getIncidentProps = (theme: Theme, count: number | null | undefined, isNavbar: boolean) => {
    let iconComponent: React.ReactNode = null;
    let valueColor: string;
    let text: string;

    if (count === null || count === undefined) {
        valueColor = getTextColor(theme, 'default', isNavbar);
        if (!isNavbar) {
             iconComponent = <ReportProblemOutlinedIcon fontSize="inherit" sx={{ color: theme.palette.action.disabled }} />;
        }
        text = '-';
    } else if (count > 0) {
        valueColor = isNavbar ? theme.palette.common.white : theme.palette.warning.main;
        if (!isNavbar) {
            iconComponent = <ReportProblemOutlinedIcon fontSize="inherit" sx={{ color: valueColor }} />;
        }
        text = count.toString();
    } else {
        valueColor = isNavbar ? 'inherit' : theme.palette.success.main;
        if (!isNavbar) {
            iconComponent = <CheckCircleOutlineIcon fontSize="inherit" sx={{ color: valueColor }} />;
        }
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
    // Destructure new props
    lastIncidentWebsiteId,
    onToggleHighlight,
    isHighlightActive = false, // Default to false
}) => {
    const theme = useTheme();
    const isNavbar = center;

    // Hook for formatted time (no changes needed here)
    const timeSinceLastIncident = useTimeSince(lastIncidentTimestamp, {
        noIncidentText: isNavbar ? 'None' : 'No recent incidents'
    });

    // Get status props (no changes)
    const getStatusProps = () => {
        // ... (getStatusProps implementation remains the same) ...
         let iconComponent: React.ReactNode = null;
        let valueColor: string;
        let text: string;
        let tooltip: string;

        if (totalCount === 0 && !isLoading) {
            const iconColor = isNavbar ? 'inherit' : theme.palette.action.disabled;
            valueColor = isNavbar ? 'inherit' : theme.palette.text.disabled;
            if (!isNavbar) {
                 iconComponent = <ErrorOutlineIcon fontSize="inherit" sx={{ color: iconColor }} />;
            }
            text = "0 / 0";
            tooltip = 'No websites monitored';
        } else if (upCount === totalCount) {
            const iconColor = isNavbar ? theme.palette.common.white : theme.palette.success.main;
            valueColor = isNavbar ? theme.palette.common.white : theme.palette.success.main;
            if (!isNavbar) iconComponent = <CheckCircleOutlineIcon fontSize="inherit" sx={{ color: iconColor }} />;
            text = `${upCount} / ${totalCount}`;
            tooltip = 'All websites are up';
        } else {
            const iconColor = isNavbar ? theme.palette.common.white : theme.palette.error.main;
            valueColor = isNavbar ? theme.palette.common.white : theme.palette.error.main;
            if (!isNavbar) iconComponent = <WarningAmberIcon fontSize="inherit" sx={{ color: iconColor }} />;
            text = `${upCount} / ${totalCount}`;
            tooltip = `${totalCount - upCount} website(s) are down or having issues`;
        }
        return { icon: iconComponent, valueColor, text, tooltip };
    };
    const statusProps = getStatusProps();
    const uptimeColorKey = getStatusColor(uptime);
    const incidentProps = getIncidentProps(theme, incidentsLast24h, isNavbar);

    // Styling (no changes)
    const containerSx = isNavbar ? { display: { xs: 'none', md: 'flex' }, justifyContent: 'center', alignItems: 'center', px: 2, flexGrow: 1, minHeight: 'auto', overflow: 'hidden' }
    : { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', py: 2.25, px: { xs: 1, sm: 2, md: 3 }, minHeight: '76px' };
    const valueVariant = isNavbar ? 'body2' : 'h6';
    const labelVariant = isNavbar ? 'caption' : 'body2';
    const iconSize = isNavbar ? '1rem' : '1.4rem';
    const gridSpacing = isNavbar ? 1.5 : { xs: 1.5, sm: 2, md: 3 };
    const valueTopMargin = isNavbar ? 0 : 0.5;
    const valueLabelMargin = isNavbar ? 0 : 0.5;

    // Loading/Error (no changes)
    if (isLoading) {
        return <Box sx={containerSx}><CircularProgress size={isNavbar ? 20 : 30} color={isNavbar ? "inherit" : "primary"} /></Box>;
    }
    if (error) {
        return <Box sx={containerSx}><Tooltip title={`Error loading stats: ${error.message}`}><ErrorOutlineIcon sx={{ color: isNavbar ? 'inherit' : theme.palette.error.main, fontSize: isNavbar ? '1.25rem' : '1.75rem' }} /></Tooltip></Box>;
    }

    const gridItemSize = isNavbar ? 4 : 3;

    // --- Determine if the Last Incident stat is clickable ---
    const canHighlight = !!lastIncidentWebsiteId && !!onToggleHighlight;

    return (
        <Box sx={containerSx}>
            <Grid container spacing={gridSpacing} justifyContent="center" alignItems="flex-start">

                {/* Stat 1: Status (Up/Total) - No changes */}
                <Grid item xs={gridItemSize} textAlign="center">
                    {/* ... content ... */}
                    <Tooltip title={statusProps.tooltip}>
                        <Box>
                           {!isNavbar && statusProps.icon && (
                               <Typography component="span" variant="inherit" sx={{ fontSize: iconSize, lineHeight: 1.1, display: 'block', color: statusProps.valueColor }}>
                                  {statusProps.icon}
                               </Typography>
                           )}
                          <Typography variant={valueVariant} component="div" fontWeight="medium" sx={{ color: statusProps.valueColor, lineHeight: 1.2, mt: isNavbar || !statusProps.icon ? 0 : valueTopMargin }}>
                            {statusProps.text}
                          </Typography>
                        </Box>
                    </Tooltip>
                    <Typography variant={labelVariant} color={isNavbar ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbar ? 0.8 : 1 }}>
                        Status
                    </Typography>
                </Grid>

                {/* Stat 2: Uptime - No changes */}
                <Grid item xs={gridItemSize} textAlign="center">
                   {/* ... content ... */}
                    <Tooltip title="Overall Uptime (Last 7 Days)">
                     <Box>
                        {!isNavbar && (
                            <Typography component="span" variant="inherit" sx={{ fontSize: iconSize, lineHeight: 1.1, display: 'block', color: getTextColor(theme, uptimeColorKey, isNavbar) }}>
                               <NetworkCheckIcon fontSize="inherit" />
                            </Typography>
                        )}
                       <Typography variant={valueVariant} component="div" fontWeight="medium" sx={{ color: getTextColor(theme, uptimeColorKey, isNavbar), lineHeight: 1.2, mt: isNavbar ? 0 : valueTopMargin }}>
                         {formatUptime(uptime)}%
                       </Typography>
                     </Box>
                   </Tooltip>
                   <Typography variant={labelVariant} color={isNavbar ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbar ? 0.8 : 1 }}>
                       Uptime (7d)
                   </Typography>
                </Grid>

                {/* Stat 3: Incidents Last 24 Hours - No changes */}
                <Grid item xs={gridItemSize} textAlign="center">
                   {/* ... content ... */}
                    <Tooltip title="Incidents (Down) reported in the last 24 hours">
                     <Box>
                         {!isNavbar && incidentProps.icon && (
                             <Typography component="span" variant="inherit" sx={{ fontSize: iconSize, lineHeight: 1.1, display: 'block', color: incidentProps.valueColor }}>
                                {incidentProps.icon}
                             </Typography>
                         )}
                       <Typography variant={valueVariant} component="div" fontWeight="medium" sx={{ color: incidentProps.valueColor, lineHeight: 1.2, mt: isNavbar || !incidentProps.icon ? 0 : valueTopMargin }}>
                         {incidentProps.text}
                       </Typography>
                     </Box>
                   </Tooltip>
                   <Typography variant={labelVariant} color={isNavbar ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbar ? 0.8 : 1 }}>
                        Incidents (24h)
                   </Typography>
                </Grid>

                {/* Stat 4: Time Since Last Incident (Only in Dashboard, now clickable) */}
                {!isNavbar && (
                    <Grid item xs={gridItemSize} textAlign="center">
                       <Tooltip
                           title={canHighlight ? (isHighlightActive ? "Click to remove highlight" : "Click to highlight affected website") : `Time elapsed since the last detected downtime incident (up to 30 days)`}
                           placement="top"
                           arrow
                        >
                         {/* Make the Box clickable */}
                         <Box
                             onClick={canHighlight ? onToggleHighlight : undefined} // Add onClick handler
                             sx={{
                                 cursor: canHighlight ? 'pointer' : 'default', // Add pointer cursor
                                 p: 0.5, // Add slight padding for click area
                                 borderRadius: 1, // Rounded corners for hover effect
                                 // Optional: Add hover/active effect
                                 '&:hover': canHighlight ? {
                                    bgcolor: alpha(theme.palette.action.hover, 0.1)
                                 } : {},
                                 // Optional: indicate active highlight state on the stat itself
                                 bgcolor: canHighlight && isHighlightActive ? alpha(theme.palette.warning.light, 0.15) : 'transparent',
                                 transition: theme.transitions.create('background-color')
                             }}
                         >
                             {/* Icon */}
                             <Typography component="span" variant="inherit" sx={{ fontSize: iconSize, lineHeight: 1.1, display: 'block', color: canHighlight && isHighlightActive ? theme.palette.warning.main : theme.palette.text.secondary }}>
                                <HistoryIcon fontSize="inherit" />
                             </Typography>
                             {/* Value */}
                           <Typography
                                variant={valueVariant}
                                component="div"
                                fontWeight="medium"
                                sx={{
                                    color: canHighlight && isHighlightActive ? theme.palette.warning.dark : theme.palette.text.primary,
                                    lineHeight: 1.2,
                                    mt: valueTopMargin
                                }}
                           >
                             {timeSinceLastIncident}
                           </Typography>
                         </Box>
                       </Tooltip>
                       <Typography variant={labelVariant} color={'text.secondary'} sx={{ mt: valueLabelMargin }}>
                           Last Incident
                       </Typography>
                    </Grid>
                )}
            </Grid>
        </Box>
    );
};

export default StatsHeader;