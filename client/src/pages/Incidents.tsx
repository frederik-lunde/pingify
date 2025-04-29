/* src/pages/IncidentsPage.tsx */
import React, { useState, useMemo, useCallback } from 'react';
// Removed Alert, Button imports used only for old error display
import { Container, Typography, Box, Paper, CircularProgress, Stack } from '@mui/material';
import { useUserIncidentsQuery } from '../hooks'; // Adjust path
import { IncidentQueryOptions, ApiError } from '../types'; // Adjust path, removed Incident, IncidentType as they are used internally by lists/filters
import IncidentFilters, { IncidentFilterValues } from '../components/incidents/IncidentFilters'; // Adjust path
import IncidentList, { IncidentSortableColumn, SortDirection } from '../components/incidents/IncidentList'; // Adjust path
import DataFetchError from '../components/common/DataFetchError'; // Import the common error component
import { subDays, startOfDay } from 'date-fns'; // Removed addDays as it wasn't used
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const DEFAULT_LIMIT = 50;

const IncidentsPage: React.FC = () => {
    const [filters, setFilters] = useState<IncidentFilterValues>({
        status: 'all',
        type: 'all',
        timeframe: '7d',
    });
    const [sortBy, setSortBy] = useState<IncidentSortableColumn>('startTime');
    const [sortDir, setSortDir] = useState<SortDirection>('desc');

    const queryOptions = useMemo((): IncidentQueryOptions => {
        const options: IncidentQueryOptions = {
            limit: DEFAULT_LIMIT,
            status: filters.status === 'all' ? undefined : filters.status,
            type: filters.type === 'all' ? undefined : filters.type,
        };

        const now = new Date();
        switch (filters.timeframe) {
            case '24h': options.from = subDays(now, 1); options.to = now; break;
            case '7d': options.from = startOfDay(subDays(now, 7)); options.to = now; break;
            case '30d': options.from = startOfDay(subDays(now, 30)); options.to = now; break;
        }
        return options;
    }, [filters]);

    const {
        data: incidentsData,
        isPending: isLoading, // Use isPending for initial load state
        isFetching,
        error,
        status,
        refetch
    } = useUserIncidentsQuery(queryOptions, {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: true,
    });

    const handleFilterChange = useCallback((newFilters: IncidentFilterValues) => {
        setFilters(newFilters);
    }, []);

    const handleSort = useCallback((column: IncidentSortableColumn) => {
        setSortDir(currentDir => (column === sortBy && currentDir === 'desc' ? 'asc' : 'desc'));
        setSortBy(column);
    }, [sortBy]);

    const sortedIncidents = useMemo(() => {
        if (!incidentsData) return [];
        const listToSort = [...incidentsData];
        // Sorting logic remains the same...
        return listToSort.sort((a, b) => {
             let valA: number | string; let valB: number | string;
             switch (sortBy) {
                case 'status': valA = a.endTime === null ? 0 : 1; valB = b.endTime === null ? 0 : 1; break;
                case 'startTime': valA = a.startTime ? new Date(a.startTime).getTime() : 0; valB = b.startTime ? new Date(b.startTime).getTime() : 0; break;
                case 'endTime': valA = a.endTime ? new Date(a.endTime).getTime() : (sortDir === 'asc' ? Infinity : -Infinity); valB = b.endTime ? new Date(b.endTime).getTime() : (sortDir === 'asc' ? Infinity : -Infinity); break;
                case 'durationSeconds': valA = a.durationSeconds ?? (a.endTime === null ? (sortDir === 'asc' ? Infinity : -1) : 0); valB = b.durationSeconds ?? (b.endTime === null ? (sortDir === 'asc' ? Infinity : -1) : 0); break;
                case 'websiteName': valA = a.website?.name?.toLowerCase() || a.website?.url?.toLowerCase() || ''; valB = b.website?.name?.toLowerCase() || b.website?.url?.toLowerCase() || ''; return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'type': valA = a.type || ''; valB = b.type || ''; return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                default: return 0;
            }
            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            const tieA = a.startTime ? new Date(a.startTime).getTime() : 0; const tieB = b.startTime ? new Date(b.startTime).getTime() : 0; return tieB - tieA;
        });
    }, [incidentsData, sortBy, sortDir]);

    const isSuccessfullyLoadedAndEmpty = status === 'success' && !isLoading && !isFetching && !error && sortedIncidents.length === 0;

    // --- Render Logic ---

    // Initial Loading State
    if (isLoading) {
        return (
            <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>Incidents</Typography>
                {/* Show Filters skeleton/disabled state? Or just the loader */}
                <Box display="flex" justifyContent="center" alignItems="center" sx={{ p: 4, minHeight: '50vh' }}>
                    <CircularProgress />
                    <Typography sx={{ ml: 2 }} color="text.secondary">Loading incidents...</Typography>
                </Box>
            </Container>
        );
    }

    // Error State - Use DataFetchError
    if (error) {
         return (
            <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
                {/* Keep header for context */}
                <Typography variant="h4" component="h1" gutterBottom>Incidents</Typography>
                <DataFetchError
                    error={error as ApiError}
                    onRetry={refetch}
                    context="Incidents"
                />
            </Container>
        );
    }

    // Success State (Data Loaded)
    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
                Incidents
            </Typography>

            <IncidentFilters
                initialFilters={filters}
                onFilterChange={handleFilterChange}
                // Pass isFetching for background refresh indication on filters
                isLoading={isFetching}
            />

            {/* No loading/error check needed here as they are handled above */}
            <>
                {sortedIncidents.length > 0 && (
                     <IncidentList
                        incidents={sortedIncidents}
                        isLoading={isFetching} // Indicate background refresh on the list
                        sortBy={sortBy}
                        sortDir={sortDir}
                        onSort={handleSort}
                    />
                )}
                {isSuccessfullyLoadedAndEmpty && (
                    <Paper sx={{ mt: 3, p: 3, textAlign: 'center' }}>
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" color="text.secondary">
                            <InfoOutlinedIcon />
                            <Typography>No incidents found matching your current filters.</Typography>
                        </Stack>
                         <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Try adjusting the timeframe or filter settings.
                        </Typography>
                    </Paper>
                )}
            </>
        </Container>
    );
};

export default IncidentsPage;