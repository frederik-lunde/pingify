import React from "react";
import WebsiteCard from "./WebsiteCard";
import { WebsiteUser } from "../../types";

interface WebsiteGridProps {
  websiteCards: WebsiteUser[];
  lastIncidentWebsiteId?: number | null | undefined;
  isHighlightActive?: boolean;
  isLoading?: boolean;
  isTvMode: boolean;
}

const createDummyWebsiteUser = (index: number): WebsiteUser => ({
    id: -1,
    userId: "-1",
    websiteId: -index - 1000,
    name: 'Loading website...',
    interval: 300,
    alertEnabled: false,
    alertThreshold: null,
    notifyEmail: null,
    createdAt: new Date().toISOString(),
    isPinned: false,
    latestResult: null,
    chartData: [],
    uptimePercent: null,
    currentIncident: null,
    website: {
        id: -index - 1000,
        url: 'http://loading.com',
        isActive: true,
        lastChecked: null,
        globalInterval: 300,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }
});

/**
 * Renders a grid of website cards or skeleton loaders.
 */
const WebsiteGrid: React.FC<WebsiteGridProps> = React.memo(
  ({
      websiteCards,
      lastIncidentWebsiteId,
      isHighlightActive = false,
      isLoading = false,
      isTvMode,
  }) => {
    if (isLoading && websiteCards.length === 0) {
        const skeletonCount = 12;
        return (
            <>
                {Array(skeletonCount).fill(0).map((_, i) => {
                     const dummyData = createDummyWebsiteUser(i);
                     return (
                         <WebsiteCard
                             key={`skeleton-${dummyData.websiteId}`}
                             userWebsite={dummyData}
                             shouldHighlightThisCard={false}
                             isTvMode={false}
                         />
                     );
                })}
            </>
        );
    }
    if (!isLoading && websiteCards.length === 0) {
        return null;
    }
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