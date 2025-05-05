"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMyPasswordValidationRules = exports.updateMyProfileValidationRules = void 0;
// src/middleware/validators/userValidator.ts
const express_validator_1 = require("express-validator");
// Validation rules for PATCH /api/users/me
const updateMyProfileValidationRules = () => [
    (0, express_validator_1.oneOf)([
        (0, express_validator_1.body)('name').exists(),
        (0, express_validator_1.body)('email').exists(),
    ], { message: 'Either name or email must be provided for update.' }),
    (0, express_validator_1.body)('name')
        .optional()
        .isString()
        .trim()
        .notEmpty()
        .withMessage('Name cannot be empty.')
        .escape(),
    (0, express_validator_1.body)('email')
        .optional()
        .isEmail()
        .withMessage('Invalid email format.')
        .normalizeEmail(),
];
exports.updateMyProfileValidationRules = updateMyProfileValidationRules;
// Validation rules for PATCH /api/users/me/password
const updateMyPasswordValidationRules = () => [
    (0, express_validator_1.body)('currentPassword')
        .notEmpty()
        .withMessage('Current password is required.'),
    (0, express_validator_1.body)('newPassword')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters long.'),
];
exports.updateMyPasswordValidationRules = updateMyPasswordValidationRules;
