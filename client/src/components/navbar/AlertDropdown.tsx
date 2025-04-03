// src/components/AlertsDropdown.tsx
import React, { useCallback, useState } from "react";
import {
  Badge, IconButton, Tooltip, Menu, MenuItem, Stack, Typography,
  Button, Divider, ListItemIcon, Box, CircularProgress,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import CloseIcon from "@mui/icons-material/Close";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router";
// Use the refactored TanStack Query hooks
import { useUserUnreadAlertsQuery, useAlertReadMutations } from "../../hooks/api/useAlerts"; // Adjusted path
import { AlertUser, AlertQueryOptions } from "../../types"; // Added ApiError
import { getAlertTypeColor } from "../../utils/statusUtils";

interface AlertsDropdownProps {
  options?: AlertQueryOptions;
  pollingInterval?: number | false; // Allow explicit false to disable polling
}

const AlertsDropdown: React.FC<AlertsDropdownProps> = ({
  options = { limit: 50, isResolved: false }, // Default options
  pollingInterval = 60000, // Default polling interval (e.g., 1 minute)
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const isMenuOpen = Boolean(anchorEl);

  // --- TanStack Query Hook for fetching unread alerts ---
  const {
    data: unreadAlerts = [], // Default to empty array
    isLoading: queryLoading, // Loading state from the query
    isFetching: queryFetching, // Fetching state (includes background refetches)
    error: queryError, // Error from the query
  } = useUserUnreadAlertsQuery(options, {
    enabled: true, // Always enabled when component is mounted
    refetchInterval: isMenuOpen ? pollingInterval : false, // Poll only when menu is open
  });

  // --- TanStack Mutation Hooks for marking alerts as read ---
  const {
    markAsRead,
    markAllAsRead,
    isMarkingOne,
    isMarkingAll,
  } = useAlertReadMutations();

  // Combine loading states
  const isLoading = queryLoading && !unreadAlerts.length; // Show initial loading spinner
  const isPolling = queryFetching && !queryLoading; // Indicate background polling/refresh

  // Handler to open the menu
  const handleOpenAlerts = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  // Handler to close the menu
  const handleCloseAlerts = useCallback(() => {
    setAnchorEl(null);
  }, []);

  // Handler for clicking an alert item
  const handleAlertClick = useCallback(
    async (alertUser: AlertUser) => {
      const websiteId = alertUser.alert?.websiteId; // Safe access
      handleCloseAlerts(); // Close menu immediately

      if (websiteId) {
          navigate(`/website/${websiteId}`);
      }
      // Marking as read handled by dismiss button
    },
    [navigate, handleCloseAlerts],
  );

  // Handler for the dismiss (mark as read) button
  const handleDismissAlert = useCallback(
    (event: React.MouseEvent, alertId: number | undefined) => { // Handle undefined alertId
      event.stopPropagation(); // Prevent menu item click
      if (alertId !== undefined) {
          markAsRead(alertId); // Call the mutation
      } else {
          console.error("Attempted to dismiss alert with undefined ID");
      }
    },
    [markAsRead],
  );

  // Handler for marking all as read
  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead(); // Call the mutation
  }, [markAllAsRead]);

  // Badge count should reflect the actual number of items fetched
  const badgeCount = unreadAlerts.length;

  return (
    <>
      {/* Notifications Icon Button */}
      <Tooltip title="Alerts">
        <IconButton
          id="alerts-button" // ID for aria-controls
          aria-label={`Show ${badgeCount} alerts`}
          aria-controls={isMenuOpen ? 'alerts-menu' : undefined} // Control menu visibility
          aria-haspopup="true"
          aria-expanded={isMenuOpen ? 'true' : undefined}
          color="inherit"
          onClick={handleOpenAlerts}
          sx={{ opacity: (isLoading || isPolling) ? 0.7 : 1 }} // Dim slightly when loading/polling
        >
          <Badge badgeContent={badgeCount} color="error" max={99}>
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Notifications Dropdown Menu */}
      <Menu
        id="alerts-menu" // ID for accessibility
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleCloseAlerts}
        PaperProps={{ sx: { maxHeight: "500px", width: "450px", overflowY: "auto", mt: 1.5 } }}
        MenuListProps={{ 'aria-labelledby': 'alerts-button' }} // Link menu to button
      >
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1, position: "sticky", top: 0, bgcolor: "background.paper", zIndex: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">Alerts</Typography>
          <Button size="small" variant="text" color="primary" onClick={handleMarkAllAsRead} disabled={unreadAlerts.length === 0 || isMarkingAll} sx={{ textTransform: "none", minWidth: "auto" }}>
            {isMarkingAll ? "Marking..." : "Mark all as read"}
          </Button>
        </Stack>
        <Divider sx={{ mb: 0.5 }} />

        {/* Body: Loading, Error, Empty, or List */}
        {isLoading ? ( // Initial Loading State
          <MenuItem disabled sx={{ justifyContent: "center", py: 4 }}>
            <CircularProgress size={24} />
          </MenuItem>
        ) : queryError ? ( // Error State
             <MenuItem disabled sx={{ justifyContent: "center", py: 2 }}>
                <Typography variant="body2" color="error" textAlign="center">Error loading alerts: <br /> {queryError.message}</Typography>
             </MenuItem>
        ) : unreadAlerts.length === 0 ? ( // Empty State
          <MenuItem disabled sx={{ justifyContent: "center", py: 2 }}>
            <Typography variant="body2" color="text.secondary">No new alerts</Typography>
          </MenuItem>
        ) : ( // List of Alerts
          unreadAlerts.map((alertUser, index) => { // Added index for border logic
            // Defensive coding: Ensure alert and its properties exist
            const alert = alertUser?.alert;
            if (!alert) {
              console.warn("Rendering alert item with missing alert data:", alertUser);
              return null; // Skip rendering if essential data is missing
            }

            const websiteName = alert.website?.websiteUsers?.[0]?.name || alert.website?.url || "Unknown Website";
            const alertTime = alert.createdAt ? formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true }) : 'Unknown time';
            const alertId = alertUser.alertId; // Get alertId for dismiss action

            return (
              <MenuItem
                key={alertUser.id ?? `alert-${index}`} // Use unique ID or fallback
                onClick={() => handleAlertClick(alertUser)}
                sx={{
                  "&:hover": {
                    backgroundColor: "action.hover",
                    "& .dismiss-button": { opacity: 1 },
                  },
                  display: "flex", alignItems: "flex-start", cursor: "pointer",
                  py: 1.5, px: 2, gap: 1.5,
                  // Add bottom border for separation, except for the last item
                  borderBottom: index < unreadAlerts.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                }}
              >
                {/* Status Icon */}
                <ListItemIcon sx={{ minWidth: "auto", mt: 0.5, mr: 1 }}>
                  <FiberManualRecordIcon
                    fontSize="small"
                    color={getAlertTypeColor(alert.type)} // Use util for color
                  />
                </ListItemIcon>

                {/* Main Content (Website Name, Message, Timestamp) */}
                <Box sx={{ flexGrow: 1, overflow: "hidden", mr: 1 }}>
                  <Typography variant="body2" fontWeight={500} noWrap title={websiteName}>
                    {websiteName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", whiteSpace: 'normal' }}> {/* Allow message wrapping */}
                    {alert.message}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                    {alertTime}
                  </Typography>
                </Box>

                {/* Dismiss Button (Mark as Read) */}
                <Tooltip title="Mark as read">
                  {/* Disable button while marking *any* single item */}
                  <IconButton
                    aria-label="Mark as read"
                    size="small"
                    className="dismiss-button"
                    onClick={(event) => handleDismissAlert(event, alertId)} // Pass alertId
                    disabled={isMarkingOne}
                    sx={{
                      opacity: 0, // Hidden initially
                      transition: (theme) => theme.transitions.create("opacity"),
                      flexShrink: 0,
                      alignSelf: 'center', // Center vertically
                      ml: 'auto', // Push to the far right
                    }}
                  >
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              </MenuItem>
            );
          })
        )}
      </Menu>
    </>
  );
};

export default AlertsDropdown;