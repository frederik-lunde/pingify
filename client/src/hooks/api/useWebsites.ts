// src/hooks/api/useWebsites.ts
import { useState, useCallback } from "react";
import {
  UserWebsite,
  WebsiteCreateDTO,
  WebsiteUpdateDTO,
  Website,
} from "../../types";
import apiClient from "../../api/client";
import { usePolling, PollingOptions } from "../common/usePolling";

/**
 * Hook for getting and polling user's websites list
 */
export function useWebsites(
  pollingInterval?: number,
  options?: Partial<PollingOptions<UserWebsite[]>>,
) {
  const fetchWebsites = useCallback(async () => {
    return await apiClient.get<UserWebsite[]>("/websites/user/dashboard");
  }, []);

  return usePolling<UserWebsite[]>(fetchWebsites, {
    pollingInterval,
    ...options,
  });
}

/**
 * Hook for getting a single website from user's dashboard by ID
 */
export function useWebsite(
  websiteId: number,
  pollingInterval?: number,
  options?: Partial<PollingOptions<UserWebsite>>,
) {
  const fetchWebsite = useCallback(async () => {
    return await apiClient.get<UserWebsite>(
      `/websites/user/dashboard/${websiteId}`,
    );
  }, [websiteId]);

  return usePolling<UserWebsite>(fetchWebsite, {
    pollingInterval,
    ...options,
  });
}

/**
 * Hook for searching websites
 */
export function useWebsiteSearch(
  initialQuery: string = "",
  limit: number = 10,
) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Website[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const search = useCallback( // Rename searchWebsites to search
    async (searchQuery: string) => {
      setQuery(searchQuery); // Update query state here
      try {
        setLoading(true);
        setError(null);
        const data = await apiClient.get<Website[]>("/websites/search", {
          params: { query: searchQuery, limit },
        });
        setResults(data);
        return data;
      } catch (err) {
        // ... (error handling remains the same)
        setError(error);
        console.error("Error searching websites:", error);
        setResults([]); // Clear results on error
        return [];
      } finally {
        setLoading(false);
      }
    },
    [limit], // Removed dependency on the internal 'search'
  );

  return {
    query,
    results,
    loading,
    error,
    search, // Export the single search function
  };
}

/**
 * Hook for website CRUD operations
 */
export function useWebsiteCrud() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(async (websiteData: WebsiteCreateDTO) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.post<UserWebsite>(
        "/websites/user/dashboard",
        websiteData,
      );
      return result;
    } catch (err) {
      const errorObj =
        err instanceof Error ? err : new Error("Failed to create website");
      setError(errorObj);
      throw errorObj;
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(
    async (websiteId: number, websiteData: WebsiteUpdateDTO) => {
      setLoading(true);
      setError(null);

      try {
        const result = await apiClient.put<UserWebsite>(
          `/websites/user/dashboard/${websiteId}`,
          websiteData,
        );
        return result;
      } catch (err) {
        const errorObj =
          err instanceof Error
            ? err
            : new Error(`Failed to update website ID: ${websiteId}`);
        setError(errorObj);
        throw errorObj;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const remove = useCallback(async (websiteId: number) => {
    setLoading(true);
    setError(null);

    try {
      await apiClient.delete<void>(`/websites/user/dashboard/${websiteId}`);
      return true;
    } catch (err) {
      const errorObj =
        err instanceof Error
          ? err
          : new Error(`Failed to delete website ID: ${websiteId}`);
      setError(errorObj);
      throw errorObj;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Utility function to toggle the alert enabled status for a website
   */
  const toggleAlertEnabled = useCallback(
    async (websiteId: number, currentStatus: boolean) => {
      return update(websiteId, { alertEnabled: !currentStatus });
    },
    [update],
  );

  return {
    create,
    update,
    remove,
    toggleAlertEnabled,
    loading,
    error,
  };
}
