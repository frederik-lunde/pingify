import {useEffect, useState } from 'react';
import './App.css';
import { fetchUsers, fetchUserById } from './services/userService';
import Button from '@mui/material/Button';



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
      <div>
        <h1>Users</h1>
        <ul>
          {users.map(user => (
            <li key={user.id}>
              {user.username} {user.password}
              <Button variant='contained' onClick={() => handleFetchUserById(user.id)}>View Details</Button>
            </li>
          ))}
        </ul>
      </div>
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