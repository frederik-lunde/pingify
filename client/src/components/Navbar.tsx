import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuIcon from '@mui/icons-material/Menu';
import Container from '@mui/material/Container';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import AdbIcon from '@mui/icons-material/Adb';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router';
import AddIcon from '@mui/icons-material/Add';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import NotificationsIcon from '@mui/icons-material/Notifications';
import Badge from '@mui/material/Badge';
import { useCallback } from 'react';
import { Alert } from '../types'; // Assuming you have an Alert type
import { getAlertTypeColor } from '../utils/statusUtils'; // Your alert color utility
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { formatDistanceToNow } from 'date-fns';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';

// Mock alerts data - replace with your actual data source
const mockAlerts: Alert[] = [
  {
    id: '1',
    websiteId: '3',
    websiteName: 'Example Site',
    type: 'down',
    message: 'Website is down',
    createdAt: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
  },
  {
    id: '2',
    websiteId: '5',
    websiteName: 'Another Site',
    type: 'slow',
    message: 'High response time',
    createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
  },
  {
    id: '3',
    websiteId: '6',
    websiteName: 'Recovered Site',
    type: 'recovered',
    message: 'Back online',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
  },
];

const pages = [
  { 
    name: 'Add Website', 
    path: '/add-website',
    icon: <AddIcon fontSize="small" />,
    ariaLabel: 'Add new website to monitor' 
  },
  { 
    name: 'Export Data', 
    path: '#',
    icon: <ImportExportIcon fontSize="small" />,
    ariaLabel: 'Export monitoring data' 
  }
];

const settings = ['Profile', 'Logout'];

function Navbar() {
  const [anchorElNav, setAnchorElNav] = React.useState<null | HTMLElement>(null);
  const [anchorElUser, setAnchorElUser] = React.useState<null | HTMLElement>(null);
  const [anchorElNotifications, setAnchorElNotifications] = React.useState<null | HTMLElement>(null);
  const [alerts, setAlerts] = React.useState<Alert[]>(mockAlerts); // Replace with your actual alerts data

  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleOpenNavMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElNav(event.currentTarget);
  };

  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleOpenNotifications = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElNotifications(event.currentTarget);
  };

  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleCloseNotifications = () => {
    setAnchorElNotifications(null);
  };

  const handlePageClick = (path: string) => {
    handleCloseNavMenu();
    navigate(path);
  };

  const handleSettingClick = async (setting: string) => {
    handleCloseUserMenu();
    if (setting === 'Logout') {
      try {
        await logout();
        navigate('/login');
      } catch (error) {
        console.error('Failed to logout:', error);
      }
    }
  };

  const handleAlertClick = useCallback((websiteId: string) => {
    handleCloseNotifications();
    navigate(`/website/${websiteId}`);
  }, [navigate]);

  return (
    <AppBar position="static">
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          {/* Left side - Logo/Brand */}
          <AdbIcon sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }} />
          <Typography
            variant="h6"
            noWrap
            component="a"
            href="/"
            sx={{
              mr: 2,
              display: { xs: 'none', md: 'flex' },
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '.3rem',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            PINGIFY
          </Typography>

          {/* Mobile Menu */}
          <Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleOpenNavMenu}
              color="inherit"
            >
              <MenuIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorElNav}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
              open={Boolean(anchorElNav)}
              onClose={handleCloseNavMenu}
              sx={{ display: { xs: 'block', md: 'none' } }}
            >
              {pages.map((page) => (
                <MenuItem key={page.name} onClick={() => handlePageClick(page.path)}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {page.icon}
                    <Typography>{page.name}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Menu>
          </Box>

          {/* Mobile Logo */}
          <AdbIcon sx={{ display: { xs: 'flex', md: 'none' }, mr: 1 }} />
          <Typography
            variant="h5"
            noWrap
            component="a"
            href="/"
            sx={{
              mr: 2,
              display: { xs: 'flex', md: 'none' },
              flexGrow: 1,
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '.3rem',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            PINGIFY
          </Typography>

          {/* Desktop Navigation */}
          <Box sx={{ 
            flexGrow: 1, 
            display: { xs: 'none', md: 'flex' },
            gap: 2,
            ml: 3
          }}>
            {pages.map((page) => (
              <Tooltip key={page.name} title={page.name} arrow>
                <IconButton
                  aria-label={page.ariaLabel}
                  onClick={() => handlePageClick(page.path)}
                  color="inherit"
                  size="large"
                >
                  {page.icon}
                </IconButton>
              </Tooltip>
            ))}
          </Box>

          {/* Right-aligned icons */}
          <Box sx={{ 
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            ml: 'auto'
          }}>
            {/* Notifications */}
            <Tooltip title="Alerts">
              <IconButton
                aria-label={`Show ${alerts.length} alerts`}
                color="inherit"
                onClick={handleOpenNotifications}
              >
                <Badge 
                  badgeContent={alerts.length} 
                  color="error"
                  max={9}
                >
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>

            {/* User Menu */}
            <Tooltip title="Open settings">
              <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                <Avatar 
                  alt={user?.name} 
                  sx={{ 
                    bgcolor: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '1.2rem'
                  }}
                >
                  {user?.name?.charAt(0)?.toUpperCase()}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>

          {/* Notifications Dropdown */}
          <Menu
            anchorEl={anchorElNotifications}
            open={Boolean(anchorElNotifications)}
            onClose={handleCloseNotifications}
            PaperProps={{
              sx: {
                maxHeight: '400px',
                width: '350px',
              }
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                Alerts
              </Typography>
              <Button 
                size="small"
                variant="text"
                color="primary"
                onClick={() => {
                  // TODO: Implement mark all as read functionality
                  console.log('Mark all alerts as read', alerts);
                  // This will be replaced with your actual API call
                }}
                disabled={alerts.length === 0}
                sx={{
                  textTransform: 'none',
                  minWidth: 'auto'
                }}
              >
                Mark all as read
              </Button>
            </Stack>
            <Divider />
            {alerts.length === 0 ? (
              <MenuItem disabled>
                <Typography variant="body2" color="text.secondary">
                  No new alerts
                </Typography>
              </MenuItem>
            ) : (
              alerts.map((alert) => (
                <MenuItem 
                  key={alert.id} 
                  onClick={() => handleAlertClick(alert.websiteId)}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    }
                  }}
                >
                  <ListItemIcon>
                    <FiberManualRecordIcon 
                      fontSize="small" 
                      color={getAlertTypeColor(alert.type)} 
                    />
                  </ListItemIcon>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2" fontWeight={500}>
                      {alert.websiteName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {alert.message}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                  </Typography>
                </MenuItem>
              ))
            )}
          </Menu>

          {/* User Menu Dropdown */}
          <Menu
            sx={{ mt: '45px' }}
            id="menu-appbar"
            anchorEl={anchorElUser}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorElUser)}
            onClose={handleCloseUserMenu}
          >
            {settings.map((setting) => (
              <MenuItem key={setting} onClick={() => handleSettingClick(setting)}>
                <Typography sx={{ textAlign: 'center' }}>{setting}</Typography>
              </MenuItem>
            ))}
          </Menu>
        </Toolbar>
      </Container>
    </AppBar>
  );
}

export default Navbar;