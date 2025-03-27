import React, { useMemo } from "react";
import {
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  useTheme,
  Skeleton,
  Box,
} from "@mui/material";
import { MonitoringResult, TimeRange } from "../../types";
import { formatResponseTime } from "../../utils/statusUtils";

interface ResultsTableProps {
  results: MonitoringResult[]; // Already filtered results
  timeRange: TimeRange;
  loading?: boolean;
  limit?: number;
}

const ResultsTable: React.FC<ResultsTableProps> = ({
  results,
  timeRange, // Still need timeRange for context, even though we don't filter
  loading = false,
  limit = 10,
}) => {
  const theme = useTheme();

  // Sort results by date (newest first) and limit them
  const displayResults = useMemo(() => {
    const sorted = [...results].sort(
      (a, b) =>
        new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
    );
    return sorted.slice(0, limit);
  }, [results, limit]);

  const renderSkeletonRows = () => {
    return Array(limit)
      .fill(0)
      .map((_, index) => (
        <TableRow key={`skeleton-${index}`}>
          <TableCell>
            <Skeleton variant="text" width="100%" />
          </TableCell>
          <TableCell>
            <Skeleton variant="rounded" width={60} height={24} />
          </TableCell>
          <TableCell>
            <Skeleton variant="text" width="80%" />
          </TableCell>
          <TableCell>
            <Skeleton variant="text" width="50%" />
          </TableCell>
          <TableCell>
            <Skeleton variant="text" width="100%" />
          </TableCell>
        </TableRow>
      ));
  };

  // If no results and not loading, show empty state
  if (!loading && displayResults.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Recent Checks
        </Typography>
        <Box
          sx={{
            p: 3,
            textAlign: "center",
            color: "text.secondary",
          }}
        >
          <Typography variant="body1">
            No monitoring results available for the selected time range.
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Recent Checks
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Time</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Response Time</TableCell>
              <TableCell>Status Code</TableCell>
              <TableCell>Error</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading
              ? renderSkeletonRows()
              : displayResults.map((result) => (
                  <TableRow
                    key={result.id}
                    sx={{
                      backgroundColor: result.isAvailable
                        ? "transparent"
                        : theme.palette.error.light + "20",
                    }}
                  >
                    <TableCell>
                      {new Date(result.checkedAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "medium",
                      })}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={result.isAvailable ? "Up" : "Down"}
                        color={result.isAvailable ? "success" : "error"}
                      />
                    </TableCell>
                    <TableCell>
                      {formatResponseTime(result.responseTime)}
                    </TableCell>
                    <TableCell>{result.statusCode || "N/A"}</TableCell>
                    <TableCell
                      sx={{
                        maxWidth: 250,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {result.errorMessage || "-"}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default React.memo(ResultsTable);