
import { body, oneOf } from 'express-validator';


export const updateMyProfileValidationRules = () => [
    oneOf([ 
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


export const updateMyPasswordValidationRules = () => [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required.'),
    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters long.'),
];