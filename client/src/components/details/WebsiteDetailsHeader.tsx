/*
src/components/details/WebsiteDetailsHeader.tsx
*/
import { useMemo, memo } from 'react';
import { Paper, Typography, Stack, Chip, IconButton, Tooltip, Box, CircularProgress } from '@mui/material'; // Removed Button, added CircularProgress back for refetch indicator
import Grid from '@mui/material/Grid2';
import {
    CheckCircleOutline as CheckIcon, ErrorOutline as ErrorIcon,
    Settings as SettingsIcon, Timer as TimerIcon
} from '@mui/icons-material'; // Removed NetworkCheckIcon
import { MonitoringResult } from '../../types';

interface WebsiteDetailsHeaderProps {
    name: string;
    url: string;
    latestResult: MonitoringResult | null;
    // isChecking is no longer needed here as the button is removed
    isRefetching: boolean; // Background query refetching (keep for indicator)
    // onCheckNow is no longer needed here
    onSettingsClick: () => void;
}

const WebsiteDetailsHeader = memo(({
    name,
    url,
    latestResult,
    isRefetching, // Removed isChecking
    onSettingsClick, // Removed onCheckNow
}: WebsiteDetailsHeaderProps) => {

    const isOnline = useMemo(() => latestResult?.isAvailable ?? false, [latestResult]);
    const currentStatusCode = useMemo(() => latestResult?.statusCode, [latestResult]);
    const statusColor = isOnline ? "success" : "error";
    const statusText = isOnline ? "Up" : "Down";
    const lastCheckedDate = latestResult?.checkedAt ? new Date(latestResult.checkedAt) : null;
    const lastCheckedTimeString = lastCheckedDate?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) ?? 'N/A';

    return (
        <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, mb: 3, position: 'relative', overflow: 'hidden' }}>
            {/* Settings Icon Button */}
            <Tooltip title="Website Settings">
                <IconButton size="medium" onClick={onSettingsClick} sx={{ position: 'absolute', top: 8, right: 8, color: 'text.secondary' }} aria-label="Website Settings">
                    <SettingsIcon />
                </IconButton>
            </Tooltip>

            {/* Main Content Grid - Align items center for vertical centering */}
            <Grid container spacing={{ xs: 2, sm: 3 }} alignItems="center">
                {/* Left Column: Name and URL */}
                <Grid size={{ xs: 12, md: 'auto' }} sx={{ flexGrow: 1, pr: { md: 4 }, minWidth: 0 }}>
                    <Stack spacing={0.5}>
                        <Typography variant="h5" component="h1" fontWeight={600} noWrap title={name}>{name}</Typography>
                        <Typography variant="body2" color="text.secondary" noWrap title={url}>{url}</Typography>
                    </Stack>
                </Grid>

                {/* Right Column: Status Info Only */}
                {/* Size auto, content dictates width */}
                <Grid size={{ xs: 12, md: 'auto' }}>
                    <Stack
                        direction="row" // Always row now
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap" // Allow chips to wrap
                        useFlexGap // Better spacing for wrapped items
                        sx={{ justifyContent: { xs: 'flex-start', sm: 'flex-end' } }} // Align chips right on sm+
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
                        {/* Refetch Indicator (moved slightly for better spacing without button) */}
                        {isRefetching && (
                            <Tooltip title="Refreshing data...">
                                <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}> {/* Added margin left */}
                                    <CircularProgress size={20} sx={{ opacity: 0.7 }} /> {/* Slightly smaller */}
                                </Box>
                            </Tooltip>
                        )}
                    </Stack>
                    {/* Removed Actions Group Stack */}
                </Grid>
            </Grid>
        </Paper>
    );
});

WebsiteDetailsHeader.displayName = 'WebsiteDetailsHeader';

export default WebsiteDetailsHeader;