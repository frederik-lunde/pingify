/* src/components/incidents/IncidentListItem.tsx */
import { memo } from 'react';
import { Link as RouterLink } from 'react-router';
import { ListItem, Typography, Tooltip, Divider, alpha, useTheme, Chip, Link} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
    ErrorOutline as ErrorIcon,
    WarningAmber as SlowIcon,
    InfoOutlined as InfoIcon,
    Link as LinkIcon,
    CheckCircle as ResolvedIcon, // Using filled variant for more emphasis
} from '@mui/icons-material';
import { Incident, IncidentType } from '../../types';
import { formatIncidentDuration } from '../../utils/statusUtils';
import { useTimeSince } from '../../hooks';

interface IncidentListItemProps {
    incident: Incident;
    isLastItem: boolean;
}

const getIncidentTypeVisuals = (type: IncidentType): { Icon: React.ElementType, color: 'error' | 'warning' } => {
    switch (type) {
        case 'down':
            return { Icon: ErrorIcon, color: 'error' };
        case 'slow':
            return { Icon: SlowIcon, color: 'warning' };
        default:
            return { Icon: InfoIcon, color: 'warning' };
    }
};

const IncidentListItem = memo(({ incident, isLastItem }: IncidentListItemProps) => {
    const theme = useTheme();
    const { Icon: TypeIcon, color: typeColor } = getIncidentTypeVisuals(incident.type);
    const isClosed = !!incident.endTime;

    // Determine the Icon and Color for the FIRST column
    const FirstColumnIcon = isClosed ? ResolvedIcon : TypeIcon;
    const firstColumnIconColor = isClosed ? 'success' : typeColor;

    // Define base row style
    const rowSx = {
        py: 1.5,
        px: { xs: 1, sm: 2 },
        '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.04) },
        // --- Add subtle opacity for closed incidents ---
        opacity: isClosed ? 0.75 : 1,
        // --- Optional: Change background slightly for closed ---
        // bgcolor: isClosed ? alpha(theme.palette.success.main, 0.05) : 'transparent',
    };

    // Format dates
    const formattedStartDate = incident.startTime
        ? new Date(incident.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
        : 'N/A';
    // --- Use a more distinct label for the end time column when closed ---
    const formattedEndDate = incident.endTime
        ? new Date(incident.endTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
        : 'Open'; // Keep 'Open' for status text

    const timeSinceStart = useTimeSince(incident.startTime, { addSuffix: true, noIncidentText: '' });
    const formattedDuration = formatIncidentDuration(incident);

    const websiteName = incident.website?.name || incident.website?.url || `Website ID: ${incident.websiteId}`;
    const websiteUrl = incident.website?.url || '#';
    const websiteDetailUrl = `/website/${incident.websiteId}`;

    return (
        <>
            <ListItem sx={rowSx} disableGutters>
                <Grid container spacing={1} alignItems="center" sx={{ width: '100%' }}>
                    {/* FIRST Column Icon (Status/Type) */}
                    <Grid size={{ xs: 2, sm: 1 }} display="flex" justifyContent="center" alignItems="center">
                        <Tooltip title={isClosed ? 'Incident Resolved' : (incident.type === 'down' ? 'Downtime Incident (Open)' : 'Performance Incident (Open)')}>
                            <FirstColumnIcon color={firstColumnIconColor} fontSize="medium" />
                        </Tooltip>
                    </Grid>

                     {/* Type Chip */}
                     <Grid size={{ xs: 10, sm: 2 }} sx={{ overflow: 'hidden' }}>
                         <Chip
                             label={incident.type.charAt(0).toUpperCase() + incident.type.slice(1)}
                             size="small"
                             color={typeColor} // Always uses type color
                             variant="outlined"
                             sx={{ fontWeight: 500 }}
                         />
                    </Grid>

                    {/* Website Name/Link */}
                    <Grid size={{ xs: 12, sm: 3 }} sx={{ pl: { xs: 'calc(2/12 * 100% + 8px)', sm: 0 }, overflow: 'hidden' }}>
                        <Tooltip title={`Go to details for ${websiteName}`}>
                            <Link
                                component={RouterLink}
                                to={websiteDetailUrl}
                                variant="body2"
                                underline="hover"
                                noWrap
                                sx={{ display: 'inline-flex', alignItems: 'center' }}
                            >
                                <Typography variant="inherit" noWrap sx={{ mr: 0.5 }}>{websiteName}</Typography>
                                <LinkIcon sx={{ fontSize: '0.9rem', color: 'action.active', opacity: 0.7 }} />
                            </Link>
                        </Tooltip>
                         <Typography variant="caption" display="block" color="text.secondary" noWrap title={websiteUrl}>
                            {websiteUrl}
                        </Typography>
                    </Grid>

                    {/* Start Time */}
                     <Grid size={{ xs: 6, sm: 2 }} textAlign="left">
                        <Tooltip title={`Started ${timeSinceStart || incident.startTime}`}>
                            <Typography variant="body2" noWrap>
                                {formattedStartDate}
                            </Typography>
                        </Tooltip>
                    </Grid>

                    {/* End Time / Status Text */}
                     <Grid size={{ xs: 6, sm: 2 }} textAlign="left">
                         {/* Display End Time or "Open" status */}
                         <Typography
                             variant="body2"
                             component="span"
                             // --- Make 'Open' text more prominent, End time less so ---
                             color={isClosed ? 'text.secondary' : 'text.primary'}
                             fontWeight={isClosed ? 'normal' : 500} // Optionally make 'Open' bold
                             noWrap
                         >
                            {formattedEndDate}
                        </Typography>
                    </Grid>

                    {/* Duration */}
                    <Grid size={{ xs: 12, sm: 2 }} textAlign="left" sx={{ pl: { xs: 'calc(2/12 * 100% + 8px)', sm: 0 }}}>
                        <Typography variant="body2" component="span" color="textSecondary" noWrap title={formattedDuration ?? ''}>
                            {formattedDuration ?? (isClosed ? 'N/A' : '-')}
                        </Typography>
                    </Grid>
                </Grid>
            </ListItem>
            {/* --- Apply similar opacity to the divider --- */}
            {!isLastItem && <Divider component="li" variant="inset" sx={{ ml: { xs: 0, sm: 'calc(1/12 * 100% + 16px)' }, opacity: isClosed ? 0.5 : 1 }} />}
        </>
    );
});

IncidentListItem.displayName = 'IncidentListItem';

export default IncidentListItem;