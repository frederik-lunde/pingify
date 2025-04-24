// src/middleware/validators/monitoringValidator.ts
import { VALID_TIMEFRAMES, VALID_SORT_BY, VALID_SORT_DIR } from '../../types';
import {
    validateOptionalIntQueryParam,
    validateRequiredIntParam,
    validateOptionalDateQueryParam,
    validateOptionalEnumQueryParam
} from './commonValidators';

// Validation rules for GET /api/monitoring/admin/results and GET /api/monitoring/user/results
export const getResultsValidationRules = () => [
    validateOptionalIntQueryParam('limit'),
    validateOptionalDateQueryParam('from'),
    validateOptionalDateQueryParam('to'),
];

// Validation rules for GET /api/monitoring/website/:websiteId/results
export const getResultsByWebsiteValidationRules = () => [
    validateRequiredIntParam('websiteId'),
    validateOptionalIntQueryParam('limit'),
    validateOptionalDateQueryParam('from'),
    validateOptionalDateQueryParam('to'),
];

// Validation rules for POST /api/monitoring/check/:websiteId
export const triggerWebsiteCheckValidationRules = () => [
    validateRequiredIntParam('websiteId'),
];

// Validation rules for GET /api/monitoring/admin/stats and GET /api/monitoring/user/stats
export const getStatsValidationRules = () => [
    // --- CORRECTED: Use common validator with constant ---
    validateOptionalEnumQueryParam('period', VALID_TIMEFRAMES).default('week'),
];

// Validation rules for GET /api/monitoring/website/:websiteId/stats
export const getWebsiteStatsValidationRules = () => [
    validateRequiredIntParam('websiteId'),
    // --- CORRECTED: Use common validator with constant ---
    validateOptionalEnumQueryParam('period', VALID_TIMEFRAMES).default('week'),
];

// Validation rules for GET /api/monitoring/website/:websiteId
export const getWebsiteDetailsValidationRules = () => [
    validateRequiredIntParam('websiteId'),
    // --- CORRECTED: Pass the imported constants ---
    validateOptionalEnumQueryParam('timeframe', VALID_TIMEFRAMES).default('day'),
    validateOptionalIntQueryParam('limit').default(25),
    validateOptionalIntQueryParam('incidentLimit').default(10),
    validateOptionalEnumQueryParam('sortBy', VALID_SORT_BY).default('checkedAt'),
    validateOptionalEnumQueryParam('sortDir', VALID_SORT_DIR).default('desc'),
];