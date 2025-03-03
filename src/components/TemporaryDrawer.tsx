import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import FilterListIcon from '@mui/icons-material/FilterList';
import SettingsIcon from '@mui/icons-material/Settings';

interface TemporaryDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function TemporaryDrawer({ open, onClose }: TemporaryDrawerProps) {
  // Calculate the height of the AppBar
  const appBarHeight = 64; // Default height of MUI AppBar

  const DrawerList = (
    <Box sx={{ width: 250 }} role="presentation" onClick={onClose}>
      <List>
        {['Add Website', 'Filters', 'Settings'].map((text, index) => (
          <ListItem key={text} disablePadding>
            <ListItemButton>
              <ListItemIcon>
                {index === 0 ? <AddCircleOutlineIcon /> : index === 1 ? <FilterListIcon /> : <SettingsIcon />}
              </ListItemIcon>
              <ListItemText primary={text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          marginTop: `${appBarHeight}px`,
          height: `calc(100% - ${appBarHeight}px)`,
          boxSizing: 'border-box',
        },
        '& .MuiBackdrop-root': {
          backgroundColor: 'transparent', // Make backdrop transparent
        }
      }}
      variant="temporary"
      ModalProps={{
        keepMounted: true, // Better performance on mobile
      }}
      slotProps={{
        backdrop: {
          invisible: true // Modern way to make backdrop invisible
        }
      }}
    >
      {DrawerList}
    </Drawer>
  );
}