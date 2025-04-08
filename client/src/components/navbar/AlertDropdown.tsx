//client/src/components/navbar/AlertDropdown.tsx
import React, { useCallback, useState, useMemo } from "react";
import {
  Badge, IconButton, Tooltip, Menu, MenuItem, Stack, Typography,
  Divider, ListItemIcon, Box, CircularProgress,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import CloseIcon from "@mui/icons-material/Close";
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'; // Icon for error state
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff'; // Icon for no alerts state
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router";

// Hooks and Types
import { useUserAlertsQuery, useAlertActions } from "../../hooks/api/useAlerts"; // Adjust path
import { ApiError, AlertQueryOptions, AlertType, VALID_ALERT_TYPES } from "../../types"; // Adjust path
import { getAlertTypeColor } from "../../utils/statusUtils"; // Adjust path

interface AlertsDropdownProps {
  // Allow passing filter options for the alerts query
  options?: AlertQueryOptions;
  // Control polling behavior
  pollingInterval?: number | false;
  // Max alerts to display in dropdown before showing a link to full page (optional)
  maxItems?: number;
}

const AlertsDropdown: React.FC<AlertsDropdownProps> = ({
  options = { limit: 10 }, // Default: fetch 10 most recent active alerts for dropdown
  pollingInterval = 60000, // Default: Poll every 60 seconds
  maxItems = 10,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const isMenuOpen = Boolean(anchorEl);

  // --- Fetch User's ACTIVE Alerts ---
  const {
    data: activeAlerts = [], // Default to empty array
    isPending: isQueryInitialLoading, // True only on initial load without data
    isFetching: isQueryFetching,     // True during initial load AND background refetches/polling
    error: queryError,
    // refetch: refetchActiveAlerts, // Keep if manual refresh button is added
  } = useUserAlertsQuery(options, {
    enabled: true, // Fetch immediately
    // Poll only when the menu is open to save resources, or always if badge needs live updates
    refetchInterval: isMenuOpen ? pollingInterval : false,
    staleTime: 0, // Data considered fresh for 30s
  });

  // --- Use Alert Action Mutations ---
  const {
    dismissAlert,
    isDismissingAlert,
    // errorDismissingAlert // Can be used for specific error feedback
  } = useAlertActions();

  // --- UI Loading/State Indicators ---
  const isLoading = isQueryInitialLoading && !activeAlerts.length; // Show main spinner only on first load
  const isPolling = isQueryFetching && !isQueryInitialLoading; // Subtle indicator for background refresh


  // --- Memoized Derived State ---
  // Avoid recalculating badge count on every render
  const badgeCount = useMemo(() => activeAlerts.length, [activeAlerts]);
  // Truncate alerts list if maxItems is set
  const displayedAlerts = useMemo(() => activeAlerts.slice(0, maxItems), [activeAlerts, maxItems]);
  const hasMoreAlerts = useMemo(() => activeAlerts.length > maxItems, [activeAlerts, maxItems]);

  // --- Handlers ---
  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = useCallback(() => {
    setAnchorEl(null);
  }, []);

  // Navigate to website detail page
  const handleNavigateToWebsite = useCallback(
    (websiteId: number | undefined) => {
      handleCloseMenu();
      if (websiteId) {
        navigate(`/website/${websiteId}`);
      } else {
        console.warn("Cannot navigate: Missing websiteId in alert data");
        // Optionally show a snackbar error to the user
      }
    },
    [navigate, handleCloseMenu]
  );

  // Dismiss an alert
  const handleDismiss = useCallback(
    (event: React.MouseEvent, alertId: number | undefined) => {
      event.stopPropagation(); // Prevent triggering navigation
      if (alertId !== undefined && !isDismissingAlert) {
        dismissAlert(alertId, {
           // Optional: onSuccess/onError callbacks specific to this dismissal action
           // onSuccess: () => { console.log(`Dismissed alert ${alertId}`)},
           // onError: (err) => { console.error(`Failed dismissal for ${alertId}`, err)}
        });
      } else if (alertId === undefined) {
          console.error("Attempted to dismiss alert with undefined ID");
      }
    },
    [dismissAlert, isDismissingAlert]
  );

  // Navigate to the main alerts page
  const handleViewAllAlerts = useCallback(() => {
    handleCloseMenu();
    navigate('/alerts'); // Adjust route as needed
  }, [navigate, handleCloseMenu]);


  // --- Menu Content Rendering ---
  const renderMenuContent = () => {
    if (isLoading) {
      return (
        <MenuItem disabled sx={{ justifyContent: "center", py: 4 }}>
          <CircularProgress size={24} />
        </MenuItem>
      );
    }

    if (queryError) {
      return (
        <MenuItem disabled sx={{ py: 2, whiteSpace: 'normal' }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'error.main', width: '100%' }}>
            <ErrorOutlineIcon fontSize="small" />
            <Typography variant="body2" textAlign="center" sx={{ flexGrow: 1 }}>
              Error loading alerts:<br />
              {(queryError as ApiError)?.message || 'Unknown error'}
            </Typography>
          </Stack>
        </MenuItem>
      );
    }

    if (badgeCount === 0) {
      return (
        <MenuItem disabled sx={{ py: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary', width: '100%' }}>
            <NotificationsOffIcon fontSize="small" />
            <Typography variant="body2" textAlign="center" sx={{ flexGrow: 1 }}>
              No active alerts
            </Typography>
          </Stack>
        </MenuItem>
      );
    }

    return (
      <>
        {/* Displayed Alert Items */}
        {displayedAlerts.map((alert, index) => {
          if (!alert?.id) return null; // Basic validation

          const websiteId = alert.website?.id;
          const websiteName = alert.website?.name || alert.website?.url || `Website ${alert.websiteId}`;
          const alertTime = alert.createdAt ? formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true }) : 'Unknown time';
          // Ensure type safety; provide a fallback if type is unexpected
          const alertType = VALID_ALERT_TYPES.includes(alert.type as AlertType) ? alert.type as AlertType : undefined;

          return (
            <MenuItem
              key={`alert-${alert.id}`}
              onClick={() => handleNavigateToWebsite(websiteId)}
              disabled={isDismissingAlert} // Disable all items while dismissing one
              sx={{
                "&:hover": {
                  bgcolor: "action.hover",
                  "& .dismiss-button": { opacity: 1 }, // Show dismiss on hover
                },
                display: "flex", alignItems: "flex-start", cursor: "pointer",
                py: 1.5, px: 2, gap: 1.5,
                // Add divider except for the last *displayed* item
                borderBottom: index < displayedAlerts.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
              }}
            >
              {/* Status Icon */}
              <ListItemIcon sx={{ minWidth: "auto", mt: 0.5, mr: 1 }}>
                <FiberManualRecordIcon
                  fontSize="small"
                  color={alertType ? getAlertTypeColor(alertType) : 'disabled'}
                />
              </ListItemIcon>

              {/* Main Content */}
              <Box sx={{ flexGrow: 1, overflow: "hidden", mr: 1 }}>
                <Typography variant="body2" fontWeight={500} noWrap title={websiteName}>
                  {websiteName}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", whiteSpace: 'normal' }}>
                  {alert.message}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                  {alertTime}
                </Typography>
              </Box>

              {/* Dismiss Button */}
              <Tooltip title="Dismiss this alert">
                {/* Wrap IconButton to prevent click propagation issues when disabled */}
                <span>
                  <IconButton
                    aria-label="Dismiss alert"
                    size="small"
                    className="dismiss-button"
                    onClick={(event) => handleDismiss(event, alert.id)}
                    disabled={isDismissingAlert} // Disable while any dismissal is happening
                    sx={{
                      opacity: 0, // Hidden initially
                      transition: (theme) => theme.transitions.create("opacity"),
                      flexShrink: 0,
                      alignSelf: 'center',
                      ml: 'auto', // Push right
                    }}
                  >
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
                </span>
              </Tooltip>
            </MenuItem>
          );
        })}

        {/* View All Button/Link */}
        {hasMoreAlerts && (
          <>
            <Divider />
            <MenuItem onClick={handleViewAllAlerts} sx={{ justifyContent: 'center', py: 1.5 }}>
              <Typography variant="body2" color="primary">
                View All {badgeCount} Alerts
              </Typography>
            </MenuItem>
          </>
        )}
      </>
    );
  };


  return (
    <>
      {/* Icon Button */}
      <Tooltip title={badgeCount > 0 ? `${badgeCount} Active Alert${badgeCount > 1 ? 's' : ''}` : "No active alerts"}>
        <IconButton
          id="alerts-button"
          aria-label={`Show ${badgeCount} active alerts`}
          aria-controls={isMenuOpen ? 'alerts-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={isMenuOpen ? 'true' : undefined}
          color="inherit"
          onClick={handleOpenMenu}
          // Optional: subtle indication of polling/loading
          sx={{ opacity: isPolling ? 0.8 : 1 }}
        >
          <Badge badgeContent={badgeCount} color="error" max={99}>
             <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Menu */}
      <Menu
        id="alerts-menu"
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleCloseMenu}
        PaperProps={{ sx: { maxHeight: "500px", width: "450px", overflowY: "auto", mt: 1.5, borderRadius: 2 } }} // Added border radius
        MenuListProps={{ 'aria-labelledby': 'alerts-button', disablePadding: true /* Let items control padding */ }}
        slotProps={{ paper: { elevation: 3 }}} // Slightly more shadow
      >
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.5, position: "sticky", top: 0, bgcolor: "background.paper", zIndex: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">Active Alerts</Typography>
          {/* Optional: Add a refresh button if polling is disabled or long */}
          {/* {pollingInterval === false && <IconButton size="small" onClick={() => refetchActiveAlerts()} disabled={isQueryFetching}><RefreshIcon fontSize="small" /></IconButton>} */}
        </Stack>
        <Divider sx={{ mb: 0.5 }} />

        {/* Dynamic Content */}
        {renderMenuContent()}

      </Menu>
    </>
  );
};

export default AlertsDropdown;