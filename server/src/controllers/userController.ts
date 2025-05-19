import { Request, Response, NextFunction } from "express";
import * as userService from "../services/userService";
import { UpdateUserData, UpdatePasswordData } from "../services/userService";


export const getMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    const user = await userService.findUserById(req.user.id);
    if (!user) {
      res.status(404).json({ message: "User associated with token not found" });
      return;
    }
    res.json({ user });
  } catch (error) {
    next(error);
  }
};

export const updateMyProfile = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    const userId = req.user.id;

    const updateData = req.body as UpdateUserData;

    const updatedUser = await userService.updateUserProfile(userId, updateData);
    res.json({ user: updatedUser, message: "Profile updated successfully." });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Email already in use")
    ) {
      res.status(409).json({ message: error.message });
    } else if (
      error instanceof Error &&
      error.message.includes("No update data provided")
    ) {
      res.status(400).json({ message: error.message });
    } else {
      next(error);
    }
  }
};

export const updateMyPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    const userId = req.user.id;

    const passwordData = req.body as UpdatePasswordData;

    await userService.updateUserPassword(userId, passwordData);
    res.json({ message: "Password updated successfully." });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Invalid current password")
    ) {
      res.status(400).json({ message: error.message });
    } else if (error instanceof Error && error.message.includes("required")) {
      res.status(400).json({ message: error.message });
    } else if (
      error instanceof Error &&
      error.message.includes("User not found")
    ) {
      res.status(404).json({ message: error.message });
    } else {
      next(error);
    }
  }
};


export const deleteMyAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }
    const userId = req.user.id;

    await userService.deleteUserAccount(userId);
    res.status(204).send();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("not found during deletion")
    ) {
      console.warn(
        `Attempted to delete non-existent user or related record: ${req.user?.id}`,
      );
      res.status(404).json({ message: "User not found or already deleted." });
    } else {
      next(error);
    }
  }
};
