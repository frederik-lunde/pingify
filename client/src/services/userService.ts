import axios from 'axios';

type User = {
  id: number;
  email: string;
  password: string;
  created_at: string;
};

export const fetchUsers = async (): Promise<User[]> => {
  try {
    const response = await axios.get<User[]>('http://localhost:3001/api/users');
    return response.data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export const fetchUserById = async (id: number): Promise<User> => {
  try {
    const response = await axios.get<User>(`http://localhost:3001/api/users/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
};

export const createUser = async (user: User): Promise<User> => {
  try {
    const response = await axios.post<User>(
      'http://localhost:3001/api/users',
      user,
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};
