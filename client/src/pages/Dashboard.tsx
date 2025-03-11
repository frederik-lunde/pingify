import { useEffect, useState } from 'react';
import { fetchUsers, fetchUserById } from '../services/userService';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';

type User = {
  id: number;
  username: string;
  password: string;
  created_at: string;
};

function Dashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    const getUsers = async () => {
      try {
        const data = await fetchUsers();
        setUsers(data);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    getUsers();
  }, []);

  const handleFetchUserById = async (id: number) => {
    try {
      const data = await fetchUserById(id);
      setSelectedUser(data);
    } catch (error) {
      console.error('Error fetching user:', error);
    }
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
        {users.map((user) => (
          <Grid  size={{ xs: 12, sm: 6, md: 3 }} key={user.id}>
            <Paper elevation={3} sx={{ p: 2, backgroundColor: 'green' }}>
              <Box>
                <Typography variant="h2">{user.username}</Typography>
                <Typography variant="body1">{user.password}</Typography>
                <Button variant="contained" onClick={() => handleFetchUserById(user.id)}>
                  View Details
                </Button>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {selectedUser && (
        <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
          <Typography variant="h2" gutterBottom>
            Selected User Details
          </Typography>
          <Typography variant="body1">ID: {selectedUser.id}</Typography>
          <Typography variant="body1">Username: {selectedUser.username}</Typography>
          <Typography variant="body1">Password: {selectedUser.password}</Typography>
          <Typography variant="body1">Created at: {selectedUser.created_at}</Typography>
        </Paper>
      )}
    </Container>
  );
}

export default Dashboard;