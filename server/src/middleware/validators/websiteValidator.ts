import { body, query, oneOf } from 'express-validator';
import {
    validateRequiredIntParam
} from './commonValidators';

const commonWebsiteUserFields = [
    body('name')
        .optional({ nullable: true })
        .isString()
        .trim()
        .escape(),
    body('interval')
        .optional({ nullable: true })
        .isInt({ gt: 0 })
        .withMessage('Interval must be a positive integer.')
        .toInt(),
    body('alertThreshold')
        .optional({ nullable: true })
        .isInt({ gt: 0 })
        .withMessage('Alert threshold must be a positive integer.')
        .toInt(),
    body('notifyEmail')
        .optional({ nullable: true, checkFalsy: true })
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

export const getWebsiteByIdValidationRules = () => [
    validateRequiredIntParam('id'),
];

export const updateWebsiteValidationRules = () => [
    validateRequiredIntParam('id'),
    oneOf([
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

export const updateUserWebsiteValidationRules = () => [
    validateRequiredIntParam('id'),
    oneOf([
        body('name').exists(),
        body('interval').exists(),
        body('alertThreshold').exists(),
        body('notifyEmail').exists(),
        body('alertEnabled').exists(),
        body('isPinned').exists(),
    ], { message: 'At least one field (name, interval, alertThreshold, notifyEmail, alertEnabled, isPinned) must be provided for update.' }),
    ...commonWebsiteUserFields
];

export const setPinStatusValidationRules = () => [
    validateRequiredIntParam('id'),
    body('isPinned')
        .exists({ checkNull: false })
        .isBoolean()
        .withMessage('isPinned must be a boolean.')
        .toBoolean(),
];

export const deleteWebsiteValidationRules = () => [
    validateRequiredIntParam('id'),
];


export const addWebsiteToUserValidationRules = () => [
    body('url')
        .isURL({ protocols: ['http', 'https'], require_protocol: true })
        .withMessage('Invalid URL format. Must include http:// or https://'),
    ...commonWebsiteUserFields
];

export const searchWebsitesValidationRules = () => [
    query('query')
        .isString()
        .trim()
        .isLength({ min: 2 })
        .withMessage('Search query must be at least 2 characters long.')
        .escape(),
];