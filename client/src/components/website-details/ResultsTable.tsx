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
import { MonitoringResult } from "../../types";
import { formatResponseTime } from "../../utils/statusUtils";

interface ResultsTableProps {
  results: MonitoringResult[];
  loading?: boolean;
  limit?: number;
}

const ResultsTable: React.FC<ResultsTableProps> = ({
  results,
  loading = false,
  limit = 10,
}) => {
  const theme = useTheme();

  // Memoize the results to avoid unnecessary re-renders
  const displayResults = useMemo(() => {
    return results
      .slice(0, limit)
      .sort(
        (a, b) =>
          new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime(),
      );
  }, [results, limit]);

  // Create loading skeletons for the table
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
            No monitoring results available yet.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Results will appear here after the first check.
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
