// src/components/StatsHeader.tsx
import React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TimerIcon from '@mui/icons-material/Timer';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import { useTheme } from '@mui/material/styles';
import { ApiError } from '../../types';
import { getStatusColor, getResponseTimeColor, formatUptime, formatResponseTime } from '../../utils/statusUtils';

type StatusColorKey = 'success' | 'warning' | 'error' | 'default';

interface StatsHeaderProps {
  isLoading: boolean;
  error: ApiError | null;
  upCount: number;
  totalCount: number;
  uptime: number | null | undefined;
  responseTime: number | null | undefined;
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


const StatsHeader: React.FC<StatsHeaderProps> = ({
  isLoading,
  error,
  upCount,
  totalCount,
  uptime,
  responseTime,
  center = false, // Default to Dashboard layout
}) => {
  const theme = useTheme();
  const isNavbar = center; // Use 'center' prop to determine context

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
  const responseTimeColorKey = getResponseTimeColor(responseTime);

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
  // No gap needed if icon isn't there in navbar
  const valueTopMargin = isNavbar ? 0 : 0.5; // Margin above value (replaces icon gap)
  const valueLabelMargin = isNavbar ? 0 : 0.5;

  // --- Loading / Error Display (Common) ---
  if (isLoading) {
    return (
      <Box sx={containerSx}>
        <CircularProgress size={isNavbar ? 20 : 30} color={isNavbar ? "inherit" : "primary"} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={containerSx}>
        <Tooltip title={`Error loading stats: ${error.message}`}>
          <ErrorOutlineIcon sx={{ color: isNavbar ? 'inherit' : theme.palette.error.main, fontSize: isNavbar ? '1.25rem' : '1.75rem' }} />
        </Tooltip>
      </Box>
    );
  }

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
              <Typography variant={valueVariant} component="div" fontWeight="medium" sx={{ color: statusProps.valueColor, lineHeight: 1.2, mt: isNavbar ? 0 : valueTopMargin }}> {/* Adjust margin top */}
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

        {/* Stat 3: Average Response Time */}
        <Grid item xs={4} textAlign="center">
           <Tooltip title="Average Response Time (Last 7 Days)">
             <Box>
                 {/* Icon (Conditionally Rendered) */}
                 {!isNavbar && (
                     <Typography component="span" variant="inherit" sx={{ color: getTextColor(theme, responseTimeColorKey, isNavbar), fontSize: iconSize, lineHeight: 1.1, display: 'block' }}>
                        <TimerIcon fontSize="inherit" />
                     </Typography>
                 )}
                 {/* Value */}
               <Typography variant={valueVariant} component="div" fontWeight="medium" sx={{ color: getTextColor(theme, responseTimeColorKey, isNavbar), lineHeight: 1.2, mt: isNavbar ? 0 : valueTopMargin }}>
                 {formatResponseTime(responseTime)}
               </Typography>
             </Box>
           </Tooltip>
          <Typography variant={labelVariant} color={isNavbar ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbar ? 0.8 : 1 }}>
            Avg Resp (7d)
          </Typography>
        </Grid>

      </Grid>
    </Box>
  );
};

export default StatsHeader;