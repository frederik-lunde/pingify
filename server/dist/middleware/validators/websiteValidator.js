"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchWebsitesValidationRules = exports.addWebsiteToUserValidationRules = exports.toggleWebsiteStatusValidationRules = exports.deleteWebsiteValidationRules = exports.setPinStatusValidationRules = exports.updateUserWebsiteValidationRules = exports.updateWebsiteValidationRules = exports.createWebsiteValidationRules = exports.getWebsiteByIdValidationRules = void 0;
// src/middleware/validators/websiteValidator.ts
const express_validator_1 = require("express-validator");
const commonValidators_1 = require("./commonValidators");
const commonWebsiteUserFields = [
    (0, express_validator_1.body)('name')
        .optional({ nullable: true }) // Allow null or undefined
        .isString()
        .trim()
        .escape(),
    (0, express_validator_1.body)('interval')
        .optional({ nullable: true }) // Allow null or undefined
        .isInt({ gt: 0 })
        .withMessage('Interval must be a positive integer.')
        .toInt(),
    (0, express_validator_1.body)('alertThreshold')
        .optional({ nullable: true }) // Allow null or undefined
        .isInt({ gt: 0 })
        .withMessage('Alert threshold must be a positive integer.')
        .toInt(),
    (0, express_validator_1.body)('notifyEmail')
        .optional({ nullable: true, checkFalsy: true }) // Allow null, undefined, or ""
        .isEmail()
        .withMessage('Invalid email format for notifications.')
        .normalizeEmail(),
    (0, express_validator_1.body)('alertEnabled')
        .optional()
        .isBoolean()
        .withMessage('Alert enabled must be a boolean.')
        .toBoolean(),
    (0, express_validator_1.body)('isPinned')
        .optional()
        .isBoolean()
        .withMessage('Is pinned must be a boolean.')
        .toBoolean(),
];
// Validation rules for GET /api/websites/:id and GET /api/websites/user/dashboard/:id
const getWebsiteByIdValidationRules = () => [
    (0, commonValidators_1.validateRequiredIntParam)('id'),
];
exports.getWebsiteByIdValidationRules = getWebsiteByIdValidationRules;
// Validation rules for POST /api/websites/admin/create
const createWebsiteValidationRules = () => [
    (0, express_validator_1.body)('url')
        .isURL({ protocols: ['http', 'https'], require_protocol: true })
        .withMessage('Invalid URL format. Must include http:// or https://'),
    (0, express_validator_1.body)('interval')
        .optional()
        .isInt({ gt: 0 })
        .withMessage('Interval must be a positive integer.')
        .toInt(),
];
exports.createWebsiteValidationRules = createWebsiteValidationRules;
// Validation rules for PUT /api/websites/admin/:id
const updateWebsiteValidationRules = () => [
    (0, commonValidators_1.validateRequiredIntParam)('id'),
    (0, express_validator_1.oneOf)([
        (0, express_validator_1.body)('url').exists(),
        (0, express_validator_1.body)('isActive').exists(),
    ], { message: 'Either url or isActive must be provided for update.' }),
    (0, express_validator_1.body)('url')
        .optional()
        .isURL({ protocols: ['http', 'https'], require_protocol: true })
        .withMessage('Invalid URL format. Must include http:// or https://'),
    (0, express_validator_1.body)('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean.')
        .toBoolean(),
];
exports.updateWebsiteValidationRules = updateWebsiteValidationRules;
// Validation rules for PUT /api/websites/user/dashboard/:id
const updateUserWebsiteValidationRules = () => [
    (0, commonValidators_1.validateRequiredIntParam)('id'),
    (0, express_validator_1.oneOf)([
        (0, express_validator_1.body)('name').exists(),
        (0, express_validator_1.body)('interval').exists(),
        (0, express_validator_1.body)('alertThreshold').exists(),
        (0, express_validator_1.body)('notifyEmail').exists(),
        (0, express_validator_1.body)('alertEnabled').exists(),
        (0, express_validator_1.body)('isPinned').exists(),
    ], { message: 'At least one field (name, interval, alertThreshold, notifyEmail, alertEnabled, isPinned) must be provided for update.' }),
    ...commonWebsiteUserFields
];
exports.updateUserWebsiteValidationRules = updateUserWebsiteValidationRules;
// Validation rules for PATCH /api/websites/user/dashboard/:id/pin
const setPinStatusValidationRules = () => [
    (0, commonValidators_1.validateRequiredIntParam)('id'),
    (0, express_validator_1.body)('isPinned')
        .exists({ checkNull: false }) // Ensure it exists, even if false
        .isBoolean()
        .withMessage('isPinned must be a boolean.')
        .toBoolean(),
];
exports.setPinStatusValidationRules = setPinStatusValidationRules;
// Validation rules for DELETE /api/websites/admin/:id and DELETE /api/websites/user/dashboard/:id
const deleteWebsiteValidationRules = () => [
    (0, commonValidators_1.validateRequiredIntParam)('id'),
];
exports.deleteWebsiteValidationRules = deleteWebsiteValidationRules;
// Validation rules for PATCH /api/websites/admin/:id/toggle
const toggleWebsiteStatusValidationRules = () => [
    (0, commonValidators_1.validateRequiredIntParam)('id'),
];
exports.toggleWebsiteStatusValidationRules = toggleWebsiteStatusValidationRules;
// Validation rules for POST /api/websites/user/dashboard
const addWebsiteToUserValidationRules = () => [
    (0, express_validator_1.body)('url')
        .isURL({ protocols: ['http', 'https'], require_protocol: true })
        .withMessage('Invalid URL format. Must include http:// or https://'),
    ...commonWebsiteUserFields
];
exports.addWebsiteToUserValidationRules = addWebsiteToUserValidationRules;
// Validation rules for GET /api/websites/search
const searchWebsitesValidationRules = () => [
    (0, express_validator_1.query)('query')
        .isString()
        .trim()
        .isLength({ min: 2 })
        .withMessage('Search query must be at least 2 characters long.')
        .escape(),
];
exports.searchWebsitesValidationRules = searchWebsitesValidationRules;
