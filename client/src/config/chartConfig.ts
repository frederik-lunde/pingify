import { ChartOptions, TooltipItem, TooltipOptions, LegendOptions, ChartType } from 'chart.js';
import { alpha, Theme } from '@mui/material/styles';
import { ChartDataPoint } from '../types';

const BASE_CHART_OPTIONS: Partial<ChartOptions> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
        mode: 'index',
        intersect: false,
    },
    animation: {
        duration: 200,
    },
};

const BASE_TOOLTIP_OPTIONS: Partial<TooltipOptions<ChartType>> = {
    enabled: true,
    mode: 'index',
    intersect: false,
    backgroundColor: 'rgba(0,0,0,0.8)',
    titleFont: { weight: 'bold' },
    bodyFont: { weight: 'normal' },
    padding: 10,
    cornerRadius: 4,
    displayColors: false,
};

interface ChartConfigParams {
    theme: Theme;
    chartData?: ChartDataPoint[];
    timeframeKey?: string;
}


export const getCardLineChartOptions = ({ theme, chartData }: ChartConfigParams): ChartOptions<'line'> => {
    const limitedChartDataPoints = chartData;
    const options: ChartOptions<'line'> = {
        ...BASE_CHART_OPTIONS,
        scales: {
            x: { display: false },
            y: { display: false, beginAtZero: true }
        },
        plugins: {
            legend: {
                display: false
            } as Partial<LegendOptions<'line'>>,
            tooltip: {
                ...BASE_TOOLTIP_OPTIONS,
                backgroundColor: alpha(theme.palette.background.paper, 0.9),
                titleColor: theme.palette.text.primary,
                bodyColor: theme.palette.text.secondary,
                borderColor: theme.palette.divider,
                borderWidth: 1,
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
            } as Partial<TooltipOptions<'line'>>
        },
        animation: { duration: 0 },
    };
    return options;
};


export const getResponseTimeLineChartOptions = ({ theme, chartData, timeframeKey }: ChartConfigParams): ChartOptions<'line'> => {
    const options: ChartOptions<'line'> = {
        ...BASE_CHART_OPTIONS,
        scales: {
            x: {
                ticks: { autoSkip: true, maxTicksLimit: 15, color: theme.palette.text.secondary },
                grid: { display: false }
            },
            y: {
                title: { display: true, text: "Response Time (ms)", color: theme.palette.text.secondary },
                beginAtZero: true,
                grid: { color: theme.palette.divider },
                ticks: { color: theme.palette.text.secondary }
            }
        },
        plugins: {
            legend: {
                display: false
            } as Partial<LegendOptions<'line'>>,
            tooltip: {
                ...BASE_TOOLTIP_OPTIONS,
                backgroundColor: alpha(theme.palette.background.paper, 0.9),
                titleColor: theme.palette.text.primary,
                bodyColor: theme.palette.text.secondary,
                borderColor: theme.palette.divider,
                borderWidth: 1,
                callbacks: {
                    label: (context: TooltipItem<'line'>) => {
                        const value = context.parsed.y;
                        if (value === null || isNaN(value)) return 'No response time data';
                        const prefix = timeframeKey === 'hour' || timeframeKey === 'day' ? 'Response Time' : 'Avg Response Time';
                        return `${prefix}: ${value.toFixed(0)} ms`;
                    },
                    title: (context: TooltipItem<'line'>[]) => {
                        if (!context.length || !chartData) return '';
                        const pointData = chartData[context[0]?.dataIndex];
                        const uptimeFormatted = pointData ? (pointData.uptimeRatio * 100).toFixed(1) : 'N/A';
                        return pointData ? `${pointData.label} (${uptimeFormatted}% Up, ${pointData.checkCount} checks)` : '';
                    }
                }
            } as Partial<TooltipOptions<'line'>>
        },
    };
    return options;
};


export const getUptimeStatusBarChartOptions = ({ theme, chartData }: ChartConfigParams): ChartOptions<'bar'> => {
    const options: ChartOptions<'bar'> = {
        ...BASE_CHART_OPTIONS,
        indexAxis: 'x',
        scales: {
            x: {
                ticks: { autoSkip: true, maxTicksLimit: 15, color: theme.palette.text.secondary },
                grid: { display: false }
            },
            y: {
                display: false,
                min: -1.5,
                max: 1.5,
                grid: { display: false }
            }
        },
        plugins: {
            legend: {
                display: false
            } as Partial<LegendOptions<'bar'>>,
            tooltip: {
                ...BASE_TOOLTIP_OPTIONS,
                backgroundColor: alpha(theme.palette.background.paper, 0.9),
                titleColor: theme.palette.text.primary,
                bodyColor: theme.palette.text.secondary,
                borderColor: theme.palette.divider,
                borderWidth: 1,
                callbacks: {
                    label: (context: TooltipItem<'bar'>) => {
                        if (!chartData) return '';
                        const pointData = chartData[context.dataIndex];
                        if (!pointData) return '';
                        const value = context.parsed.y;
                        const statusText = value > 0 ? 'Up' : 'Downtime';
                        const uptimeFormatted = (pointData.uptimeRatio * 100).toFixed(2);
                        return `Status: ${statusText} (${uptimeFormatted}%)`;
                    },
                    title: (context: TooltipItem<'bar'>[]) => {
                        if (!context.length || !chartData) return '';
                        const pointData = chartData[context[0]?.dataIndex];
                        return pointData ? `${pointData.label} (${pointData.checkCount} checks)` : '';
                    }
                }
            } as Partial<TooltipOptions<'bar'>>
        },
    };
    return options;
};


export const getCardLineChartData = (theme: Theme, dataPoints: ChartDataPoint[] | undefined) => {
    if (!dataPoints || dataPoints.length === 0) return { labels: [], datasets: [] };
    const labels = dataPoints.map(p => p.label);
    const data = dataPoints.map(p => (p.avgResponseTime !== null && !isNaN(p.avgResponseTime)) ? p.avgResponseTime : null);
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
            spanGaps: true
        }]
    };
};