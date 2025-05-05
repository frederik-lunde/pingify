/*
src/hooks/useTimeSince.ts
*/
import { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { formatDistanceToNow, parseISO } from 'date-fns';

/**
 * Calculates and formats the time elapsed since a given timestamp string.
 * Updates the formatted string periodically.
 *
 * @param timestampIsoString - An ISO 8601 timestamp string, or null/undefined.
 * @param options - Configuration options.
 * @param options.addSuffix - Add 'ago' or 'in' suffix (default: true).
 * @param options.noIncidentText - Text to display if timestamp is null (default: 'No recent incidents').
 * @param options.errorText - Text to display on invalid date (default: 'Invalid Date').
 * @param options.updateIntervalMs - How often to update the relative time (default: 60000ms).
 * @returns The formatted relative time string (e.g., "about 5 hours ago").
 */
export const useTimeSince = (
    timestampIsoString: string | null | undefined,
    options?: {
        addSuffix?: boolean;
        noIncidentText?: string;
        errorText?: string;
        updateIntervalMs?: number;
    }
): string => {
    const {
        addSuffix = true,
        noIncidentText = 'No recent incidents',
        errorText = 'Invalid Date',
        updateIntervalMs = 60000 // Update every minute
    } = options ?? {};

    // Helper function to get the formatted time string
    const getFormattedTime = useCallback((): string => {
        if (!timestampIsoString) {
            return noIncidentText;
        }
        try {
            const date = parseISO(timestampIsoString);
            if (isNaN(date.getTime())) {
                console.warn(`useTimeSince: Invalid date parsed from "${timestampIsoString}"`);
                return errorText;
            }
            return formatDistanceToNow(date, { addSuffix });
        } catch (e) {
            console.error(`useTimeSince: Error parsing date "${timestampIsoString}"`, e);
            return errorText;
        }
    }, [timestampIsoString, addSuffix, noIncidentText, errorText]); // Dependencies for the helper

    const [formattedTime, setFormattedTime] = useState<string>(getFormattedTime); // Use helper for initial state

    useEffect(() => {
        // Function to update the formatted time using the helper
        const updateFormattedTime = () => {
            setFormattedTime(getFormattedTime());
        };

        // Initial update in case the timestamp changes after mount (or if helper logic changes)
        updateFormattedTime();

        // Set up interval only if there's a valid timestamp string (avoids interval for null/undefined)
        let intervalId: number | null = null;
        if (timestampIsoString) {
           // Check if the initial parse was valid before setting interval
           try {
               const date = parseISO(timestampIsoString);
               if (!isNaN(date.getTime())) {
                   intervalId = setInterval(updateFormattedTime, updateIntervalMs);
               }
           } catch {
               // If initial parse failed, don't start interval
           }
        }

        // Cleanup interval on component unmount or when dependencies change
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
        // Rerun effect if the helper function or update interval changes
    }, [getFormattedTime, updateIntervalMs, timestampIsoString]); // Added timestampIsoString to ensure interval resets if it becomes null/valid

    return formattedTime;
};