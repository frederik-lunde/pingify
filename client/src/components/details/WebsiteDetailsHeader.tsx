// src/components/details/WebsiteDetailsHeader.tsx
import React, { useMemo } from 'react';
import { Paper, Box, Grid, Typography, Stack, Chip, Button, IconButton, Tooltip, CircularProgress, useTheme } from '@mui/material';
import {
    CheckCircleOutline as CheckIcon, ErrorOutline as ErrorIcon, NetworkCheck as NetworkCheckIcon,
    Settings as SettingsIcon, Timer as TimerIcon
} from '@mui/icons-material';
import { MonitoringResult } from '../../types'; // Adjust path

interface WebsiteDetailsHeaderProps {
    name: string;
    url: string;
    latestResult: MonitoringResult | null;
    isChecking: boolean;
    isRefetching: boolean; // Pass the fetching state
    onCheckNow: () => void;
    onSettingsClick: () => void;
}

// Memoize the component
const WebsiteDetailsHeader = React.memo(({
    name,
    url,
    latestResult,
    isChecking,
    isRefetching,
    onCheckNow,
    onSettingsClick,
}: WebsiteDetailsHeaderProps) => {
    const theme = useTheme();

    // Derived state specific to the header
    const isOnline = useMemo(() => latestResult?.isAvailable ?? false, [latestResult]);
    const currentStatusCode = useMemo(() => latestResult?.statusCode, [latestResult]);
    const statusColor = isOnline ? "success" : "error";
    const statusText = isOnline ? "Up" : "Down";
    const lastCheckedDate = latestResult?.checkedAt ? new Date(latestResult.checkedAt) : null;

    return (
        <Paper sx={{ p: 2, mb: 3, position: 'relative', overflow: 'hidden' }}>
            <Tooltip title="Website Settings">
                <IconButton size="medium" onClick={onSettingsClick} sx={{ position: 'absolute', top: theme.spacing(1), right: theme.spacing(1), zIndex: 1 }}>
                    <SettingsIcon />
                </IconButton>
            </Tooltip>
            <Box sx={{ pt: { xs: 4, sm: 0 } }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={8}>
                        <Tooltip title={name}>
                            <Typography variant="h4" component="h1" noWrap gutterBottom>{name}</Typography>
                        </Tooltip>
                        <Tooltip title={url}>
                            <Typography variant="body1" color="textSecondary" noWrap sx={{ mb: 1 }}>{url}</Typography>
                        </Tooltip>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Chip icon={isOnline ? <CheckIcon /> : <ErrorIcon />} label={statusText} color={statusColor} size="small" sx={{ fontWeight: "bold" }} />
                            <Chip label={`HTTP ${currentStatusCode ?? "N/A"}`} variant="outlined" size="small" />
                            {lastCheckedDate && (
                                <Tooltip title={`Last checked: ${lastCheckedDate.toLocaleString()}`}>
                                    <Typography variant="caption" color="textSecondary" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                                        <TimerIcon fontSize="inherit" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                                        {lastCheckedDate.toLocaleTimeString()}
                                    </Typography>
                                </Tooltip>
                            )}
                        </Stack>
                    </Grid>
                    <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, alignItems: 'center', mt: { xs: 2, md: 0 } }}>
                        <Button variant="contained" startIcon={isChecking ? <CircularProgress size={20} color="inherit" /> : <NetworkCheckIcon />} onClick={onCheckNow} disabled={isChecking || isRefetching} size="medium">
                            {isChecking ? "Checking..." : "Check Now"}
                        </Button>
                        {/* Show refetching indicator only if not actively checking */}
                        {isRefetching && !isChecking && <CircularProgress size={24} sx={{ ml: 2 }} />}
                    </Grid>
                </Grid>
            </Box>
        </Paper>
    );
});

WebsiteDetailsHeader.displayName = 'WebsiteDetailsHeader';

export default WebsiteDetailsHeader;