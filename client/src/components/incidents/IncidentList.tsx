import { memo } from 'react';
import {
    Paper, Box, Typography, Stack, List, Tooltip, ButtonBase, alpha, useTheme, ListItem, CircularProgress
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
    InfoOutlined as InfoOutlinedIcon, Link as LinkIcon,
    CalendarToday as CalendarTodayIcon, AccessTime as DurationIcon,
    ArrowUpward as ArrowUpwardIcon, ArrowDownward as ArrowDownwardIcon, SwapVert as SwapVertIcon,
} from '@mui/icons-material';
import { Incident } from '../../types';
import IncidentListItem from './IncidentListItem';

export type IncidentSortableColumn = 'startTime' | 'endTime' | 'durationSeconds' | 'websiteName' | 'type' | 'status';
export type SortDirection = 'asc' | 'desc';

interface IncidentListProps {
    incidents: Incident[];
    isLoading: boolean;
    sortBy: IncidentSortableColumn;
    sortDir: SortDirection;
    onSort: (column: IncidentSortableColumn) => void;
}

/**
 * Renders the appropriate sort icon based on current sort state.
 */
const renderSortIcon = (column: IncidentSortableColumn, sortBy: IncidentSortableColumn, sortDir: SortDirection) => {
    const isActive = sortBy === column;
    const IconComponent = isActive ? (sortDir === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon) : SwapVertIcon;
    const color = isActive ? 'text.primary' : 'text.disabled';
    const opacity = isActive ? 1 : 0.5;
    return <IconComponent fontSize="inherit" sx={{ ml: 0.5, color, opacity, verticalAlign: 'middle' }} />;
};

/**
 * Displays a sortable list of incidents with loading and empty states.
 */
const IncidentList = memo(({
    incidents,
    isLoading,
    sortBy,
    sortDir,
    onSort,
}: IncidentListProps) => {
    const theme = useTheme();
    const hasIncidents = incidents && incidents.length > 0;
    const headerCellStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        cursor: 'pointer',
        borderRadius: 1,
        p: 0.5,
        width: '100%',
        justifyContent: 'flex-start',
        '&:hover': { bgcolor: alpha(theme.palette.action.selected, 0.08) }
    };
    return (
        <Paper sx={{ p: 2, overflow: 'hidden', mt: 3 }}>
            {}
             <Grid container spacing={1} sx={{
                    borderBottom: 1, borderColor: 'divider', pb: 1, mb: 1,
                    display: { xs: 'none', sm: 'flex' }, alignItems: 'center',
                    background: alpha(theme.palette.action.hover, 0.04),
                    borderRadius: 1, px: 1
                }}>
                {}
                <Grid size={1} display="flex" justifyContent="center" alignItems="center">
                    <Tooltip title="Sort by Status">
                        {}
                        <ButtonBase onClick={() => onSort('status')} sx={headerCellStyle} aria-label="Sort by Status">
                        <Typography variant="caption" color="textSecondary" fontWeight="bold">Status</Typography>{renderSortIcon('status', sortBy, sortDir)}
                        </ButtonBase>
                    </Tooltip>
                </Grid>
                {}
                 <Grid size={2}>
                    <Tooltip title="Sort by Type">
                        <ButtonBase onClick={() => onSort('type')} sx={headerCellStyle} aria-label="Sort by Type">
                            <Typography variant="caption" color="textSecondary" fontWeight="bold">Type</Typography>{renderSortIcon('type', sortBy, sortDir)}
                        </ButtonBase>
                    </Tooltip>
                </Grid>
                {}
                 <Grid size={3}>
                    <Tooltip title="Sort by Website Name">
                        <ButtonBase onClick={() => onSort('websiteName')} sx={headerCellStyle} aria-label="Sort by Website Name">
                            <LinkIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5, verticalAlign: 'bottom' }} />
                            <Typography variant="caption" color="textSecondary" fontWeight="bold">Website</Typography>{renderSortIcon('websiteName', sortBy, sortDir)}
                        </ButtonBase>
                    </Tooltip>
                </Grid>
                {}
                 <Grid size={2}>
                    <Tooltip title="Sort by Start Time">
                        <ButtonBase onClick={() => onSort('startTime')} sx={headerCellStyle} aria-label="Sort by Start Time">
                            <CalendarTodayIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5, verticalAlign: 'bottom' }} />
                            <Typography variant="caption" color="textSecondary" fontWeight="bold">Started</Typography>{renderSortIcon('startTime', sortBy, sortDir)}
                        </ButtonBase>
                    </Tooltip>
                </Grid>
                {}
                 <Grid size={2}>
                    <Tooltip title="Sort by End Time">
                        <ButtonBase onClick={() => onSort('endTime')} sx={headerCellStyle} aria-label="Sort by End Time">
                             <CalendarTodayIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5, verticalAlign: 'bottom' }} />
                            <Typography variant="caption" color="textSecondary" fontWeight="bold">Ended</Typography>{renderSortIcon('endTime', sortBy, sortDir)}
                        </ButtonBase>
                    </Tooltip>
                </Grid>
                {}
                <Grid size={2}>
                    <Tooltip title="Sort by Duration">
                        <ButtonBase onClick={() => onSort('durationSeconds')} sx={headerCellStyle} aria-label="Sort by Duration">
                            <DurationIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5, verticalAlign: 'bottom' }} />
                            <Typography variant="caption" color="textSecondary" fontWeight="bold">Duration</Typography>{renderSortIcon('durationSeconds', sortBy, sortDir)}
                        </ButtonBase>
                    </Tooltip>
                </Grid>
            </Grid>
            {}
            <Box sx={{ maxHeight: { xs: '60vh', sm: '70vh' }, overflowY: 'auto' }}> {}
                <List dense disablePadding>
                    {isLoading ? (
                        <ListItem>
                             <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" width="100%" p={3} color="text.secondary">
                                <CircularProgress size={24} />
                                <Typography>Loading incidents...</Typography>
                            </Stack>
                        </ListItem>
                    ) : hasIncidents ? (
                        incidents.map((incident, index) => (
                            <IncidentListItem
                                key={incident.id ?? `incident-${index}`}
                                incident={incident}
                                isLastItem={index === incidents.length - 1}
                            />
                        ))
                    ) : (
                        <ListItem>
                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" width="100%" p={3} color="text.secondary">
                                <InfoOutlinedIcon fontSize="small" />
                                <Typography>No incidents found matching your criteria.</Typography>
                            </Stack>
                        </ListItem>
                    )}
                </List>
            </Box>
        </Paper>
    );
});
IncidentList.displayName = 'IncidentList';
export default IncidentList;