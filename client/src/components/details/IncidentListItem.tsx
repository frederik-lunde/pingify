/* src/components/details/IncidentListItem.tsx */
import { memo } from 'react';
import { ListItem, Typography, Tooltip, Divider, alpha, useTheme, Chip } from '@mui/material';
import Grid from '@mui/material/Grid2'; // Use Grid v2
import { ErrorOutline as ErrorIcon, WarningAmber as SlowIcon, InfoOutlined as InfoIcon } from '@mui/icons-material';
import { Incident, IncidentType } from '../../types'; // Adjust path
import { formatIncidentDuration } from '../../utils/statusUtils'; // Adjust path
import { useTimeSince } from '../../hooks'; 

interface IncidentListItemProps {
    incident: Incident;
    isLastItem: boolean; // To control the divider
}

// Helper to get icon and color based on incident type
const getIncidentVisuals = (type: IncidentType): { Icon: React.ElementType, color: 'error' | 'warning' } => {
    switch (type) {
        case 'down':
            return { Icon: ErrorIcon, color: 'error' };
        case 'slow':
            return { Icon: SlowIcon, color: 'warning' };
        default:
            return { Icon: InfoIcon, color: 'warning' }; // Fallback, should ideally not happen
    }
};

// Memoize the list item component
const IncidentListItem = memo(({ incident, isLastItem }: IncidentListItemProps) => {
    const theme = useTheme();
    const { Icon, color } = getIncidentVisuals(incident.type);
    const rowSx = {
        py: 1.5, // Increased padding slightly
        px: { xs: 1, sm: 2 },
        '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.04) },
    };

    // Format dates - use toLocaleString for user-friendly display
    const formattedStartDate = incident.startTime
        ? new Date(incident.startTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
        : 'N/A';
    const formattedEndDate = incident.endTime
        ? new Date(incident.endTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
        : 'Ongoing';

    // Use useTimeSince for relative start time in tooltip
    const timeSinceStart = useTimeSince(incident.startTime, { addSuffix: true, noIncidentText: '' });
    const formattedDuration = formatIncidentDuration(incident); // Gets "for X" or "since Y ago"

    return (
        <>
            <ListItem sx={rowSx} disableGutters>
                <Grid container spacing={1} alignItems="center" sx={{ width: '100%' }}>
                    {/* Icon & Type */}
                    <Grid size={{ xs: 2, sm: 1 }} display="flex" justifyContent="center" alignItems="center">
                        <Tooltip title={incident.type === 'down' ? 'Downtime Incident' : 'Performance Incident'}>
                            <Icon color={color} fontSize="medium" />
                        </Tooltip>
                    </Grid>
                     <Grid size={{ xs: 10, sm: 2 }}>
                          <Chip
                              label={incident.type.charAt(0).toUpperCase() + incident.type.slice(1)} // Capitalize type
                              size="small"
                              color={color}
                              variant="outlined"
                              sx={{ fontWeight: 500 }}
                          />
                    </Grid>

                    {/* Start Time */}
                    <Grid size={{ xs: 12, sm: 3 }} sx={{ pl: { xs: 'calc(2/12 * 100% + 8px)', sm: 0 }}}> {/* Indent on xs */}
                        <Tooltip title={timeSinceStart || incident.startTime}>
                            <Typography variant="body2" noWrap>
                                {formattedStartDate}
                            </Typography>
                        </Tooltip>
                    </Grid>

                    {/* End Time / Status */}
                    <Grid size={{ xs: 6, sm: 3 }} textAlign={{ xs: 'left', sm: 'left' }}>
                         <Typography component="span" sx={{ display: { xs: 'inline', sm: 'none' }, mr: 0.5, fontSize: '0.75rem', color: 'text.secondary' }}>End:</Typography>
                        <Typography variant="body2" component="span" color={incident.endTime ? 'text.secondary' : 'text.primary'}>
                            {formattedEndDate}
                        </Typography>
                    </Grid>

                    {/* Duration */}
                    <Grid size={{ xs: 6, sm: 3 }} textAlign={{ xs: 'left', sm: 'left' }}>
                        <Typography component="span" sx={{ display: { xs: 'inline', sm: 'none' }, mr: 0.5, fontSize: '0.75rem', color: 'text.secondary' }}>Duration:</Typography>
                        <Typography variant="body2" component="span" color="textSecondary" noWrap title={formattedDuration ?? ''}>
                            {formattedDuration ?? 'N/A'}
                        </Typography>
                    </Grid>
                </Grid>
            </ListItem>
            {!isLastItem && <Divider component="li" variant="inset" sx={{ ml: { xs: 0, sm: 'calc(1/12 * 100% + 16px)' } }} />} {/* Adjusted inset */}
        </>
    );
});

IncidentListItem.displayName = 'IncidentListItem';

export default IncidentListItem;