/* src/pages/IncidentsPage.tsx */
import React, { useState, useMemo, useCallback } from 'react';
import { Container, Typography, Box, Alert, Button, Paper, CircularProgress, Stack } from '@mui/material';
import { useUserIncidentsQuery } from '../hooks'; // Adjust path
import { Incident, IncidentQueryOptions, ApiError, IncidentType } from '../types'; // Adjust path
import IncidentFilters, { IncidentFilterValues } from '../components/incidents/IncidentFilters'; // Adjust path
// --- Update type import ---
import IncidentList, { IncidentSortableColumn, SortDirection } from '../components/incidents/IncidentList'; // Adjust path
import { addDays, subDays, startOfDay } from 'date-fns';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const DEFAULT_LIMIT = 50;

const IncidentsPage: React.FC = () => {
    const [filters, setFilters] = useState<IncidentFilterValues>({
        status: 'all',
        type: 'all',
        timeframe: '7d',
    });
    // --- Update initial state to include 'status' if desired, otherwise default to startTime ---
    const [sortBy, setSortBy] = useState<IncidentSortableColumn>('startTime'); // Or 'status'
    const [sortDir, setSortDir] = useState<SortDirection>('desc');

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
        }
        return options;
    }, [filters]);

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

    const handleFilterChange = useCallback((newFilters: IncidentFilterValues) => {
        setFilters(newFilters);
    }, []);

    // Update handleSort signature if needed (though it should match already)
    const handleSort = useCallback((column: IncidentSortableColumn) => {
        setSortDir(currentDir => (column === sortBy && currentDir === 'desc' ? 'asc' : 'desc'));
        setSortBy(column);
    }, [sortBy]);

    // --- Update sorting logic ---
    const sortedIncidents = useMemo(() => {
        if (!incidentsData) return [];
        const listToSort = [...incidentsData];

        return listToSort.sort((a, b) => {
             let valA: any; let valB: any;
             switch (sortBy) {
                // --- ADD 'status' case ---
                case 'status':
                    // Assign 0 for open (null endTime), 1 for closed (non-null endTime)
                    valA = a.endTime === null ? 0 : 1;
                    valB = b.endTime === null ? 0 : 1;
                    // Standard comparison applies: asc (0 -> 1) = open first, desc (1 -> 0) = closed first
                    break;
                // --- Keep other cases ---
                case 'startTime': valA = a.startTime ? new Date(a.startTime).getTime() : 0; valB = b.startTime ? new Date(b.startTime).getTime() : 0; break;
                case 'endTime': valA = a.endTime ? new Date(a.endTime).getTime() : (sortDir === 'asc' ? Infinity : -Infinity); valB = b.endTime ? new Date(b.endTime).getTime() : (sortDir === 'asc' ? Infinity : -Infinity); break;
                case 'durationSeconds': valA = a.durationSeconds ?? (a.endTime === null ? (sortDir === 'asc' ? Infinity : -1) : 0); valB = b.durationSeconds ?? (b.endTime === null ? (sortDir === 'asc' ? Infinity : -1) : 0); break;
                case 'websiteName': valA = a.website?.name?.toLowerCase() || a.website?.url?.toLowerCase() || ''; valB = b.website?.name?.toLowerCase() || b.website?.url?.toLowerCase() || ''; return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                case 'type': valA = a.type || ''; valB = b.type || ''; return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                default: return 0;
            }
            // --- Standard comparison and tie-breaker ---
            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            // Tie-breaker: always sort by most recent start time descending
            const tieA = a.startTime ? new Date(a.startTime).getTime() : 0; const tieB = b.startTime ? new Date(b.startTime).getTime() : 0; return tieB - tieA;
        });
    }, [incidentsData, sortBy, sortDir]);

    const isSuccessfullyLoadedAndEmpty = status === 'success' && !isLoading && !isFetching && !error && sortedIncidents.length === 0;

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>
                Incidents
            </Typography>

            <IncidentFilters
                initialFilters={filters}
                onFilterChange={handleFilterChange}
                isLoading={isLoading || isFetching}
            />

            {error && (
                <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => refetch()}>Retry</Button>} sx={{ mb: 2 }}>
                    Error loading incidents: {(error as ApiError).message || 'Unknown error'}
                </Alert>
            )}

            {isLoading && (
                <Box display="flex" justifyContent="center" alignItems="center" sx={{ p: 4 }}>
                    <CircularProgress />
                    <Typography sx={{ ml: 2 }} color="text.secondary">Loading incidents...</Typography>
                </Box>
            )}

            {!isLoading && !error && (
                <>
                    {/* --- Pass updated sort props to IncidentList --- */}
                    {sortedIncidents.length > 0 && (
                         <IncidentList
                            incidents={sortedIncidents}
                            isLoading={false} // Pass false as main loading is handled above
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