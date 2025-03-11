
type User = {
    id: number;
    username: string;
    password: string;
    created_at: string;
  };
  
export const fetchUsers = async (): Promise<User[]> => {
    try {
      const response = await fetch('http://localhost:3001/api/users');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data: User[] = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  };
  
  export const fetchUserById = async (id: number): Promise<User> => {
    try {
      const response = await fetch(`http://localhost:3001/api/users/${id}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data: User = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching user:', error);
      throw error;
    }
  };

  export const createUser = async (user: User): Promise<User> => {
    try {
      const response = await fetch('http://localhost:3001/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(user),
      });
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data: User = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }