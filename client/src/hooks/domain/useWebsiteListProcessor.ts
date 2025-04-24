/*
src/hooks/useWebsiteListProcessor.ts
*/
import { useState, useMemo, useCallback } from 'react';
// --- MODIFIED: Remove WebsiteWithResults, use WebsiteUser directly ---
import { SortOption, WebsiteUser } from '../../types'; // Adjust path as needed

export interface UseWebsiteListProcessorReturn {
    // --- MODIFIED: Use WebsiteUser[] ---
    processedWebsites: WebsiteUser[];
    filterTerm: string;
    setFilterTerm: (term: string) => void;
    sortOption: SortOption;
    setSortOption: (option: SortOption) => void;
}

export const useWebsiteListProcessor = (
    // --- MODIFIED: Use WebsiteUser[] ---
    allWebsites: WebsiteUser[] = [] // Default to empty array
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
        // --- MODIFIED: Access properties directly from item (which is WebsiteUser) ---
        return allWebsites.filter(item => {
            const name = item.name?.toLowerCase() || ''; // Access name directly
            const url = item.website?.url?.toLowerCase() || ''; // Access website.url directly
            return name.includes(filterTerm) || url.includes(filterTerm);
        });
    }, [allWebsites, filterTerm]);

    const processedWebsites = useMemo(() => {
        const listToSort = [...filteredWebsites];

        // --- MODIFIED: getPrimarySortOrder receives WebsiteUser directly ---
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
             // --- MODIFIED: a and b are WebsiteUser directly ---
             if (!a || !b) return 0;
             const wuA = a;
             const wuB = b;

             // Primary Sort: Pinned/Down > Pinned/Slow > Pinned/Up > Down > Slow > Up
             const primaryOrderA = getPrimarySortOrder(wuA);
             const primaryOrderB = getPrimarySortOrder(wuB);

             if (primaryOrderA !== primaryOrderB) {
                 return primaryOrderA - primaryOrderB;
             }

             // Secondary Sort (based on user selection) - Logic remains the same
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
                     const respA = wuA.latestResult?.isAvailable ? (wuA.latestResult?.responseTime ?? Infinity) : Infinity;
                     const respB = wuB.latestResult?.isAvailable ? (wuB.latestResult?.responseTime ?? Infinity) : Infinity;
                     if (respA === Infinity && respB === Infinity) {
                         const nameA = wuA.name ?? wuA.website?.url ?? '';
                         const nameB = wuB.name ?? wuB.website?.url ?? '';
                         return nameA.localeCompare(nameB);
                     }
                     return respA - respB;
                 }
                 case 'response-desc': {
                     const respA = wuA.latestResult?.isAvailable ? (wuA.latestResult?.responseTime ?? -1) : -1;
                     const respB = wuB.latestResult?.isAvailable ? (wuB.latestResult?.responseTime ?? -1) : -1;
                     if (respA === -1 && respB === -1) {
                         const nameA = wuA.name ?? wuA.website?.url ?? '';
                         const nameB = wuB.name ?? wuB.website?.url ?? '';
                         return nameA.localeCompare(nameB);
                     }
                     return respB - respA;
                 }
                 default: return 0;
             }
        });
    }, [filteredWebsites, sortOption]);

    return {
        processedWebsites, // This is now WebsiteUser[]
        filterTerm,
        setFilterTerm: handleSetFilterTerm,
        sortOption,
        setSortOption: handleSetSortOption,
    };
};