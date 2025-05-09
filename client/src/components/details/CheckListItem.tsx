import { memo } from 'react';
import { ListItem, Typography, Tooltip, Divider, alpha, useTheme } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { CheckCircleOutline as CheckIcon, ErrorOutline as ErrorIcon } from '@mui/icons-material';
import { MonitoringResult } from '../../types';
import { formatResponseTime } from '../../utils/statusUtils';

interface CheckListItemProps {
    check: MonitoringResult;
    isLastItem: boolean;
}

/**
 * Renders a single item in a list of monitoring checks.
 */
const CheckListItem = memo(({ check, isLastItem }: CheckListItemProps) => {
    const theme = useTheme();
    const rowSx = {
        py: 1, px: { xs: 1, sm: 2 },
        '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.04) },
        ...(!check.isAvailable && { bgcolor: alpha(theme.palette.error.light, 0.1) })
    };
    const formattedDate = check.checkedAt
        ? new Date(check.checkedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' })
        : 'N/A';
    return (
        <>
            <ListItem sx={rowSx} disableGutters> {}
                {}
                <Grid container spacing={1} alignItems="center" sx={{ width: '100%' }}>
                    {}
                    <Grid size={{ xs: 1 }} display="flex" justifyContent="center" alignItems="center"> {}
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
                    <Grid size={{ xs: 11, sm: 5 }}>
                        <Typography variant="body2" noWrap title={check.checkedAt ?? 'No timestamp'}> {}
                            {formattedDate}
                        </Typography>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }} textAlign={{ xs: 'left', sm: 'center' }}>
                        <Typography component="span" sx={{ display: { xs: 'inline', sm: 'none' }, mr: 0.5, fontSize: '0.75rem', color: 'text.secondary' }}>Status:</Typography>
                        <Typography variant="body2" component="span" color="textSecondary">
                            {check.statusCode ?? 'N/A'}
                        </Typography>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }} textAlign={{ xs: 'left', sm: 'center' }}>
                        <Typography component="span" sx={{ display: { xs: 'inline', sm: 'none' }, mr: 0.5, fontSize: '0.75rem', color: 'text.secondary' }}>Resp:</Typography>
                        <Typography variant="body2" component="span" color="textSecondary">
                            {formatResponseTime(check.responseTime)}
                        </Typography>
                    </Grid>
                </Grid>
            </ListItem>
            {}
            {!isLastItem && <Divider component="li" variant="inset" sx={{ ml: { xs: 0, sm: 'calc(1/12 * 100% + 8px)' } }} />} {}
        </>
    );
});
CheckListItem.displayName = 'CheckListItem';
export default CheckListItem;