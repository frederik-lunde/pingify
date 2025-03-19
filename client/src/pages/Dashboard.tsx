import { useEffect, useState } from 'react';
import { getWebsitesForUser } from '../services/websiteService';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { Website } from '../types';



function Dashboard() {
  const [websites, setWebsites] = useState<Website[]>([]);
  // const [users, setUsers] = useState<User[]>([]);
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);

  useEffect(() => {
    const getWebsites = async () => {
      try {
        const data = await getWebsitesForUser();
        setWebsites(data);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    getWebsites();
  }, []);

  const handleFetchWebsiteDetails = async () => {
    //Placeholder get website by websiteid
  };

  return (
    <Container>
      <Typography variant="h1" gutterBottom>
        Users
      </Typography>
      <Button variant="contained" href="/create" sx={{ mb: 3 }}>
        Create User
      </Button>
      <Grid container spacing={{ xs: 2, md: 3 }}>
        {websites.map((website) => (
          <Grid  size={{ xs: 12, sm: 6, md: 3 }} key={website.id}>
            <Paper elevation={3} sx={{ p: 2, backgroundColor: 'green' }}>
              <Box>
                <Typography variant="h2">{website.name}</Typography>
                <Typography variant="body1">{website.url}</Typography>
                <Button variant="contained" onClick={() => handleFetchWebsiteDetails()}>
                  View Details
                </Button>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {selectedWebsite && (
        <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
          <Typography variant="h2" gutterBottom>
            Selected User Details
          </Typography>
          <Typography variant="body1">ID: {selectedWebsite.url}</Typography>

        </Paper>
      )}
    </Container>
  );
}

export default Dashboard;