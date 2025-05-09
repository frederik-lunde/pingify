import React from 'react';
import { Box, Button, FormControl, InputLabel, Select, MenuItem, CircularProgress, SelectChangeEvent } from '@mui/material';
import { NetworkCheck as NetworkCheckIcon } from '@mui/icons-material';
import { TimeframeKey } from '../../types';

interface WebsiteDetailsControlsProps {
    timeframeKey: TimeframeKey;
    onTimeframeChange: (event: SelectChangeEvent<TimeframeKey>) => void;
    onCheckNow: () => void;
    isChecking: boolean;
    isProcessingData: boolean;
}

/**
 * Renders controls for the website details page, including "Check Now" button and timeframe selector.
 */
const WebsiteDetailsControls: React.FC<WebsiteDetailsControlsProps> = ({
    timeframeKey,
    onTimeframeChange,
    onCheckNow,
    isChecking,
    isProcessingData,
}) => {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
            <Button
                variant="contained"
                color="primary"
                startIcon={isChecking ? <CircularProgress size={20} color="inherit" /> : <NetworkCheckIcon />}
                onClick={onCheckNow}
                disabled={isChecking}
                size="medium"
                sx={{ borderRadius: 2, whiteSpace: 'nowrap', minWidth: { xs: 'auto', sm: 110 } }}
                title={isChecking ? "Check in progress..." : "Trigger an immediate check"}
            >
                {isChecking ? "Checking..." : "Check Now"}
            </Button>
            <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel id="timeframe-select-label">Chart Timeframe</InputLabel>
                <Select
                    labelId="timeframe-select-label"
                    id="timeframe-select"
                    value={timeframeKey}
                    label="Chart Timeframe"
                    onChange={onTimeframeChange}
                    disabled={isProcessingData}
                >
                    <MenuItem value={'hour'}>Last Hour</MenuItem>
                    <MenuItem value={'day'}>Last 24 Hours</MenuItem>
                    <MenuItem value={'week'}>Last 7 Days</MenuItem>
                    <MenuItem value={'month'}>Last 30 Days</MenuItem>
                    <MenuItem value={'year'}>Last Year</MenuItem>
                </Select>
            </FormControl>
        </Box>
    );
};
export default WebsiteDetailsControls;