/*
src/hooks/useWebsiteListProcessor.ts (NEW FILE)
*/
import { useState, useMemo, useCallback } from 'react';
import { WebsiteWithResults, SortOption, WebsiteUser } from '../../types'; // Adjust path as needed

export interface UseWebsiteListProcessorReturn {
    processedWebsites: WebsiteWithResults[];
    filterTerm: string;
    setFilterTerm: (term: string) => void;
    sortOption: SortOption;
    setSortOption: (option: SortOption) => void;
}

export const useWebsiteListProcessor = (
    allWebsites: WebsiteWithResults[] = [] // Default to empty array
): UseWebsiteListProcessorReturn => {
    const [filterTerm, setFilterTerm] = useState<string>('');
    const [sortOption, setSortOption] = useState<SortOption>('name-asc');

    const handleSetFilterTerm = useCallback((term: string) => {
        setFilterTerm(term.toLowerCase());
    }, []);

    const handleSetSortOption = useCallback((option: SortOption) => {
        setSortOption(option);
    }, []);

    const filteredWebsites = useMemo(() => {
        if (!filterTerm) return allWebsites;
        return allWebsites.filter(item => {
            const name = item.userWebsite?.name?.toLowerCase() || '';
            const url = item.userWebsite?.website?.url?.toLowerCase() || '';
            return name.includes(filterTerm) || url.includes(filterTerm);
        });
    }, [allWebsites, filterTerm]);

    const processedWebsites = useMemo(() => {
        const listToSort = [...filteredWebsites];

        const getPrimarySortOrder = (wu: WebsiteUser): number => {
            const isPinned = wu.isPinned;
            const incidentType = wu.currentIncident?.type;

            if (isPinned) {
                if (incidentType === 'down') return 0;
                if (incidentType === 'slow') return 1;
                return 2; // Pinned & Up
            } else {
                if (incidentType === 'down') return 3;
                if (incidentType === 'slow') return 4;
                return 5; // Not Pinned & Up
            }
        };

        return listToSort.sort((a, b) => {
             if (!a?.userWebsite || !b?.userWebsite) return 0; // Should not happen with valid data
             const wuA = a.userWebsite;
             const wuB = b.userWebsite;

             // Primary Sort: Pinned/Down > Pinned/Slow > Pinned/Up > Down > Slow > Up
             const primaryOrderA = getPrimarySortOrder(wuA);
             const primaryOrderB = getPrimarySortOrder(wuB);

             if (primaryOrderA !== primaryOrderB) {
                 return primaryOrderA - primaryOrderB;
             }

             // Secondary Sort (based on user selection)
             switch (sortOption) {
                 case 'name-asc': {
                     const nameA = wuA.name ?? wuA.website?.url ?? '';
                     const nameB = wuB.name ?? wuB.website?.url ?? '';
                     return nameA.localeCompare(nameB);
                 }
                 case 'name-desc': {
                     const nameA = wuA.name ?? wuA.website?.url ?? '';
                     const nameB = wuB.name ?? wuB.website?.url ?? '';
                     return nameB.localeCompare(nameA);
                 }
                 case 'response-asc': {
                     // Treat unavailable/down as Infinity
                     const respA = wuA.latestResult?.isAvailable ? (wuA.latestResult?.responseTime ?? Infinity) : Infinity;
                     const respB = wuB.latestResult?.isAvailable ? (wuB.latestResult?.responseTime ?? Infinity) : Infinity;
                     // If both are Infinity, sort by name asc
                     if (respA === Infinity && respB === Infinity) {
                         const nameA = wuA.name ?? wuA.website?.url ?? '';
                         const nameB = wuB.name ?? wuB.website?.url ?? '';
                         return nameA.localeCompare(nameB);
                     }
                     return respA - respB;
                 }
                 case 'response-desc': {
                     // Treat unavailable/down as -1 (or lower than any valid time)
                     const respA = wuA.latestResult?.isAvailable ? (wuA.latestResult?.responseTime ?? -1) : -1;
                     const respB = wuB.latestResult?.isAvailable ? (wuB.latestResult?.responseTime ?? -1) : -1;
                      // If both are -1, sort by name asc
                     if (respA === -1 && respB === -1) {
                         const nameA = wuA.name ?? wuA.website?.url ?? '';
                         const nameB = wuB.name ?? wuB.website?.url ?? '';
                         return nameA.localeCompare(nameB);
                     }
                     return respB - respA; // Higher response time first
                 }
                 default: return 0;
             }
        });
    }, [filteredWebsites, sortOption]);

    return {
        processedWebsites,
        filterTerm,
        setFilterTerm: handleSetFilterTerm,
        sortOption,
        setSortOption: handleSetSortOption,
    };
};