/* src/components/details/WebsiteCharts.tsx */
import React, { useMemo, Suspense, memo } from 'react';
import { Paper, Box, Typography, Stack, Chip, CircularProgress, alpha, useTheme } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { BarChart as BarChartIcon, Timeline as TimelineIcon, InfoOutlined as InfoOutlinedIcon } from '@mui/icons-material';
import { ChartOptions, TooltipItem } from 'chart.js';
import { TimeframeKey, ChartDataPoint } from '../../types'; // Adjust path
// --- Use getStatusColor for the overall chip, but the chart logic will be simpler ---
import { getStatusColor, formatUptime } from '../../utils/statusUtils'; // Adjust path

const Bar = React.lazy(() => import('react-chartjs-2').then(module => ({ default: module.Bar })));
const Line = React.lazy(() => import('react-chartjs-2').then(module => ({ default: module.Line })));

interface WebsiteChartsProps {
    chartData: ChartDataPoint[];
    uptimePercent: number | null; // Allow null
    timeframeKey: TimeframeKey; // Keep timeframeKey to adjust chart options/labels if needed
    isLoading: boolean; // Keep isLoading
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
    timeframeKey, // Keep timeframeKey for potential use in labels or tooltips
}: WebsiteChartsProps) => {
    const theme = useTheme();

    // --- MODIFICATION: Uptime Chart Data/Options - Revert to Status Bar ---
    const uptimeChartData = useMemo(() => {
         if (!chartData || chartData.length === 0) return { labels: [], datasets: [] };
         const labels = chartData.map(p => p.label);

         // Data: 1 for fully up, -1 if any downtime occurred in the period
         // Threshold: Consider anything less than 100% uptime as having downtime for visual clarity
         const data = chartData.map(p => (p.uptimeRatio >= 1.0 ? 1 : -1));

         // Background Colors: Success for 'Up' (1), Error for 'Down' (-1)
         const backgroundColors = data.map(d =>
             d > 0 ? theme.palette.success.light : theme.palette.error.light
         );

         return {
             labels,
             datasets: [{
                 label: "Status", // Label for tooltip context
                 data,
                 backgroundColor: backgroundColors,
                 // Make bars thick to represent status blocks
                 barPercentage: 1.0,
                 categoryPercentage: 1.0,
                 borderWidth: 0, // Remove border for cleaner look
             }]
         };
    }, [chartData, theme.palette.success.light, theme.palette.error.light]);

    const uptimeChartOptions: ChartOptions<'bar'> = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }, // No legend needed for single dataset status
            tooltip: {
                callbacks: {
                    // Tooltip shows the exact uptime % and status text
                    label: (context: TooltipItem<'bar'>) => {
                         const pointData = chartData[context.dataIndex];
                         if (!pointData) return '';
                         const value = context.parsed.y; // 1 or -1
                         const statusText = value > 0 ? 'Up' : 'Downtime';
                         const uptimeFormatted = (pointData.uptimeRatio * 100).toFixed(2); // Show precise uptime
                         return `Status: ${statusText} (${uptimeFormatted}%)`;
                    },
                    // Title shows the period label and check count
                    title: (context: TooltipItem<'bar'>[]) => {
                         const pointData = chartData[context[0]?.dataIndex];
                         return pointData ? `${pointData.label} (${pointData.checkCount} checks)` : '';
                    }
                }
            }
        },
        scales: {
            x: {
                ticks: { autoSkip: true, maxTicksLimit: 15 }, // Keep label skipping
                grid: { display: false } // Hide vertical grid lines
            },
            y: {
                // Hide the Y-axis labels/ticks as they are just 1 / -1
                display: false,
                // Set limits slightly beyond 1 and -1 for padding
                min: -1.5,
                max: 1.5,
                grid: {
                    display: false, // Hide horizontal grid lines
                }
            }
        },
        // Ensure bars are drawn from the zero line correctly
        indexAxis: 'x', // Default, but explicit
    }), [chartData]); // Remove theme.palette dependency as grid is hidden
    // --- END MODIFICATION ---


    // Response Time Chart Data/Options (remain the same)
     const responseTimeChartData = useMemo(() => {
        if (!chartData || chartData.length === 0) return { labels: [], datasets: [] };
        const labels = chartData.map(p => p.label);
        const data = chartData.map(p => (p.avgResponseTime !== null && !isNaN(p.avgResponseTime)) ? p.avgResponseTime : null);
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
                 const uptimeFormatted = pointData ? (pointData.uptimeRatio * 100).toFixed(1) : 'N/A';
                 return pointData ? `${pointData.label} (${uptimeFormatted}% Up, ${pointData.checkCount} checks)` : '';
            }
        }}},
        scales: { x: { ticks: { autoSkip: true, maxTicksLimit: 15 }, grid: { display: false } }, y: { title: { display: true, text: "ms" }, beginAtZero: true, grid: { color: theme.palette.divider } } },
        interaction: { mode: 'index', intersect: false },
    }), [chartData, timeframeKey, theme.palette.divider]);

    // Overall Uptime formatting (remain the same)
    const formattedOverallUptime = useMemo(() => formatUptime(uptimePercent), [uptimePercent]);
    // Use the refined getStatusColor for the overall chip
    const overallUptimeColor = useMemo(() => getStatusColor(uptimePercent), [uptimePercent]);

    return (
        <>
            {/* Charts Section - Use Grid v2 */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
                {/* Uptime Status Chart */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper sx={{ p: 2, height: 300, display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                             <Stack direction="row" alignItems="center" spacing={1}>
                                <BarChartIcon sx={{ color: 'text.secondary' }} />
                                {/* --- MODIFICATION: Update Chart Title --- */}
                                <Typography variant="h6" component="h2">Uptime Status</Typography>
                                {/* --- END MODIFICATION --- */}
                            </Stack>
                            {formattedOverallUptime !== 'N/A' && (
                                <Chip label={`${formattedOverallUptime}% Overall`} size="small" variant="outlined" color={overallUptimeColor} />
                            )}
                        </Box>
                        <Box sx={{ flexGrow: 1, position: 'relative', minHeight: 0 }}>
                            <Suspense fallback={<ChartFallback />}>
                                {uptimeChartData.labels.length > 0 ? (
                                    // Use the updated data and options for the status bar chart
                                    <Bar data={uptimeChartData} options={uptimeChartOptions} />
                                ) : (
                                    <NoDataMessage message="No uptime data available." />
                                )}
                            </Suspense>
                        </Box>
                    </Paper>
                </Grid>

                {/* Response Time Chart (Remains the same) */}
                 <Grid size={{ xs: 12, md: 6 }}>
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