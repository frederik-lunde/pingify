// src/api/hooks/useWebsites.ts
import { useState, useEffect, useCallback } from 'react';
import { Website } from '../../types';
import { getWebsites, getWebsiteById, createWebsite, updateWebsite, deleteWebsite } from '../websites';
import { DEFAULT_POLLING_INTERVAL } from '../config';

/**
 * Hook for getting and polling websites list
 */
export function useWebsites(pollingInterval = DEFAULT_POLLING_INTERVAL) {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWebsites = useCallback(async () => {
    try {
      const data = await getWebsites();
      setWebsites(data);
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

/**
 * Hook for getting a single website by ID
 */
export function useWebsite(websiteId: number, pollingInterval = DEFAULT_POLLING_INTERVAL) {
  const [website, setWebsite] = useState<Website | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWebsite = useCallback(async () => {
    try {
      const data = await getWebsiteById(websiteId);
      setWebsite(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(`Failed to fetch website ID: ${websiteId}`));
      console.error(`Error fetching website ID: ${websiteId}`, err);
    } finally {
      setLoading(false);
    }
  }, [websiteId]);

  useEffect(() => {
    // Initial fetch
    fetchWebsite();

    // Set up polling
    const intervalId = setInterval(fetchWebsite, pollingInterval);

    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [fetchWebsite, pollingInterval]);

  return { website, loading, error, refetch: fetchWebsite };
}

/**
 * Hook for website CRUD operations
 */
export function useWebsiteCrud() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(async (websiteData: Partial<Website>) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await createWebsite(websiteData);
      return result;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to create website');
      setError(errorObj);
      throw errorObj;
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(async (websiteId: number, websiteData: Partial<Website>) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await updateWebsite(websiteId, websiteData);
      return result;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(`Failed to update website ID: ${websiteId}`);
      setError(errorObj);
      throw errorObj;
    } finally {
      setLoading(false);
    }
  }, []);

  const remove = useCallback(async (websiteId: number) => {
    setLoading(true);
    setError(null);
    
    try {
      await deleteWebsite(websiteId);
      return true;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(`Failed to delete website ID: ${websiteId}`);
      setError(errorObj);
      throw errorObj;
    } finally {
      setLoading(false);
    }
  }, []);

  return { create, update, remove, loading, error };
}