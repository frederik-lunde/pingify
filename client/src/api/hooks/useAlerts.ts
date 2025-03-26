// import { useState, useCallback } from 'react';
// import { Alert, AlertStats, AlertQueryOptions, AlertUser } from '../../types';
// import { 
//   getUserAlerts, 
//   getUserUnreadAlerts, 
//   markAlertAsRead, 
//   markAllAlertsAsRead, 
//   getAlertsByWebsite, 
//   getUserAlertStats 
// } from '../alerts';
// import { DEFAULT_POLLING_INTERVAL } from '../config';
// import { usePolling } from '../../hooks/common';

// /**
//  * Hook for polling user's alerts with improved parameter handling
//  */
// export function useUserAlerts(
//   options: AlertQueryOptions = {}, 
//   pollingInterval = DEFAULT_POLLING_INTERVAL
// ) {
//   const fetchAlerts = useCallback(async () => {
//     return await getUserAlerts(options);
//   }, [options]);

//   return usePolling<Alert[]>(fetchAlerts, { pollingInterval });
// }

// /**
//  * Hook for polling unread alerts for the user with improved parameter handling
//  */
// export function useUserUnreadAlerts(
//   options: AlertQueryOptions = {}, 
//   pollingInterval = DEFAULT_POLLING_INTERVAL
// ) {
//   const fetchUnreadAlerts = useCallback(async () => {
//     return await getUserUnreadAlerts(options);
//   }, [options]);

//   const { 
//     data: unreadAlerts, 
//     loading, 
//     error, 
//     refetch 
//   } = usePolling<AlertUser[]>(fetchUnreadAlerts, { pollingInterval });

//   // Add helper to mark as read and refetch
//   const markAsRead = useCallback(async (alertId: number) => {
//     await markAlertAsRead(alertId);
//     refetch();
//   }, [refetch]);

//   // Add helper to mark all as read and refetch
//   const markAllAsRead = useCallback(async () => {
//     await markAllAlertsAsRead();
//     refetch();
//   }, [refetch]);

//   return { 
//     unreadAlerts, 
//     loading, 
//     error, 
//     refetch, 
//     markAsRead, 
//     markAllAsRead 
//   };
// }

// /**
//  * Hook for polling alerts for a specific website with improved parameter handling
//  */
// export function useWebsiteAlerts(
//   websiteId: number, 
//   options: AlertQueryOptions = {},
//   pollingInterval = DEFAULT_POLLING_INTERVAL
// ) {
//   const [noAlertsEnabled, setNoAlertsEnabled] = useState<boolean>(false);

//   const fetchAlerts = useCallback(async () => {
//     try {
//       const data = await getAlertsByWebsite(websiteId, options);
//       setNoAlertsEnabled(false);
//       return data;
//     } catch (err) {
//       // If we get a 404, it likely means the user doesn't have access or alerts disabled
//       if (err instanceof Error && err.message.includes('404')) {
//         setNoAlertsEnabled(true);
//         return [];
//       }
//       throw err;
//     }
//   }, [websiteId, options]);

//   const { data: alerts, loading, error, refetch } = usePolling<Alert[]>(fetchAlerts, { pollingInterval });

//   return { alerts, loading, error, noAlertsEnabled, refetch };
// }

// /**
//  * Hook for getting alert statistics for the user
//  */
// export function useAlertStats(days = 7, pollingInterval = DEFAULT_POLLING_INTERVAL) {
//   const fetchStats = useCallback(async () => {
//     return await getUserAlertStats(days);
//   }, [days]);

//   return usePolling<AlertStats>(fetchStats, { pollingInterval });
// }