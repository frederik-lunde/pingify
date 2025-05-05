// src/middleware/validators/userValidator.ts
import { body, oneOf } from 'express-validator';

// Validation rules for PATCH /api/users/me
export const updateMyProfileValidationRules = () => [
    oneOf([ // Ensure at least one field is present
        body('name').exists(),
        body('email').exists(),
    ], { message: 'Either name or email must be provided for update.' }),
    body('name')
        .optional()
        .isString()
        .trim()
        .notEmpty()
        .withMessage('Name cannot be empty.')
        .escape(),
    body('email')
        .optional()
        .isEmail()
        .withMessage('Invalid email format.')
        .normalizeEmail(),
];

// Validation rules for PATCH /api/users/me/password
export const updateMyPasswordValidationRules = () => [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required.'),
    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters long.'),
];