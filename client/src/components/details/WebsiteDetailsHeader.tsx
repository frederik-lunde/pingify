/* src/components/details/WebsiteDetailsHeader.tsx */
import { useMemo, memo } from 'react';
import { Paper, Typography, Stack, Chip, IconButton, Tooltip, Box, CircularProgress } from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
    CheckCircleOutline as CheckIcon, ErrorOutline as ErrorIcon,
    Settings as SettingsIcon, Timer as TimerIcon,
    ArrowBack as ArrowBackIcon // Import ArrowBackIcon
} from '@mui/icons-material';
import { MonitoringResult } from '../../types';

interface WebsiteDetailsHeaderProps {
    name: string;
    url: string;
    latestResult: MonitoringResult | null;
    isRefetching: boolean;
    onSettingsClick: () => void;
    onBackClick: () => void; // Add prop for back navigation
}

const WebsiteDetailsHeader = memo(({
    name,
    url,
    latestResult,
    isRefetching,
    onSettingsClick,
    onBackClick, // Destructure the new prop
}: WebsiteDetailsHeaderProps) => {

    const isOnline = useMemo(() => latestResult?.isAvailable ?? false, [latestResult]);
    const currentStatusCode = useMemo(() => latestResult?.statusCode, [latestResult]);
    const statusColor = isOnline ? "success" : "error";
    const statusText = isOnline ? "Up" : "Down";
    const lastCheckedDate = latestResult?.checkedAt ? new Date(latestResult.checkedAt) : null;
    const lastCheckedTimeString = lastCheckedDate?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) ?? 'N/A';

    return (
        <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, mb: 3, position: 'relative', overflow: 'hidden' }}>
            {/* Settings Icon Button (kept in top right) */}
            <Tooltip title="Website Settings">
                <IconButton size="medium" onClick={onSettingsClick} sx={{ position: 'absolute', top: 8, right: 8, color: 'text.secondary' }} aria-label="Website Settings">
                    <SettingsIcon />
                </IconButton>
            </Tooltip>

            {/* Use a Stack for main layout to easily add the back button */}
            <Stack direction="row" spacing={2} alignItems="center">
                {/* Back Button */}
                <Tooltip title="Back to Dashboard">
                     {/* Wrap in Box to prevent Stack spacing issues if needed, or adjust Stack spacing */}
                    <Box>
                        <IconButton onClick={onBackClick} aria-label="Back to dashboard" sx={{ p: 0.5 /* Adjust padding if needed */ }}>
                            <ArrowBackIcon fontSize="large" /> {/* Slightly larger icon */}
                        </IconButton>
                    </Box>
                </Tooltip>

                {/* Main Content Grid (nested inside the Stack) */}
                <Grid container spacing={{ xs: 1, sm: 2 }} alignItems="center" sx={{ flexGrow: 1, minWidth: 0 /* Prevent overflow */ }}>
                    {/* Left Column: Name and URL */}
                    <Grid size={{ xs: 12, md: 'auto' }} sx={{ flexGrow: 1, pr: { md: 2 }, minWidth: 0 }}>
                        <Stack spacing={0.5}>
                            <Typography variant="h5" component="h1" fontWeight={600} noWrap title={name}>{name}</Typography>
                            <Typography variant="body2" color="text.secondary" noWrap title={url}>{url}</Typography>
                        </Stack>
                    </Grid>

                    {/* Right Column: Status Info Only */}
                    <Grid size={{ xs: 12, md: 'auto' }}>
                        <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            flexWrap="wrap"
                            useFlexGap
                            sx={{ justifyContent: { xs: 'flex-start', sm: 'flex-end' } }}
                        >
                            <Chip icon={isOnline ? <CheckIcon /> : <ErrorIcon />} label={statusText} color={statusColor} size="small" sx={{ fontWeight: "bold" }} />
                            <Chip label={`HTTP ${currentStatusCode ?? "N/A"}`} variant="outlined" size="small" />
                            {lastCheckedDate && (
                                <Tooltip title={`Last checked: ${lastCheckedDate.toLocaleString()}`} arrow>
                                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                                        <TimerIcon sx={{ fontSize: '1rem' }} />
                                        <Typography variant="caption">
                                            {lastCheckedTimeString}
                                        </Typography>
                                    </Stack>
                                </Tooltip>
                            )}
                            {isRefetching && (
                                <Tooltip title="Refreshing data...">
                                    <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
                                        <CircularProgress size={20} sx={{ opacity: 0.7 }} />
                                    </Box>
                                </Tooltip>
                            )}
                        </Stack>
                    </Grid>
                </Grid>
             </Stack>
        </Paper>
    );
});

WebsiteDetailsHeader.displayName = 'WebsiteDetailsHeader';

export default WebsiteDetailsHeader;