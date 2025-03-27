// src/components/website-details/TimeRangeSelector.tsx
import React from 'react';
import { 
  ToggleButtonGroup, 
  ToggleButton, 
  Box, 
  Tooltip, 
  Typography 
} from '@mui/material';
import { 
  Today as TodayIcon,
  DateRange as WeekIcon,
  CalendarMonth as MonthIcon,
  CalendarViewDay as YearIcon,
  AllInclusive as AllTimeIcon
} from '@mui/icons-material';

// Define time range options
export type TimeRange = '1d' | '7d' | '30d' | '365d' | 'all';

// TimeRangeSelector Props
export interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
  label?: string;
}

/**
 * Time range selector component for filtering data by time period
 */
const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  value,
  onChange,
  label = "Time Range:"
}) => {
  // Handle change events
  const handleChange = (_event: React.MouseEvent<HTMLElement>, newValue: TimeRange | null) => {
    // Don't allow deselecting a value (if null, keep current value)
    if (newValue !== null) {
      onChange(newValue);
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
      {label && (
        <Typography 
          variant="body2" 
          color="textSecondary" 
          sx={{ mr: 2, minWidth: '80px' }}
        >
          {label}
        </Typography>
      )}
      
      <ToggleButtonGroup
        value={value}
        exclusive
        onChange={handleChange}
        aria-label="Time range selector"
        size="small"
        sx={{
          '.MuiToggleButtonGroup-grouped': {
            border: 1,
            borderColor: 'divider',
          },
        }}
      >
        <Tooltip title="Last 24 hours">
          <ToggleButton value="1d" aria-label="Last 24 hours">
            <TodayIcon fontSize="small" />
            <Typography sx={{ ml: 0.5, display: { xs: 'none', sm: 'block' } }}>
              Day
            </Typography>
          </ToggleButton>
        </Tooltip>
        
        <Tooltip title="Last 7 days">
          <ToggleButton value="7d" aria-label="Last 7 days">
            <WeekIcon fontSize="small" />
            <Typography sx={{ ml: 0.5, display: { xs: 'none', sm: 'block' } }}>
              Week
            </Typography>
          </ToggleButton>
        </Tooltip>
        
        <Tooltip title="Last 30 days">
          <ToggleButton value="30d" aria-label="Last 30 days">
            <MonthIcon fontSize="small" />
            <Typography sx={{ ml: 0.5, display: { xs: 'none', sm: 'block' } }}>
              Month
            </Typography>
          </ToggleButton>
        </Tooltip>
        
        <Tooltip title="Last 365 days">
          <ToggleButton value="365d" aria-label="Last 365 days">
            <YearIcon fontSize="small" />
            <Typography sx={{ ml: 0.5, display: { xs: 'none', sm: 'block' } }}>
              Year
            </Typography>
          </ToggleButton>
        </Tooltip>
        
        <Tooltip title="All time">
          <ToggleButton value="all" aria-label="All time">
            <AllTimeIcon fontSize="small" />
            <Typography sx={{ ml: 0.5, display: { xs: 'none', sm: 'block' } }}>
              All
            </Typography>
          </ToggleButton>
        </Tooltip>
      </ToggleButtonGroup>
    </Box>
  );
};

export default React.memo(TimeRangeSelector);