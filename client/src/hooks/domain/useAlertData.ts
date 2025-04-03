// src/hooks/domain/useAlertData.ts
import { useMemo, useCallback } from "react";
import {
    useUserAlertsQuery,
    useUserUnreadAlertsQuery,
    useAlertStatsQuery,
    useAlertReadMutations
} from "../api/useAlerts"; // Use the refactored API hooks
import { useUserWebsitesQuery } from "../api/useWebsites"; // Use the refactored API hook
import { Alert, AlertUser, AlertStats, ApiError, } from "../../types"; // Adjust path

export interface AlertSummary {
  stats: AlertStats | null;
  allAlerts: Alert[];
  unresolvedAlerts: Alert[];
  resolvedAlerts: Alert[];
  unreadAlerts: AlertUser[];
  websiteAlertCounts: Map<number, number>;
  isLoading: boolean; // Changed from 'loading'
  error: ApiError | null;
  markAsRead: (alertId: number) => void;
  markAllAsRead: () => void;
  refetch: () => Promise<any>;
  isMarkingRead: boolean;
}

/**
 * Hook to provide comprehensive alert data using TanStack Query hooks.
 */
export function useAlertData(
  days = 7,
  limit = 50,
  refetchInterval?: number | false,
): AlertSummary {

  // Query Options
  const listQueryOptions = useMemo(() => ({ limit }), [limit]);
  const unreadQueryOptions = useMemo(() => ({ limit, isResolved: false }), [limit]); // Ensure we only fetch unresolved for unread count typically
  const statsQueryOptions = useMemo(() => ({ days }), [days]);
  const queryConfig = useMemo(() => ({ refetchInterval }), [refetchInterval]);

  // Fetch Data using TanStack Query Hooks
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useAlertStatsQuery(statsQueryOptions.days, queryConfig);

  const {
    data: allAlerts = [],
    isLoading: allAlertsLoading,
    error: allAlertsError,
    refetch: refetchAllAlerts,
  } = useUserAlertsQuery(listQueryOptions, queryConfig);

  const {
    data: unreadAlerts = [],
    isLoading: unreadLoading,
    error: unreadError,
    refetch: refetchUnread,
  } = useUserUnreadAlertsQuery(unreadQueryOptions, queryConfig);

  // Fetch websites for context (needed for websiteAlertCounts map)
  const {
    data: userWebsites = [],
    isLoading: websitesLoading,
    error: websitesError,
    refetch: refetchWebsites,
  } = useUserWebsitesQuery(); // No interval needed here, fetched once or on invalidation

  // Use Mutation Hook
  const {
      markAsRead,
      markAllAsRead,
      isMarkingOne,
      isMarkingAll,
      errorMarkingOne,
      errorMarkingAll,
  } = useAlertReadMutations();

  // Derived Data Calculations
  const { unresolvedAlerts, resolvedAlerts } = useMemo(() => {
    return {
      unresolvedAlerts: allAlerts.filter((alert) => !alert.isResolved),
      resolvedAlerts: allAlerts.filter((alert) => alert.isResolved),
    };
  }, [allAlerts]);

  const websiteAlertCounts = useMemo(() => {
    const counts = new Map<number, number>();
    // Initialize counts for all user websites
    userWebsites.forEach((website) => {
      counts.set(website.websiteId, 0);
    });
    // Count unresolved alerts per website
    unresolvedAlerts.forEach((alert) => {
       if (alert.websiteId) { // Check if websiteId exists
        counts.set(alert.websiteId, (counts.get(alert.websiteId) || 0) + 1);
       }
    });
    return counts;
  }, [userWebsites, unresolvedAlerts]);

  // Consolidate Loading and Error States
  const isLoading = statsLoading || allAlertsLoading || unreadLoading || websitesLoading;
  const error = statsError || allAlertsError || unreadError || websitesError || errorMarkingOne || errorMarkingAll || null;

  // Refetch Function
  const refetch = useCallback(async () => {
    // Refetch all relevant queries concurrently
    await Promise.all([
        refetchStats(),
        refetchAllAlerts(),
        refetchUnread(),
        // refetchWebsites(), // Only refetch websites if absolutely necessary
    ]);
  }, [refetchStats, refetchAllAlerts, refetchUnread/*, refetchWebsites*/]);

  // Return Value
  return {
    stats: stats || null,
    allAlerts,
    unresolvedAlerts,
    resolvedAlerts,
    unreadAlerts, // Use the directly fetched unreadAlerts
    websiteAlertCounts,
    isLoading, // Use TanStack Query's isLoading
    error,
    markAsRead,
    markAllAsRead,
    refetch,
    isMarkingRead: isMarkingOne || isMarkingAll,
  };
}

// Default export might not be needed if always used as named import
export default useAlertData;