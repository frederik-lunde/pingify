import {useState } from 'react';
import { createUser } from '../services/userService';
import '../App.css';
import Button from '@mui/material/Button';

type User = {
  id: number;
  username: string;
  password: string;
  created_at: string;
};

function CreateUser(){
    const [user, setUser] = useState<User>({
        id: 0,
        username: '',
        password: '',
        created_at: '',
    });
    
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setUser((prevUser) => ({
        ...prevUser,
        [name]: value,
        }));
    };
    
    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        try {
        const data = await createUser(user);
        console.log('User created:', data);
        } catch (error) {
        console.error('Error creating user:', error);
        }
    };
    
    return (
        <>
        <h1>Create User</h1>
        <form onSubmit={handleSubmit}>
            <label>
            Username:
            <input type='text' name='username' value={user.username} onChange={handleChange} />
            </label>
            <label>
            Password:
            <input type='password' name='password' value={user.password} onChange={handleChange} />
            </label>
            <Button type='submit' variant='contained'>Create User</Button>
        </form>
        </>
    );
}

export default CreateUser;