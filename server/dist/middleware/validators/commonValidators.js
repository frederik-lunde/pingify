"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateOptionalEnumQueryParam = exports.validateOptionalDateQueryParam = exports.validateRequiredIntParam = exports.validateOptionalIntQueryParam = void 0;
// src/middleware/validators/commonValidators.ts
const express_validator_1 = require("express-validator");
const validateOptionalIntQueryParam = (paramName) => (0, express_validator_1.query)(paramName)
    .optional()
    .isInt({ gt: 0 })
    .withMessage(`${paramName} must be a positive integer.`)
    .toInt();
exports.validateOptionalIntQueryParam = validateOptionalIntQueryParam;
const validateRequiredIntParam = (paramName) => (0, express_validator_1.param)(paramName)
    .isInt({ gt: 0 })
    .withMessage(`${paramName} must be a positive integer.`)
    .toInt();
exports.validateRequiredIntParam = validateRequiredIntParam;
const validateOptionalDateQueryParam = (paramName) => (0, express_validator_1.query)(paramName)
    .optional()
    .isISO8601()
    .withMessage(`${paramName} must be a valid ISO 8601 date.`)
    .toDate();
exports.validateOptionalDateQueryParam = validateOptionalDateQueryParam;
const validateOptionalEnumQueryParam = (paramName, validValues) => (0, express_validator_1.query)(paramName)
    .optional()
    .isIn(validValues)
    .withMessage(`${paramName} must be one of: ${validValues.join(', ')}`);
exports.validateOptionalEnumQueryParam = validateOptionalEnumQueryParam;
