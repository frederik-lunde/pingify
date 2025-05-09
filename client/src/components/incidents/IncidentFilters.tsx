import React, { useState } from 'react';
import {
    FormControl, InputLabel, Select, MenuItem, SelectChangeEvent, Stack,
} from '@mui/material';
import { IncidentType, VALID_INCIDENT_TYPES } from '../../types';

type StatusFilter = 'all' | 'open' | 'closed';
type TypeFilter = 'all' | IncidentType;
type TimeframeFilter = '24h' | '7d' | '30d';

export interface IncidentFilterValues {
    status: StatusFilter;
    type: TypeFilter;
    timeframe: TimeframeFilter;
}

interface IncidentFiltersProps {
    initialFilters: IncidentFilterValues;
    onFilterChange: (filters: IncidentFilterValues) => void;
    isLoading: boolean;
}

/**
 * Renders filter controls for incidents (status, type, timeframe).
 */
const IncidentFilters: React.FC<IncidentFiltersProps> = ({ initialFilters, onFilterChange, isLoading }) => {
    const [status, setStatus] = useState<StatusFilter>(initialFilters.status);
    const [type, setType] = useState<TypeFilter>(initialFilters.type);
    const [timeframe, setTimeframe] = useState<TimeframeFilter>(initialFilters.timeframe);

    /**
     * Handles changes to the incident status filter.
     */
    const handleStatusChange = (event: SelectChangeEvent<StatusFilter>) => {
        const newStatus = event.target.value as StatusFilter;
        setStatus(newStatus);
        onFilterChange({ status: newStatus, type, timeframe });
    };

    /**
     * Handles changes to the incident type filter.
     */
    const handleTypeChange = (event: SelectChangeEvent<TypeFilter>) => {
        const newType = event.target.value as TypeFilter;
        setType(newType);
        onFilterChange({ status, type: newType, timeframe });
    };

    /**
     * Handles changes to the incident timeframe filter.
     */
    const handleTimeframeChange = (event: SelectChangeEvent<TimeframeFilter>) => {
        const newTimeframe = event.target.value as TimeframeFilter;
        setTimeframe(newTimeframe);
        onFilterChange({ status, type, timeframe: newTimeframe });
    };

    return (
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
                    {}
                    {}
                </Select>
            </FormControl>
            {}
            {}
            {}
        </Stack>
    );
};
export default IncidentFilters;