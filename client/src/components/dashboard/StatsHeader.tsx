// src/components/dashboard/StatsHeader.tsx
import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'; // New Icon for Incidents
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import Popover from '@mui/material/Popover';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { useTheme } from '@mui/material/styles';
import { formatDistanceToNow } from 'date-fns';
import { ApiError, Alert } from '../../types';
import { getStatusColor, formatUptime } from '../../utils/statusUtils';

type StatusColorKey = 'success' | 'warning' | 'error' | 'default';

interface StatsHeaderProps {
  isLoading: boolean; // Loading state for overall stats (uptime, status)
  error: ApiError | null; // Error state for overall stats
  upCount: number;
  totalCount: number;
  uptime: number | null | undefined;
  // Removed responseTime
  // Added incidents data
  isLoadingIncidents: boolean; // Separate loading state for incidents
  incidentsError: ApiError | null; // Separate error state for incidents
  incidentsLast24h: Alert[] | null | undefined; // Array of incidents in the last 24h
  center?: boolean; // true = Navbar layout, false = Dashboard layout
}

// Helper to get text color based on status key
const getTextColor = (theme: any, colorKey: StatusColorKey, isNavbar: boolean): string => {
    if (isNavbar) {
        return colorKey === 'default' ? 'inherit' : theme.palette.common.white;
    }
    if (colorKey === 'default') {
        return theme.palette.text.secondary;
    }
    return theme.palette[colorKey]?.main || theme.palette.text.primary;
};

// Helper to get incident color
const getIncidentColorKey = (count: number | null | undefined): StatusColorKey => {
    if (count === null || count === undefined) return 'default';
    return count > 0 ? 'error' : 'success';
};



const StatsHeader: React.FC<StatsHeaderProps> = ({
  isLoading,
  error,
  upCount,
  totalCount,
  uptime,
  // --- New Incident Props ---
  isLoadingIncidents,
  incidentsError,
  incidentsLast24h,
  
  // ------------------------
  center = false, // Default to Dashboard layout
  
}) => {
  const theme = useTheme();
  const isNavbar = center; // Use 'center' prop to determine context
  const [popoverAnchorEl, setPopoverAnchorEl] = useState<HTMLElement | null>(null);

  const handlePopoverOpen = (event: React.MouseEvent<HTMLElement>) => {
    // Only open if there are incidents to show
    if (incidentsLast24h && incidentsLast24h.length > 0) {
      setPopoverAnchorEl(event.currentTarget);
    }
  };

  const handlePopoverClose = () => {
    setPopoverAnchorEl(null);
  };

  const open = Boolean(popoverAnchorEl);
  const incidentCount = incidentsLast24h?.length ?? null;
  

  // --- Props for Status Display ---
  const getStatusProps = () => {
    let iconComponent: React.ReactNode = null; // Default to no icon
    let valueColor: string;

    if (totalCount === 0 && !isLoading) {
        const iconColor = isNavbar ? 'inherit' : theme.palette.action.disabled;
        valueColor = isNavbar ? 'inherit' : theme.palette.text.disabled;
        if (!isNavbar) { // Only show icon in dashboard view
             iconComponent = <ErrorOutlineIcon fontSize="inherit" sx={{ color: iconColor }} />;
        }
        return {
            icon: iconComponent,
            valueColor: valueColor,
            text: "0 / 0",
            tooltip: 'No websites monitored'
        };
    }
    if (upCount === totalCount) {
        const iconColor = isNavbar ? theme.palette.common.white : theme.palette.success.main;
        valueColor = isNavbar ? theme.palette.common.white : theme.palette.success.main;
         if (!isNavbar) {
             iconComponent = <CheckCircleOutlineIcon fontSize="inherit" sx={{ color: iconColor }} />;
         }
        return {
            icon: iconComponent,
            valueColor: valueColor,
            text: `${upCount} / ${totalCount}`,
            tooltip: 'All websites are up'
        };
    } else {
        const iconColor = isNavbar ? theme.palette.common.white : theme.palette.error.main;
        valueColor = isNavbar ? theme.palette.common.white : theme.palette.error.main;
         if (!isNavbar) {
             iconComponent = <WarningAmberIcon fontSize="inherit" sx={{ color: iconColor }} />;
         }
        return {
            icon: iconComponent,
            valueColor: valueColor,
            text: `${upCount} / ${totalCount}`,
            tooltip: `${totalCount - upCount} website(s) are down or having issues`
        };
    }
  };

  const statusProps = getStatusProps();
  const uptimeColorKey = getStatusColor(uptime);
  const incidentColorKey = getIncidentColorKey(incidentCount);
  

  // --- Container Styling ---
  const containerSx = isNavbar
    ? {
        display: { xs: 'none', md: 'flex' },
        justifyContent: 'center',
        alignItems: 'center',
        px: 2,
        flexGrow: 1,
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
        minHeight: '76px',
      };

  // --- Dynamic Font Sizes & Spacing ---
  const valueVariant = isNavbar ? 'body1' : 'h5';
  const labelVariant = isNavbar ? 'caption' : 'body2';
  const iconSize = isNavbar ? '1.1rem' : '1.5rem'; // Still needed for dashboard icons
  const gridSpacing = isNavbar ? 1.5 : { xs: 2, md: 4 };
  const valueTopMargin = isNavbar ? 0 : 0.5;
  const valueLabelMargin = isNavbar ? 0 : 0.5;

  // --- Loading / Error Display (Common) ---
  // Show loading if either main stats OR incidents are loading initially
  if (isLoading || (isLoadingIncidents && incidentCount === null)) {
    return (
      <Box sx={containerSx}>
        <CircularProgress size={isNavbar ? 20 : 30} color={isNavbar ? "inherit" : "primary"} />
      </Box>
    );
  }

  // Show error if main stats error occurred
  if (error) {
    return (
      <Box sx={containerSx}>
        <Tooltip title={`Error loading stats: ${error.message}`}>
          <ErrorOutlineIcon sx={{ color: isNavbar ? 'inherit' : theme.palette.error.main, fontSize: isNavbar ? '1.25rem' : '1.75rem' }} />
        </Tooltip>
      </Box>
    );
  }
  console.log('Passing to StatsHeader:', {
    isLoadingIncidents: isLoadingIncidents,
    incidentsError: incidentsError,
    incidentsLast24h: incidentsLast24h
});

  // --- Grid Layout (Used for Both Contexts) ---
  return (
    <Box sx={containerSx}>
      <Grid container spacing={gridSpacing} justifyContent="center" alignItems="flex-start">

        {/* Stat 1: Status (Up/Total) */}
        <Grid item xs={4} textAlign="center">
          <Tooltip title={statusProps.tooltip}>
            <Box>
               {/* Icon (Conditionally Rendered) */}
               {!isNavbar && statusProps.icon && (
                   <Typography component="span" variant="inherit" sx={{ color: statusProps.valueColor, fontSize: iconSize, lineHeight: 1.1, display: 'block' }}>
                      {statusProps.icon}
                   </Typography>
               )}
               {/* Value */}
              <Typography variant={valueVariant} component="div" fontWeight="medium" sx={{ color: statusProps.valueColor, lineHeight: 1.2, mt: isNavbar ? 0 : valueTopMargin }}>
                {statusProps.text}
              </Typography>
            </Box>
          </Tooltip>
          <Typography variant={labelVariant} color={isNavbar ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbar ? 0.8 : 1 }}>
            Status
          </Typography>
        </Grid>

        {/* Stat 2: Uptime */}
        <Grid item xs={4} textAlign="center">
           <Tooltip title="Overall Uptime (Last 7 Days)">
             <Box>
                {/* Icon (Conditionally Rendered) */}
                {!isNavbar && (
                    <Typography component="span" variant="inherit" sx={{ color: getTextColor(theme, uptimeColorKey, isNavbar), fontSize: iconSize, lineHeight: 1.1, display: 'block' }}>
                       <NetworkCheckIcon fontSize="inherit" />
                    </Typography>
                )}
               {/* Value */}
               <Typography variant={valueVariant} component="div" fontWeight="medium" sx={{ color: getTextColor(theme, uptimeColorKey, isNavbar), lineHeight: 1.2, mt: isNavbar ? 0 : valueTopMargin }}>
                 {formatUptime(uptime)}%
               </Typography>
             </Box>
           </Tooltip>
          <Typography variant={labelVariant} color={isNavbar ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbar ? 0.8 : 1 }}>
            Uptime (7d)
          </Typography>
        </Grid>

        {/* Stat 3: Incidents (Last 24h) */}
        <Grid item xs={4} textAlign="center">
          <Box
            onMouseEnter={handlePopoverOpen}
            onMouseLeave={handlePopoverClose}
            aria-owns={open ? 'mouse-over-popover' : undefined}
            aria-haspopup="true"
            sx={{ cursor: (incidentsLast24h && incidentsLast24h.length > 0) ? 'pointer' : 'default' }}
          >
            <Tooltip title={incidentsError
              ? `Error loading incidents: ${incidentsError.message}`
              : (isLoadingIncidents ? 'Loading incidents...' : `${incidentCount ?? 0} incident(s) in the last 24 hours`)}
            >
              <Box>
                  {/* Icon (Conditionally Rendered) */}
                  {!isNavbar && (
                      <Typography component="span" variant="inherit" sx={{ color: incidentsError ? theme.palette.grey[500] : getTextColor(theme, incidentColorKey, isNavbar), fontSize: iconSize, lineHeight: 1.1, display: 'block' }}>
                        {isLoadingIncidents && !incidentsError ? (
                          <CircularProgress size="inherit" color="inherit" sx={{ display: 'inline-block', verticalAlign: 'middle' }}/>
                        ) : incidentsError ? (
                          <ErrorOutlineIcon fontSize="inherit" />
                        ) : (
                          <NotificationsActiveIcon fontSize="inherit" />
                        )}
                      </Typography>
                  )}
                  {/* Value */}
                <Typography variant={valueVariant} component="div" fontWeight="medium" sx={{ color: incidentsError ? theme.palette.grey[500] : getTextColor(theme, incidentColorKey, isNavbar), lineHeight: 1.2, mt: isNavbar ? 0 : valueTopMargin }}>
                  {isLoadingIncidents ? '-' : incidentsError ? 'Err' : incidentCount ?? 'N/A'}
                </Typography>
              </Box>
            </Tooltip>
          </Box>
          <Typography variant={labelVariant} color={isNavbar ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbar ? 0.8 : 1 }}>
            Incidents (24h)
          </Typography>

          {/* Popover for displaying incidents on hover */}
          <Popover
            id="mouse-over-popover"
            sx={{
              pointerEvents: 'none', // Let mouse events pass through to the element below
            }}
            open={open}
            anchorEl={popoverAnchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'center',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'center',
            }}
            onClose={handlePopoverClose}
            disableRestoreFocus
            PaperProps={{
                sx: {
                  p: 1,
                  mt: 1,
                  maxWidth: 300,
                  pointerEvents: 'auto', // Allow interaction with the popover content itself
                }
            }}
          >
            <Typography variant="subtitle2" sx={{ px: 1, pb: 0.5 }}>Incidents (Last 24h)</Typography>
            {incidentsLast24h && incidentsLast24h.length > 0 ? (
                 <List dense disablePadding>
                    {incidentsLast24h.slice(0, 5).map((incident) => ( // Limit to 5 for brevity in popover
                        <ListItem key={incident.id} disableGutters sx={{ py: 0.25 }}>
                             <ListItemText
                                 primary={`${incident.website?.name || incident.website?.url || 'Unknown Website'} - ${incident.type.toUpperCase()}`}
                                 secondary={formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true })}
                                 primaryTypographyProps={{ variant: 'caption', fontWeight: 'medium' }}
                                 secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                             />
                        </ListItem>
                    ))}
                    {incidentsLast24h.length > 5 && (
                        <ListItem disableGutters sx={{ pt: 0.5 }}>
                            <ListItemText secondary={`...and ${incidentsLast24h.length - 5} more`} secondaryTypographyProps={{ variant: 'caption', fontStyle: 'italic' }}/>
                        </ListItem>
                    )}
                 </List>
            ) : (
                <Typography variant="caption" sx={{ px: 1 }}>No incidents found.</Typography>
            )}
          </Popover>
        </Grid>

      </Grid>
    </Box>
  );
};

export default StatsHeader;