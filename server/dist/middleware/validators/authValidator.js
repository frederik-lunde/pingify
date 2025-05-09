"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleValidationErrors =
  exports.loginValidationRules =
  exports.registerValidationRules =
    void 0;
// src/middleware/validators/authValidators.ts
const express_validator_1 = require("express-validator");
// --- Validation Rules ---
const registerValidationRules = () => {
  return [
    (0, express_validator_1.body)("email")
      .trim() // Remove leading/trailing whitespace
      .isEmail()
      .withMessage("Please provide a valid email address.")
      .normalizeEmail(), // Canonicalize email address
    (0, express_validator_1.body)("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long."),
    // .matches(/\d/).withMessage('Password must contain a number')
    // .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    (0, express_validator_1.body)("name")
      .optional() // Name is optional based on your schema (String?)
      .trim()
      .escape() // Basic sanitization against XSS if name is displayed directly
      .isLength({ max: 100 })
      .withMessage("Name cannot exceed 100 characters."),
  ];
};
exports.registerValidationRules = registerValidationRules;
const loginValidationRules = () => {
  return [
    (0, express_validator_1.body)("email")
      .trim()
      .isEmail()
      .withMessage("Please provide a valid email address.")
      .normalizeEmail(),
    (0, express_validator_1.body)("password")
      .notEmpty() // Just needs to exist for login
      .withMessage("Password is required."),
  ];
};
exports.loginValidationRules = loginValidationRules;
// --- Validation Error Handler Middleware ---
const handleValidationErrors = (req, res, next) => {
  const errors = (0, express_validator_1.validationResult)(req);
  if (!errors.isEmpty()) {
    // Send a 400 Bad Request response with the validation errors
    res.status(400).json({ errors: errors.array() });
    return; // Stop processing if errors found
  }
  // No errors, proceed to the next middleware or route handler
  next();
};
exports.handleValidationErrors = handleValidationErrors;
