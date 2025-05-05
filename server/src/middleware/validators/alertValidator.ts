// src/middleware/validators/alertValidator.ts
import { VALID_ALERT_TYPES } from '../../types'; // Import the constant
import {
    validateOptionalIntQueryParam,
    validateRequiredIntParam,
    validateOptionalDateQueryParam,
    validateOptionalEnumQueryParam
} from './commonValidators';

// Validation rules for GET /api/alerts/user
export const getUserAlertsValidationRules = () => [
    validateOptionalIntQueryParam('limit'),
    // --- CORRECTED: Pass the imported constant ---
    validateOptionalEnumQueryParam('type', VALID_ALERT_TYPES),
    validateOptionalDateQueryParam('from'),
    validateOptionalDateQueryParam('to'),
    validateOptionalIntQueryParam('websiteId'),
];

// Validation rules for DELETE /api/alerts/:alertId
export const dismissAlertValidationRules = () => [
    validateRequiredIntParam('alertId'),
];

// Validation rules for GET /api/alerts/website/:websiteId
export const getAlertsByWebsiteValidationRules = () => [
    validateRequiredIntParam('websiteId'),
    validateOptionalIntQueryParam('limit'),
    // --- CORRECTED: Pass the imported constant ---
    validateOptionalEnumQueryParam('type', VALID_ALERT_TYPES),
    validateOptionalDateQueryParam('from'),
    validateOptionalDateQueryParam('to'),
];

// Validation rules for GET /api/alerts/user/stats
export const getUserAlertStatsValidationRules = () => [
    validateOptionalIntQueryParam('days').default(7),
];