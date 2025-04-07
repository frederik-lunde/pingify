// client/src/components/Navbar.tsx
import * as React from "react";
import { useCallback, useState } from "react"; // Added useState
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Menu from "@mui/material/Menu";
import MenuIcon from "@mui/icons-material/Menu";
import Container from "@mui/material/Container";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import MenuItem from "@mui/material/MenuItem";
import AdbIcon from "@mui/icons-material/Adb"; // Keep or replace with your actual logo icon
import { useAuth } from "../context/AuthContext"; // Correct: Uses the context hook
import { useNavigate } from "react-router";
import AddIcon from "@mui/icons-material/Add";
// Corrected import path based on provided file name `AlertsDropdown.tsx`
import AlertsDropdown from "./navbar/AlertDropdown";
// Make sure AlertQueryOptions is imported if needed, or remove unused import
// import { AlertQueryOptions } from "../types";

// --- Navigation Items ---
// Define pages with icons and aria labels for better structure and accessibility
const pages = [
  {
    name: "Add Website",
    path: "/add-website",
    icon: <AddIcon fontSize="small" />,
    ariaLabel: "Add new website to monitor",
  },
  // { // Example for future feature
  //   name: "Export Data",
  //   path: "/export", // Or specific path
  //   icon: <ImportExportIcon fontSize="small" />,
  //   ariaLabel: "Export monitoring data",
  // },
];

// --- User Menu Items ---
const settings = ["Profile", "Logout"];

function Navbar() {
  // State for mobile and user menus
  const [anchorElNav, setAnchorElNav] = useState<null | HTMLElement>(null);
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);

  // Get auth state and logout function from context
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  // --- Menu Handlers ---
  const handleOpenNavMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElNav(event.currentTarget);
  };

  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  // Navigate to page and close mobile menu
  const handlePageClick = useCallback(
    (path: string) => {
      handleCloseNavMenu();
      if (path !== "#") { // Avoid navigation for placeholder paths
        navigate(path);
      } else {
        // Handle placeholder actions if needed (e.g., open modal)
        console.log("Placeholder action for:", path);
      }
    },
    [navigate], // Removed handleCloseNavMenu dependency as it's stable
  );

  // Handle user menu item clicks (Profile, Logout)
  const handleSettingClick = useCallback(
    async (setting: string) => {
      handleCloseUserMenu();
      if (setting === "Logout") {
        try {
          await logout(); // Call logout from useAuth context
          // Navigation is handled implicitly by useAuthCore's effect or listener after logout completes
          // navigate("/login"); // Explicit navigation can be removed if handled globally
        } catch (error) {
          console.error("Failed to logout:", error);
          // Handle logout error display if necessary
        }
      } else if (setting === "Profile") {
        // Placeholder for navigating to profile page
         navigate("/profile"); // Example navigation
        console.log("Navigate to Profile page");
      }
    },
    [logout, navigate], // Removed handleCloseUserMenu dependency
  );

  // --- Render Logic ---
  return (
    <AppBar position="static">
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          {/* Desktop Logo */}
          <Box
            onClick={() => navigate("/")}
            sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", cursor: "pointer", mr: 1 }}
          >
            <AdbIcon /> {/* Replace with your Logo */}
          </Box>
          <Typography
            variant="h6"
            noWrap
            component="div" // Changed to div, navigation handled by Box onClick
            onClick={() => navigate("/")}
            sx={{
              mr: 2,
              display: { xs: "none", md: "flex" },
              fontFamily: "monospace",
              fontWeight: 700,
              letterSpacing: ".3rem",
              color: "inherit",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            PINGIFY {/* Your App Name */}
          </Typography>

          {/* Mobile Menu Button */}
          <Box sx={{ flexGrow: 1, display: { xs: "flex", md: "none" } }}>
            <IconButton
              size="large"
              aria-label="navigation menu"
              aria-controls="menu-appbar-nav" // Ensure ID matches Menu
              aria-haspopup="true"
              onClick={handleOpenNavMenu}
              color="inherit"
            >
              <MenuIcon />
            </IconButton>
            {/* Mobile Navigation Menu */}
            <Menu
              id="menu-appbar-nav" // Matches aria-controls
              anchorEl={anchorElNav}
              anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
              keepMounted
              transformOrigin={{ vertical: "top", horizontal: "left" }}
              open={Boolean(anchorElNav)}
              onClose={handleCloseNavMenu}
              sx={{ display: { xs: "block", md: "none" } }}
            >
              {pages.map((page) => (
                <MenuItem key={page.name} onClick={() => handlePageClick(page.path)}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}> {/* Added gap */}
                    {page.icon}
                    <Typography>{page.name}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Menu>
          </Box>

          {/* Mobile Logo */}
          <Box
            onClick={() => navigate("/")}
            sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", cursor: "pointer", mr: 1 }}
          >
             <AdbIcon /> {/* Replace with your Logo */}
          </Box>
          <Typography
            variant="h5" // Slightly larger for mobile visibility
            noWrap
            component="div" // Changed to div
            onClick={() => navigate("/")}
            sx={{
              mr: 2,
              display: { xs: "flex", md: "none" },
              flexGrow: 1, // Takes available space
              fontFamily: "monospace",
              fontWeight: 700,
              letterSpacing: ".3rem",
              color: "inherit",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            PINGIFY {/* Your App Name */}
          </Typography>

          {/* Desktop Navigation Buttons */}
          <Box sx={{ flexGrow: 1, display: { xs: "none", md: "flex" }, gap: 1, ml: 2 }}> {/* Reduced gap/margin */}
            {pages.map((page) => (
              <Tooltip key={page.name} title={page.ariaLabel || page.name} arrow>
                {/* Wrap IconButton in span for Tooltip when disabled */}
                <span>
                   <IconButton
                    aria-label={page.ariaLabel || page.name}
                    onClick={() => handlePageClick(page.path)}
                    color="inherit"
                    size="medium" // Slightly smaller icon buttons
                    // disabled={page.path === "#"} // Example: Disable placeholder buttons
                   >
                    {page.icon}
                   </IconButton>
                </span>
              </Tooltip>
            ))}
          </Box>

          {/* Right-aligned Icons (Alerts, User Menu) */}
          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 2 }, ml: "auto" }}> {/* Responsive gap */}
            {/* Alerts Dropdown Component */}
            {/* Pass necessary options for fetching unread alerts */}
            <AlertsDropdown
              options={{
                limit: 50, // How many alerts to fetch initially
              }}
              pollingInterval={60000} // e.g., Refetch every 60 seconds when dropdown is open
            />

            {/* User Menu */}
            <Tooltip title="Open settings">
              <IconButton
                 onClick={handleOpenUserMenu}
                 sx={{ p: 0 }}
                 aria-label="open user menu"
                 aria-controls="menu-appbar-user" // Ensure ID matches Menu
                 aria-haspopup="true"
              >
                <Avatar
                  alt={user?.name || user?.email || 'User'} // Provide alt text
                  sx={{
                    width: { xs: 32, sm: 40 }, // Responsive size
                    height: { xs: 32, sm: 40 },
                    bgcolor: "secondary.main", // Use theme color
                    fontSize: "1rem", // Adjust font size if needed
                  }}
                >
                  {/* Display first letter of name or email */}
                  {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "?"}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>

          {/* User Menu Dropdown */}
          <Menu
            id="menu-appbar-user" // Matches aria-controls
            sx={{ mt: "45px" }}
            anchorEl={anchorElUser}
            anchorOrigin={{ vertical: "top", horizontal: "right" }}
            keepMounted
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            open={Boolean(anchorElUser)}
            onClose={handleCloseUserMenu}
          >
            {/* User Info Display (Optional) */}
             <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
                 <Typography variant="subtitle1" fontWeight="bold">{user?.name || 'User'}</Typography>
                 <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
             </Box>

            {settings.map((setting) => (
              <MenuItem key={setting} onClick={() => handleSettingClick(setting)}>
                <Typography sx={{ textAlign: "center" }}>{setting}</Typography>
              </MenuItem>
            ))}
          </Menu>
        </Toolbar>
      </Container>
    </AppBar>
  );
}

export default Navbar;