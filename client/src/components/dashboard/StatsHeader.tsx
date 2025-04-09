// src/components/dashboard/StatsHeader.tsx
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
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { ApiError } from '../../types';
import { getStatusColor, formatUptime } from '../../utils/statusUtils';
import { useTimeSince } from '../../hooks';

type StatusColorKey = 'success' | 'warning' | 'error' | 'default';

interface DownWebsite {
    id: number;
    name: string;
    lastDownTime: string;
}

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
    downWebsites?: DownWebsite[];
    onShowDownWebsites: () => void;
    showDownWebsites: boolean;
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
    lastIncidentWebsiteId,
    onToggleHighlight,
    isHighlightActive = false,
    downWebsites,
    onShowDownWebsites,
    showDownWebsites,
}) => {
    const theme = useTheme();
    const isNavbarLayout = center;

    const timeSinceLastIncident = useTimeSince(lastIncidentTimestamp, {
        noIncidentText: isNavbarLayout ? 'None' : 'No recent incidents'
    });

    const getStatusProps = () => {
        let iconComponent: React.ReactNode = null;
        let valueColor: string;
        let text: string;
        let tooltip: string;

        if (totalCount === 0 && !isLoading) {
            const iconColor = isNavbarLayout ? 'inherit' : theme.palette.action.disabled;
            valueColor = isNavbarLayout ? 'inherit' : theme.palette.text.disabled;
            if (!isNavbarLayout) { 
                iconComponent = <ErrorOutlineIcon fontSize="inherit" sx={{ color: iconColor }} />; 
            }
            text = "0 / 0"; 
            tooltip = 'No websites monitored';
        } else if (upCount === totalCount && totalCount > 0) {
            const iconColor = isNavbarLayout ? theme.palette.common.white : theme.palette.success.main;
            valueColor = isNavbarLayout ? theme.palette.common.white : theme.palette.success.main;
            if (!isNavbarLayout) { 
                iconComponent = <CheckCircleOutlineIcon fontSize="inherit" sx={{ color: iconColor }} />; 
            }
            text = `${upCount} / ${totalCount}`; 
            tooltip = 'All websites are up';
        } else {
            const iconColor = isNavbarLayout ? theme.palette.common.white : theme.palette.error.main;
            valueColor = isNavbarLayout ? theme.palette.common.white : theme.palette.error.main;
            if (!isNavbarLayout) { 
                iconComponent = <WarningAmberIcon fontSize="inherit" sx={{ color: iconColor }} />; 
            }
            text = `${upCount} / ${totalCount}`; 
            tooltip = `${totalCount - upCount} website(s) are down or having issues`;
        }
        return { icon: iconComponent, valueColor, text, tooltip };
    };

    const statusProps = getStatusProps();
    const uptimeColorKey = getStatusColor(uptime);
    const incidentProps = getIncidentProps(theme, incidentsLast24h, isNavbarLayout);

    const containerSx = isNavbarLayout
        ? {
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            px: 1,
            minHeight: 'auto',
            overflow: 'hidden',
          }
        : {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            py: 2.25,
            px: { xs: 1, sm: 2, md: 3 },
            minHeight: '76px'
          };

    const valueVariant = isNavbarLayout ? 'body2' : 'h6';
    const labelVariant = isNavbarLayout ? 'caption' : 'body2';
    const iconSize = isNavbarLayout ? '0.9rem' : '1.4rem';
    const gridSpacing = isNavbarLayout ? 1.2 : { xs: 1.5, sm: 2, md: 3 };
    const valueTopMargin = isNavbarLayout ? 0 : 0.5;
    const valueLabelMargin = isNavbarLayout ? 0.2 : 0.5;

    if (isLoading) {
        return (
            <Box sx={{ ...containerSx, justifyContent: 'center', alignItems: 'center' }}>
                <CircularProgress size={isNavbarLayout ? 20 : 24} color={isNavbarLayout ? 'inherit' : 'primary'} />
            </Box>
        );
    }

    if (error && !isNavbarLayout) {
        return (
             <Box sx={{ ...containerSx, alignItems: 'center', justifyContent: 'center', py: 1 }}>
                 <Alert severity="error" icon={<ErrorOutlineIcon fontSize="inherit" />} sx={{ width: '100%', justifyContent: 'center' }}>
                     Stats unavailable: {error.message || 'Loading error'}
                 </Alert>
             </Box>
        );
    }

    const gridItemSize = 3;
    const canHighlight = !isNavbarLayout && !!lastIncidentWebsiteId && !!onToggleHighlight;
    const canClickIncidents = !isNavbarLayout && incidentsLast24h !== null && incidentsLast24h !== undefined;

    return (
        <Box sx={containerSx}>
            <Grid
                container
                spacing={gridSpacing}
                justifyContent="center"
                alignItems="center"
                sx={isNavbarLayout ? { maxWidth: 420, width: '100%' } : {}}
            >
                {/* Stat 1: Status (Up/Total) */}
                <Grid item xs={gridItemSize} textAlign="center">
                    <Tooltip title={statusProps.tooltip}>
                        <Box sx={isNavbarLayout ? { p: 0.5, borderRadius: 1 } : {}}>
                           {!isNavbarLayout && statusProps.icon && (
                               <Typography component="span" variant="inherit" sx={{ fontSize: iconSize, lineHeight: 1.1, display: 'block', color: statusProps.valueColor }}>
                                  {statusProps.icon}
                               </Typography>
                           )}
                          <Typography
                            variant={valueVariant} component="div" fontWeight="medium"
                            sx={{ color: statusProps.valueColor, lineHeight: 1.2, mt: valueTopMargin }}
                          >
                            {statusProps.text}
                          </Typography>
                        </Box>
                    </Tooltip>
                    <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : 1 }}>
                        Status
                    </Typography>
                </Grid>

                {/* Stat 2: Uptime */}
                <Grid item xs={gridItemSize} textAlign="center">
                   <Tooltip title="Overall Uptime (Last 7 Days)">
                     <Box sx={isNavbarLayout ? { p: 0.5, borderRadius: 1 } : {}}>
                        {!isNavbarLayout && (
                            <Typography component="span" variant="inherit" sx={{ fontSize: iconSize, lineHeight: 1.1, display: 'block', color: getTextColor(theme, uptimeColorKey, isNavbarLayout) }}>
                               <NetworkCheckIcon fontSize="inherit" />
                            </Typography>
                        )}
                       <Typography
                            variant={valueVariant} component="div" fontWeight="medium"
                            sx={{ color: getTextColor(theme, uptimeColorKey, isNavbarLayout), lineHeight: 1.2, mt: valueTopMargin }}
                       >
                         {formatUptime(uptime)}%
                       </Typography>
                     </Box>
                   </Tooltip>
                   <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : 1 }}>
                       Uptime (7d)
                   </Typography>
                </Grid>

                {/* Stat 3: Incidents Last 24 Hours */}
                <Grid item xs={gridItemSize} textAlign="center">
                   <Tooltip title={showDownWebsites ? 
                       "Click to show all websites" : 
                       (incidentsLast24h ? "Click to show down websites" : "No incidents in last 24 hours")}>
                     <Box 
                         onClick={canClickIncidents ? onShowDownWebsites : undefined}
                         sx={{
                             ...(isNavbarLayout ? { p: 0.5, borderRadius: 1 } : {}),
                             cursor: canClickIncidents ? 'pointer' : 'default',
                             '&:hover': canClickIncidents ? { 
                                 bgcolor: alpha(theme.palette.action.hover, 0.1) 
                             } : {},
                             bgcolor: showDownWebsites ? alpha(theme.palette.warning.light, 0.15) : 'transparent',
                             transition: theme.transitions.create('background-color')
                         }}
                     >
                         {!isNavbarLayout && incidentProps.icon && (
                             <Typography component="span" variant="inherit" sx={{ fontSize: iconSize, lineHeight: 1.1, display: 'block', color: incidentProps.valueColor }}>
                                {incidentProps.icon}
                             </Typography>
                         )}
                       <Typography
                            variant={valueVariant} component="div" fontWeight="medium"
                            sx={{ color: incidentProps.valueColor, lineHeight: 1.2, mt: valueTopMargin }}
                        >
                         {incidentProps.text}
                       </Typography>
                     </Box>
                   </Tooltip>
                   <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : 1 }}>
                        Incidents (24h)
                   </Typography>
                </Grid>

                {/* Stat 4: Time Since Last Incident */}
                <Grid item xs={gridItemSize} textAlign="center">
                   <Tooltip
                       title={canHighlight ? (isHighlightActive ? "Click to remove highlight" : "Click to highlight affected website") : `Time since last downtime (up to 30 days)`}
                       placement="top"
                       arrow
                    >
                     <Box
                         onClick={canHighlight ? onToggleHighlight : undefined}
                         sx={{
                             cursor: canHighlight ? 'pointer' : 'default',
                             p: 0.5, 
                             borderRadius: 1,
                             '&:hover': canHighlight ? { bgcolor: alpha(theme.palette.action.hover, 0.1) } : {},
                             bgcolor: canHighlight && isHighlightActive ? alpha(theme.palette.warning.light, 0.15) : 'transparent',
                             transition: theme.transitions.create('background-color')
                         }}
                     >
                         {!isNavbarLayout && (
                            <Typography component="span" variant="inherit" sx={{ fontSize: iconSize, lineHeight: 1.1, display: 'block', color: theme.palette.text.secondary }}>
                                <HistoryIcon fontSize="inherit" />
                            </Typography>
                         )}
                       <Typography
                            variant={valueVariant} component="div" fontWeight="medium"
                            sx={{ color: theme.palette.text.primary, lineHeight: 1.2, mt: valueTopMargin }}
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