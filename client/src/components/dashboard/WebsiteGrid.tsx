// src/components/dashboard/WebsiteGrid.tsx
import React from "react";
import WebsiteCard from "./WebsiteCard";
import { WebsiteUser } from "../../types"; // Ensure correct path

interface WebsiteGridProps {
  websiteCards: WebsiteUser[];
  lastIncidentWebsiteId?: number | null | undefined;
  isHighlightActive?: boolean;
  isLoading?: boolean; // For skeleton cards on initial load
  isTvMode: boolean;
}

// Define the dummy data structure outside the component for reuse
const createDummyWebsiteUser = (index: number): WebsiteUser => ({
    id: -1, // Use -1 or a unique negative index to indicate skeleton
    userId: "-1",
    websiteId: -index - 1000, // Ensure unique negative websiteId for keys
    name: 'Loading website...',
    interval: 300,
    alertEnabled: false,
    alertThreshold: null,
    notifyEmail: null,
    createdAt: new Date().toISOString(),
    isPinned: false,
    latestResult: null, // Skeletons have no result
    chartData: [],     // Skeletons have no chart data
    uptimePercent: null, // Skeletons have no uptime
    currentIncident: null, // Skeletons have no incident
    website: {
        id: -index - 1000, // Match websiteId
        url: 'http://loading.com',
        isActive: true,
        lastChecked: null,
        globalInterval: 300,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }
});


const WebsiteGrid: React.FC<WebsiteGridProps> = React.memo(
  ({
      websiteCards,
      lastIncidentWebsiteId,
      isHighlightActive = false,
      isLoading = false,
      isTvMode,
  }) => {

    // --- Render Logic ---

    // If loading and no *real* cards yet, render skeletons using WebsiteCard
    if (isLoading && websiteCards.length === 0) {
        const skeletonCount = 12; // Or derive from viewport if needed
        return (
            <>
                {Array(skeletonCount).fill(0).map((_, i) => {
                     const dummyData = createDummyWebsiteUser(i);
                     return (
                         <WebsiteCard
                             // Use a unique key based on dummy data's websiteId
                             key={`skeleton-${dummyData.websiteId}`}
                             userWebsite={dummyData} // Pass the dummy data
                             shouldHighlightThisCard={false}
                             isTvMode={false} // Skeletons aren't interactive in TV mode sense
                         />
                     );
                })}
            </>
        );
    }

    // If not loading and still no cards, render nothing (parent handles messages)
    if (!isLoading && websiteCards.length === 0) {
        return null;
    }

    // Render the actual website cards
    return (
        <>
            {websiteCards.map((item) => {
                if (!item) return null;
                const shouldHighlight = isHighlightActive && item.websiteId === lastIncidentWebsiteId;

                return (
                    <WebsiteCard
                        key={`website-${item.websiteId}`}
                        userWebsite={item}
                        shouldHighlightThisCard={shouldHighlight}
                        isTvMode={isTvMode}
                    />
                );
            })}
        </>
    );
  },
);

WebsiteGrid.displayName = 'WebsiteGrid';

export default WebsiteGrid;