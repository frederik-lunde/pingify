// src/components/website-details/TimeRangeSelector.tsx
import React from "react";
import {
  ToggleButtonGroup,
  ToggleButton,
  Box,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Today as TodayIcon,
  DateRange as WeekIcon,
  CalendarMonth as MonthIcon,
  CalendarViewDay as YearIcon,
  AllInclusive as AllTimeIcon,
} from "@mui/icons-material";

// Define time range options
export type TimeRange = "1d" | "7d" | "30d" | "365d" | "all";

// TimeRangeSelector Props
export interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
  label?: string;
  availableRanges?: TimeRange[]; // New prop to restrict available options
}

// Time range button configuration
const timeRangeButtons: Array<{
  value: TimeRange;
  label: string;
  tooltip: string;
  icon: React.ReactNode;
  ariaLabel: string;
}> = [
  {
    value: "1d",
    label: "Day",
    tooltip: "Last 24 hours",
    icon: <TodayIcon fontSize="small" />,
    ariaLabel: "Last 24 hours",
  },
  {
    value: "7d",
    label: "Week",
    tooltip: "Last 7 days",
    icon: <WeekIcon fontSize="small" />,
    ariaLabel: "Last 7 days",
  },
  {
    value: "30d",
    label: "Month",
    tooltip: "Last 30 days",
    icon: <MonthIcon fontSize="small" />,
    ariaLabel: "Last 30 days",
  },
  {
    value: "365d",
    label: "Year",
    tooltip: "Last 365 days",
    icon: <YearIcon fontSize="small" />,
    ariaLabel: "Last 365 days",
  },
  {
    value: "all",
    label: "All",
    tooltip: "All time",
    icon: <AllTimeIcon fontSize="small" />,
    ariaLabel: "All time",
  },
];

/**
 * Time range selector component for filtering data by time period
 */
const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  value,
  onChange,
  label = "Time Range:",
  availableRanges = ["1d", "7d", "30d", "365d", "all"], // Default to all ranges
}) => {
  // Handle change events
  const handleChange = (
    _event: React.MouseEvent<HTMLElement>,
    newValue: TimeRange | null,
  ) => {
    // Don't allow deselecting a value (if null, keep current value)
    if (newValue !== null) {
      onChange(newValue);
    }
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
      {label && (
        <Typography
          variant="body2"
          color="textSecondary"
          sx={{ mr: 2, minWidth: "80px" }}
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
          ".MuiToggleButtonGroup-grouped": {
            border: 1,
            borderColor: "divider",
          },
        }}
      >
        {timeRangeButtons
          .filter((btn) => availableRanges.includes(btn.value)) // Only show available options
          .map((btn) => (
            <Tooltip key={btn.value} title={btn.tooltip}>
              <ToggleButton value={btn.value} aria-label={btn.ariaLabel}>
                {btn.icon}
                <Typography
                  sx={{ ml: 0.5, display: { xs: "none", sm: "block" } }}
                >
                  {btn.label}
                </Typography>
              </ToggleButton>
            </Tooltip>
          ))}
      </ToggleButtonGroup>
    </Box>
  );
};

export default React.memo(TimeRangeSelector);
