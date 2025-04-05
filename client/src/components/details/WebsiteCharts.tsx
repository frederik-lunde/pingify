// src/components/details/WebsiteCharts.tsx
import React, { useMemo, Suspense } from 'react';
import { Paper, Box, Grid, Typography, Stack, Chip, CircularProgress, FormControl, InputLabel, Select, MenuItem, SelectChangeEvent, alpha, useTheme } from '@mui/material';
import { BarChart as BarChartIcon, Timeline as TimelineIcon, InfoOutlined as InfoOutlinedIcon } from '@mui/icons-material';
import { ChartOptions, TooltipItem } from 'chart.js'; // Keep core types
import { TimeframeKey, ChartDataPoint } from '../../types'; // Adjust path
import { getStatusColor, formatUptime } from '../../utils/statusUtils'; // Adjust path

// Lazy load react-chartjs-2 components
const Bar = React.lazy(() => import('react-chartjs-2').then(module => ({ default: module.Bar })));
const Line = React.lazy(() => import('react-chartjs-2').then(module => ({ default: module.Line })));

interface WebsiteChartsProps {
    chartData: ChartDataPoint[];
    uptimePercent: number;
    timeframeKey: TimeframeKey;
    isLoading: boolean; // Combined loading/fetching state
    onTimeframeChange: (event: SelectChangeEvent<TimeframeKey>) => void;
}

// Chart options generation can stay here or be moved to utils if very complex
// (Keeping them here for simplicity in this example)

// Memoize the component
const WebsiteCharts = React.memo(({
    chartData,
    uptimePercent,
    timeframeKey,
    isLoading,
    onTimeframeChange,
}: WebsiteChartsProps) => {
    const theme = useTheme();

    // Uptime Status Bar Chart Data/Options (using props)
    const uptimeChartData = useMemo(() => {
         if (!chartData || chartData.length === 0) return { labels: [], datasets: [] };
         const labels = chartData.map(p => p.label);
         const threshold = (timeframeKey === 'hour' || timeframeKey === 'day') ? 1.0 : 0.5;
         const data = chartData.map(p => (p.uptimeRatio >= threshold ? 1 : -1));
         const backgroundColors = data.map(d => d > 0 ? theme.palette.success.light : theme.palette.error.light);
         return { labels, datasets: [{ label: "Status", data, backgroundColor: backgroundColors, barPercentage: 1.0, categoryPercentage: 1.0 }] };
    }, [chartData, timeframeKey, theme.palette.success.light, theme.palette.error.light]);

    const uptimeChartOptions: ChartOptions<'bar'> = useMemo(() => ({
        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: {
            label: (context: TooltipItem<'bar'>) => {
                 const pointData = chartData[context.dataIndex];
                 if (!pointData) return '';
                 const threshold = (timeframeKey === 'hour' || timeframeKey === 'day') ? 1.0 : 0.5;
                 const status = pointData.uptimeRatio >= threshold ? 'Up' : 'Down';
                 return timeframeKey === 'hour' || timeframeKey === 'day'
                    ? `Status: ${status}`
                    : `Status: ${status} (${(pointData.uptimeRatio * 100).toFixed(1)}%)`;
            },
            title: (context: TooltipItem<'bar'>[]) => {
                 const pointData = chartData[context[0]?.dataIndex];
                 return pointData ? `${pointData.label} (${pointData.checkCount} checks)` : '';
            }
        }}},
        scales: { x: { ticks: { autoSkip: true, maxTicksLimit: 15 }, grid: { display: false } }, y: { display: false, min: -1.5, max: 1.5 } },
    }), [chartData, timeframeKey]);

    // Response Time Line Chart Data/Options (using props)
     const responseTimeChartData = useMemo(() => {
        if (!chartData || chartData.length === 0) return { labels: [], datasets: [] };
        const labels = chartData.map(p => p.label);
        const data = chartData.map(p => p.avgResponseTime);
        const datasetLabel = timeframeKey === 'hour' || timeframeKey === 'day' ? "Response Time (ms)" : "Avg Response Time (ms)";
        return { labels, datasets: [{ label: datasetLabel, data, borderColor: theme.palette.primary.main, backgroundColor: alpha(theme.palette.primary.light, 0.2), fill: timeframeKey === 'hour' || timeframeKey === 'day', tension: 0.1, pointRadius: timeframeKey === 'hour' || timeframeKey === 'day' ? 2 : 3, pointHoverRadius: 5, spanGaps: true }]};
    }, [chartData, timeframeKey, theme.palette.primary]);

    const responseTimeChartOptions: ChartOptions<'line'> = useMemo(() => ({
        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: {
            label: (context: TooltipItem<'line'>) => {
                const value = context.parsed.y;
                if (value === null || isNaN(value)) return 'No response time data';
                const prefix = timeframeKey === 'hour' || timeframeKey === 'day' ? 'Response Time' : 'Avg Response Time';
                return `${prefix}: ${value.toFixed(0)} ms`;
            },
            title: (context: TooltipItem<'line'>[]) => {
                 if (!context.length) return '';
                 const pointData = chartData[context[0]?.dataIndex];
                 return pointData ? `${pointData.label} (${(pointData.uptimeRatio * 100).toFixed(1)}% Up, ${pointData.checkCount} checks)` : '';
            }
        }}},
        scales: { x: { ticks: { autoSkip: true, maxTicksLimit: 15 }, grid: { display: false } }, y: { title: { display: true, text: "ms" }, beginAtZero: true, grid: { color: theme.palette.divider } } },
        interaction: { mode: 'index', intersect: false },
    }), [chartData, timeframeKey, theme.palette.divider]);

    const formattedOverallUptime = useMemo(() => formatUptime(uptimePercent), [uptimePercent]);
    const overallUptimeColor = useMemo(() => getStatusColor(uptimePercent), [uptimePercent]);

    // Chart fallback UI
    const ChartFallback = () => (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress size={30}/>
        </Box>
    );

     const NoDataMessage = ({message}: {message: string}) => (
         <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" height="100%" color="text.secondary">
            <InfoOutlinedIcon fontSize="small" />
            <Typography>{message}</Typography>
         </Stack>
     );

    return (
        <>
            {/* Controls: Timeframe Selector */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel id="timeframe-select-label">Chart Timeframe</InputLabel>
                    <Select
                        labelId="timeframe-select-label"
                        id="timeframe-select"
                        value={timeframeKey}
                        label="Chart Timeframe"
                        onChange={onTimeframeChange}
                        disabled={isLoading}
                    >
                        <MenuItem value={'hour'}>Last Hour</MenuItem>
                        <MenuItem value={'day'}>Last 24 Hours</MenuItem>
                        <MenuItem value={'week'}>Last 7 Days</MenuItem>
                        <MenuItem value={'month'}>Last 30 Days</MenuItem>
                        <MenuItem value={'year'}>Last Year</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            {/* Charts Section */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                {/* Uptime Status Chart */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, height: 300, display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                             <Stack direction="row" alignItems="center" spacing={1}>
                                <BarChartIcon sx={{ color: 'text.secondary' }} />
                                <Typography variant="h6" component="h2">Uptime Status</Typography>
                            </Stack>
                            <Chip label={`${formattedOverallUptime}%`} size="small" variant="outlined" color={overallUptimeColor} />
                        </Box>
                        <Box sx={{ flexGrow: 1, position: 'relative', minHeight: 0 }}>
                            <Suspense fallback={<ChartFallback />}>
                                {uptimeChartData.labels.length > 0 ? (
                                    <Bar data={uptimeChartData} options={uptimeChartOptions} />
                                ) : (
                                    <NoDataMessage message="No uptime data." />
                                )}
                            </Suspense>
                        </Box>
                    </Paper>
                </Grid>

                {/* Response Time Chart */}
                 <Grid item xs={12} md={6}>
                     <Paper sx={{ p: 2, height: 300, display: 'flex', flexDirection: 'column' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <TimelineIcon sx={{ mr: 1, color: 'text.secondary' }} />
                            <Typography variant="h6" component="h2">Response Time</Typography>
                        </Box>
                        <Box sx={{ flexGrow: 1, position: 'relative', minHeight: 0 }}>
                           <Suspense fallback={<ChartFallback />}>
                                {responseTimeChartData.labels.length > 0 ? (
                                    <Line data={responseTimeChartData} options={responseTimeChartOptions} />
                                ) : (
                                     <NoDataMessage message="No response time data." />
                                )}
                            </Suspense>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </>
    );
});

WebsiteCharts.displayName = 'WebsiteCharts';

export default WebsiteCharts;