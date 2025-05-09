import { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';

/**
 * Custom hook to display the time since a given ISO timestamp, updating periodically.
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
        updateIntervalMs = 60000
    } = options ?? {};

    /**
     * Calculates and formats the time since the given timestamp.
     */
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
    }, [timestampIsoString, addSuffix, noIncidentText, errorText]);

    const [formattedTime, setFormattedTime] = useState<string>(getFormattedTime);

    /**
     * Effect to update the formatted time initially and set up an interval for periodic updates.
     */
    useEffect(() => {
        const updateFormattedTime = () => {
            setFormattedTime(getFormattedTime());
        };
        updateFormattedTime();

        let intervalId: NodeJS.Timeout | null = null;
        if (timestampIsoString) {
           try {
               const date = parseISO(timestampIsoString);
               if (!isNaN(date.getTime())) { 
                   intervalId = setInterval(updateFormattedTime, updateIntervalMs);
               }
           } catch {
               // Error parsing, interval won't be set
           }
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [getFormattedTime, updateIntervalMs, timestampIsoString]);

    return formattedTime;
};