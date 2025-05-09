// src/middleware/validators/authValidators.ts
import { body, validationResult, ValidationChain } from "express-validator";
import { Request, Response, NextFunction } from "express";

// --- Validation Rules ---

export const registerValidationRules = (): ValidationChain[] => {
  return [
    body("email")
      .trim() // Remove leading/trailing whitespace
      .isEmail()
      .withMessage("Please provide a valid email address.")
      .normalizeEmail(), // Canonicalize email address

    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long."),
    // .matches(/\d/).withMessage('Password must contain a number')
    // .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')

    body("name")
      .optional() // Name is optional based on your schema (String?)
      .trim()
      .escape() // Basic sanitization against XSS if name is displayed directly
      .isLength({ max: 100 })
      .withMessage("Name cannot exceed 100 characters."),
  ];
};

export const loginValidationRules = (): ValidationChain[] => {
  return [
    body("email")
      .trim()
      .isEmail()
      .withMessage("Please provide a valid email address.")
      .normalizeEmail(),

    body("password")
      .notEmpty() // Just needs to exist for login
      .withMessage("Password is required."),
  ];
};

// --- Validation Error Handler Middleware ---

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Send a 400 Bad Request response with the validation errors
    res.status(400).json({ errors: errors.array() });
    return; // Stop processing if errors found
  }
  // No errors, proceed to the next middleware or route handler
  next();
};
