
type User = {
    id: number;
    username: string;
    password: string;
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