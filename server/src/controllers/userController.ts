import { Request, Response } from 'express';
import * as userService from '../services/userService';

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await userService.getUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Error fetching users" });
  }
};

export const getUserById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const user = await userService.getUserById(id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Error fetching user" });
  }
};

export const createUser = async (req: Request<{}, {}, { username: string; password: string }>, res: Response): Promise<void> => {
  const { username, password } = req.body;
  try {
    const user = await userService.createUser({ username, password });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Error creating user" });
  }
};
