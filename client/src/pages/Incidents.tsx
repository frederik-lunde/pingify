import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Container, Typography, Box, Paper, CircularProgress, Stack, IconButton, Tooltip } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useUserIncidentsQuery } from '../hooks';
import { IncidentQueryOptions, ApiError } from '../types';
import IncidentFilters, { IncidentFilterValues } from '../components/incidents/IncidentFilters';
import IncidentList, { IncidentSortableColumn, SortDirection } from '../components/incidents/IncidentList';
import DataFetchError from '../components/common/DataFetchError';
import { subDays, startOfDay } from 'date-fns';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const DEFAULT_LIMIT = 50;

/**
 * Page component for displaying and filtering user incidents.
 */
const IncidentsPage: React.FC = () => {
    const navigate = useNavigate();
    const [filters, setFilters] = useState<IncidentFilterValues>({
        status: 'all',
        type: 'all',
        timeframe: '7d',
    });
    const [sortBy, setSortBy] = useState<IncidentSortableColumn>('startTime');
    const [sortDir, setSortDir] = useState<SortDirection>('desc');

    /**
     * Memoizes query options based on current filters.
     */
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
        isPending: isLoading,
        isFetching,
        error,
        status,
        refetch
    } = useUserIncidentsQuery(queryOptions, {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: true,
    });

    /**
     * Updates filter state when filter values change.
     */
    const handleFilterChange = useCallback((newFilters: IncidentFilterValues) => {
        setFilters(newFilters);
    }, []);

    /**
     * Handles sorting of the incident list.
     */
    const handleSort = useCallback((column: IncidentSortableColumn) => {
        setSortDir(currentDir => (column === sortBy && currentDir === 'desc' ? 'asc' : 'desc'));
        setSortBy(column);
    }, [sortBy]);

    /**
     * Navigates back to the previous page (dashboard).
     */
    const handleBackClick = useCallback(() => {
        navigate('/');
    }, [navigate]);

    /**
     * Memoizes and sorts incidents based on current sort options.
     */
    const sortedIncidents = useMemo(() => {
        if (!incidentsData) return [];
        const listToSort = [...incidentsData];
        /**
         * Sorts two incident items.
         */
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

    /**
     * Renders the page header with back button and title.
     */
    const renderHeader = () => (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
            <Tooltip title="Back to Dashboard">
                <IconButton onClick={handleBackClick} aria-label="Back to dashboard">
                    <ArrowBackIcon />
                </IconButton>
            </Tooltip>
            <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 0  }}>
                Incidents
            </Typography>
        </Stack>
    );

    if (isLoading) {
        return (
            <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
                {renderHeader()} {}
                <Box display="flex" justifyContent="center" alignItems="center" sx={{ p: 4, minHeight: '50vh' }}>
                    <CircularProgress />
                    <Typography sx={{ ml: 2 }} color="text.secondary">Loading incidents...</Typography>
                </Box>
            </Container>
        );
    }

    if (error) {
         return (
            <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
                {renderHeader()} {}
                <DataFetchError
                    error={error as ApiError}
                    onRetry={refetch}
                    context="Incidents"
                />
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            {renderHeader()} {}
            <IncidentFilters
                initialFilters={filters}
                onFilterChange={handleFilterChange}
                isLoading={isFetching}
            />
            <>
                {sortedIncidents.length > 0 && (
                     <IncidentList
                        incidents={sortedIncidents}
                        isLoading={isFetching}
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