// src/components/details/CheckListItem.tsx
import React from 'react';
import { ListItem, Grid, Typography, Tooltip, Divider, alpha, useTheme } from '@mui/material';
import { CheckCircleOutline as CheckIcon, ErrorOutline as ErrorIcon } from '@mui/icons-material';
import { MonitoringResult } from '../../types'; // Adjust path
import { formatResponseTime } from '../../utils/statusUtils'; // Adjust path

interface CheckListItemProps {
    check: MonitoringResult;
    isLastItem: boolean; // To control the divider
}

// Memoize the list item component
const CheckListItem = React.memo(({ check, isLastItem }: CheckListItemProps) => {
    const theme = useTheme();
    const rowSx = {
        py: 1, px: { xs: 1, sm: 2 },
        '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.04) },
        ...(!check.isAvailable && { bgcolor: alpha(theme.palette.error.light, 0.15) })
    };
    const checkDate = check.checkedAt ? new Date(check.checkedAt) : null;

    return (
        <>
            <ListItem sx={rowSx}>
                <Grid container spacing={1} alignItems="center">
                    <Grid item xs={1} sm={1} sx={{ textAlign: 'center' }}>
                        {check.isAvailable ? (
                            <Tooltip title="Up">
                                <CheckIcon color="success" fontSize="small" />
                            </Tooltip>
                        ) : (
                            <Tooltip title="Down">
                                <ErrorIcon color="error" fontSize="small" />
                            </Tooltip>
                        )}
                    </Grid>
                    <Grid item xs={11} sm={5}>
                        <Typography variant="body2" noWrap title={checkDate?.toISOString()}>
                            {checkDate?.toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' }) ?? 'N/A'}
                        </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3} sx={{ textAlign: { xs: 'left', sm: 'center' } }}>
                        <Typography component="span" sx={{ display: { xs: 'inline', sm: 'none' }, mr: 0.5, fontSize: '0.75rem', color: 'text.secondary' }}>Status:</Typography>
                        <Typography variant="body2" component="span" color="textSecondary">
                            {check.statusCode ?? 'N/A'}
                        </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3} sx={{ textAlign: { xs: 'left', sm: 'center' } }}>
                        <Typography component="span" sx={{ display: { xs: 'inline', sm: 'none' }, mr: 0.5, fontSize: '0.75rem', color: 'text.secondary' }}>Resp:</Typography>
                        <Typography variant="body2" component="span" color="textSecondary">
                            {formatResponseTime(check.responseTime)}
                        </Typography>
                    </Grid>
                </Grid>
            </ListItem>
            {!isLastItem && <Divider component="li" variant="inset" sx={{ ml: { xs: 0, sm: '72px' } }} />}
        </>
    );
});

CheckListItem.displayName = 'CheckListItem'; // Good practice for DevTools

export default CheckListItem;