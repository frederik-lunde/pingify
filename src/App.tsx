import React, { useEffect, useState } from 'react';
import './App.css';

type User = {
  id: number;
  username: string;
  password: string;
};

function App() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/users');
        const data: User[] = await response.json();
        setUsers(data);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();
  }, []);

  return (
    <>
      <div>
        <h1>Users</h1>
        <ul>
          {users.map(user => (
            <li key={user.id}>
              {user.username} {user.password}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export default App;