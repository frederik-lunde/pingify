// src/hooks/domain/useWebsiteDetail.ts
import { useState, useCallback, useMemo } from "react";
import { useWebsiteResults } from "../api/useMonitoring";
import { useWebsite } from "../api/useWebsites";
import { useWebsiteCheck } from "../api/useMonitoring";
import { DEFAULT_POLLING_INTERVAL } from "../../api/config";
import { TimeRange, UserWebsite, MonitoringResult } from "../../types";
import {
  getDateRangeFromTimeRange,
  filterResultsByTimeRange,
} from "../../utils/charts/common";
// Define the return type for the hook explicitly using types from types.ts
export interface WebsiteDetailData {
  userWebsite: UserWebsite | null;
  results: MonitoringResult[]; // Already filtered by timeRange
  allResults: MonitoringResult[]; // Raw results from API for the period
  latestResult: MonitoringResult | null;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void; // Callback to change time range
  currentStatus: string;
  statusColor: "success" | "error" | "info";
  uptime: number;
  avgResponseTime: number;
  loading: boolean;
  isChecking: boolean;
  error: Error | null;
  handleCheckNow: () => Promise<void>;
  refetch: () => Promise<void>;
  stopPolling: () => void;
  startPolling: () => void;
}

/**
* Hook that combines data for a website detail view with time range support
*/
export function useWebsiteDetail(
websiteId: number,
initialTimeRange: TimeRange = "7d",
resultsLimit = 500,
pollingInterval = DEFAULT_POLLING_INTERVAL,
): WebsiteDetailData { // Use the defined return type
// State for selected time range
const [timeRange, setTimeRangeInternal] = useState<TimeRange>(initialTimeRange);

// Track manual check status
const [isCheckingManually, setIsCheckingManually] = useState(false);

// Calculate date range based on selected time range
const dateRange = useMemo(
  () => getDateRangeFromTimeRange(timeRange),
  [timeRange],
);

// Get website details with the API hook
const {
  data: userWebsite,
  loading: websiteLoading,
  error: websiteError,
  refetch: refetchWebsite,
  stopPolling: stopWebsitePolling,
  startPolling: startWebsitePolling,
} = useWebsite(websiteId, pollingInterval);

// Get results with the API hook, using date range filter if not 'all' time
// Fetch a broader range initially to allow local filtering
const {
  data: allResults = [],
  loading: resultsLoading,
  error: resultsError,
  refetch: refetchResults,
  stopPolling: stopResultsPolling,
  startPolling: startResultsPolling,
} = useWebsiteResults(
  websiteId,
  {
    limit: resultsLimit, // Fetch a larger dataset
    // Consider fetching based on the *widest* possible range initially,
    // or adjust fetching strategy if needed for performance.
    // For now, fetch up to the limit, potentially from 'all' time if efficient.
    // Let's keep the logic to fetch from `dateRange.from` if not 'all' for now.
    from: timeRange !== "all" ? dateRange.from : undefined,
  },
  pollingInterval,
);

// Filter results locally by time range - THIS IS THE IMMEDIATE UPDATE
const results = useMemo(() => {
  if (!allResults || allResults.length === 0) return [];
  // Ensure filtering happens correctly based on the current timeRange state
  return filterResultsByTimeRange(allResults, timeRange);
}, [allResults, timeRange]); // Re-filters when timeRange changes

// Get manual check capability
const { checkWebsite, loading: checkLoading } = useWebsiteCheck();

// Compute if we're in any loading state
const isLoading = websiteLoading || resultsLoading;

// Compute overall error (if any)
const error = websiteError || resultsError;

// Derive latest result state (based on currently filtered results)
const latestResult = useMemo(() => {
  // Find the latest within the *filtered* results
  if (!results || results.length === 0) {
      // If filtered results are empty, try finding the latest in allResults
      const sortedAll = [...(allResults || [])].sort(
        (a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime(),
      );
      return sortedAll.length > 0 ? sortedAll[0] : null;
  }
  // Already sorted by filterResultsByTimeRange is not guaranteed, sort again
   const sortedResults = [...results].sort(
     (a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime(),
   );
   return sortedResults.length > 0 ? sortedResults[0] : null;

}, [results, allResults]); // Depends on filtered results AND allResults for fallback

// Derive current status based on the absolute latest result
const currentStatus = useMemo(() => {
   // Find the absolute latest result from all fetched data
   const absoluteLatest = allResults && allResults.length > 0
      ? [...allResults].sort(
          (a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime(),
        )[0]
      : null;
  if (!absoluteLatest) return "Unknown";
  return absoluteLatest.isAvailable ? "Online" : "Offline";
}, [allResults]); // Based on all results

// Determine status color for UI based on the absolute latest result
const statusColor = useMemo((): "success" | "error" | "info" => {
   const absoluteLatest = allResults && allResults.length > 0
      ? [...allResults].sort(
          (a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime(),
        )[0]
      : null;
  if (!absoluteLatest) return "info";
  return absoluteLatest.isAvailable ? "success" : "error";
}, [allResults]); // Based on all results

// Handle manual check button click
const handleCheckNow = useCallback(async (): Promise<void> => {
  if (isCheckingManually || !websiteId) return;

  try {
    setIsCheckingManually(true);
    await checkWebsite(websiteId);
    // Immediately refetch results to show the new check
    await refetchResults();
  } catch (err) {
    console.error("Error triggering check:", err);
  } finally {
    setIsCheckingManually(false);
  }
}, [websiteId, checkWebsite, refetchResults, isCheckingManually]);

// Combined refetch function
const refetchAll = useCallback(async () => {
  // Refetch website details AND results
  await Promise.all([refetchWebsite(), refetchResults()]);
}, [refetchResults, refetchWebsite]);

// Stop all polling
const stopPolling = useCallback(() => {
  stopResultsPolling();
  stopWebsitePolling();
}, [stopResultsPolling, stopWebsitePolling]);

// Start all polling
const startPolling = useCallback(() => {
  startResultsPolling();
  startWebsitePolling();
}, [startResultsPolling, startWebsitePolling]);

// Calculate uptime percentage based on *filtered* results
const uptime = useMemo(() => {
  if (!results || results.length === 0) return 100; // Assume 100% if no data in range
  const available = results.filter((r) => r.isAvailable).length;
  return results.length > 0 ? (available / results.length) * 100 : 100;
}, [results]);

// Calculate average response time based on *filtered* results
const avgResponseTime = useMemo(() => {
  if (!results || results.length === 0) return 0;
  const validTimes = results
    .filter((r) => r.responseTime !== null && r.responseTime !== undefined && r.isAvailable) // Only consider available checks for avg response time
    .map((r) => r.responseTime!);

  if (validTimes.length === 0) return 0;

  const sum = validTimes.reduce((acc, time) => acc + time, 0);
  return sum / validTimes.length;
}, [results]);

// Wrapper for setTimeRange to potentially add side effects later if needed
const setTimeRange = useCallback((newRange: TimeRange) => {
    setTimeRangeInternal(newRange);
    // Future: Could trigger specific API refetch here if local filtering isn't sufficient
    // e.g., if newRange === 'all' and we previously fetched only '7d' data.
    // For now, relies on the existing `useMemo` for `results`.
}, []);


return {
  // Basic data
  userWebsite,
  results, // Filtered results
  allResults: allResults ?? [], // Ensure it's always an array
  latestResult, // Latest result within the filtered range (or overall if empty)

  // Time range controls
  timeRange,
  setTimeRange, // Expose the setter

  // Status information (currentStatus based on absolute latest)
  currentStatus,
  statusColor,
  // Stats based on filtered results
  uptime,
  avgResponseTime,

  // Loading and error states
  loading: isLoading,
  isChecking: isCheckingManually || checkLoading,
  error,

  // Actions
  handleCheckNow,
  refetch: refetchAll,
  stopPolling,
  startPolling,
};
}

export default useWebsiteDetail;