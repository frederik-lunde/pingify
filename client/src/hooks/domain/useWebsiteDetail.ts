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

// Interface remains the same
export interface WebsiteDetailData {
  userWebsite: UserWebsite | null;
  results: MonitoringResult[];
  allResults: MonitoringResult[];
  latestResult: MonitoringResult | null;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
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

export function useWebsiteDetail(
  websiteId: number,
  initialTimeRange: TimeRange = "7d",
  resultsLimit = 500, // IMPORTANT: This limit now defines the max history available for immediate filtering
  pollingInterval = DEFAULT_POLLING_INTERVAL,
): WebsiteDetailData {
  const [timeRange, setTimeRangeInternal] =
    useState<TimeRange>(initialTimeRange);
  const [isCheckingManually, setIsCheckingManually] = useState(false);

  // dateRange is still useful for the filterResultsByTimeRange utility
  const dateRange = useMemo(
    () => getDateRangeFromTimeRange(timeRange),
    [timeRange],
  );

  const {
    data: userWebsite,
    loading: websiteLoading,
    error: websiteError,
    refetch: refetchWebsite,
    stopPolling: stopWebsitePolling,
    startPolling: startWebsitePolling,
  } = useWebsite(websiteId, pollingInterval);

  // *** MODIFICATION HERE ***
  // Fetch results without a 'from' date initially.
  // Relies on the API returning the most recent 'resultsLimit' items.
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
      limit: resultsLimit, // Fetch up to the limit of the most recent results
      // from: timeRange !== "all" ? dateRange.from : undefined, // REMOVED THIS LINE
    },
    pollingInterval,
  );
  // **************************

  // Filter results locally by time range - This now filters the broader dataset immediately
  const results = useMemo(() => {
    if (!allResults || allResults.length === 0) return [];
    // filterResultsByTimeRange now works on the 'allResults' (up to limit)
    // based on the *currently selected* timeRange
    return filterResultsByTimeRange(allResults, timeRange);
  }, [allResults, timeRange]); // Re-filters immediately when allResults OR timeRange changes

  const { checkWebsite, loading: checkLoading } = useWebsiteCheck();

  const isLoading = websiteLoading || resultsLoading;
  const error = websiteError || resultsError;

  // Derivations (latestResult, currentStatus, statusColor, uptime, avgResponseTime)
  // remain largely the same, but are now based on the immediately filtered 'results'
  // or the broader 'allResults'.

  // latestResult: find latest within the *currently filtered* results first
  const latestResult = useMemo(() => {
    if (results && results.length > 0) {
      // Sort filtered results (most recent first)
      return [...results].sort(
        (a, b) =>
          new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime(),
      )[0];
    }
    // Fallback: If no results in current filter, find the absolute latest from all fetched
    if (allResults && allResults.length > 0) {
      return [...allResults].sort(
        (a, b) =>
          new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime(),
      )[0];
    }
    return null;
  }, [results, allResults]);

  // currentStatus & statusColor: Should reflect the *absolute* latest check, regardless of filter
  const absoluteLatest = useMemo(() => {
    if (!allResults || allResults.length === 0) return null;
    return [...allResults].sort(
      (a, b) =>
        new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime(),
    )[0];
  }, [allResults]);

  const currentStatus = useMemo(() => {
    if (!absoluteLatest) return "Unknown";
    return absoluteLatest.isAvailable ? "Online" : "Offline";
  }, [absoluteLatest]);

  const statusColor = useMemo((): "success" | "error" | "info" => {
    if (!absoluteLatest) return "info";
    return absoluteLatest.isAvailable ? "success" : "error";
  }, [absoluteLatest]);

  // Uptime and Avg Response Time: Calculated based on the *filtered* results
  const uptime = useMemo(() => {
    if (!results || results.length === 0) return 100;
    const available = results.filter((r) => r.isAvailable).length;
    return (available / results.length) * 100; // Avoid division by zero
  }, [results]);

  const avgResponseTime = useMemo(() => {
    if (!results || results.length === 0) return 0;
    const validTimes = results
      .filter(
        (r) =>
          r.isAvailable &&
          r.responseTime !== null &&
          r.responseTime !== undefined,
      )
      .map((r) => r.responseTime!);
    if (validTimes.length === 0) return 0;
    const sum = validTimes.reduce((acc, time) => acc + time, 0);
    return sum / validTimes.length;
  }, [results]);

  // Actions (handleCheckNow, refetchAll, stop/startPolling) remain the same
  const handleCheckNow = useCallback(async (): Promise<void> => {
    if (isCheckingManually || !websiteId) return;
    try {
      setIsCheckingManually(true);
      await checkWebsite(websiteId);
      await refetchResults(); // Refetch results immediately after manual check
    } catch (err) {
      console.error("Error triggering check:", err);
    } finally {
      setIsCheckingManually(false);
    }
  }, [websiteId, checkWebsite, refetchResults, isCheckingManually]);

  const refetchAll = useCallback(async () => {
    await Promise.all([refetchWebsite(), refetchResults()]);
  }, [refetchResults, refetchWebsite]);

  const stopPolling = useCallback(() => {
    stopResultsPolling();
    stopWebsitePolling();
  }, [stopResultsPolling, stopWebsitePolling]);

  const startPolling = useCallback(() => {
    startResultsPolling();
    startWebsitePolling();
  }, [startResultsPolling, startWebsitePolling]);

  // setTimeRange implementation remains the same - it just updates state
  const setTimeRange = useCallback((newRange: TimeRange) => {
    setTimeRangeInternal(newRange);
  }, []);

  return {
    userWebsite,
    results, // Instantly filtered results
    allResults: allResults ?? [], // Ensure array type
    latestResult,
    timeRange,
    setTimeRange,
    currentStatus,
    statusColor,
    uptime, // Based on filtered results
    avgResponseTime, // Based on filtered results
    loading: isLoading,
    isChecking: isCheckingManually || checkLoading,
    error,
    handleCheckNow,
    refetch: refetchAll,
    stopPolling,
    startPolling,
  };
}

export default useWebsiteDetail;
