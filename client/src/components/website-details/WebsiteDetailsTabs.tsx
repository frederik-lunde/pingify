// client/src/components/website-details/WebsiteDetailsTabs.tsx
import React, { useState } from "react";
import { Box, Tabs, Tab, Paper } from "@mui/material";
import { TimeRange } from "../../types";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`website-details-tabpanel-${index}`}
      aria-labelledby={`website-details-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

interface WebsiteDetailsTabsProps {
  // Pass components as children or specific props
  responseTimeChart: React.ReactNode;
  uptimeChart: React.ReactNode;
  downtimePatternChart: React.ReactNode;
  resultsTable: React.ReactNode;
  // Callback to inform parent about tab changes (for TimeRangeSelector logic)
  onTabChange: (newTabIndex: number) => void;
}

const WebsiteDetailsTabs: React.FC<WebsiteDetailsTabsProps> = ({
  responseTimeChart,
  uptimeChart,
  downtimePatternChart,
  resultsTable,
  onTabChange,
}) => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    onTabChange(newValue); // Notify parent
  };

  return (
    <Paper sx={{ mb: 3 }}>
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        aria-label="Website monitoring tabs"
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label="Response Time" id="website-details-tab-0" aria-controls="website-details-tabpanel-0" />
        <Tab label="Uptime Status" id="website-details-tab-1" aria-controls="website-details-tabpanel-1" />
        <Tab label="Downtime Patterns" id="website-details-tab-2" aria-controls="website-details-tabpanel-2" />
        <Tab label="Recent Checks" id="website-details-tab-3" aria-controls="website-details-tabpanel-3" />
      </Tabs>

      {/* Tab Content */}
      <TabPanel value={activeTab} index={0}>
        {responseTimeChart}
      </TabPanel>
      <TabPanel value={activeTab} index={1}>
        {uptimeChart}
      </TabPanel>
      <TabPanel value={activeTab} index={2}>
        {downtimePatternChart}
      </TabPanel>
      <TabPanel value={activeTab} index={3}>
        {resultsTable}
      </TabPanel>
    </Paper>
  );
};

export default WebsiteDetailsTabs;