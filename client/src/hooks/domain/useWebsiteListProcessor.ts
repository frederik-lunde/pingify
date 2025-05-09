import { useState, useMemo, useCallback } from 'react';
import { SortOption, WebsiteUser } from '../../types';

export interface UseWebsiteListProcessorReturn {
    processedWebsites: WebsiteUser[];
    filterTerm: string;
    setFilterTerm: (term: string) => void;
    sortOption: SortOption;
    setSortOption: (option: SortOption) => void;
}

/**
 * Processes a list of websites, enabling filtering and sorting.
 */
export const useWebsiteListProcessor = (
    allWebsites: WebsiteUser[] = []
): UseWebsiteListProcessorReturn => {
    const [filterTerm, setFilterTerm] = useState<string>('');
    const [sortOption, setSortOption] = useState<SortOption>('name-asc');

    const handleSetFilterTerm = useCallback(
        /**
         * Updates the filter term state, converting to lowercase.
         */
        (term: string) => {
            setFilterTerm(term.toLowerCase());
        },
    []);

    const handleSetSortOption = useCallback(
        /**
         * Updates the sort option state.
         */
        (option: SortOption) => {
            setSortOption(option);
        },
    []);

    const filteredWebsites = useMemo(
        /**
         * Filters websites by name or URL based on the filter term.
         */
        () => {
            if (!filterTerm) return allWebsites;
            return allWebsites.filter(
                /**
                 * Checks if a website item matches the filter term.
                 */
                item => {
                    const name = item.name?.toLowerCase() || '';
                    const url = item.website?.url?.toLowerCase() || '';
                    return name.includes(filterTerm) || url.includes(filterTerm);
                }
            );
        },
    [allWebsites, filterTerm]);

    const processedWebsites = useMemo(
        /**
         * Sorts filtered websites by status and selected option.
         */
        () => {
            const listToSort = [...filteredWebsites];

            /**
             * Determines a website's primary sort key (pin, incident).
             */
            const getPrimarySortOrder = (wu: WebsiteUser): number => {
                const isPinned = wu.isPinned;
                const incidentType = wu.currentIncident?.type;
                if (isPinned) {
                    if (incidentType === 'down') return 0;
                    if (incidentType === 'slow') return 1;
                    return 2;
                } else {
                    if (incidentType === 'down') return 3;
                    if (incidentType === 'slow') return 4;
                    return 5;
                }
            };

            return listToSort.sort(
                /**
                 * Compares two websites for multi-level sorting.
                 */
                (a, b) => {
                     if (!a || !b) return 0;
                     const wuA = a;
                     const wuB = b;
                     const primaryOrderA = getPrimarySortOrder(wuA);
                     const primaryOrderB = getPrimarySortOrder(wuB);

                     if (primaryOrderA !== primaryOrderB) {
                         return primaryOrderA - primaryOrderB;
                     }

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
                }
            );
        },
    [filteredWebsites, sortOption]);

    return {
        processedWebsites,
        filterTerm,
        setFilterTerm: handleSetFilterTerm,
        sortOption,
        setSortOption: handleSetSortOption,
    };
};