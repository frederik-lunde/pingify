/*
src/hooks/useTimeSince.ts
*/
import { useState, useEffect } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';

/**
 * Calculates and formats the time elapsed since a given timestamp string.
 * Updates the formatted string periodically.
 *
 * @param timestampIsoString - An ISO 8601 timestamp string, or null/undefined.
 * @param options - Configuration options.
 * @param options.addSuffix - Add 'ago' or 'in' suffix (default: true).
 * @param options.noIncidentText - Text to display if timestamp is null (default: 'Never').
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
        noIncidentText = 'No recent incidents', // Changed default text
        errorText = 'Invalid Date',
        updateIntervalMs = 60000 // Update every minute
    } = options ?? {};

    const [formattedTime, setFormattedTime] = useState<string>(() => {
        if (!timestampIsoString) {
            return noIncidentText;
        }
        try {
            const date = parseISO(timestampIsoString);
            // Check if date is valid after parsing
            if (isNaN(date.getTime())) {
                console.warn(`useTimeSince: Invalid date parsed from "${timestampIsoString}"`);
                return errorText;
            }
            return formatDistanceToNow(date, { addSuffix });
        } catch (e) {
            console.error(`useTimeSince: Error parsing date "${timestampIsoString}"`, e);
            return errorText;
        }
    });

    useEffect(() => {
        // Function to update the formatted time
        const updateFormattedTime = () => {
            if (!timestampIsoString) {
                setFormattedTime(noIncidentText);
                return;
            }
            try {
                const date = parseISO(timestampIsoString);
                if (isNaN(date.getTime())) {
                     // Check validity again inside interval, though unlikely to change
                    setFormattedTime(errorText);
                    return;
                }
                setFormattedTime(formatDistanceToNow(date, { addSuffix }));
            } catch (e) {
                // Handle potential errors during updates as well
                setFormattedTime(errorText);
            }
        };

        // Initial update in case the timestamp changes after mount
        updateFormattedTime();

        // Set up interval only if there's a valid timestamp
        let intervalId: number | null = null;
        if (timestampIsoString) {
           intervalId = setInterval(updateFormattedTime, updateIntervalMs);
        }


        // Cleanup interval on component unmount or when timestamp changes
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
        // Rerun effect if the timestamp string or options affecting output change
    }, [timestampIsoString, addSuffix, noIncidentText, errorText, updateIntervalMs]);

    return formattedTime;
};