// src/routes/authRoutes.ts
import { Router } from "express";
import * as authController from "../controllers/authController";
import { authenticate } from "../middleware/authMiddleware";
// --- Import the validator middleware ---
import {
  registerValidationRules,
  loginValidationRules,
  handleValidationErrors,
} from "../middleware/validators/authValidator";

const router = Router();

// --- Public Routes ---

router.post(
  "/register",
  registerValidationRules(),
  handleValidationErrors,
  authController.register,
);

router.post(
  "/login",
  loginValidationRules(),
  handleValidationErrors,
  authController.login,
);

// --- Protected Routes ---

router.get("/me", authenticate, authController.getCurrentUser);

export default router;
