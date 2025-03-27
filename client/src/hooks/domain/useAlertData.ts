// src/hooks/domain/useAlertData.ts
import { useMemo, useCallback } from "react";
import {
  useUserAlerts,
  useUserUnreadAlerts,
  useAlertStats,
} from "../api/useAlerts";
import { useWebsites } from "../api/useWebsites";
import { Alert, AlertUser, AlertStats } from "../../types";
import { DEFAULT_POLLING_INTERVAL } from "../../api/config";

export interface AlertSummary {
  stats: AlertStats | null;
  allAlerts: Alert[];
  unresolvedAlerts: Alert[];
  resolvedAlerts: Alert[];
  unreadAlerts: AlertUser[];
  websiteAlertCounts: Map<number, number>;
  loading: boolean;
  error: string | null;
  markAsRead: (alertId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refetch: () => void;
}

/**
 * Hook to provide comprehensive alert data for the dashboard
 */
export function useAlertData(
  days = 7,
  limit = 50,
  pollingInterval = DEFAULT_POLLING_INTERVAL,
): AlertSummary {
  // Fetch alert statistics
  const {
    data: stats,
    loading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useAlertStats(days, pollingInterval);

  // Fetch all alerts (resolved and unresolved)
  const {
    data: allAlerts = [],
    loading: allAlertsLoading,
    error: allAlertsError,
    refetch: refetchAllAlerts,
  } = useUserAlerts({ limit }, pollingInterval);

  // Fetch unread alerts with mark as read functionality
  const {
    unreadAlerts = [],
    loading: unreadLoading,
    error: unreadError,
    markAsRead,
    markAllAsRead,
    refetch: refetchUnread,
  } = useUserUnreadAlerts({ limit }, pollingInterval);

  // Fetch websites for context
  const { data: userWebsites = [], loading: websitesLoading } = useWebsites(
    pollingInterval,
    { enabled: true },
  );

  // Split alerts into resolved and unresolved
  const { unresolvedAlerts, resolvedAlerts } = useMemo(() => {
    const alerts = allAlerts || [];
    return {
      unresolvedAlerts: alerts.filter((alert) => !alert.isResolved),
      resolvedAlerts: alerts.filter((alert) => alert.isResolved),
    };
  }, [allAlerts]);

  // Create map of website IDs to their alert counts
  const websiteAlertCounts = useMemo(() => {
    const counts = new Map<number, number>();

    // Initialize with all websites at 0
    (userWebsites || []).forEach((website) => {
      counts.set(website.websiteId, 0);
    });

    // Count unresolved alerts per website
    unresolvedAlerts.forEach((alert) => {
      const currentCount = counts.get(alert.websiteId) || 0;
      counts.set(alert.websiteId, currentCount + 1);
    });

    return counts;
  }, [userWebsites, unresolvedAlerts]);

  // Compile all errors
  const error = useMemo(() => {
    const errors = [statsError, allAlertsError, unreadError]
      .filter(Boolean)
      .map((err) => err?.message || "Unknown error");

    return errors.length > 0 ? errors.join(", ") : null;
  }, [statsError, allAlertsError, unreadError]);

  // Loading state
  const loading =
    statsLoading || allAlertsLoading || unreadLoading || websitesLoading;

  // Helper function to refetch all data
  const refetch = useCallback(() => {
    refetchStats();
    refetchAllAlerts();
    refetchUnread();
  }, [refetchStats, refetchAllAlerts, refetchUnread]);

  // Return the alert summary with non-null arrays
  return {
    stats: stats || null,
    allAlerts: allAlerts || [],
    unresolvedAlerts,
    resolvedAlerts,
    unreadAlerts: unreadAlerts || [],
    websiteAlertCounts,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    refetch,
  };
}

export default useAlertData;
