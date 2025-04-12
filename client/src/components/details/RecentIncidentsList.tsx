/* src/components/details/RecentIncidentsList.tsx */
import { memo } from 'react';
import {
    Paper, Box, Typography, Stack, List, Tooltip, ButtonBase, alpha, useTheme, ListItem
} from '@mui/material';
import Grid from '@mui/material/Grid2'; // Use Grid v2
import {
    History as HistoryIcon, InfoOutlined as InfoOutlinedIcon,
    ErrorOutline as ErrorIcon, WarningAmber as SlowIcon, CalendarToday as CalendarTodayIcon, Timer as TimerIcon, AccessTime as DurationIcon
} from '@mui/icons-material';
import { Incident } from '../../types'; // Adjust path
import IncidentListItem from './IncidentListItem'; // Adjust path

interface RecentIncidentsListProps {
    incidents: Incident[];
    isLoading: boolean; // To potentially show loading state within the list
    // Add sorting/filtering props later if needed
}

// Memoize the component
const RecentIncidentsList = memo(({
    incidents,
    isLoading,
    // Add sorting/filtering handlers later if needed
}: RecentIncidentsListProps) => {
    const theme = useTheme();
    const hasIncidents = incidents && incidents.length > 0;

    return (
        <Paper sx={{ p: 2, overflow: 'hidden', mt: 3 }}> {/* Added margin top */}
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', mb: 2, gap: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <HistoryIcon sx={{ color: 'text.secondary' }} />
                    <Typography variant="h6" component="h2">Recent Incidents</Typography>
                </Stack>
                {/* Add controls like filtering or pagination here later if needed */}
            </Box>

            {/* Column Headers - Use Grid v2 */}
             <Grid container spacing={1} sx={{
                    borderBottom: 1, borderColor: 'divider', pb: 1, mb: 1,
                    display: { xs: 'none', sm: 'flex' }, alignItems: 'center',
                    background: alpha(theme.palette.action.hover, 0.04),
                    borderRadius: 1, px: 1
                }}>
                 {/* Icon Col */}
                <Grid size={1} display="flex" justifyContent="center" alignItems="center">
                   {/* Placeholder or common icon, maybe filter later */}
                   <ErrorIcon fontSize="small" sx={{ color: 'text.secondary', opacity: 0.6 }} />
                </Grid>
                {/* Type Col */}
                 <Grid size={2}>
                     <Typography variant="caption" color="textSecondary" fontWeight="bold">Type</Typography>
                     {/* Add sorting later if needed */}
                </Grid>
                {/* Start Time Col */}
                 <Grid size={3}>
                     <CalendarTodayIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5, verticalAlign: 'bottom' }} />
                     <Typography variant="caption" color="textSecondary" fontWeight="bold">Started</Typography>
                     {/* Add sorting later if needed */}
                </Grid>
                {/* End Time Col */}
                 <Grid size={3}>
                     <CalendarTodayIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5, verticalAlign: 'bottom' }} />
                    <Typography variant="caption" color="textSecondary" fontWeight="bold">Ended</Typography>
                     {/* Add sorting later if needed */}
                </Grid>
                {/* Duration Col */}
                <Grid size={3}>
                     <DurationIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5, verticalAlign: 'bottom' }} />
                     <Typography variant="caption" color="textSecondary" fontWeight="bold">Duration</Typography>
                     {/* Add sorting later if needed */}
                </Grid>
            </Grid>

            {/* Incident List Items */}
            <Box sx={{ maxHeight: { xs: 300, sm: 400 }, overflowY: 'auto' }}>
                <List dense disablePadding>
                    {isLoading && !hasIncidents ? ( // Show loading indicator only if list is empty
                        <ListItem>
                             <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" width="100%" p={3} color="text.secondary">
                                {/* Optional: Add a spinner here */}
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
                                <Typography>No recent incidents found for the selected timeframe.</Typography>
                            </Stack>
                        </ListItem>
                    )}
                </List>
            </Box>
        </Paper>
    );
});

RecentIncidentsList.displayName = 'RecentIncidentsList';

export default RecentIncidentsList;