
import { Request, Response, NextFunction } from "express";
import * as authService from "../services/authService";
import prisma from "../prisma/prismaClient"; 

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    const result = await authService.registerUser({ email, password, name });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser({ email, password });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId }, 
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res
        .status(404)
        .json({ message: "User associated with token not found." });
      return;
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
};
