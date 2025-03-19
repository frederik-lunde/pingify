import axios from 'axios';
import { useState, useEffect, useCallback } from 'react';
import { MonitoringResult, OverallStats, Alert, Website } from '../types';

// API base URL - adjust this to match your environment
const API_BASE_URL = 'http://localhost:3001/api';



// Axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Polling interval (in milliseconds)
const DEFAULT_POLLING_INTERVAL = 5000;

/**
 * Hook for polling the latest monitoring results
 */
export function useMonitoringResults(limit = 20, pollingInterval = DEFAULT_POLLING_INTERVAL) {
  const [results, setResults] = useState<MonitoringResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      const response = await api.get(`/monitoring/results?limit=${limit}`);
      setResults(response.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch monitoring results'));
      console.error('Error fetching monitoring results:', err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    // Initial fetch
    fetchResults();

    // Set up polling
    const intervalId = setInterval(fetchResults, pollingInterval);

    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [fetchResults, pollingInterval]);

  return { results, loading, error, refetch: fetchResults };
}

/**
 * Hook for polling results for a specific website
 */
export function useWebsiteResults(websiteId: number, limit = 20, pollingInterval = DEFAULT_POLLING_INTERVAL) {
  const [results, setResults] = useState<MonitoringResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      const response = await api.get(`/monitoring/website/${websiteId}/results?limit=${limit}`);
      setResults(response.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(`Failed to fetch results for website ID: ${websiteId}`));
      console.error(`Error fetching results for website ID: ${websiteId}`, err);
    } finally {
      setLoading(false);
    }
  }, [websiteId, limit]);

  useEffect(() => {
    // Initial fetch
    fetchResults();

    // Set up polling
    const intervalId = setInterval(fetchResults, pollingInterval);

    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [fetchResults, pollingInterval]);

  return { results, loading, error, refetch: fetchResults };
}

/**
 * Hook for polling website statistics
 */
export function useWebsiteStats(pollingInterval = DEFAULT_POLLING_INTERVAL) {
  const [stats, setStats] = useState<OverallStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/monitoring/stats');
      setStats(response.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch monitoring statistics'));
      console.error('Error fetching monitoring statistics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchStats();

    // Set up polling
    const intervalId = setInterval(fetchStats, pollingInterval);

    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [fetchStats, pollingInterval]);

  return { stats, loading, error, refetch: fetchStats };
}

/**
 * Hook for polling alerts
 */
export function useAlerts(limit = 10, pollingInterval = DEFAULT_POLLING_INTERVAL) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const response = await api.get(`/monitoring/alerts?limit=${limit}`);
      setAlerts(response.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch alerts'));
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    // Initial fetch
    fetchAlerts();

    // Set up polling
    const intervalId = setInterval(fetchAlerts, pollingInterval);

    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [fetchAlerts, pollingInterval]);

  return { alerts, loading, error, refetch: fetchAlerts };
}

/**
 * Function to trigger an immediate check for a website
 */
export async function triggerWebsiteCheck(websiteId: number) {
  try {
    const response = await api.post(`/monitoring/check/${websiteId}`);
    return response.data;
  } catch (error) {
    console.error(`Error triggering check for website ID: ${websiteId}`, error);
    throw error;
  }
}

/**
 * Get all websites
 */
export async function getWebsites() {
  try {
    const response = await api.get('/websites');
    return response.data;
  } catch (error) {
    console.error('Error fetching websites:', error);
    throw error;
  }
}

/**
 * Hook for getting and polling websites list
 */
export function useWebsites(pollingInterval = DEFAULT_POLLING_INTERVAL) {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWebsites = useCallback(async () => {
    try {
      const response = await api.get('/websites');
      setWebsites(response.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch websites'));
      console.error('Error fetching websites:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchWebsites();

    // Set up polling
    const intervalId = setInterval(fetchWebsites, pollingInterval);

    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [fetchWebsites, pollingInterval]);

  return { websites, loading, error, refetch: fetchWebsites };
}