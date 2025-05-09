import { memo } from 'react';
import {
    Paper, Box, Typography, Stack, FormControl, InputLabel, Select, MenuItem,
    List, Tooltip, ButtonBase, SelectChangeEvent, alpha, useTheme, ListItem
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
    ListAlt as ListAltIcon, InfoOutlined as InfoOutlinedIcon,
    CheckCircleOutline as CheckIcon, CalendarToday as CalendarTodayIcon, Code as CodeIcon,
    Timer as TimerIcon, ArrowUpward as ArrowUpwardIcon, ArrowDownward as ArrowDownwardIcon,
     SwapVert as SwapVertIcon
} from '@mui/icons-material';
import { MonitoringResult } from '../../types';
import CheckListItem from './CheckListItem';

type SortableColumn = 'isAvailable' | 'checkedAt' | 'statusCode' | 'responseTime';
type SortDirection = 'asc' | 'desc';

interface RecentChecksListProps {
    recentChecks: MonitoringResult[];
    checkLimit: number;
    sortBy: SortableColumn;
    sortDir: SortDirection;
    isLoading: boolean;
    onCheckLimitChange: (event: SelectChangeEvent<number | string>) => void;
    onSort: (column: SortableColumn) => void;
}

/**
 * Renders the appropriate sort icon based on current sort state.
 */
const renderSortIcon = (column: SortableColumn, sortBy: SortableColumn, sortDir: SortDirection) => {
    const isActive = sortBy === column;
    const IconComponent = isActive ? (sortDir === 'asc' ? ArrowUpwardIcon : ArrowDownwardIcon) : SwapVertIcon;
    const color = isActive ? 'text.primary' : 'text.disabled';
    const opacity = isActive ? 1 : 0.5;
    return <IconComponent fontSize="inherit" sx={{ ml: 0.5, color, opacity, verticalAlign: 'middle' }} />;
};

/**
 * Displays a list of recent monitoring checks with sorting and filtering options.
 */
const RecentChecksList = memo(({
    recentChecks,
    checkLimit,
    sortBy,
    sortDir,
    isLoading,
    onCheckLimitChange,
    onSort,
}: RecentChecksListProps) => {
    const theme = useTheme();
    return (
        <Paper sx={{ p: 2, overflow: 'hidden' }}>
            {}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', mb: 2, gap: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <ListAltIcon sx={{ color: 'text.secondary' }} />
                    <Typography variant="h6" component="h2">Recent Checks</Typography>
                </Stack>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel id="check-limit-label">Show Checks</InputLabel>
                    <Select
                        labelId="check-limit-label"
                        id="check-limit-select"
                        value={checkLimit}
                        label="Show Checks"
                        onChange={onCheckLimitChange}
                        disabled={isLoading}
                    >
                        <MenuItem value={10}>Last 10</MenuItem>
                        <MenuItem value={25}>Last 25</MenuItem>
                        <MenuItem value={50}>Last 50</MenuItem>
                        <MenuItem value={100}>Last 100</MenuItem>
                    </Select>
                </FormControl>
            </Box>
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
                        <ButtonBase onClick={() => onSort('isAvailable')} sx={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', borderRadius: 1, p: 0.5, '&:hover': { bgcolor: alpha(theme.palette.action.selected, 0.08)} }} aria-label="Sort by Status">
                            <CheckIcon fontSize="small" sx={{ color: 'text.secondary' }} />{renderSortIcon('isAvailable', sortBy, sortDir)}
                        </ButtonBase>
                    </Tooltip>
                </Grid>
                {}
                <Grid size={5} >
                    <Tooltip title="Sort by Date & Time">
                        {}
                        <ButtonBase onClick={() => onSort('checkedAt')} sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', borderRadius: 1, p: 0.5, width: '100%', justifyContent: 'flex-start', '&:hover': { bgcolor: alpha(theme.palette.action.selected, 0.08) } }} aria-label="Sort by Date and Time">
                            <CalendarTodayIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5 }} /><Typography variant="caption" color="textSecondary" fontWeight="bold">Date & Time</Typography>{renderSortIcon('checkedAt', sortBy, sortDir)}
                        </ButtonBase>
                    </Tooltip>
                </Grid>
                {}
                <Grid size={3} display="flex" justifyContent="center" alignItems="center">
                    <Tooltip title="Sort by HTTP Status Code">
                        <ButtonBase onClick={() => onSort('statusCode')} sx={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', borderRadius: 1, p: 0.5, width: '100%', justifyContent: 'center', '&:hover': { bgcolor: alpha(theme.palette.action.selected, 0.08) } }} aria-label="Sort by HTTP Status Code">
                            <CodeIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5 }} /><Typography variant="caption" color="textSecondary" fontWeight="bold">HTTP Status</Typography>{renderSortIcon('statusCode', sortBy, sortDir)}
                        </ButtonBase>
                    </Tooltip>
                </Grid>
                {}
                <Grid size={3} display="flex" justifyContent="center" alignItems="center">
                    <Tooltip title="Sort by Response Time">
                        <ButtonBase onClick={() => onSort('responseTime')} sx={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', borderRadius: 1, p: 0.5, width: '100%', justifyContent: 'center', '&:hover': { bgcolor: alpha(theme.palette.action.selected, 0.08) } }} aria-label="Sort by Response Time">
                            <TimerIcon fontSize="small" sx={{ color: 'text.secondary', mr: 0.5 }} /><Typography variant="caption" color="textSecondary" fontWeight="bold">Response (ms)</Typography>{renderSortIcon('responseTime', sortBy, sortDir)}
                        </ButtonBase>
                    </Tooltip>
                </Grid>
            </Grid>
            {}
            <Box sx={{ maxHeight: { xs: 300, sm: 400 }, overflowY: 'auto' }}>
                <List dense disablePadding>
                    {recentChecks.length > 0 ? (
                        recentChecks.map((check, index) => (
                            <CheckListItem
                                key={check.id ?? `check-${index}`}
                                check={check}
                                isLastItem={index === recentChecks.length - 1}
                            />
                        ))
                    ) : (
                        <ListItem>
                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" width="100%" p={3} color="text.secondary">
                                <InfoOutlinedIcon fontSize="small" />
                                <Typography>No checks found for the selected criteria.</Typography>
                            </Stack>
                        </ListItem>
                    )}
                </List>
            </Box>
        </Paper>
    );
});
RecentChecksList.displayName = 'RecentChecksList';
export default RecentChecksList;