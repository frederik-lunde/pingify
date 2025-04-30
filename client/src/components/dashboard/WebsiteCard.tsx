/* src/components/dashboard/WebsiteCard.tsx */
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
    InfoOutlined as InfoIcon,
    SsidChart as SlowIcon,
} from "@mui/icons-material";
import { Line } from 'react-chartjs-2';
// Import ChartData along with ChartOptions
import { ChartOptions, ChartData } from 'chart.js';
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";

import {
    getStatusColor,
    getResponseTimeColor,
    formatResponseTime,
    formatUptime,
} from "../../utils/statusUtils";
import { useWebsiteMutations } from "../../hooks";
import { getCardLineChartOptions, getCardLineChartData } from "../../config/chartConfig";
import {
    WebsiteUser,
    TimeframeKey,
} from "../../types";

interface WebsiteCardProps {
    userWebsite: WebsiteUser;
    shouldHighlightThisCard?: boolean;
    isTvMode?: boolean;
}

const CARD_TIMEFRAME: TimeframeKey = 'day';
const CHART_AREA_HEIGHT = 80;
const TICKS_AREA_HEIGHT = 8;
const TICKS_MARGIN_TOP = 1;
const CHIPS_ROW_MIN_HEIGHT = '32px';

// Simplified Chart Component (Memoized)
const SimpleLineChart = React.memo(
    ({ data, options }: { data: ChartData<'line'>; options: ChartOptions<'line'> }) => {
        const hasPlottableData = useMemo(() =>
            data?.datasets?.[0]?.data?.some(
                (d) => d !== null && d !== undefined && !isNaN(d as number) // Cast to number for isNaN check
            ) ?? false, [data]);

        if (!hasPlottableData) {
            return (
                <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center" sx={{ height: '100%', color: 'text.disabled' }}>
                    <InfoIcon fontSize="small" />
                    <Typography variant="caption">Not enough data for chart</Typography>
                </Stack>
            );
        }
        return (
            <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Line data={data} options={options} />
            </Box>
        );
    },
);
SimpleLineChart.displayName = 'SimpleLineChart';

const formatIncidentStartTime = (isoDateString: string | null | undefined): string | null => {
    if (!isoDateString) return null;
    try { return formatDistanceToNowStrict(parseISO(isoDateString), { addSuffix: true }); }
    catch (e) { console.error("Error parsing incident start time:", isoDateString, e); return "Invalid Date"; }
};

const WebsiteCard = React.memo(
    ({
        userWebsite,
        shouldHighlightThisCard = false,
        isTvMode = false,
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
        const currentIncident = userWebsite.currentIncident;

        const limitedChartDataPoints = aggregatedChartDataProp?.length ? aggregatedChartDataProp : undefined;
        const validAggregatedPointsCount = useMemo(() => limitedChartDataPoints?.filter(p => p.avgResponseTime !== null && !isNaN(p.avgResponseTime)).length ?? 0, [limitedChartDataPoints]);
        const canShowAggregatedChart = validAggregatedPointsCount >= 2;

        const chartData = useMemo(() =>
            getCardLineChartData(theme, canShowAggregatedChart ? limitedChartDataPoints : undefined),
            [theme, canShowAggregatedChart, limitedChartDataPoints]
        );

        const chartOptions = useMemo(() =>
            getCardLineChartOptions({ theme, chartData: limitedChartDataPoints }),
            [theme, limitedChartDataPoints]
        );

        const cardStatus = useMemo(() => {
            if (currentIncident) return currentIncident.type;
            if (latestResult === undefined || latestResult === null) return 'pending';
            return latestResult.isAvailable ? 'up' : 'down';
        }, [currentIncident, latestResult]);

        const responseTime = latestResult?.responseTime ?? null;
        const statusCode = latestResult?.statusCode;
        const formattedUptime = formatUptime(uptimePercent);
        const incidentStartTimeFormatted = formatIncidentStartTime(currentIncident?.startTime);

        const canShowTicks = canShowAggregatedChart && limitedChartDataPoints?.every(p => typeof p.uptimeRatio === 'number');
        const canShowSingleTick = !canShowTicks && latestResult !== null && latestResult !== undefined;

        const handleClick = useCallback(() => {
            if (isTvMode) return;
            navigate(`/website/${userWebsite.websiteId}`);
        }, [navigate, userWebsite.websiteId, isTvMode]);

        const handlePinClick = useCallback(async (e: React.MouseEvent) => {
            e.stopPropagation();
            try { await setPinStatus({ websiteId: userWebsite.websiteId, isPinned: !isPinned }); }
            catch (err) { console.error("Failed to set pin status from card:", err); }
        }, [setPinStatus, userWebsite.websiteId, isPinned]);

        const displayName = name || url || 'Website';
        const displayUrl = url;
        const hasPinError = !!errorSettingPin;
        const pinTooltipText = useMemo(() => {
            if (isSettingPin) return "Processing...";
            if (hasPinError) return `Error: ${errorSettingPin?.message || 'Pin action failed'}. Click to retry.`;
            return isPinned ? "Unpin Website" : "Pin Website";
        }, [isSettingPin, hasPinError, isPinned, errorSettingPin?.message]);

        const cardStyles = useMemo(() => {
            let dynamicStyles = {};
            const baseSx = {
                width: '100%',
                height: '100%',
                margin: 'auto',
                cursor: isTvMode ? "default" : "pointer",
                display: "flex",
                flexDirection: "column",
                position: 'relative',
                overflow: 'hidden',
                transition: theme.transitions.create(['opacity', 'transform', 'box-shadow', 'border-color'], { duration: theme.transitions.duration.short }),
                "&:hover": isTvMode ? {} : { transform: "translateY(-4px)", boxShadow: theme.shadows[6] },
            };
            if (shouldHighlightThisCard) {
                dynamicStyles = { borderWidth: '2px', borderStyle: 'solid', borderColor: theme.palette.warning.main, boxShadow: `0 0 10px -1px ${alpha(theme.palette.warning.main, 0.6)}` };
            } else if (isPinned) {
                dynamicStyles = { borderWidth: '2px', borderStyle: 'solid', borderColor: theme.palette.primary.main };
            } else {
                dynamicStyles = { borderWidth: '1px', borderStyle: 'solid', borderColor: theme.palette.divider };
            }
            return { ...baseSx, ...dynamicStyles };
        }, [shouldHighlightThisCard, isPinned, theme, isTvMode]);

        const renderStatusChips = () => {
            if (cardStatus === 'pending') return <Chip size="small" icon={<PendingIcon fontSize="inherit" />} label="Pending" variant="outlined" color="warning" sx={{ fontWeight: 500 }} />;

            let statusChip: React.ReactNode = null;

            if (cardStatus === 'up') statusChip = <Tooltip title="Website is online"><Chip size="small" icon={<CheckIcon fontSize="inherit" />} label="Online" color="success" sx={{ fontWeight: 500 }} /></Tooltip>;
            else if (cardStatus === 'down') {
                statusChip = <Tooltip title={`Website is down ${incidentStartTimeFormatted ? `(since ${incidentStartTimeFormatted})` : ''}`}><Chip size="small" icon={<ErrorIcon fontSize="inherit" />} label="Offline" color="error" sx={{ fontWeight: 500 }} /></Tooltip>;
            } else if (cardStatus === 'slow') {
                statusChip = <Tooltip title={`Website is responding slowly ${incidentStartTimeFormatted ? `(since ${incidentStartTimeFormatted})` : ''}`}><Chip size="small" icon={<SlowIcon fontSize="inherit" />} label="Slow" color="warning" sx={{ fontWeight: 500 }} /></Tooltip>;
            }

            return (
                <>
                    {statusChip}
                    {statusCode != null && cardStatus !== 'down' && <Tooltip title={`Last HTTP Status: ${statusCode}`}><Chip size="small" label={`${statusCode}`} variant="outlined" /></Tooltip>}
                    {responseTime !== null && cardStatus !== 'down' && <Tooltip title={`Last Response Time: ${formatResponseTime(responseTime)}`}><Chip size="small" label={formatResponseTime(responseTime)} color={getResponseTimeColor(responseTime)} variant="outlined" /></Tooltip>}
                    {cardStatus === 'up' && formattedUptime !== "N/A" && typeof uptimePercent === 'number' && <Tooltip title={`Uptime (${CARD_TIMEFRAME}): ${formattedUptime}%`}><Chip size="small" icon={<ChartIcon fontSize="inherit" />} label={`${formattedUptime}%`} color={getStatusColor(uptimePercent)} variant="outlined" /></Tooltip>}
                </>
            );
        };

        const cardContent = (
            <Card sx={cardStyles} onClick={handleClick} aria-label={`View details for ${displayName}${isPinned ? ', Pinned' : ''}${cardStatus !== 'up' ? `, Status: ${cardStatus}` : ''}${shouldHighlightThisCard ? ', Highlighted as Last Incident Source' : ''}`}>
                <CardContent sx={{
                    flexGrow: 1,
                    display: "flex",
                    flexDirection: "column",
                    p: 2,
                    pb: `calc(${theme.spacing(1)} + ${TICKS_AREA_HEIGHT}px + ${theme.spacing(TICKS_MARGIN_TOP)})`
                }}>
                    {/* Header */}
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                        <Tooltip title={displayName} placement="top-start"><Typography variant="h6" component="div" noWrap sx={{ maxWidth: 'calc(100% - 40px)', mr: 1, overflow: 'hidden' }}>{displayName}</Typography></Tooltip>
                        <Tooltip title={pinTooltipText} placement="top">
                            <span><IconButton size="small" onClick={handlePinClick} disabled={isSettingPin} aria-label={isPinned ? `Unpin ${displayName}` : `Pin ${displayName}`} sx={{ color: hasPinError && !isSettingPin ? theme.palette.error.main : isPinned ? theme.palette.primary.main : 'inherit' }}>
                                {isSettingPin ? <CircularProgress size={20} color="inherit" /> : isPinned ? <PinIcon fontSize="small" /> : <PinOutlinedIcon fontSize="small" />}
                            </IconButton></span>
                        </Tooltip>
                    </Box>

                    <Box sx={{ minHeight: '20px', mb: 1.5 }}>
                        {name && displayUrl && name !== displayUrl && (
                            <Tooltip title={displayUrl} placement="bottom-start"><Typography variant="body2" color="textSecondary" noWrap sx={{ overflow: 'hidden' }}>{displayUrl}</Typography></Tooltip>
                        )}
                    </Box>

                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.8, mb: 1.5, minHeight: CHIPS_ROW_MIN_HEIGHT, alignItems: 'center' }}>
                        {renderStatusChips()}
                    </Box>

                    <Box sx={{
                        height: `${CHART_AREA_HEIGHT}px`,
                        mt: "auto",
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}>
                        {/* Use SimpleLineChart and pass generated data/options */}
                        {canShowAggregatedChart && cardStatus !== 'down' ? (
                             <SimpleLineChart data={chartData} options={chartOptions} />
                        ) : (
                            <Box sx={{ color: 'text.secondary', textAlign: 'center', width: '100%', p: 1 }}>
                                {cardStatus === 'pending' ? (
                                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center"><PendingIcon fontSize="small" /><Typography variant="caption">Awaiting check data...</Typography></Stack>
                                ) : cardStatus === 'down' ? (
                                    <Stack alignItems="center" spacing={0.3} color={theme.palette.error.dark}>
                                        <ErrorIcon sx={{ fontSize: '1.3rem' }} /><Typography variant="body2" sx={{ fontWeight: 500 }}>Currently Offline</Typography>
                                        {incidentStartTimeFormatted && <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>{`Since ${incidentStartTimeFormatted}`}</Typography>}
                                    </Stack>
                                ) : cardStatus === 'slow' ? (
                                    <Stack alignItems="center" spacing={0.3} color={theme.palette.warning.dark}>
                                        <SlowIcon sx={{ fontSize: '1.3rem' }} /><Typography variant="body2" sx={{ fontWeight: 500 }}>Responding Slowly</Typography>
                                        {incidentStartTimeFormatted && <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>{`Since ${incidentStartTimeFormatted}`}</Typography>}
                                    </Stack>
                                ) : (
                                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center"><InfoIcon fontSize="small" /><Typography variant="caption">Gathering data for chart...</Typography></Stack>
                                )}
                            </Box>
                        )}
                    </Box>
                </CardContent>

                {/* Ticks Area */}
                <Box sx={{
                    position: 'absolute',
                    bottom: theme.spacing(1),
                    left: '5%',
                    right: '5%',
                    height: `${TICKS_AREA_HEIGHT}px`,
                }}>
                    {canShowTicks && limitedChartDataPoints && (
                        <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center" sx={{ width: '100%', height: '100%' }}>
                            {limitedChartDataPoints.map((point, index) => {
                                const uptimeRatio = point.uptimeRatio;
                                let tickColor = theme.palette.grey[400];
                                let tooltipStatus = 'Unknown';
                                let uptimePercentFormatted = 'N/A';

                                if (typeof uptimeRatio === 'number' && !isNaN(uptimeRatio)) {
                                    tickColor = uptimeRatio === 1.0 ? theme.palette.success.light : theme.palette.error.light;
                                    tooltipStatus = uptimeRatio === 1.0 ? 'Up' : 'Down';
                                    uptimePercentFormatted = (uptimeRatio * 100).toFixed(1);
                                } else { tickColor = theme.palette.grey[300]; tooltipStatus = 'Data Missing'; }

                                const tooltipTitle = `${point.label ?? ('Interval ' + index)}: ${tooltipStatus}${uptimePercentFormatted !== 'N/A' ? ` (${uptimePercentFormatted}%)` : ''}`;
                                const numberOfTicks = limitedChartDataPoints.length;
                                const tickMaxWidth = numberOfTicks > 0 ? `calc(${100 / numberOfTicks}% - ${theme.spacing(0.5)})` : '0%';

                                return (<Tooltip key={`${userWebsite.websiteId}-tick-${index}`} title={tooltipTitle} placement="top"><Box sx={{ flexGrow: 1, maxWidth: tickMaxWidth, height: '100%', bgcolor: tickColor, borderRadius: '1px' }} /></Tooltip>);
                            })}
                        </Stack>
                    )}
                    {canShowSingleTick && latestResult && (
                        <Stack direction="row" justifyContent="center" alignItems="center" sx={{ width: '100%', height: '100%' }}>
                            <Tooltip title={`Latest Check (${format(new Date(latestResult.checkedAt), 'HH:mm')}): ${latestResult.isAvailable ? 'Up' : 'Down'}`} placement="top">
                                <Box sx={{ width: '100%', height: '100%', bgcolor: latestResult.isAvailable ? theme.palette.success.light : theme.palette.error.light, borderRadius: '1px' }} />
                            </Tooltip>
                        </Stack>
                    )}
                </Box>
            </Card>
        );

        return shouldHighlightThisCard ? <Tooltip title="This website had the most recent incident" placement="top" arrow>{cardContent}</Tooltip> : cardContent;
    },
);
WebsiteCard.displayName = 'WebsiteCard';

export default WebsiteCard;