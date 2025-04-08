import React, { useMemo } from 'react';
import { Paper, Box, Grid, Typography, Stack, Chip, Button, IconButton, Tooltip, CircularProgress, useTheme } from '@mui/material';
import {
    CheckCircleOutline as CheckIcon, ErrorOutline as ErrorIcon, NetworkCheck as NetworkCheckIcon,
    Settings as SettingsIcon, Timer as TimerIcon
} from '@mui/icons-material';
import { MonitoringResult } from '../../types';

interface WebsiteDetailsHeaderProps {
    name: string;
    url: string;
    latestResult: MonitoringResult | null;
    isChecking: boolean;
    isRefetching: boolean;
    onCheckNow: () => void;
    onSettingsClick: () => void;
}

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

    const isOnline = useMemo(() => latestResult?.isAvailable ?? false, [latestResult]);
    const currentStatusCode = useMemo(() => latestResult?.statusCode, [latestResult]);
    const statusColor = isOnline ? "success" : "error";
    const statusText = isOnline ? "Up" : "Down";
    const lastCheckedDate = latestResult?.checkedAt ? new Date(latestResult.checkedAt) : null;

    return (
        <Paper elevation={3} sx={{ p: 3, borderRadius: 2, mb: 3, position: 'relative', overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, position: 'relative' }}>
                <Box>
                    <Typography variant="h5" component="h1" fontWeight={600} noWrap gutterBottom>{name}</Typography>
                    <Typography variant="body2" color="textSecondary" noWrap>{url}</Typography>
                </Box>
                <Tooltip title="Website Settings">
                    <IconButton size="medium" onClick={onSettingsClick} sx={{ position: 'absolute', top: 0, right: 0, color: theme.palette.text.secondary }}>
                        <SettingsIcon />
                    </IconButton>
                </Tooltip>
            </Box>
            <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={8}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Chip icon={isOnline ? <CheckIcon /> : <ErrorIcon />} label={statusText} color={statusColor} size="small" sx={{ fontWeight: "bold" }} />
                        <Chip label={`HTTP ${currentStatusCode ?? "N/A"}`} variant="outlined" size="small" />
                        {lastCheckedDate && (
                            <Tooltip title={`Last checked: ${lastCheckedDate.toLocaleString()}`} arrow>
                                <Typography variant="caption" color="textSecondary" sx={{ display: 'flex', alignItems: 'center' }}>
                                    <TimerIcon fontSize="inherit" sx={{ mr: 0.5 }} />
                                    {lastCheckedDate.toLocaleTimeString()}
                                </Typography>
                            </Tooltip>
                        )}
                    </Stack>
                </Grid>
                <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: { xs: 2, md: 0 } }}>
                    <Button 
                        variant="contained" 
                        startIcon={isChecking ? <CircularProgress size={20} color="inherit" /> : <NetworkCheckIcon />} 
                        onClick={onCheckNow} 
                        disabled={isChecking || isRefetching} 
                        size="medium"
                        sx={{ borderRadius: 2 }}
                    >
                        {isChecking ? "Checking..." : "Check Now"}
                    </Button>
                    {isRefetching && !isChecking && <CircularProgress size={24} sx={{ ml: 2 }} />}
                </Grid>
            </Grid>
        </Paper>
    );
});

WebsiteDetailsHeader.displayName = 'WebsiteDetailsHeader';

export default WebsiteDetailsHeader;
