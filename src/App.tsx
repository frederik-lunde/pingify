import {useEffect, useState } from 'react';

import './App.css';
import { fetchUsers, fetchUserById } from './services/userService';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid2';




type User = {
  id: number;
  username: string;
  password: string;
};

function App() {
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
    <>
    <h1>Users</h1>
    <Grid container spacing={{ xs: 2, md: 3 }} columns={{ xs: 4, sm: 8, md: 12 }}>
          {users.map(user => (

            <Grid border={2} padding={3} size={{ xs: 2, sm: 4, md: 4 }} key={user.id} >
              <div>
                <h2>{user.username}</h2>
                <p>{user.password}</p>
                <Button variant='contained' onClick={() => handleFetchUserById(user.id)}>View Details</Button>
              </div>
            </Grid>
          ))}
        </Grid>

        {selectedUser && (
        <div>
          <h2>Selected User Details</h2>
          <p>ID: {selectedUser.id}</p>
          <p>Username: {selectedUser.username}</p>
          <p>Password: {selectedUser.password}</p>
        </div>
      )}
    </>
  );
}

export default App;