/*
src/components/dashboard/WebsiteCard.tsx
*/
import React, { useCallback, useMemo } from "react";
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
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
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
  WebsiteUser,
  TimeframeKey,
  ChartDataPoint
} from "../../types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend
);


interface WebsiteCardProps {
  userWebsite: WebsiteUser;
  shouldHighlightThisCard?: boolean;
}

const CARD_TIMEFRAME: TimeframeKey = 'day';

const MIN_CARD_WIDTH = 280;
// Add a maximum width to prevent excessive stretching
const MAX_CARD_WIDTH = 450; // px - Adjust as needed

const ResponseTimeChart = React.memo(
  ({ data, options }: { data: any; options: ChartOptions<'line'> }) => {
    const hasValidData = data?.datasets?.[0]?.data?.length > 0 &&
                         !data.datasets[0].data.every((d: number | null | undefined) => d === null || d === undefined || d === -1 || isNaN(d));

    if (!hasValidData) {
      return null;
    }

    return (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Line data={data} options={options} />
        </Box>
    );
  },
);
ResponseTimeChart.displayName = 'ResponseTimeChart';

const useCardChartConfig = (limitedChartDataPoints: ChartDataPoint[] | undefined): { chartData: any, chartOptions: ChartOptions<'line'> } => {
    const theme = useTheme();

    const chartData = useMemo(() => {
        if (!limitedChartDataPoints || limitedChartDataPoints.length === 0) {
            return { labels: [], datasets: [] };
        }
        const labels = limitedChartDataPoints.map(p => p.label);
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

const WebsiteCard = React.memo(
  ({
    userWebsite,
    shouldHighlightThisCard = false,
  }: WebsiteCardProps) => {
    const navigate = useNavigate();
    const theme = useTheme();
    const { setPinStatus, isSettingPin, errorSettingPin } = useWebsiteMutations();

    const name = userWebsite.name ?? userWebsite.website?.url ?? 'Website';
    const url = userWebsite.website?.url;
    const latestResult = userWebsite.latestResult;
    const aggregatedChartDataProp = userWebsite.chartData;
    const uptimePercent = userWebsite.uptimePercent;
    const isPinned = userWebsite.isPinned;
    const consecutiveFailures = userWebsite.consecutiveFailures;
    const downtimeStartedAt = userWebsite.downtimeStartedAt;

    const limitedChartDataPoints = aggregatedChartDataProp?.length ? aggregatedChartDataProp : undefined;

    const validAggregatedPointsCount = useMemo(() => {
        return limitedChartDataPoints?.filter(p => p.avgResponseTime !== null && !isNaN(p.avgResponseTime)).length ?? 0;
    }, [limitedChartDataPoints]);
    const canShowAggregatedChart = validAggregatedPointsCount >= 2;
    const aggregatedChartConfig = useCardChartConfig(canShowAggregatedChart ? limitedChartDataPoints : undefined);

    const hasPinError = !!errorSettingPin;
    const isOnline = latestResult?.isAvailable ?? null;
    const responseTime = latestResult?.responseTime ?? null;
    const statusCode = latestResult?.statusCode;
    const downtimeDuration = formatDowntimeDuration(downtimeStartedAt);
    const formattedUptime = formatUptime(uptimePercent);

    const canShowTicks = canShowAggregatedChart && limitedChartDataPoints?.every(p => typeof p.uptimeRatio === 'number');
    const canShowSingleTick = !canShowTicks && latestResult !== null && latestResult !== undefined;

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

    const displayName = name || url || 'Website';
    const displayUrl = url;
    const pinTooltipText = useMemo(() => {
        if (isSettingPin) return "Processing...";
        if (hasPinError) return `Error: ${errorSettingPin?.message || 'Pin action failed'}. Click to retry.`;
        return isPinned ? "Unpin Website" : "Pin Website";
    }, [isSettingPin, hasPinError, isPinned, errorSettingPin?.message]);

    const cardStyles = useMemo(() => {
        let dynamicStyles = {};
        const baseSx = {
            minWidth: MIN_CARD_WIDTH,
            maxWidth: MAX_CARD_WIDTH,
            width: '100%',
            margin: 'auto',
            cursor: "pointer",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            position: 'relative',
            pb: 1,
            transition: theme.transitions.create(['opacity', 'transform', 'box-shadow', 'border-color'], { duration: theme.transitions.duration.short }),
            "&:hover": {
                 transform: "translateY(-4px)",
                 boxShadow: theme.shadows[6]
            },
        };

        if (shouldHighlightThisCard) {
            dynamicStyles = {
                 borderWidth: '2px',
                 borderStyle: 'solid',
                 borderColor: theme.palette.warning.main,
                 boxShadow: `0 0 10px -1px ${alpha(theme.palette.warning.main, 0.6)}`
            };
        } else if (isPinned) {
             dynamicStyles = {
                 borderWidth: '2px',
                 borderStyle: 'solid',
                 borderColor: theme.palette.primary.main,
             };
        } else {
             dynamicStyles = {
                 borderWidth: '1px',
                 borderStyle: 'solid',
                 borderColor: theme.palette.divider,
             };
        }
        return { ...baseSx, ...dynamicStyles };

    }, [shouldHighlightThisCard, isPinned, theme]);


    const cardContent = (
        <Card
            sx={cardStyles}
            onClick={handleClick}
            aria-label={`View details for ${displayName}${isPinned ? ', Pinned' : ''}${isOnline === false ? ', Offline' : ''}${shouldHighlightThisCard ? ', Highlighted as Last Incident Source' : ''}`}
        >
            <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", p: 2, pb: 1 }}>
               <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                 <Tooltip title={displayName} placement="top-start">
                     <Typography variant="h6" component="div" noWrap sx={{ maxWidth: 'calc(100% - 40px)', mr: 1 }}>{displayName}</Typography>
                 </Tooltip>
                 <Tooltip title={pinTooltipText} placement="top">
                    <span>
                        <IconButton
                           size="small"
                           onClick={handlePinClick}
                           disabled={isSettingPin}
                           aria-label={isPinned ? `Unpin ${displayName}` : `Pin ${displayName}`}
                           sx={{ color: hasPinError && !isSettingPin ? theme.palette.error.main : isPinned ? theme.palette.primary.main : 'inherit' }}
                        >
                            {isSettingPin ? <CircularProgress size={20} color="inherit" /> : isPinned ? <PinIcon fontSize="small" /> : <PinOutlinedIcon fontSize="small" />}
                        </IconButton>
                    </span>
                 </Tooltip>
               </Box>

               {name && displayUrl && name !== displayUrl && (
                   <Tooltip title={displayUrl} placement="bottom-start">
                     <Typography variant="body2" color="textSecondary" noWrap sx={{ mb: 1.5, minHeight: '20px' }}>{displayUrl}</Typography>
                   </Tooltip>
               )}
               {(!name || !displayUrl || name === displayUrl) && <Box sx={{ mb: 1.5, minHeight: '20px' }} />}

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

               <Stack sx={{ flexGrow: 1, minHeight: 60, maxHeight: 80, mt: "auto", justifyContent: 'center', alignItems: 'center', width: '100%' }} spacing={0.5}>
                    <Box sx={{ width: '100%', flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
                        {canShowAggregatedChart ? (
                            <ResponseTimeChart data={aggregatedChartConfig.chartData} options={aggregatedChartConfig.chartOptions} />
                        ) : (
                            <Box sx={{ color: 'text.secondary', textAlign: 'center', width: '100%', p: 1 }}>
                                {latestResult === undefined || latestResult === null ? (
                                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                                        <PendingIcon fontSize="small" />
                                        <Typography variant="caption">Awaiting check data...</Typography>
                                    </Stack>
                                ) : !isOnline ? (
                                    <Stack alignItems="center" spacing={0.3} color={theme.palette.error.dark}>
                                        <TimerOffIcon sx={{ fontSize: '1.3rem' }} />
                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{downtimeDuration || 'Currently Offline'}</Typography>
                                        {(consecutiveFailures !== undefined && consecutiveFailures > 0 || downtimeStartedAt) && (
                                            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                                                {consecutiveFailures !== undefined && consecutiveFailures > 0 && `Failures: ${consecutiveFailures}`}
                                                {(consecutiveFailures !== undefined && consecutiveFailures > 0 && downtimeStartedAt) && ' • '}
                                                {downtimeStartedAt && `Since: ${format(new Date(downtimeStartedAt), 'MMM d, HH:mm')}`}
                                            </Typography>
                                        )}
                                    </Stack>
                                ) : (
                                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                                        <InfoIcon fontSize="small" />
                                        <Typography variant="caption">Gathering data for chart...</Typography>
                                    </Stack>
                                )}
                            </Box>
                        )}
                    </Box>

                    {canShowTicks && limitedChartDataPoints && (
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