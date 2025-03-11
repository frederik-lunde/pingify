// server/src/controllers/user.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/userService';

export const getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await userService.getUsers();
    res.json(users);
  } catch (error) {
    next(error); // Pass error to global error handler
  }
};

// server/src/controllers/userController.ts
export const getUserById = async (
  req: Request<{ id: string }>, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await userService.getUserById(id);
    if (!user) {
      const error: any = new Error('User not found');
      error.status = 404;
      throw error;
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
};


export const createUser = async (
  req: Request<{}, {}, { username: string; password: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { username, password } = req.body;
    const user = await userService.createUser({ username, password });
    res.json(user);
  } catch (error) {
    next(error); // Pass error to global error handler
  }
};
