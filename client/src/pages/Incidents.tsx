/* src/pages/IncidentsPage.tsx */
import React, { useState, useMemo, useCallback } from 'react';
import { Container, Typography, Box, Alert, Button, Paper, CircularProgress, Stack } from '@mui/material';
import { useUserIncidentsQuery } from '../hooks'; // Adjust path
import { Incident, IncidentQueryOptions, ApiError, IncidentType } from '../types'; // Adjust path
// --- Updated import signature ---
import IncidentFilters, { IncidentFilterValues } from '../components/incidents/IncidentFilters'; // Adjust path
import IncidentList, { IncidentSortableColumn, SortDirection } from '../components/incidents/IncidentList'; // Adjust path
// --- Removed endOfDay as it's no longer needed for custom range ---
import { addDays, subDays, startOfDay } from 'date-fns';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const DEFAULT_LIMIT = 50;

const IncidentsPage: React.FC = () => {
    // --- Updated initial state for filters (removed customRange) ---
    const [filters, setFilters] = useState<IncidentFilterValues>({
        status: 'all',
        type: 'all',
        timeframe: '7d', // Default to last 7 days
        // customRange removed
    });
    const [sortBy, setSortBy] = useState<IncidentSortableColumn>('startTime');
    const [sortDir, setSortDir] = useState<SortDirection>('desc');

    // --- Calculate Query Options based on Filters ---
    const queryOptions = useMemo((): IncidentQueryOptions => {
        const options: IncidentQueryOptions = {
            limit: DEFAULT_LIMIT,
            status: filters.status === 'all' ? undefined : filters.status,
            type: filters.type === 'all' ? undefined : filters.type,
        };

        const now = new Date();
        switch (filters.timeframe) {
            case '24h':
                options.from = subDays(now, 1);
                options.to = now;
                break;
            case '7d':
                options.from = startOfDay(subDays(now, 7));
                options.to = now;
                break;
            case '30d':
                options.from = startOfDay(subDays(now, 30));
                options.to = now;
                break;
            // --- REMOVED 'custom' case ---
        }
        return options;
    }, [filters]); // Dependency array remains the same

    const {
        data: incidentsData,
        isPending: isLoading,
        isFetching,
        error,
        status,
        refetch
    } = useUserIncidentsQuery(queryOptions, {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: true,
    });

    // --- handleFilterChange remains the same ---
    const handleFilterChange = useCallback((newFilters: IncidentFilterValues) => {
        setFilters(newFilters);
    }, []);

    // --- handleSort remains the same ---
    const handleSort = useCallback((column: IncidentSortableColumn) => {
        setSortDir(currentDir => (column === sortBy && currentDir === 'desc' ? 'asc' : 'desc'));
        setSortBy(column);
    }, [sortBy]);

    // --- sortedIncidents logic remains the same ---
    const sortedIncidents = useMemo(() => {
        if (!incidentsData) return [];
        const listToSort = [...incidentsData];
        // ... (actual sort implementation remains unchanged) ...
        return listToSort.sort((a, b) => {
             let valA: any; let valB: any;
             switch (sortBy) {
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

    // --- isSuccessfullyLoadedAndEmpty logic remains the same ---
    const isSuccessfullyLoadedAndEmpty = status === 'success' && !isLoading && !isFetching && !error && sortedIncidents.length === 0;

    // --- Render Logic remains largely the same ---
    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
                Incidents
            </Typography>

            {/* IncidentFilters component is used as before */}
            <IncidentFilters
                initialFilters={filters}
                onFilterChange={handleFilterChange}
                isLoading={isLoading || isFetching}
            />

            {/* Error handling remains the same */}
            {error && (
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => refetch()}>Retry</Button>} sx={{ mb: 2 }}>
                    Error loading incidents: {(error as ApiError).message || 'Unknown error'}
                </Alert>
            )}

            {/* Loading indicator remains the same */}
            {isLoading && (
                <Box display="flex" justifyContent="center" alignItems="center" sx={{ p: 4 }}>
                    <CircularProgress />
                    <Typography sx={{ ml: 2 }} color="text.secondary">Loading incidents...</Typography>
                </Box>
            )}

            {/* Conditional rendering of list or empty state remains the same */}
            {!isLoading && !error && (
                <>
                    {sortedIncidents.length > 0 && (
                         <IncidentList
                            incidents={sortedIncidents}
                            isLoading={false}
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
            )}
        </Container>
    );
};

export default IncidentsPage;