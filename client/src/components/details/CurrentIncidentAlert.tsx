// src/components/details/CurrentIncidentAlert.tsx
import React from 'react';
import { Alert, AlertTitle, Stack, Tooltip, Typography, Box } from '@mui/material';
import { ErrorOutline as ErrorIcon, WarningAmber as SlowIcon } from '@mui/icons-material';
import { Incident, IncidentType } from '../../types'; // Adjust path
import { formatIncidentDuration } from '../../utils/statusUtils'; // Adjust path
import { useTimeSince } from '../../hooks'; // Adjust path

// Helper moved inside or kept separate if used elsewhere
const getIncidentAlertProps = (type: IncidentType): { severity: 'error' | 'warning', icon: React.ReactNode, title: string } => {
    switch (type) {
        case 'down': return { severity: 'error', icon: <ErrorIcon fontSize="inherit" />, title: "Website is Currently Down" };
        case 'slow': return { severity: 'warning', icon: <SlowIcon fontSize="inherit" />, title: "Website Performance Degradation" };
        default: return { severity: 'warning', icon: <SlowIcon fontSize="inherit" />, title: "Active Incident" };
    }
};

interface WebsiteCurrentIncidentAlertProps {
    incident: Incident | null;
}

const WebsiteCurrentIncidentAlert: React.FC<WebsiteCurrentIncidentAlertProps> = ({ incident }) => {
    // Calculate derived data inside this component
    const duration = formatIncidentDuration(incident);
    const startTimeRelative = useTimeSince(incident?.startTime, { addSuffix: false });

    if (!incident) {
        return null; // Render nothing if there's no current incident
    }

    const alertProps = getIncidentAlertProps(incident.type);

    return (
        <Alert
            severity={alertProps.severity}
            icon={alertProps.icon}
            variant="filled"
            sx={{ mb: 3 }}
        >
            <AlertTitle>{alertProps.title}</AlertTitle>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 2 }} alignItems={{ sm: 'center' }}>
                <Typography variant="body2">
                    Incident started: <Tooltip title={new Date(incident.startTime).toLocaleString()}><Box component="span" sx={{ fontWeight: 'medium' }}>{startTimeRelative} ago</Box></Tooltip>
                </Typography>
                {duration && (
                    <Typography variant="body2">
                        Duration so far: <Box component="span" sx={{ fontWeight: 'medium' }}>{duration.replace('since ', '').replace(' ago', '')}</Box>
                    </Typography>
                )}
            </Stack>
        </Alert>
    );
};

export default WebsiteCurrentIncidentAlert;