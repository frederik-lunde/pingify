// src/middleware/validators/websiteValidator.ts
import { body, param, query, oneOf } from 'express-validator';
import {
    validateRequiredIntParam
} from './commonValidators';

const commonWebsiteUserFields = [
    body('name')
        .optional({ nullable: true }) // Allow null or undefined
        .isString()
        .trim()
        .escape(),
    body('interval')
        .optional({ nullable: true }) // Allow null or undefined
        .isInt({ gt: 0 })
        .withMessage('Interval must be a positive integer.')
        .toInt(),
    body('alertThreshold')
        .optional({ nullable: true }) // Allow null or undefined
        .isInt({ gt: 0 })
        .withMessage('Alert threshold must be a positive integer.')
        .toInt(),
    body('notifyEmail')
        .optional({ nullable: true, checkFalsy: true }) // Allow null, undefined, or ""
        .isEmail()
        .withMessage('Invalid email format for notifications.')
        .normalizeEmail(),
    body('alertEnabled')
        .optional()
        .isBoolean()
        .withMessage('Alert enabled must be a boolean.')
        .toBoolean(),
    body('isPinned')
        .optional()
        .isBoolean()
        .withMessage('Is pinned must be a boolean.')
        .toBoolean(),
];

// Validation rules for GET /api/websites/:id and GET /api/websites/user/dashboard/:id
export const getWebsiteByIdValidationRules = () => [
    validateRequiredIntParam('id'),
];

// Validation rules for POST /api/websites/admin/create
export const createWebsiteValidationRules = () => [
    body('url')
        .isURL({ protocols: ['http', 'https'], require_protocol: true })
        .withMessage('Invalid URL format. Must include http:// or https://'),
    body('interval')
        .optional()
        .isInt({ gt: 0 })
        .withMessage('Interval must be a positive integer.')
        .toInt(),
];

// Validation rules for PUT /api/websites/admin/:id
export const updateWebsiteValidationRules = () => [
    validateRequiredIntParam('id'),
    oneOf([ // Require at least one field
        body('url').exists(),
        body('isActive').exists(),
    ], { message: 'Either url or isActive must be provided for update.' }),
    body('url')
        .optional()
        .isURL({ protocols: ['http', 'https'], require_protocol: true })
        .withMessage('Invalid URL format. Must include http:// or https://'),
    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean.')
        .toBoolean(),
];

// Validation rules for PUT /api/websites/user/dashboard/:id
export const updateUserWebsiteValidationRules = () => [
    validateRequiredIntParam('id'),
    oneOf([ // Require at least one field to update
        body('name').exists(),
        body('interval').exists(),
        body('alertThreshold').exists(),
        body('notifyEmail').exists(),
        body('alertEnabled').exists(),
        body('isPinned').exists(),
    ], { message: 'At least one field (name, interval, alertThreshold, notifyEmail, alertEnabled, isPinned) must be provided for update.' }),
    ...commonWebsiteUserFields
];

// Validation rules for PATCH /api/websites/user/dashboard/:id/pin
export const setPinStatusValidationRules = () => [
    validateRequiredIntParam('id'),
    body('isPinned')
        .exists({ checkNull: false }) // Ensure it exists, even if false
        .isBoolean()
        .withMessage('isPinned must be a boolean.')
        .toBoolean(),
];

// Validation rules for DELETE /api/websites/admin/:id and DELETE /api/websites/user/dashboard/:id
export const deleteWebsiteValidationRules = () => [
    validateRequiredIntParam('id'),
];

// Validation rules for PATCH /api/websites/admin/:id/toggle
export const toggleWebsiteStatusValidationRules = () => [
    validateRequiredIntParam('id'),
];

// Validation rules for POST /api/websites/user/dashboard
export const addWebsiteToUserValidationRules = () => [
    body('url')
        .isURL({ protocols: ['http', 'https'], require_protocol: true })
        .withMessage('Invalid URL format. Must include http:// or https://'),
    ...commonWebsiteUserFields
];

// Validation rules for GET /api/websites/search
export const searchWebsitesValidationRules = () => [
    query('query')
        .isString()
        .trim()
        .isLength({ min: 2 })
        .withMessage('Search query must be at least 2 characters long.')
        .escape(),
];