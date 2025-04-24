/* src/components/details/WebsiteCharts.tsx */
import React, { useMemo, Suspense, memo } from 'react';
import { Paper, Box, Typography, Stack, Chip, CircularProgress, alpha, useTheme } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { BarChart as BarChartIcon, Timeline as TimelineIcon, InfoOutlined as InfoOutlinedIcon } from '@mui/icons-material';
// ChartJS types are no longer needed here
import { TimeframeKey, ChartDataPoint } from '../../types';
import { getStatusColor, formatUptime } from '../../utils/statusUtils';
// Import new config functions
import { getResponseTimeLineChartOptions, getUptimeStatusBarChartOptions } from '../../config/chartConfig';

// Lazy load chart components
const Bar = React.lazy(() => import('react-chartjs-2').then(module => ({ default: module.Bar })));
const Line = React.lazy(() => import('react-chartjs-2').then(module => ({ default: module.Line })));

interface WebsiteChartsProps {
    chartData: ChartDataPoint[];
    uptimePercent: number | null;
    timeframeKey: TimeframeKey;
    isLoading: boolean; // Keep isLoading (though not directly used for options generation anymore)
}

// Chart fallback UI
const ChartFallback = () => (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 150 }}>
        <CircularProgress size={30}/>
    </Box>
);

// No data message component
 const NoDataMessage = ({message}: {message: string}) => (
     <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" height="100%" minHeight={150} color="text.secondary">
        <InfoOutlinedIcon fontSize="small" />
        <Typography variant="body2">{message}</Typography>
     </Stack>
 );

// Memoize the component
const WebsiteCharts = memo(({
    chartData,
    uptimePercent,
    timeframeKey,
}: WebsiteChartsProps) => {
    const theme = useTheme();

    // --- Uptime Chart Data (Data transformation remains here) ---
    const uptimeChartData = useMemo(() => {
         if (!chartData || chartData.length === 0) return { labels: [], datasets: [] };
         const labels = chartData.map(p => p.label);
         const data = chartData.map(p => (p.uptimeRatio >= 1.0 ? 1 : -1));
         const backgroundColors = data.map(d =>
             d > 0 ? theme.palette.success.light : theme.palette.error.light
         );
         return {
             labels,
             datasets: [{
                 label: "Status",
                 data,
                 backgroundColor: backgroundColors,
                 barPercentage: 1.0,
                 categoryPercentage: 1.0,
                 borderWidth: 0,
             }]
         };
    }, [chartData, theme.palette.success.light, theme.palette.error.light]);

    // --- Uptime Chart Options (Generated using centralized function) ---
    const uptimeChartOptions = useMemo(() => getUptimeStatusBarChartOptions({
        theme,
        chartData // Pass chartData for tooltip generation
    }), [theme, chartData]);


    // --- Response Time Chart Data (Data transformation remains here) ---
     const responseTimeChartData = useMemo(() => {
        if (!chartData || chartData.length === 0) return { labels: [], datasets: [] };
        const labels = chartData.map(p => p.label);
        const data = chartData.map(p => (p.avgResponseTime !== null && !isNaN(p.avgResponseTime)) ? p.avgResponseTime : null);
        const datasetLabel = timeframeKey === 'hour' || timeframeKey === 'day' ? "Response Time (ms)" : "Avg Response Time (ms)";
        return {
            labels,
            datasets: [{
                label: datasetLabel,
                data,
                borderColor: theme.palette.primary.main,
                backgroundColor: alpha(theme.palette.primary.light, 0.2),
                fill: timeframeKey === 'hour' || timeframeKey === 'day',
                tension: 0.1,
                pointRadius: timeframeKey === 'hour' || timeframeKey === 'day' ? 2 : 3,
                pointHoverRadius: 5,
                spanGaps: true
            }]
        };
    }, [chartData, timeframeKey, theme.palette.primary]);

    // --- Response Time Chart Options (Generated using centralized function) ---
    const responseTimeChartOptions = useMemo(() => getResponseTimeLineChartOptions({
        theme,
        chartData, // Pass chartData for tooltip generation
        timeframeKey // Pass timeframeKey for context
    }), [theme, chartData, timeframeKey]);

    // Overall Uptime formatting
    const formattedOverallUptime = useMemo(() => formatUptime(uptimePercent), [uptimePercent]);
    const overallUptimeColor = useMemo(() => getStatusColor(uptimePercent), [uptimePercent]);

    // Determine if charts have data to display
    const hasUptimeData = uptimeChartData.labels.length > 0;
    const hasResponseTimeData = responseTimeChartData.datasets?.[0]?.data?.some(d => d !== null && !isNaN(d)) ?? false;


    return (
        <>
            <Grid container spacing={3} sx={{ mb: 3 }}>
                {/* Uptime Status Chart */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 2, height: 300, display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                             <Stack direction="row" alignItems="center" spacing={1}>
                                <BarChartIcon sx={{ color: 'text.secondary' }} />
                                <Typography variant="h6" component="h2">Uptime Status</Typography>
                            </Stack>
                            {formattedOverallUptime !== 'N/A' && (
                                <Chip label={`${formattedOverallUptime}% Overall`} size="small" variant="outlined" color={overallUptimeColor} />
                            )}
                        </Box>
                        <Box sx={{ flexGrow: 1, position: 'relative', minHeight: 0 }}>
                            <Suspense fallback={<ChartFallback />}>
                                {hasUptimeData ? (
                                    <Bar data={uptimeChartData} options={uptimeChartOptions} />
                                ) : (
                                    <NoDataMessage message="No uptime data available." />
                                )}
                            </Suspense>
                        </Box>
                    </Paper>
                </Grid>

                {/* Response Time Chart */}
                 <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 2, height: 300, display: 'flex', flexDirection: 'column' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <TimelineIcon sx={{ mr: 1, color: 'text.secondary' }} />
                            <Typography variant="h6" component="h2">Response Time</Typography>
                        </Box>
                        <Box sx={{ flexGrow: 1, position: 'relative', minHeight: 0 }}>
                           <Suspense fallback={<ChartFallback />}>
                                {hasResponseTimeData ? (
                                    <Line data={responseTimeChartData} options={responseTimeChartOptions} />
                                ) : (
                                     <NoDataMessage message="No response time data available." />
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