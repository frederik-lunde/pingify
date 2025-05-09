
import { Router } from "express";
import * as authController from "../controllers/authController";
import { authenticate } from "../middleware/authMiddleware";

import {
  registerValidationRules,
  loginValidationRules,
  handleValidationErrors,
} from "../middleware/validators/authValidator";

const router = Router();



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



router.get("/me", authenticate, authController.getCurrentUser);

export default router;
