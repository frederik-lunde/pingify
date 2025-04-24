/* src/components/incidents/IncidentFilters.tsx */
import React, { useState } from 'react';
import {
    FormControl, InputLabel, Select, MenuItem, SelectChangeEvent, Stack,
} from '@mui/material';
import { IncidentType, VALID_INCIDENT_TYPES } from '../../types'; // Adjust path


type StatusFilter = 'all' | 'open' | 'closed';
type TypeFilter = 'all' | IncidentType;
// --- REMOVED 'custom' from TimeframeFilter ---
type TimeframeFilter = '24h' | '7d' | '30d'; // Removed 'custom'

export interface IncidentFilterValues {
    status: StatusFilter;
    type: TypeFilter;
    timeframe: TimeframeFilter;
    // --- REMOVED customRange ---
    // customRange: DateRange<Date>;
}

interface IncidentFiltersProps {
    initialFilters: IncidentFilterValues;
    onFilterChange: (filters: IncidentFilterValues) => void;
    isLoading: boolean;
}

const IncidentFilters: React.FC<IncidentFiltersProps> = ({ initialFilters, onFilterChange, isLoading }) => {
    const [status, setStatus] = useState<StatusFilter>(initialFilters.status);
    const [type, setType] = useState<TypeFilter>(initialFilters.type);
    const [timeframe, setTimeframe] = useState<TimeframeFilter>(initialFilters.timeframe);
    // --- REMOVED customRange state ---
    // const [customRange, setCustomRange] = useState<DateRange<Date>>(initialFilters.customRange);

    const handleStatusChange = (event: SelectChangeEvent<StatusFilter>) => {
        const newStatus = event.target.value as StatusFilter;
        setStatus(newStatus);
        // --- Pass updated filter object without customRange ---
        onFilterChange({ status: newStatus, type, timeframe });
    };

    const handleTypeChange = (event: SelectChangeEvent<TypeFilter>) => {
        const newType = event.target.value as TypeFilter;
        setType(newType);
        // --- Pass updated filter object without customRange ---
        onFilterChange({ status, type: newType, timeframe });
    };

    const handleTimeframeChange = (event: SelectChangeEvent<TimeframeFilter>) => {
        const newTimeframe = event.target.value as TimeframeFilter;
        setTimeframe(newTimeframe);
        // --- Pass updated filter object without customRange ---
        onFilterChange({ status, type, timeframe: newTimeframe });
    };

    // --- REMOVED handleCustomRangeChange ---

    return (
        // --- REMOVED LocalizationProvider ---
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            <FormControl size="small" sx={{ minWidth: 120, flexGrow: 1 }}>
                <InputLabel id="incident-status-filter-label">Status</InputLabel>
                <Select
                    labelId="incident-status-filter-label"
                    value={status}
                    label="Status"
                    onChange={handleStatusChange}
                    disabled={isLoading}
                >
                    <MenuItem value="all">All Statuses</MenuItem>
                    <MenuItem value="open">Open</MenuItem>
                    <MenuItem value="closed">Closed</MenuItem>
                </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120, flexGrow: 1 }}>
                <InputLabel id="incident-type-filter-label">Type</InputLabel>
                <Select
                    labelId="incident-type-filter-label"
                    value={type}
                    label="Type"
                    onChange={handleTypeChange}
                    disabled={isLoading}
                >
                    <MenuItem value="all">All Types</MenuItem>
                    {VALID_INCIDENT_TYPES.map(t => (
                        <MenuItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</MenuItem>
                    ))}
                </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150, flexGrow: 1 }}>
                <InputLabel id="incident-timeframe-filter-label">Timeframe</InputLabel>
                <Select
                    labelId="incident-timeframe-filter-label"
                    value={timeframe}
                    label="Timeframe"
                    onChange={handleTimeframeChange}
                    disabled={isLoading}
                >
                    <MenuItem value="24h">Last 24 Hours</MenuItem>
                    <MenuItem value="7d">Last 7 Days</MenuItem>
                    <MenuItem value="30d">Last 30 Days</MenuItem>
                    {/* --- REMOVED Custom Range MenuItem --- */}
                    {/* <MenuItem value="custom">Custom Range</MenuItem> */}
                </Select>
            </FormControl>

            {/* --- REMOVED Conditional Collapse and DateRangePicker --- */}

            {/* Placeholder for potential website filter */}
            {/* <FormControl size="small" sx={{ minWidth: 200, flexGrow: 1 }}>...</FormControl> */}
        </Stack>
    );
};

export default IncidentFilters;