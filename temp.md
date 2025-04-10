Okay, let's refactor these components one by one, applying the Grid v2 upgrade and other optimizations.

**1. `client/src/components/dashboard/DashboardSearchFilter.tsx`**

*   Removed redundant `onFilterChange` call in `handleClear`.
*   Simplified `handleClear` dependency array.

```typescript
/*
client/src/components/dashboard/DashboardSearchFilter.tsx
*/
import React, { useState, useEffect, useCallback } from 'react';
import { TextField, InputAdornment, IconButton, Box, SxProps, Theme } from '@mui/material'; // Import SxProps and Theme
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

interface DashboardSearchFilterProps {
    /** Callback function triggered when the debounced search term changes. */
    onFilterChange: (filterTerm: string) => void;
    /** Placeholder text for the input field. */
    placeholder?: string;
    /** Debounce delay in milliseconds. */
    debounceDelay?: number;
    /** Initial value for the filter (optional). */
    initialValue?: string;
    /** Styling for the root Box element */
    sx?: SxProps<Theme>; // Use SxProps for better type checking
}

const DashboardSearchFilter: React.FC<DashboardSearchFilterProps> = ({
    onFilterChange,
    placeholder = "Filter by name or URL...",
    debounceDelay = 300,
    initialValue = '',
    sx = {}
}) => {
    const [searchTerm, setSearchTerm] = useState<string>(initialValue);

    // Effect to handle debouncing
    useEffect(() => {
        const handler = setTimeout(() => {
            onFilterChange(searchTerm.trim());
        }, debounceDelay);

        return () => {
            clearTimeout(handler);
        };
        // Only re-run if these specific props change
    }, [searchTerm, debounceDelay, onFilterChange]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    };

    // Handler to clear the search input
    const handleClear = useCallback(() => {
        setSearchTerm('');
        // The useEffect above will trigger onFilterChange('') after debounce
    }, []); // No dependencies needed as setSearchTerm is stable

    return (
        <Box sx={{ width: '100%', maxWidth: 400, ...sx }}>
            <TextField
                fullWidth
                size="small"
                variant="outlined"
                placeholder={placeholder}
                value={searchTerm}
                onChange={handleChange}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchIcon color="action" />
                        </InputAdornment>
                    ),
                    endAdornment: searchTerm ? (
                        <InputAdornment position="end">
                            <IconButton
                                aria-label="clear search"
                                onClick={handleClear}
                                edge="end"
                                size="small"
                            >
                                <ClearIcon fontSize="small" />
                            </IconButton>
                        </InputAdornment>
                    ) : null,
                }}
                aria-label={placeholder} // Add aria-label for accessibility
            />
        </Box>
    );
};

export default DashboardSearchFilter;
```

**2. `client/src/components/dashboard/DownWebsitesList.tsx`**

*   No significant changes needed. Added `aria-label` to close button.

```typescript
/*
client/src/components/dashboard/DownWebsitesList.tsx
*/
import React from 'react';
import {
    Box,
    Typography,
    List,
    ListItem,
    ListItemText,
    Divider,
    Paper,
    IconButton,
    Tooltip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
// Consider using a shared date formatting utility if available
// import { formatDateTime } from '../../utils/dateUtils';

interface DownWebsiteItem { // Define a clear type for the website item
    id: number;
    name: string;
    lastDownTime: string; // ISO string expected
}

interface DownWebsitesListProps {
    websites: DownWebsiteItem[];
    onClose: () => void;
}

const DownWebsitesList: React.FC<DownWebsitesListProps> = ({ websites, onClose }) => {
    return (
        <Paper elevation={3} sx={{
            position: 'absolute', // Consider if this should be relative to a parent
            zIndex: (theme) => theme.zIndex.modal + 1, // Ensure it's above other elements like modals
            width: '300px',
            maxHeight: '400px',
            overflow: 'auto',
            mt: 1,
            right: 0, // Example positioning: align to the right
            // Add more positioning styles (top, left, bottom) as needed based on parent
        }}>
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 1.5, // Slightly reduced padding
                bgcolor: 'warning.light',
                color: 'warning.contrastText',
                position: 'sticky', // Make header sticky
                top: 0,
                zIndex: 1 // Ensure header stays above list content
            }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningAmberIcon />
                    Down Websites (24h)
                </Typography>
                <Tooltip title="Close List">
                    <IconButton onClick={onClose} size="small" color="inherit" aria-label="Close down websites list">
                        <CloseIcon />
                    </IconButton>
                </Tooltip>
            </Box>
            {websites.length === 0 ? (
                 <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                    No websites reported down in the last 24 hours.
                 </Typography>
            ) : (
                <List dense disablePadding> {/* Added disablePadding */}
                    {websites.map((website, index) => (
                        // Using Fragment shorthand
                        <>
                            <ListItem key={website.id}> {/* Key moved to ListItem */}
                                <ListItemText
                                    primary={website.name}
                                    secondary={`Down at: ${new Date(website.lastDownTime).toLocaleString()}`}
                                    // Example using a utility:
                                    // secondary={`Down at: ${formatDateTime(website.lastDownTime)}`}
                                    primaryTypographyProps={{ noWrap: true, title: website.name }} // Add tooltip for long names
                                />
                            </ListItem>
                            {index < websites.length - 1 && <Divider component="li" />} {/* Add component="li" for semantics */}
                        </>
                    ))}
                </List>
            )}
        </Paper>
    );
};

export default DownWebsitesList;
```

**3. `src/components/dashboard/StatsHeader.tsx`**

*   Upgraded to Grid v2.
*   Removed unused `DownWebsite` type import.
*   Simplified icon rendering logic slightly.
*   Passed default/empty values for props not relevant in Navbar context (`downWebsites`, `onShowDownWebsites`).

```typescript
/*
src/components/dashboard/StatsHeader.tsx
*/
import React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid2'; // <-- Use Grid v2
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

// Removed unused DownWebsite type import

interface StatsHeaderProps {
    isLoading: boolean;
    error: ApiError | null;
    upCount: number;
    totalCount: number;
    uptime: number | null | undefined;
    incidentsLast24h: number | null | undefined;
    lastIncidentTimestamp: string | null | undefined;
    center?: boolean; // Determines layout style (Navbar vs Dashboard)
    lastIncidentWebsiteId?: number | null | undefined;
    onToggleHighlight?: () => void; // Only relevant for Dashboard layout
    isHighlightActive?: boolean; // Only relevant for Dashboard layout
    // Props related to showing down websites list (only relevant for Dashboard layout)
    onShowDownWebsites: () => void;
    showDownWebsites: boolean;
    // downWebsites prop is no longer needed here, logic moved to parent
}

// Helper to get text color based on status and layout
const getTextColor = (theme: Theme, colorKey: StatusColorKey, isNavbar: boolean): string => {
    if (isNavbar) {
        // In Navbar, use white for status colors, inherit for default
        return colorKey === 'default' ? 'inherit' : theme.palette.common.white;
    }
    // In Dashboard, use theme palette colors
    if (colorKey === 'default') {
        return theme.palette.text.secondary;
    }
    // Use main color for success/warning/error, fallback to primary text
    return theme.palette[colorKey]?.main || theme.palette.text.primary;
};

// Helper to get icon component based on status and layout
const getIcon = (IconComponent: React.ElementType, color: string, isNavbar: boolean, iconSize: string) => {
    // Only render icons in the dashboard layout (not navbar)
    if (isNavbar) return null;
    return <IconComponent fontSize="inherit" sx={{ color, fontSize: iconSize, lineHeight: 1.1, display: 'block' }} />;
};

const StatsHeader: React.FC<StatsHeaderProps> = ({
    isLoading,
    error,
    upCount,
    totalCount,
    uptime,
    incidentsLast24h,
    lastIncidentTimestamp,
    center = false, // Default to Dashboard layout
    lastIncidentWebsiteId,
    onToggleHighlight,
    isHighlightActive = false,
    onShowDownWebsites, // Keep prop for clicking
    showDownWebsites, // Keep prop for styling
}) => {
    const theme = useTheme();
    const isNavbarLayout = center;

    // --- Derived Values & Formatting ---
    const timeSinceLastIncident = useTimeSince(lastIncidentTimestamp, {
        noIncidentText: isNavbarLayout ? 'None' : 'No recent incidents'
    });
    const uptimeColorKey = getStatusColor(uptime);
    const formattedUptimeValue = formatUptime(uptime);

    // --- Status Props ---
    const statusProps = React.useMemo(() => {
        let iconType: React.ElementType | null = null;
        let valueColorKey: StatusColorKey = 'default';
        let text: string;
        let tooltip: string;

        if (totalCount === 0 && !isLoading) {
            iconType = ErrorOutlineIcon;
            valueColorKey = 'default';
            text = "0 / 0";
            tooltip = 'No websites monitored';
        } else if (upCount === totalCount && totalCount > 0) {
            iconType = CheckCircleOutlineIcon;
            valueColorKey = 'success';
            text = `${upCount} / ${totalCount}`;
            tooltip = 'All websites are up';
        } else {
            iconType = WarningAmberIcon;
            // Use error color if any site is down/having issues
            valueColorKey = totalCount > 0 ? 'error' : 'default';
            text = `${upCount} / ${totalCount}`;
            tooltip = `${totalCount - upCount} website(s) are down or having issues`;
        }
        const valueColor = getTextColor(theme, valueColorKey, isNavbarLayout);
        return { iconType, valueColor, text, tooltip };
    }, [totalCount, upCount, isLoading, theme, isNavbarLayout]);

    // --- Incident Props ---
    const incidentProps = React.useMemo(() => {
        let iconType: React.ElementType | null = null;
        let valueColorKey: StatusColorKey = 'default';
        let text: string;

        if (incidentsLast24h === null || incidentsLast24h === undefined) {
            iconType = ReportProblemOutlinedIcon;
            valueColorKey = 'default';
            text = '-';
        } else if (incidentsLast24h > 0) {
            iconType = ReportProblemOutlinedIcon;
            valueColorKey = 'warning';
            text = incidentsLast24h.toString();
        } else {
            iconType = CheckCircleOutlineIcon;
            valueColorKey = 'success';
            text = '0';
        }
        const valueColor = getTextColor(theme, valueColorKey, isNavbarLayout);
        return { iconType, valueColor, text };
    }, [incidentsLast24h, theme, isNavbarLayout]);

    // --- Layout Styles ---
    const containerSx = isNavbarLayout
        ? { display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', px: 1, minHeight: 'auto', overflow: 'hidden' }
        : { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', py: 2.25, px: { xs: 1, sm: 2, md: 3 }, minHeight: '76px' };

    const valueVariant = isNavbarLayout ? 'body2' : 'h6';
    const labelVariant = isNavbarLayout ? 'caption' : 'body2';
    const iconSize = isNavbarLayout ? '0.9rem' : '1.4rem'; // Icon size only relevant for dashboard
    const gridSpacing = isNavbarLayout ? 1.2 : { xs: 1.5, sm: 2, md: 3 };
    const valueTopMargin = isNavbarLayout ? 0 : 0.5;
    const valueLabelMargin = isNavbarLayout ? 0.2 : 0.5;

    // --- Loading / Error States ---
    if (isLoading) {
        return (
            <Box sx={{ ...containerSx, justifyContent: 'center', alignItems: 'center' }}>
                <CircularProgress size={isNavbarLayout ? 20 : 24} color={isNavbarLayout ? 'inherit' : 'primary'} />
            </Box>
        );
    }

    // Only show full error alert in Dashboard layout
    if (error && !isNavbarLayout) {
        return (
             <Box sx={{ ...containerSx, alignItems: 'center', justifyContent: 'center', py: 1 }}>
                 <Alert severity="error" icon={<ErrorOutlineIcon fontSize="inherit" />} sx={{ width: '100%', justifyContent: 'center' }}>
                     Stats unavailable: {error.message || 'Loading error'}
                 </Alert>
             </Box>
        );
    }

    // --- Render Logic ---
    const gridItemSize = 3; // Each stat takes 3 columns out of 12
    const canHighlight = !isNavbarLayout && !!lastIncidentWebsiteId && !!onToggleHighlight;
    // Enable clicking incidents area only in dashboard layout and if count is not null/undefined
    const canClickIncidents = !isNavbarLayout && incidentsLast24h !== null && incidentsLast24h !== undefined;

    return (
        <Box sx={containerSx}>
            {/* Use Grid v2 */}
            <Grid
                container
                spacing={gridSpacing}
                justifyContent="center"
                alignItems="center"
                sx={isNavbarLayout ? { maxWidth: 420, width: '100%' } : {}}
            >
                {/* Stat 1: Status (Up/Total) */}
                <Grid size={gridItemSize} textAlign="center"> {/* Use size prop */}
                    <Tooltip title={statusProps.tooltip}>
                        <Box sx={isNavbarLayout ? { p: 0.5, borderRadius: 1 } : {}}>
                           {statusProps.iconType && getIcon(statusProps.iconType, statusProps.valueColor, isNavbarLayout, iconSize)}
                          <Typography variant={valueVariant} component="div" fontWeight="medium" sx={{ color: statusProps.valueColor, lineHeight: 1.2, mt: valueTopMargin }}>
                            {statusProps.text}
                          </Typography>
                        </Box>
                    </Tooltip>
                    <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : 1 }}>
                        Status
                    </Typography>
                </Grid>

                {/* Stat 2: Uptime */}
                <Grid size={gridItemSize} textAlign="center"> {/* Use size prop */}
                   <Tooltip title="Overall Uptime (Last 7 Days)">
                     <Box sx={isNavbarLayout ? { p: 0.5, borderRadius: 1 } : {}}>
                        {getIcon(NetworkCheckIcon, getTextColor(theme, uptimeColorKey, isNavbarLayout), isNavbarLayout, iconSize)}
                       <Typography variant={valueVariant} component="div" fontWeight="medium" sx={{ color: getTextColor(theme, uptimeColorKey, isNavbarLayout), lineHeight: 1.2, mt: valueTopMargin }}>
                         {formattedUptimeValue}%
                       </Typography>
                     </Box>
                   </Tooltip>
                   <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : 1 }}>
                       Uptime (7d)
                   </Typography>
                </Grid>

                {/* Stat 3: Incidents Last 24 Hours */}
                <Grid size={gridItemSize} textAlign="center"> {/* Use size prop */}
                   <Tooltip title={
                       isNavbarLayout ? `Incidents (24h): ${incidentProps.text}` : // Simpler tooltip for navbar
                       showDownWebsites ? "Click to show all websites" :
                       (incidentsLast24h && incidentsLast24h > 0 ? "Click to show down websites" : "No incidents in last 24 hours")
                   }>
                     <Box
                         onClick={canClickIncidents ? onShowDownWebsites : undefined}
                         sx={{
                             ...(isNavbarLayout ? { p: 0.5, borderRadius: 1 } : {}),
                             cursor: canClickIncidents ? 'pointer' : 'default',
                             '&:hover': canClickIncidents ? { bgcolor: alpha(theme.palette.action.hover, 0.1) } : {},
                             // Apply background only in dashboard layout when showing down list
                             bgcolor: !isNavbarLayout && showDownWebsites ? alpha(theme.palette.warning.light, 0.15) : 'transparent',
                             transition: theme.transitions.create('background-color')
                         }}
                     >
                         {incidentProps.iconType && getIcon(incidentProps.iconType, incidentProps.valueColor, isNavbarLayout, iconSize)}
                       <Typography variant={valueVariant} component="div" fontWeight="medium" sx={{ color: incidentProps.valueColor, lineHeight: 1.2, mt: valueTopMargin }}>
                         {incidentProps.text}
                       </Typography>
                     </Box>
                   </Tooltip>
                   <Typography variant={labelVariant} color={isNavbarLayout ? 'inherit' : 'text.secondary'} sx={{ mt: valueLabelMargin, opacity: isNavbarLayout ? 0.8 : 1 }}>
                        Incidents (24h)
                   </Typography>
                </Grid>

                {/* Stat 4: Time Since Last Incident */}
                <Grid size={gridItemSize} textAlign="center"> {/* Use size prop */}
                   <Tooltip
                       title={
                           isNavbarLayout ? `Last Incident: ${timeSinceLastIncident}` : // Simpler tooltip for navbar
                           canHighlight ? (isHighlightActive ? "Click to remove highlight" : "Click to highlight affected website") :
                           `Time since last downtime (up to 30 days)`
                       }
                       placement="top"
                       arrow={!isNavbarLayout} // Only show arrow in dashboard
                    >
                     <Box
                         onClick={canHighlight ? onToggleHighlight : undefined}
                         sx={{
                             cursor: canHighlight ? 'pointer' : 'default',
                             p: 0.5,
                             borderRadius: 1,
                             '&:hover': canHighlight ? { bgcolor: alpha(theme.palette.action.hover, 0.1) } : {},
                             // Apply background only in dashboard layout when highlight is active
                             bgcolor: canHighlight && isHighlightActive ? alpha(theme.palette.warning.light, 0.15) : 'transparent',
                             transition: theme.transitions.create('background-color')
                         }}
                     >
                         {getIcon(HistoryIcon, theme.palette.text.secondary, isNavbarLayout, iconSize)}
                       <Typography
                            variant={valueVariant} component="div" fontWeight="medium"
                            // Use primary text color in dashboard, inherit in navbar
                            sx={{ color: isNavbarLayout ? 'inherit' : theme.palette.text.primary, lineHeight: 1.2, mt: valueTopMargin }}
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
```

**4. `src/components/dashboard/WebsiteCard.tsx`**

*   Removed unused `AccessTimeIcon` import.
*   Removed unnecessary `Suspense` around `Line` chart.
*   Removed unnecessary `key` props from `ResponseTimeChart` and tick `Stack` components.
*   Simplified placeholder logic slightly.

```typescript
/*
src/components/dashboard/WebsiteCard.tsx
*/
import React, { useCallback, useMemo } from "react"; // Removed Suspense
import { useNavigate } from "react-router";
import {
  Card, CardContent, Typography, Box, Chip, IconButton,
  Tooltip,
  useTheme,
  CircularProgress,
  alpha,
  Stack
} from "@mui/material";
import {
  CheckCircleOutline as CheckIcon,
  ErrorOutline as ErrorIcon,
  ShowChart as ChartIcon,
  HourglassEmpty as PendingIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  TimerOff as TimerOffIcon,
  InfoOutlined as InfoIcon,
} from "@mui/icons-material";
import { Line } from 'react-chartjs-2';
import { ChartOptions, TooltipItem } from 'chart.js';
import { format } from "date-fns";

import {
  getStatusColor,
  getResponseTimeColor,
  formatResponseTime,
  formatUptime,
  formatDowntimeDuration
} from "../../utils/statusUtils";

import { useWebsiteMutations } from "../../hooks";

import {
  MonitoringResult,
  WebsiteUser,
  TimeframeKey,
  ChartDataPoint
} from "../../types";

interface WebsiteCardProps {
  userWebsite: WebsiteUser;
  shouldHighlightThisCard?: boolean;
}

const CARD_TIMEFRAME: TimeframeKey = 'day'; // Used for Uptime tooltip text

// Memoized chart component
const ResponseTimeChart = React.memo(
  ({ data, options }: { data: any; options: ChartOptions<'line'> }) => {
    const hasValidData = data?.datasets?.[0]?.data?.length > 0 &&
                         !data.datasets[0].data.every((d: number | null | undefined) => d === null || d === undefined || d === -1 || isNaN(d));

    if (!hasValidData) {
      return null; // Don't render the chart if no valid data
    }

    // Removed Suspense wrapper
    return (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Line data={data} options={options} />
        </Box>
    );
  },
);
ResponseTimeChart.displayName = 'ResponseTimeChart';

// Helper Function to generate Chart Data/Options
const useCardChartConfig = (limitedChartDataPoints: ChartDataPoint[] | undefined): { chartData: any, chartOptions: ChartOptions<'line'> } => {
    const theme = useTheme();

    const chartData = useMemo(() => {
        if (!limitedChartDataPoints || limitedChartDataPoints.length === 0) {
            return { labels: [], datasets: [] };
        }
        const labels = limitedChartDataPoints.map(p => p.label);
        // Ensure data points are numbers or null for Chart.js
        const data = limitedChartDataPoints.map(p => (p.avgResponseTime !== null && !isNaN(p.avgResponseTime)) ? p.avgResponseTime : null);

        return {
            labels,
            datasets: [{
                label: 'Response Time',
                data,
                borderColor: theme.palette.primary.main,
                borderWidth: 1.5,
                pointRadius: 0,
                pointHoverRadius: 0,
                tension: 0.2,
                fill: false,
                spanGaps: true,
            }]
        };
    }, [limitedChartDataPoints, theme.palette.primary.main]);

    const chartOptions = useMemo((): ChartOptions<'line'> => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                enabled: true,
                mode: 'index',
                intersect: false,
                displayColors: false,
                callbacks: {
                     title: (tooltipItems: TooltipItem<'line'>[]) => {
                        if (!tooltipItems.length || !limitedChartDataPoints) return '';
                        const index = tooltipItems[0].dataIndex;
                        if (index < 0 || index >= limitedChartDataPoints.length) return '';
                        const point = limitedChartDataPoints[index];
                        const uptimePercentFormatted = (point && typeof point.uptimeRatio === 'number') ? `${(point.uptimeRatio * 100).toFixed(1)}%` : 'N/A';
                        const statusText = (point && typeof point.uptimeRatio === 'number') ? (point.uptimeRatio === 1.0 ? 'Up' : 'Down') : 'Unknown';
                        return `${point?.label ?? ''} (${statusText} - ${uptimePercentFormatted})`;
                     },
                     label: (tooltipItem: TooltipItem<'line'>) => {
                        const value = tooltipItem.parsed.y;
                        return value === null || isNaN(value) ? 'No response data' : `Avg Response: ${value.toFixed(0)} ms`;
                    },
                }
            }
        },
        scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
        interaction: { mode: 'index', axis: 'x', intersect: false },
        animation: { duration: 0 },
    }), [limitedChartDataPoints]);

    return { chartData, chartOptions };
};

// --- Main Component ---
const WebsiteCard = React.memo(
  ({
    userWebsite,
    shouldHighlightThisCard = false,
  }: WebsiteCardProps) => {
    const navigate = useNavigate();
    const theme = useTheme();
    const { setPinStatus, isSettingPin, errorSettingPin } = useWebsiteMutations();

    // --- Derived Data ---
    const name = userWebsite.name ?? userWebsite.website?.url ?? 'Website';
    const url = userWebsite.website?.url;
    const latestResult = userWebsite.latestResult;
    const aggregatedChartDataProp = userWebsite.chartData;
    const uptimePercent = userWebsite.uptimePercent;
    const isPinned = userWebsite.isPinned;
    const consecutiveFailures = userWebsite.consecutiveFailures;
    const downtimeStartedAt = userWebsite.downtimeStartedAt;

    const limitedChartDataPoints = aggregatedChartDataProp?.length ? aggregatedChartDataProp : undefined;

    // --- Chart Logic ---
    const validAggregatedPointsCount = useMemo(() => {
        return limitedChartDataPoints?.filter(p => p.avgResponseTime !== null && !isNaN(p.avgResponseTime)).length ?? 0;
    }, [limitedChartDataPoints]);
    const canShowAggregatedChart = validAggregatedPointsCount >= 2;
    const aggregatedChartConfig = useCardChartConfig(canShowAggregatedChart ? limitedChartDataPoints : undefined);

    // --- Other Derived Values ---
    const hasPinError = !!errorSettingPin;
    const isOnline = latestResult?.isAvailable ?? null;
    const responseTime = latestResult?.responseTime ?? null;
    const statusCode = latestResult?.statusCode;
    const downtimeDuration = formatDowntimeDuration(downtimeStartedAt);
    const formattedUptime = formatUptime(uptimePercent);

    const canShowTicks = canShowAggregatedChart && limitedChartDataPoints?.every(p => typeof p.uptimeRatio === 'number');
    const canShowSingleTick = !canShowTicks && latestResult !== null && latestResult !== undefined;

    // --- Handlers ---
    const handleClick = useCallback(() => {
      navigate(`/website/${userWebsite.websiteId}`);
    }, [navigate, userWebsite.websiteId]);

    const handlePinClick = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
          await setPinStatus({ websiteId: userWebsite.websiteId, isPinned: !isPinned });
        } catch (err) { console.error("Failed to set pin status from card:", err); }
      },
      [setPinStatus, userWebsite.websiteId, isPinned],
    );

    // --- Display Values ---
    const displayName = name || url || 'Website';
    const displayUrl = url;
    const pinTooltipText = useMemo(() => {
        if (isSettingPin) return "Processing...";
        if (hasPinError) return `Error: ${errorSettingPin?.message || 'Pin action failed'}. Click to retry.`;
        return isPinned ? "Unpin Website" : "Pin Website";
    }, [isSettingPin, hasPinError, isPinned, errorSettingPin?.message]);

    // Card highlighting styles
    const cardHighlightStyles = useMemo(() => {
        const baseSx = {
            transition: theme.transitions.create(['transform', 'box-shadow', 'border-color'], { duration: theme.transitions.duration.short }),
             "&:hover": { transform: "translateY(-4px)", boxShadow: theme.shadows[6] },
        };
        if (shouldHighlightThisCard) {
            return { ...baseSx, borderWidth: '2px', borderStyle: 'solid', borderColor: theme.palette.warning.main, boxShadow: `0 0 10px -1px ${alpha(theme.palette.warning.main, 0.6)}` };
        } else {
            return { ...baseSx, borderWidth: isPinned ? '2px' : '1px', borderStyle: 'solid', borderColor: isPinned ? theme.palette.primary.main : theme.palette.divider };
        }
    }, [shouldHighlightThisCard, isPinned, theme]);

    // --- Main Card Render ---
    const cardContent = (
        <Card
            sx={{
                cursor: "pointer", height: "100%", display: "flex", flexDirection: "column", position: 'relative', pb: 1,
                ...cardHighlightStyles,
                transition: theme.transitions.create(['opacity', 'transform', 'box-shadow', 'border-color'], { duration: theme.transitions.duration.short }),
            }}
            onClick={handleClick}
            aria-label={`View details for ${displayName}${isPinned ? ', Pinned' : ''}${isOnline === false ? ', Offline' : ''}${shouldHighlightThisCard ? ', Highlighted as Last Incident Source' : ''}`}
        >
            <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", p: 2, pb: 1 }}>
               {/* Header */}
               <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                 <Tooltip title={displayName} placement="top-start">
                     <Typography variant="h6" component="div" noWrap sx={{ maxWidth: 'calc(100% - 40px)', mr: 1 }}>{displayName}</Typography>
                 </Tooltip>
                 <Tooltip title={pinTooltipText} placement="top">
                    <span>
                        <IconButton size="small" onClick={handlePinClick} disabled={isSettingPin} aria-label={isPinned ? `Unpin ${displayName}` : `Pin ${displayName}`}
                            sx={{ color: hasPinError && !isSettingPin ? theme.palette.error.main : isPinned ? theme.palette.primary.main : 'inherit' }}>
                            {isSettingPin ? <CircularProgress size={20} color="inherit" /> : isPinned ? <PinIcon fontSize="small" /> : <PinOutlinedIcon fontSize="small" />}
                        </IconButton>
                    </span>
                 </Tooltip>
               </Box>

               {/* URL */}
               {name && displayUrl && (
                   <Tooltip title={displayUrl} placement="bottom-start">
                     <Typography variant="body2" color="textSecondary" noWrap sx={{ mb: 1.5, minHeight: '20px' }}>{displayUrl}</Typography>
                   </Tooltip>
               )}
               {(!name || !displayUrl) && <Box sx={{ mb: 1.5, minHeight: '20px' }} />}

               {/* Status Chips */}
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mb: 1.5, minHeight: '24px' }}>
                 {latestResult === undefined || latestResult === null ? (
                     <Chip size="small" icon={<PendingIcon fontSize="inherit"/>} label="Pending" variant="outlined" color="warning" sx={{ fontWeight: 500 }}/>
                 ) : (
                     <>
                         <Tooltip title={isOnline ? "Website is online" : "Website is offline"}>
                             <Chip size="small" icon={isOnline ? <CheckIcon fontSize="inherit"/> : <ErrorIcon fontSize="inherit"/>} label={isOnline ? "Online" : "Offline"} color={isOnline ? "success" : "error"} sx={{ fontWeight: 500 }}/>
                         </Tooltip>
                         {statusCode != null && (
                             <Tooltip title={`Last HTTP Status: ${statusCode}`}>
                                <Chip size="small" label={`${statusCode}`} variant="outlined" />
                             </Tooltip>
                         )}
                         {isOnline && responseTime !== null && (
                             <Tooltip title={`Last Response Time: ${formatResponseTime(responseTime)}`}>
                                <Chip size="small" label={formatResponseTime(responseTime)} color={getResponseTimeColor(responseTime)} variant="outlined" />
                             </Tooltip>
                         )}
                         {isOnline && formattedUptime !== "N/A" && typeof uptimePercent === 'number' && (
                            <Tooltip title={`Uptime (${CARD_TIMEFRAME}): ${formattedUptime}%`}>
                                <Chip size="small" icon={<ChartIcon fontSize="inherit" />} label={`${formattedUptime}%`} color={getStatusColor(uptimePercent)} variant="outlined" />
                            </Tooltip>
                         )}
                     </>
                 )}
              </Box>

               {/* Chart / Downtime / Ticks Area */}
               <Stack sx={{ flexGrow: 1, minHeight: 60, maxHeight: 80, mt: "auto", justifyContent: 'center', alignItems: 'center', width: '100%' }} spacing={0.5}>
                    {/* Box for Chart or Placeholder Text */}
                    <Box sx={{ width: '100%', flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
                        {canShowAggregatedChart ? (
                            // Render aggregated chart - Removed unnecessary key
                            <ResponseTimeChart data={aggregatedChartConfig.chartData} options={aggregatedChartConfig.chartOptions} />
                        ) : (
                            // Placeholder Area
                            <Box sx={{ color: 'text.secondary', textAlign: 'center', width: '100%', p: 1 }}>
                                {latestResult === undefined || latestResult === null ? (
                                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                                        <PendingIcon fontSize="small" />
                                        <Typography variant="caption">Awaiting check data...</Typography>
                                    </Stack>
                                ) : !isOnline ? (
                                    <Stack alignItems="center" spacing={0.3} color={theme.palette.warning.dark}>
                                        <TimerOffIcon sx={{ fontSize: '1.3rem' }} />
                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{downtimeDuration || 'Currently Offline'}</Typography>
                                        {(consecutiveFailures !== undefined || downtimeStartedAt) && (
                                            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                                                {consecutiveFailures !== undefined && `Failures: ${consecutiveFailures}`}
                                                {(consecutiveFailures !== undefined && downtimeStartedAt) && ' • '}
                                                {downtimeStartedAt && `Since: ${new Date(downtimeStartedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}
                                            </Typography>
                                        )}
                                    </Stack>
                                ) : (
                                    // Online, but not enough data for chart
                                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                                        <InfoIcon fontSize="small" />
                                        <Typography variant="caption">Gathering data for chart...</Typography>
                                    </Stack>
                                )}
                            </Box>
                        )}
                    </Box>

                    {/* Ticks Area */}
                    {canShowTicks && limitedChartDataPoints && (
                        // Removed unnecessary key
                        <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center" sx={{ width: '95%', height: '8px', mb: 0.5 }}>
                            {limitedChartDataPoints.map((point, index) => {
                                const uptimeRatio = point.uptimeRatio;
                                let tickColor = theme.palette.grey[400];
                                let tooltipStatus = 'Unknown';
                                let uptimePercentFormatted = 'N/A';

                                if (typeof uptimeRatio === 'number' && !isNaN(uptimeRatio)) {
                                    tickColor = uptimeRatio === 1.0 ? theme.palette.success.light : theme.palette.error.light;
                                    tooltipStatus = uptimeRatio === 1.0 ? 'Up' : 'Down';
                                    uptimePercentFormatted = (uptimeRatio * 100).toFixed(1);
                                } else {
                                    tickColor = theme.palette.grey[300];
                                    tooltipStatus = 'Data Missing';
                                }

                                const tooltipTitle = `${point.label ?? ('Interval ' + index)}: ${tooltipStatus}${uptimePercentFormatted !== 'N/A' ? ` (${uptimePercentFormatted}%)` : ''}`;
                                const numberOfTicks = limitedChartDataPoints.length;
                                const tickMaxWidth = numberOfTicks > 0 ? `calc(${100 / numberOfTicks}% - ${theme.spacing(0.5)})` : '0%';

                                return (
                                    <Tooltip key={`${userWebsite.websiteId}-tick-${index}`} title={tooltipTitle} placement="top">
                                        <Box sx={{ flexGrow: 1, maxWidth: tickMaxWidth, height: '100%', bgcolor: tickColor, borderRadius: '1px' }} />
                                    </Tooltip>
                                );
                            })}
                        </Stack>
                    )}

                    {canShowSingleTick && latestResult && (
                        // Removed unnecessary key
                        <Stack direction="row" justifyContent="center" alignItems="center" sx={{ width: '95%', height: '8px', mb: 0.5 }}>
                            <Tooltip title={`Latest Check (${format(new Date(latestResult.checkedAt), 'HH:mm')}): ${latestResult.isAvailable ? 'Up' : 'Down'}`} placement="top">
                                <Box sx={{ width: '100%', height: '100%', bgcolor: latestResult.isAvailable ? theme.palette.success.light : theme.palette.error.light, borderRadius: '1px' }} />
                            </Tooltip>
                        </Stack>
                    )}
               </Stack>

            </CardContent>
        </Card>
    );

    return shouldHighlightThisCard ? (
        <Tooltip title="This website had the most recent downtime incident" placement="top" arrow>
            {cardContent}
        </Tooltip>
    ) : (
        cardContent
    );
  },
);
WebsiteCard.displayName = 'WebsiteCard';

export default WebsiteCard;
```

**5. `src/components/dashboard/WebsiteGrid.tsx`**

*   Upgraded to Grid v2.
*   Simplified loading/error handling, assuming parent (`Dashboard`) handles the primary states.

```typescript
/*
src/components/dashboard/WebsiteGrid.tsx
*/
import React from "react";
import { Box, Alert, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2"; // <-- Use Grid v2

import WebsiteCard from "./WebsiteCard";

// Removed ApiError import as error prop is removed
import { WebsiteUser, WebsiteWithResults } from "../../types"; // Adjust path if needed
// Removed useWebsiteData import as it's not used here

interface WebsiteGridProps {
  // Use the already sorted/filtered list from Dashboard
  websitesWithResults: WebsiteWithResults[];
  // Props for highlighting logic (passed down from Dashboard)
  lastIncidentWebsiteId?: number | null | undefined;
  isHighlightActive?: boolean; // Is the highlight feature currently active?
  // Loading state passed from parent to show skeletons if needed
  isLoading?: boolean;
}

/**
 * Grid component displaying website cards.
 * Assumes the incoming `websitesWithResults` prop is already sorted and filtered.
 * Handles highlighting based on props.
 * Parent component should handle primary loading/error/empty states.
 */
const WebsiteGrid: React.FC<WebsiteGridProps> = React.memo(
  ({
      websitesWithResults,
      lastIncidentWebsiteId,
      isHighlightActive = false,
      isLoading = false, // Default to false
  }) => {

    // Skeleton Rendering (only shown if isLoading is true and list is empty)
    const renderSkeletonCards = (count = 8) => {
       const dummyWebsiteUser: WebsiteUser = {
          id: -1, userId: -1, websiteId: -1, name: 'Loading website...',
          interval: 300, alertEnabled: false, alertThreshold: null,
          notifyEmail: null, createdAt: new Date().toISOString(), isPinned: false,
          latestResult: null, chartData: [], uptimePercent: 100,
          consecutiveFailures: 0, downtimeStartedAt: null,
          website: {
            id: -1, url: 'http://loading.com', isActive: true, lastChecked: null,
            globalInterval: 300, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          }
      };
      return Array(count).fill(0).map((_, i) => (
        // Use Grid v2 for skeletons as well
        <Grid key={`skeleton-${i}`} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <WebsiteCard
              userWebsite={dummyWebsiteUser}
              shouldHighlightThisCard={false}
          />
        </Grid>
      ));
    };


    // --- Render Logic ---
    // Show skeletons only if explicitly loading AND the list is currently empty
    if (isLoading && websitesWithResults.length === 0) {
      return <Grid container spacing={2} sx={{ pt: 2 }}>{renderSkeletonCards()}</Grid>;
    }

    // Parent component handles the main empty state message.
    // This component just renders the grid if there are items.
    if (!isLoading && websitesWithResults.length === 0) {
        // Return null or an empty fragment if the parent handles the "No results" message
        return null;
    }

    return (
      // Use Grid v2 container
      <Grid container spacing={2} sx={{ pt: 2 }}>
        {websitesWithResults.map((item) => {
           if (!item?.userWebsite) {
               console.warn("[WebsiteGrid] Skipping item due to missing userWebsite:", item);
               return null;
           }
           const shouldHighlight = isHighlightActive && item.userWebsite.websiteId === lastIncidentWebsiteId;

           return (
              // Use Grid v2 item with size prop
              <Grid
                key={`website-${item.userWebsite.websiteId}`}
                id={`website-card-grid-${item.userWebsite.websiteId}`}
                size={{ xs: 12, sm: 6, md: 4, lg: 3 }} // size prop for Grid v2
              >
                <WebsiteCard
                  userWebsite={item.userWebsite}
                  shouldHighlightThisCard={shouldHighlight}
                />
              </Grid>
           );
        })}
      </Grid>
    );
  },
);

WebsiteGrid.displayName = 'WebsiteGrid';

export default WebsiteGrid;
```

**6. `src/components/Navbar.tsx`**

*   Removed unused `getUserThemeKey` function (logic moved inline).
*   Passed appropriate default/dummy props (`downWebsites`, `onShowDownWebsites`) to the Navbar instance of `StatsHeader`.

```typescript
/*
src/components/Navbar.tsx
*/
import * as React from "react";
import { useCallback, useState, useMemo } from "react";
import { useLocation, useNavigate } from 'react-router';
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Menu from "@mui/material/Menu";
import MenuIcon from "@mui/icons-material/Menu";
import Container from "@mui/material/Container";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import MenuItem from "@mui/material/MenuItem";
import AdbIcon from "@mui/icons-material/Adb";
import AddIcon from "@mui/icons-material/Add";
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';

import { useAuth } from "../context/AuthContext";
import { useThemeMode } from "../context/ThemeContext";
import { useWebsiteData } from "../hooks";
import AlertsDropdown from "./navbar/AlertDropdown";
import StatsHeader from "../components/dashboard/StatsHeader"; // Adjust path if needed


// --- Navigation Items ---
const pages = [
  { name: "Add Website", path: "/add-website", icon: <AddIcon fontSize="small" />, ariaLabel: "Add new website to monitor" },
];

// --- User Menu Items ---
const settings = ["Profile", "Logout"];

// Removed unused helper function getUserThemeKey

function Navbar() {
  const [anchorElNav, setAnchorElNav] = useState<null | HTMLElement>(null);
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);

  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleThemeMode } = useThemeMode();

  // --- Fetch Website Data (needed for stats header) ---
  const {
      overallStats,
      incidentsLast24h,
      lastIncidentTimestamp,
      lastIncidentWebsiteId,
      isLoading: isLoadingData,
      error: dataError,
      totalWebsitesCount,
      upWebsitesCount,
  } = useWebsiteData(
      'week',    // Stats period
      60000      // Refetch interval (1 minute)
  );

  // Memoize specific stats needed for the header display
  const headerUptime = useMemo(() => overallStats?.overallUptime ?? null, [overallStats]);

  // --- Menu Handlers ---
  const handleOpenNavMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorElNav(event.currentTarget);
  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorElUser(event.currentTarget);
  const handleCloseNavMenu = () => setAnchorElNav(null);
  const handleCloseUserMenu = () => setAnchorElUser(null);

  const handlePageClick = useCallback((path: string) => {
    handleCloseNavMenu();
    if (path !== "#") navigate(path);
  }, [navigate]);

  const handleSettingClick = useCallback(async (setting: string) => {
    handleCloseUserMenu(); // Close menu first
    if (setting === "Logout") {
      try { await logout(); navigate('/login'); }
      catch (error) { console.error("Failed to logout:", error); }
    } else if (setting === "Profile") {
       navigate("/profile");
    }
  }, [logout, navigate, handleCloseUserMenu]);

  // --- Theme Toggle Handler ---
  const handleThemeToggle = useCallback(() => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    toggleThemeMode();
    // Store preference locally, associated with user ID if available
    if (user?.id) {
        const userThemeKey = `themeMode_${user.id}`;
        try {
            localStorage.setItem(userThemeKey, newMode);
        } catch (e) {
            console.error("Failed to save theme preference:", e);
        }
    }
  }, [mode, toggleThemeMode, user]);


  // --- Render Logic ---
  const isDashboard = location.pathname === '/';
  const userInitial = user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "?";

  return (
    <AppBar position="static">
      <Container maxWidth="xl">
        <Toolbar disableGutters>

          {/* === Left Section === */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: { xs: 0, md: 1 } }}>
            {/* Desktop Logo */}
            <Box onClick={() => navigate("/")} sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", cursor: "pointer", mr: 1 }}>
              <AdbIcon sx={{ mr: 1 }}/>
              <Typography variant="h6" noWrap component="div" sx={{ mr: 2, fontFamily: "monospace", fontWeight: 700, letterSpacing: ".3rem" }}>PINGIFY</Typography>
            </Box>
            {/* Mobile Menu */}
            <Box sx={{ display: { xs: "flex", md: "none" } }}>
              <IconButton size="large" aria-label="navigation menu" aria-controls="menu-appbar-nav" aria-haspopup="true" onClick={handleOpenNavMenu} color="inherit"><MenuIcon /></IconButton>
              <Menu id="menu-appbar-nav" anchorEl={anchorElNav} anchorOrigin={{ vertical: "bottom", horizontal: "left" }} keepMounted transformOrigin={{ vertical: "top", horizontal: "left" }} open={Boolean(anchorElNav)} onClose={handleCloseNavMenu} sx={{ display: { xs: "block", md: "none" } }}>
                {pages.map((page) => (
                  <MenuItem key={page.name} onClick={() => handlePageClick(page.path)}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>{page.icon}<Typography>{page.name}</Typography></Box>
                  </MenuItem>
                ))}
              </Menu>
            </Box>
            {/* Mobile Logo */}
            <Box onClick={() => navigate("/")} sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", cursor: "pointer", flexGrow: 1 }}>
              <AdbIcon sx={{ mr: 1 }}/>
              <Typography variant="h5" noWrap component="div" sx={{ fontFamily: "monospace", fontWeight: 700, letterSpacing: ".3rem" }}>PINGIFY</Typography>
            </Box>
             {/* Desktop Icons */}
            <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1, ml: 2 }}>
              {pages.map((page) => (
                <Tooltip key={page.name} title={page.ariaLabel || page.name} arrow>
                  <span><IconButton aria-label={page.ariaLabel || page.name} onClick={() => handlePageClick(page.path)} color="inherit" size="medium">{page.icon}</IconButton></span>
                </Tooltip>
              ))}
            </Box>
          </Box>

          {/* === Center Section (Conditional StatsHeader) === */}
          {/* Show stats header only if NOT on the main dashboard page */}
          {!isDashboard && (
            <StatsHeader
              isLoading={isLoadingData && !overallStats} // Show loading only if initial data isn't there yet
              error={dataError} // Pass error state
              upCount={upWebsitesCount}
              totalCount={totalWebsitesCount}
              uptime={headerUptime} // Pass memoized uptime
              incidentsLast24h={incidentsLast24h}
              lastIncidentTimestamp={lastIncidentTimestamp}
              lastIncidentWebsiteId={lastIncidentWebsiteId} // Pass ID for potential future use
              center={true} // Use centered layout for Navbar
              // Pass dummy/default props for features not used in Navbar context
              onShowDownWebsites={() => {}}
              showDownWebsites={false}
              // Highlighting is not used in Navbar context
              onToggleHighlight={undefined}
              isHighlightActive={false}
            />
          )}

          {/* === Right Section === */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexGrow: 0, gap: { xs: 0.5, sm: 1 } }}> {/* Reduced gap slightly */}
             <AlertsDropdown options={{ limit: 50 }} pollingInterval={60000} />

             <Tooltip title={`Toggle ${mode === 'dark' ? 'light' : 'dark'} mode`}>
                <IconButton onClick={handleThemeToggle} color="inherit">
                    {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
                </IconButton>
             </Tooltip>

             <Tooltip title="Open settings">
                <IconButton onClick={handleOpenUserMenu} aria-label="open user menu" aria-controls="menu-appbar-user" aria-haspopup="true" sx={{ p: 0 }}> {/* Removed default padding */}
                  <Avatar alt={user?.name || user?.email || 'User'} sx={{ width: { xs: 32, sm: 40 }, height: { xs: 32, sm: 40 }, bgcolor: "secondary.main", color: (theme) => theme.palette.getContrastText(theme.palette.secondary.main), fontSize: "1rem" }}>
                    {userInitial}
                  </Avatar>
                </IconButton>
              </Tooltip>

            <Menu id="menu-appbar-user" sx={{ mt: "45px" }} anchorEl={anchorElUser} anchorOrigin={{ vertical: "top", horizontal: "right" }} keepMounted transformOrigin={{ vertical: "top", horizontal: "right" }} open={Boolean(anchorElUser)} onClose={handleCloseUserMenu}>
              <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle1" fontWeight="bold" noWrap>{user?.name || 'User'}</Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>{user?.email}</Typography>
              </Box>
              {settings.map((setting) => (
                <MenuItem key={setting} onClick={() => handleSettingClick(setting)}>
                  <Typography sx={{ textAlign: "center", width: '100%' }}>{setting}</Typography>
                </MenuItem>
              ))}
            </Menu>
          </Box>

        </Toolbar>
      </Container>
    </AppBar>
  );
}

export default Navbar;
```

**7. `src/pages/Dashboard.tsx`**

*   Corrected `Link` import from `react-router-dom`.
*   Corrected `useWebsiteData` hook call (removed `undefined` argument).
*   Removed unused `SortOption` type definition (using imported one).
*   Simplified loading state logic slightly.
*   Delegated more of the empty/error state display to `WebsiteGrid` or handled it more cleanly here.

```typescript
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
    Stack // Import Stack
} from "@mui/material";
import FilterListIcon from '@mui/icons-material/FilterList';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import ViewCompactOutlinedIcon from '@mui/icons-material/ViewCompactOutlined';
import ViewAgendaOutlinedIcon from '@mui/icons-material/ViewAgendaOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber'; // For down websites button

import WebsiteGrid from "../components/dashboard/WebsiteGrid";
import DashboardSearchFilter from "../components/dashboard/DashboardSearchFilter";
import StatsHeader from "../components/dashboard/StatsHeader";
import DownWebsitesList from "../components/dashboard/DownWebsitesList"; // Import the list component

import { useWebsiteData, useDownWebsitesLast24h } from "../hooks";
import { useFocusMode } from "../context/FocusModeContext";
import { Link } from "react-router-dom"; // <-- Correct import for react-router-dom v6+

// Ensure SortOption is imported or defined correctly in types.ts
import { SortOption, WebsiteWithResults } from "../types";

// Define Sort Options Config
interface SortOptionConfig {
    value: SortOption;
    label: string;
    icon: React.ReactElement;
}

const sortOptionsConfig: SortOptionConfig[] = [
    { value: 'name-asc', label: 'Name (A-Z)', icon: <SortByAlphaIcon fontSize="small" /> },
    { value: 'name-desc', label: 'Name (Z-A)', icon: <SortByAlphaIcon fontSize="small" sx={{ transform: 'scaleY(-1)'}}/> },
    { value: 'response-asc', label: 'Response Time (Fastest)', icon: <ArrowUpwardIcon fontSize="small" /> },
    { value: 'response-desc', label: 'Response Time (Slowest)', icon: <ArrowDownwardIcon fontSize="small" /> },
    // Add other sort options if needed (e.g., by status, by uptime)
];

const Dashboard: React.FC = () => {
    // --- State ---
    const [filterTerm, setFilterTerm] = useState<string>('');
    const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);
    const [sortOption, setSortOption] = useState<SortOption>('name-asc');
    const { isFocusMode, toggleFocusMode } = useFocusMode();
    const [isHighlightActive, setIsHighlightActive] = useState(false);
    const [showDownWebsitesList, setShowDownWebsitesList] = useState(false);
    const [downListAnchorEl, setDownListAnchorEl] = useState<null | HTMLElement>(null);

    // --- Data Hooks ---
    const {
        data: downWebsites = [],
        isLoading: isLoadingDownWebsites,
        error: downWebsitesError,
        refetch: refetchDownWebsites
    } = useDownWebsitesLast24h({
        // Only fetch when the list is intended to be shown or needed for stats
        enabled: showDownWebsitesList || false, // Adjust based on when you need the data
    });

    const {
        websitesWithResults: allWebsites,
        overallStats,
        incidentsLast24h, // Use this count directly
        lastIncidentTimestamp,
        lastIncidentWebsiteId,
        isLoading: isLoadingData, // Primary data loading state
        error: dataError,
        refetch,
        totalWebsitesCount,
        upWebsitesCount,
    } = useWebsiteData( // <-- Corrected hook call
        'week', // Default stats period
        60000   // Refetch interval (1 minute)
    );

    const openSortMenu = Boolean(sortAnchorEl);

    // --- Callbacks ---
    const handleFilterChange = useCallback((term: string) => {
        setFilterTerm(term.toLowerCase());
        setShowDownWebsitesList(false); // Close down list when filter changes
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
        setShowDownWebsitesList(false); // Close down list when sort changes
    }, [handleSortMenuClose]);

    const handleToggleHighlight = useCallback(() => {
        const shouldActivate = !isHighlightActive;
        setIsHighlightActive(shouldActivate);

        if (shouldActivate && lastIncidentWebsiteId) {
            // Scroll to highlighted card after a short delay
            setTimeout(() => {
                const element = document.getElementById(`website-card-grid-${lastIncidentWebsiteId}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }, [isHighlightActive, lastIncidentWebsiteId]);

    // Toggle the visibility of the down websites list
    const toggleDownWebsitesView = useCallback((event: React.MouseEvent<HTMLElement>) => {
        if (showDownWebsitesList) {
            setShowDownWebsitesList(false);
            setDownListAnchorEl(null);
        } else {
            refetchDownWebsites(); // Fetch data when opening
            setShowDownWebsitesList(true);
            setDownListAnchorEl(event.currentTarget); // Anchor to the button
        }
    }, [showDownWebsitesList, refetchDownWebsites]);

    const closeDownWebsitesList = useCallback(() => {
        setShowDownWebsitesList(false);
        setDownListAnchorEl(null);
    }, []);

    // --- Effects ---
    // Deactivate highlight if the source changes
    useEffect(() => {
        setIsHighlightActive(false);
    }, [lastIncidentWebsiteId]);

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
        // Start with the already filtered list
        const listToSort = [...filteredWebsites];

        return listToSort.sort((a, b) => {
            if (!a?.userWebsite || !b?.userWebsite) return 0;

            // Pinned first
            if (a.userWebsite.isPinned !== b.userWebsite.isPinned) {
                return a.userWebsite.isPinned ? -1 : 1;
            }
            // Down sites before up sites
            const aIsAvailable = a.userWebsite.latestResult?.isAvailable ?? true;
            const bIsAvailable = b.userWebsite.latestResult?.isAvailable ?? true;
            if (aIsAvailable !== bIsAvailable) {
                return aIsAvailable ? 1 : -1;
            }
            // Apply user-selected sort
            switch (sortOption) {
                case 'name-asc': {
                    const nameA = a.userWebsite.name ?? a.userWebsite.website?.url ?? '';
                    const nameB = b.userWebsite.name ?? b.userWebsite.website?.url ?? '';
                    return nameA.localeCompare(nameB);
                }
                case 'name-desc': {
                    const nameA = a.userWebsite.name ?? a.userWebsite.website?.url ?? '';
                    const nameB = b.userWebsite.name ?? b.userWebsite.website?.url ?? '';
                    return nameB.localeCompare(nameA);
                }
                case 'response-asc': {
                    const respA = a.userWebsite.latestResult?.responseTime ?? Infinity;
                    const respB = b.userWebsite.latestResult?.responseTime ?? Infinity;
                    return respA - respB;
                }
                case 'response-desc': {
                    const respA = a.userWebsite.latestResult?.responseTime ?? -1;
                    const respB = b.userWebsite.latestResult?.responseTime ?? -1;
                    return respB - respA;
                }
                default: return 0;
            }
        });
    }, [filteredWebsites, sortOption]); // Depends on filtered list and sort option

    const headerStats = useMemo(() => ({
        uptime: overallStats?.overallUptime ?? null,
    }), [overallStats]);

    // --- Render Logic ---
    const showLoadingSkeleton = isLoadingData && sortedAndFilteredWebsites.length === 0;
    const isListEmpty = !isLoadingData && sortedAndFilteredWebsites.length === 0;
    const isEmptyDueToFilter = isListEmpty && !!filterTerm;
    const isEmptyBecauseNoWebsites = isListEmpty && !filterTerm && !dataError;

    // Show main loading spinner only on initial load
    if (isLoadingData && !overallStats && !dataError) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
                <CircularProgress />
            </Box>
        );
    }

    // Handle initial error state where nothing loaded at all
    if (dataError && !overallStats && allWebsites.length === 0) {
        return (
            <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
                <Alert severity="error" sx={{ mb: 2 }}>
                    Error loading dashboard data: {dataError.message || 'Unknown error'}
                </Alert>
                <Button variant="outlined" onClick={() => refetch()} sx={{ mt: 1 }}>Retry</Button>
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ px: { xs: 1, sm: 2 }, mt: 2, mb: 2 }}>
            {/* Statistics Header */}
            {!isFocusMode && (
                <Paper elevation={1} sx={{ mb: 2, overflow: 'hidden', position: 'relative' }}> {/* Added position relative */}
                    <StatsHeader
                        isLoading={isLoadingData && !overallStats} // Show loading if initial stats aren't loaded
                        error={dataError} // Pass primary data error
                        upCount={upWebsitesCount}
                        totalCount={totalWebsitesCount}
                        uptime={headerStats.uptime}
                        incidentsLast24h={incidentsLast24h}
                        lastIncidentTimestamp={lastIncidentTimestamp}
                        lastIncidentWebsiteId={lastIncidentWebsiteId}
                        onToggleHighlight={handleToggleHighlight}
                        isHighlightActive={isHighlightActive}
                        center={false} // Dashboard layout
                        // Pass props for down websites button interaction
                        onShowDownWebsites={toggleDownWebsitesView}
                        showDownWebsites={showDownWebsitesList} // Use state controlling the list popup
                    />
                    {/* Conditionally render DownWebsitesList */}
                    {showDownWebsitesList && (
                        <Box sx={{ position: 'absolute', top: '100%', right: 0, zIndex: 1200 }}> {/* Position relative to Paper */}
                            {isLoadingDownWebsites ? (
                                <CircularProgress sx={{ m: 2 }} />
                            ) : downWebsitesError ? (
                                <Alert severity="error" onClose={closeDownWebsitesList}>
                                    Error loading down list: {downWebsitesError.message}
                                    <Button onClick={() => refetchDownWebsites()} size="small">Retry</Button>
                                </Alert>
                            ) : (
                                <DownWebsitesList
                                    websites={downWebsites}
                                    onClose={closeDownWebsitesList}
                                />
                            )}
                        </Box>
                    )}
                </Paper>
            )}

            {/* Search and Controls Row */}
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                justifyContent="space-between"
                mb={2} // Increased margin bottom
            >
                <Stack direction="row" spacing={1} alignItems="center">
                    <Tooltip title={isFocusMode ? "Show Full Dashboard" : "Focus Mode (Hide Stats)"}>
                        <IconButton onClick={toggleFocusMode} color="default" aria-label="toggle focus mode">
                            {isFocusMode ? <ViewAgendaOutlinedIcon /> : <ViewCompactOutlinedIcon />}
                        </IconButton>
                    </Tooltip>
                    {/* Button to show down websites - only visible in dashboard layout */}
                    {!isFocusMode && (incidentsLast24h ?? 0) > 0 && (
                         <Tooltip title={showDownWebsitesList ? "Hide Down List" : "Show Down Websites (24h)"}>
                            <IconButton
                                onClick={toggleDownWebsitesView}
                                color={showDownWebsitesList ? "warning" : "default"}
                                aria-label="toggle down websites list"
                                id="down-list-button" // Add id for anchoring if needed
                            >
                                <WarningAmberIcon />
                            </IconButton>
                         </Tooltip>
                    )}
                </Stack>

                <DashboardSearchFilter
                    onFilterChange={handleFilterChange}
                    sx={{ flexGrow: 1, maxWidth: { xs: '100%', sm: 450 } }} // Allow filter to grow
                />

                <Tooltip title="Sort websites">
                    <IconButton
                        id="sort-button"
                        aria-controls={openSortMenu ? 'sort-menu' : undefined}
                        aria-haspopup="true"
                        aria-expanded={openSortMenu ? 'true' : undefined}
                        onClick={handleSortMenuClick}
                        color="primary"
                    >
                        <FilterListIcon />
                    </IconButton>
                </Tooltip>

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
                        <MenuItem
                            key={option.value}
                            selected={option.value === sortOption}
                            onClick={() => handleSortOptionSelect(option.value)}
                        >
                            <ListItemIcon sx={{ minWidth: '36px' }}>{option.icon}</ListItemIcon>
                            <ListItemText primary={option.label} />
                        </MenuItem>
                    ))}
                </Menu>
            </Stack>

            {/* Inline Warning for partial data errors */}
            {!isFocusMode && dataError && (allWebsites.length > 0 || overallStats) && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    There might be issues displaying the latest data: {dataError.message}.
                    <Button onClick={() => refetch()} size="small" sx={{ ml: 1 }}>Retry</Button>
                </Alert>
            )}

            {/* Website Grid */}
            <WebsiteGrid
                websitesWithResults={sortedAndFilteredWebsites}
                isLoading={showLoadingSkeleton} // Pass skeleton loading state
                lastIncidentWebsiteId={lastIncidentWebsiteId}
                isHighlightActive={isHighlightActive}
            />

            {/* Empty States */}
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
```

**8. `src/components/details/WebsiteDetails.tsx`**

*   Upgraded `MuiGrid` to Grid v2.
*   Ensured loading states (`isManualChecking`, `isBackgroundRefetching`, `isProcessingData`) are passed correctly to child components.

```typescript
/*
src/components/details/WebsiteDetails.tsx
*/
import React, { useState, useMemo, useCallback, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Container, Box, Alert, Button, Skeleton, Paper, SelectChangeEvent, CircularProgress } from '@mui/material';
import Grid from '@mui/material/Grid2'; // <-- Use Grid v2
import { keepPreviousData } from '@tanstack/react-query';

// Adjust paths as needed
import { useWebsiteDetailsQuery, useWebsiteCheckMutation } from '../../hooks';
import { TimeframeKey, ApiError } from '../../types';
import WebsiteDetailsHeader from './WebsiteDetailsHeader';
import RecentChecksList from './RecentCheckList';
const WebsiteCharts = React.lazy(() => import('./WebsiteCharts'));

export type SortableColumn = 'isAvailable' | 'timestamp' | 'statusCode' | 'responseTime';
export type SortDirection = 'asc' | 'desc';

// --- Skeletons & Fallbacks ---
const PageSkeleton = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 2, mb: 3 }}><Skeleton variant="rectangular" height={80} /></Paper>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}><Skeleton variant="rectangular" width={150} height={40} /></Box>
        {/* Use Grid v2 for skeleton layout */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 6 }}><Paper sx={{ p: 2 }}><Skeleton variant="rectangular" height={300} /></Paper></Grid>
            <Grid size={{ xs: 12, md: 6 }}><Paper sx={{ p: 2 }}><Skeleton variant="rectangular" height={300} /></Paper></Grid>
        </Grid>
        <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Skeleton variant="text" width={150} height={30} />
                <Skeleton variant="rectangular" width={100} height={40} />
            </Box>
            <Skeleton variant="rectangular" height={200} />
        </Paper>
    </Container>
);

const LoadingFallback = () => (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <CircularProgress />
    </Box>
);
// --- End Skeletons & Fallbacks ---

const WebsiteDetails: React.FC = () => {
    const { websiteId: websiteIdParam } = useParams<{ websiteId: string }>();
    const navigate = useNavigate();

    const numericWebsiteId = useMemo(() => {
        const id = parseInt(websiteIdParam || '', 10);
        return isNaN(id) || id <= 0 ? undefined : id;
    }, [websiteIdParam]);

    // --- Local UI State ---
    const [timeframeKey, setTimeframeKey] = useState<TimeframeKey>('day');
    const [checkLimit, setCheckLimit] = useState<number>(25);
    const [sortBy, setSortBy] = useState<SortableColumn>('timestamp');
    const [sortDir, setSortDir] = useState<SortDirection>('desc');

    // --- Data Fetching ---
    const {
        data: websiteDetails,
        isPending: isInitialLoading,
        error: detailsError,
        isFetching: isDetailsRefetching,
        refetch: refetchDetails,
    } = useWebsiteDetailsQuery({
        websiteId: numericWebsiteId!, // Assert non-null as enabled handles it
        timeframe: timeframeKey,
        limit: checkLimit,
        sortBy: sortBy,
        sortDir: sortDir,
    }, {
        enabled: !!numericWebsiteId, // Query enabled only if ID is valid
        staleTime: 60 * 1000, // 1 minute stale time
        refetchOnWindowFocus: true,
        placeholderData: keepPreviousData, // Keep old data while refetching
    });

    // --- Mutation ---
    const { mutate: checkWebsite, isPending: isChecking } = useWebsiteCheckMutation();

    // --- Event Handlers ---
    const handleTimeframeChange = useCallback((event: SelectChangeEvent<TimeframeKey>) => {
        setTimeframeKey(event.target.value as TimeframeKey);
    }, []);

    const handleCheckLimitChange = useCallback((event: SelectChangeEvent<number | string>) => {
        const newLimit = Number(event.target.value);
        if (!isNaN(newLimit) && newLimit > 0) { setCheckLimit(newLimit); }
    }, []);

    const handleSort = useCallback((column: SortableColumn) => {
        setSortDir(currentDir => (column === sortBy && currentDir === 'desc' ? 'asc' : 'desc'));
        setSortBy(column);
    }, [sortBy]);

    const handleCheckNow = useCallback(() => {
        // Trigger check only if ID is valid and mutation is not already pending
        if (numericWebsiteId && !isChecking) {
            checkWebsite(numericWebsiteId);
        }
    }, [numericWebsiteId, isChecking, checkWebsite]);

    const handleSettingsClick = useCallback(() => {
        if (numericWebsiteId) { navigate(`/website/${numericWebsiteId}/settings`); }
    }, [navigate, numericWebsiteId]);

    // --- Derived Data & Loading States ---
    const name = websiteDetails?.name ?? (isInitialLoading ? 'Loading...' : 'N/A');
    const url = websiteDetails?.url ?? '';
    const latestResult = websiteDetails?.latestResult ?? null;
    const chartData = websiteDetails?.chartData ?? [];
    const recentChecks = websiteDetails?.recentChecks ?? [];
    const uptimePercent = websiteDetails?.uptimePercent ?? null; // Use null if undefined

    // isProcessingData: True if either the query is refetching OR the manual check mutation is running
    const isProcessingData = isDetailsRefetching || isChecking;
    // isManualChecking: True ONLY when the manual "Check Now" mutation is running
    const isManualChecking = isChecking;
    // isBackgroundRefetching: True ONLY when the query is refetching in the background (not triggered by manual check)
    const isBackgroundRefetching = isDetailsRefetching && !isChecking;

    // --- Render Logic ---

    if (websiteIdParam !== undefined && numericWebsiteId === undefined) {
        return <Container sx={{ mt: 4 }}><Alert severity="error">Invalid Website ID provided in URL.</Alert></Container>;
    }
    if (isInitialLoading) {
        return <PageSkeleton />;
    }
    if (detailsError && !websiteDetails) { // Error on initial load
        return (
            <Container sx={{ mt: 4 }}>
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => refetchDetails()}>Retry</Button>}>
                    Error loading website details: {(detailsError as ApiError).message || 'Unknown error'}
                </Alert>
            </Container>
        );
    }
    if (!isInitialLoading && !websiteDetails) { // Data loaded successfully but was empty/not found
       return <Container sx={{ mt: 4 }}><Alert severity="warning">Could not find data for this website.</Alert></Container>;
    }

    // Show inline error only if a refetch fails but we still have old data
    const showInlineError = detailsError && !!websiteDetails;

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            {showInlineError && (
                <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => refetchDetails()}>Retry</Button>}>
                    Could not refresh data: {(detailsError as ApiError)?.message || 'Unknown error'}. Displaying last known data.
                </Alert>
            )}

            <WebsiteDetailsHeader
                name={name}
                url={url}
                latestResult={latestResult}
                isChecking={isManualChecking} // Pass specific state for "Check Now" button
                isRefetching={isBackgroundRefetching} // Pass specific state for background refresh indicator
                onCheckNow={handleCheckNow}
                onSettingsClick={handleSettingsClick}
            />

            {/* Suspense for lazy charts */}
             <Suspense fallback={<LoadingFallback />}>
                <WebsiteCharts
                    chartData={chartData}
                    uptimePercent={uptimePercent} // Pass null if undefined
                    timeframeKey={timeframeKey}
                    // Disable timeframe selection if any data processing is happening
                    isLoading={isProcessingData}
                    onTimeframeChange={handleTimeframeChange}
                />
            </Suspense>

            {/* Pass combined loading state to disable list controls */}
            <RecentChecksList
                recentChecks={recentChecks}
                checkLimit={checkLimit}
                sortBy={sortBy}
                sortDir={sortDir}
                isLoading={isProcessingData} // Disable controls if query/mutation is running
                onCheckLimitChange={handleCheckLimitChange}
                onSort={handleSort}
            />
        </Container>
    );
};

export default WebsiteDetails;
```

**9. `src/pages/WebsiteSettings.tsx`**

*   Upgraded `Grid` to Grid v2.
*   Removed redundant pre-submit checks in `handleSubmit` (relying on Yup).
*   Simplified the `disabled` logic for the Save button.

```typescript
/*
src/pages/WebsiteSettings.tsx
*/
import React, { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { Formik, Form, Field, FormikHelpers, FieldProps } from "formik";
import * as Yup from "yup";
import {
    Container, Paper, Typography, Box, TextField, Switch, FormControlLabel,
    Button, Divider, CircularProgress, Alert, IconButton, Tooltip,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack
} from "@mui/material";
import Grid from "@mui/material/Grid2"; // <-- Use Grid v2
import {
    ArrowBack as ArrowBackIcon, Save as SaveIcon, Delete as DeleteIcon,
} from "@mui/icons-material";

// Adjust paths as needed
import { useUserWebsiteQuery, useWebsiteMutations } from "../hooks";
import FormNotification, { initialNotificationState, FormNotificationState } from "../components/common/FormNotification";
import { UpdateWebsiteUserDTO, ApiError, WebsiteUser } from "../types";

interface WebsiteSettingsFormValues {
    name: string;
    interval: number | string;
    alertEnabled: boolean;
    alertThreshold: number | string;
    notifyEmail: string;
}

// Validation schema using Yup
const WebsiteSettingsSchema = Yup.object().shape({
    name: Yup.string().trim().required("Website name is required"),
    interval: Yup.number()
        .min(30, "Interval must be at least 30 seconds")
        .max(86400, "Interval must be at most 86400 seconds (1 day)")
        .required("Interval is required")
        .typeError("Interval must be a number"),
    alertEnabled: Yup.boolean().required(),
    alertThreshold: Yup.number()
        .when("alertEnabled", ([alertEnabled], schema) => {
            return alertEnabled
                ? schema
                    .min(1, "Threshold must be at least 1 millisecond")
                    .max(60000, "Threshold must be at most 60000 milliseconds (1 min)")
                    .required("Response threshold is required when alerts are enabled")
                    .typeError("Threshold must be a number")
                : schema.nullable().transform((value) => (value === "" || value == null) ? null : value);
        }),
    notifyEmail: Yup.string()
        .email("Please enter a valid email address")
        .when("alertEnabled", ([alertEnabled], schema) => {
            return alertEnabled
                ? schema.trim().required("Email is required when alerts are enabled")
                : schema.nullable().email("Please enter a valid email address").transform((value) => (value === "" || value == null) ? null : value.trim());
        }),
});


const WebsiteSettings: React.FC = () => {
    const { websiteId: websiteIdParam } = useParams<{ websiteId: string }>();
    const navigate = useNavigate();

    const parseIdParam = (idParam: string | undefined): number | undefined => {
        if (!idParam) return undefined;
        const id = parseInt(idParam, 10);
        return isNaN(id) || id <= 0 ? undefined : id;
    };

    const numericWebsiteId = useMemo(() => parseIdParam(websiteIdParam), [websiteIdParam]);

    const [notification, setNotification] = useState<FormNotificationState>(initialNotificationState);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    // --- Data Fetching ---
    const {
        data: userWebsite,
        isLoading: isWebsiteLoading,
        error: websiteError,
        refetch: refetchWebsite,
    } = useUserWebsiteQuery(numericWebsiteId, {
        enabled: !!numericWebsiteId,
        staleTime: 1000 * 60,
        gcTime: 1000 * 60 * 5,
    });

    // --- Mutations ---
    const {
        updateSettings,
        removeWebsite,
        isUpdating,
        isRemoving,
        errorUpdating,
        errorRemoving,
    } = useWebsiteMutations();

    // Combined state for disabling form fields during any mutation
    const isMutating = isUpdating || isRemoving;
    // Combined state for disabling core actions (Save/Delete buttons) or showing page-level loading
    const isActionLoading = isWebsiteLoading || isUpdating || isRemoving;

    // --- Form Initial Values ---
    const initialValues = useMemo((): WebsiteSettingsFormValues => ({
        name: userWebsite?.name || "",
        interval: userWebsite?.interval ?? 300,
        alertEnabled: userWebsite?.alertEnabled ?? false,
        alertThreshold: userWebsite?.alertThreshold ?? "",
        notifyEmail: userWebsite?.notifyEmail || "",
    }), [userWebsite]);

    // --- Handlers ---
    const handleSubmit = async (
        values: WebsiteSettingsFormValues,
        formikHelpers: FormikHelpers<WebsiteSettingsFormValues>
    ) => {
        const { setStatus, resetForm } = formikHelpers;
        setStatus(null); // Clear previous form status
        setNotification(initialNotificationState);

        if (!numericWebsiteId) {
            setStatus({ error: "Cannot save: Invalid Website ID." });
            setNotification({ open: true, message: "Error: Invalid Website ID.", severity: "error" });
            return;
        }

        // Prepare DTO, relying on Yup for validation before this point
        const updateData: UpdateWebsiteUserDTO = {
            name: values.name.trim() || null,
            interval: Number(values.interval), // Yup ensures this is a valid number
            alertEnabled: values.alertEnabled,
            // Convert threshold/email based on alertEnabled status
            alertThreshold: values.alertEnabled ? Number(values.alertThreshold) : null, // Yup ensures number if enabled
            notifyEmail: values.alertEnabled && values.notifyEmail.trim() ? values.notifyEmail.trim() : null,
        };

        try {
            const updatedWebsite = await updateSettings({ websiteId: numericWebsiteId, websiteData: updateData });
            setNotification({ open: true, message: "Settings saved successfully!", severity: "success" });

            // Navigate back only after successful save
            navigate(`/website/${numericWebsiteId}`);

            // Optionally reset form to reflect saved state if staying on page
            // resetForm({ values: { /* map updatedWebsite back to form values */ } });

        } catch (err) {
            const apiError = err as ApiError;
            console.error("Failed to update settings:", apiError);
            const message = (errorUpdating as ApiError)?.message || apiError?.message || "Failed to save settings.";
            setStatus({ error: message }); // Set form-level error
            setNotification({ open: true, message: `Error: ${message}`, severity: "error" });
        }
        // Formik handles isSubmitting state automatically with async onSubmit
    };

    const openDeleteDialog = useCallback(() => setDeleteConfirmOpen(true), []);
    const closeDeleteDialog = useCallback(() => { if (!isRemoving) setDeleteConfirmOpen(false); }, [isRemoving]);

    const handleDeleteConfirm = useCallback(async () => {
        if (!numericWebsiteId) return;
        setNotification(initialNotificationState);
        try {
            await removeWebsite(numericWebsiteId);
            setNotification({ open: true, message: `Website removed successfully.`, severity: "success" });
            closeDeleteDialog();
            navigate("/");
        } catch (err) {
            const apiError = err as ApiError;
            console.error("Failed to delete website:", apiError);
            const message = (errorRemoving as ApiError)?.message || apiError.message || 'Unknown error removing website';
            setNotification({ open: true, message: `Error removing website: ${message}`, severity: "error" });
            // Keep dialog open on error
        }
    }, [numericWebsiteId, removeWebsite, navigate, closeDeleteDialog, errorRemoving, setNotification]);

    const handleBackClick = useCallback(() => {
        navigate(numericWebsiteId ? `/website/${numericWebsiteId}` : '/');
    }, [navigate, numericWebsiteId]);

    const handleNotificationClose = useCallback((event?: React.SyntheticEvent | Event, reason?: string) => {
         if (reason === 'clickaway') return;
        setNotification((prev) => ({ ...prev, open: false }));
    }, []);

    // --- Render Logic ---
    if (websiteIdParam !== undefined && numericWebsiteId === undefined) {
        return <Container sx={{ mt: 4 }}><Alert severity="error">Invalid Website ID provided in URL.</Alert></Container>;
    }
    if (isWebsiteLoading) {
        return <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}><Box display="flex" justifyContent="center" my={5}><CircularProgress data-testid="settings-loading-spinner" /></Box></Container>;
    }
    if (websiteError) {
        return (
            <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => refetchWebsite()}>Retry</Button>}>
                    Error loading website settings: {(websiteError as ApiError).message || 'Unknown error'}
                </Alert>
                <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")} sx={{ mt: 2 }}>Return to Dashboard</Button>
            </Container>
        );
    }
    if (!userWebsite) {
        return (
            <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
                <Alert severity="warning">Website not found or access denied.</Alert>
                <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")} sx={{ mt: 2 }}>Return to Dashboard</Button>
            </Container>
        );
    }

    return (
        <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
            {/* Header */}
            <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: 'wrap', gap: 1 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <Tooltip title="Back to Website Details">
                        <IconButton onClick={handleBackClick} aria-label="Back to website details" disabled={isMutating}>
                            <ArrowBackIcon />
                        </IconButton>
                    </Tooltip>
                    <Typography variant="h4" component="h1">Website Settings</Typography>
                </Stack>
                <Typography variant="body2" color="textSecondary" noWrap title={userWebsite.website?.url ?? ''} sx={{ maxWidth: '50%', textAlign: 'right' }}>
                    {userWebsite.website?.url ?? 'URL not available'}
                </Typography>
            </Box>

            <Formik initialValues={initialValues} validationSchema={WebsiteSettingsSchema} onSubmit={handleSubmit} enableReinitialize>
                {({ errors, touched, values, status, dirty, isValid }) => (
                    <Form noValidate>
                        {status?.error && <Alert severity="error" sx={{ mb: 3 }}>{status.error}</Alert>}
                        {errorUpdating && !status?.error && <Alert severity="error" sx={{ mb: 3 }}>Update failed: {(errorUpdating as ApiError).message || 'Unknown error'}</Alert>}

                        {/* General Settings */}
                        <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 4 }}>
                            <Typography variant="h6" gutterBottom>General Settings</Typography>
                            <Divider sx={{ mb: 3 }} />
                            {/* Use Grid v2 */}
                            <Grid container spacing={3}>
                                <Grid size={{ xs: 12, md: 6 }}> {/* Use size prop */}
                                    <Field as={TextField} fullWidth label="Website Name" name="name"
                                        error={touched.name && Boolean(errors.name)} helperText={touched.name && errors.name}
                                        required disabled={isMutating} />
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}> {/* Use size prop */}
                                    <Field as={TextField} fullWidth label="Check Interval (seconds)" name="interval" type="number"
                                        error={touched.interval && Boolean(errors.interval)} helperText={(touched.interval && errors.interval) || "Minimum 30 seconds"}
                                        required InputProps={{ inputProps: { min: 30, max: 86400, step: 30 } }} disabled={isMutating} />
                                </Grid>
                            </Grid>
                        </Paper>

                        {/* Alert Settings */}
                        <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 4 }}>
                            <Typography variant="h6" gutterBottom>Alert Settings</Typography>
                            <Divider sx={{ mb: 3 }} />
                            <Field name="alertEnabled" type="checkbox">
                                {({ field }: FieldProps<boolean>) => (
                                    <FormControlLabel control={<Switch {...field} checked={field.value} color="primary" disabled={isMutating} />}
                                        label="Enable Downtime / Slow Response Alerts" sx={{ mb: values.alertEnabled ? 2 : 0 }} />
                                )}
                            </Field>
                            {values.alertEnabled && (
                                // Use Grid v2
                                <Grid container spacing={3} sx={{ mt: 0 }}>
                                    <Grid size={{ xs: 12, md: 6 }}> {/* Use size prop */}
                                        <Field as={TextField} fullWidth label="Response Time Threshold (ms)" name="alertThreshold" type="number"
                                            error={touched.alertThreshold && Boolean(errors.alertThreshold)} helperText={(touched.alertThreshold && errors.alertThreshold) || "Alert if response > value (1-60000ms)"}
                                            InputProps={{ inputProps: { min: 1, max: 60000 } }} disabled={isMutating} required={values.alertEnabled} />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 6 }}> {/* Use size prop */}
                                        <Field as={TextField} fullWidth label="Notification Email" name="notifyEmail" type="email"
                                            error={touched.notifyEmail && Boolean(errors.notifyEmail)} helperText={(touched.notifyEmail && errors.notifyEmail) || "Email address for alerts"}
                                            disabled={isMutating} required={values.alertEnabled} />
                                    </Grid>
                                </Grid>
                            )}
                        </Paper>

                        {/* Action Buttons */}
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: 'center', mt: 4, gap: 2, flexWrap: 'wrap' }}>
                            <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={openDeleteDialog}
                                disabled={isActionLoading} data-testid="delete-button">
                                Remove Website
                            </Button>
                            <Button type="submit" variant="contained" startIcon={isUpdating ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                                // Simplified disabled logic
                                disabled={isActionLoading || !dirty || !isValid}
                                data-testid="save-button">
                                {isUpdating ? "Saving..." : "Save Changes"}
                            </Button>
                        </Box>
                    </Form>
                )}
            </Formik>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteConfirmOpen} onClose={closeDeleteDialog} aria-labelledby="delete-confirm-title" aria-describedby="delete-confirm-description">
                <DialogTitle id="delete-confirm-title">Confirm Removal</DialogTitle>
                <DialogContent>
                    <DialogContentText id="delete-confirm-description">
                        Are you sure you want to remove "{userWebsite.name || userWebsite.website?.url}"? This action cannot be undone.
                    </DialogContentText>
                    {errorRemoving && <Alert severity="error" sx={{ mt: 2 }}>Removal failed: {(errorRemoving as ApiError).message || 'Unknown error'}</Alert>}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={closeDeleteDialog} disabled={isRemoving}>Cancel</Button>
                    <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={isRemoving}
                        startIcon={isRemoving ? <CircularProgress size={16} color="inherit" /> : null} data-testid="confirm-delete-button">
                        {isRemoving ? "Removing..." : "Remove"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar Notification */}
            <FormNotification notification={notification} onClose={handleNotificationClose} />
        </Container>
    );
};

export default WebsiteSettings;
```

Remember to install `@mui/material` and related dependencies if you haven't already, and ensure your Material UI version supports Grid v2 (v5+). Test these components thoroughly after applying the changes.