import { VALID_TIMEFRAMES, VALID_SORT_BY, VALID_SORT_DIR } from "../../types";
import {
  validateOptionalIntQueryParam,
  validateRequiredIntParam,
  validateOptionalDateQueryParam,
  validateOptionalEnumQueryParam,
} from "./commonValidators";

export const getResultsValidationRules = () => [
  validateOptionalIntQueryParam("limit"),
  validateOptionalDateQueryParam("from"),
  validateOptionalDateQueryParam("to"),
];

export const getResultsByWebsiteValidationRules = () => [
  validateRequiredIntParam("websiteId"),
  validateOptionalIntQueryParam("limit"),
  validateOptionalDateQueryParam("from"),
  validateOptionalDateQueryParam("to"),
];

export const triggerWebsiteCheckValidationRules = () => [
  validateRequiredIntParam("websiteId"),
];

export const getStatsValidationRules = () => [
  validateOptionalEnumQueryParam("period", VALID_TIMEFRAMES).default("week"),
];

export const getWebsiteStatsValidationRules = () => [
  validateRequiredIntParam("websiteId"),

  validateOptionalEnumQueryParam("period", VALID_TIMEFRAMES).default("week"),
];

export const getWebsiteDetailsValidationRules = () => [
  validateRequiredIntParam("websiteId"),

  validateOptionalEnumQueryParam("timeframe", VALID_TIMEFRAMES).default("day"),
  validateOptionalIntQueryParam("limit").default(25),
  validateOptionalIntQueryParam("incidentLimit").default(10),
  validateOptionalEnumQueryParam("sortBy", VALID_SORT_BY).default("checkedAt"),
  validateOptionalEnumQueryParam("sortDir", VALID_SORT_DIR).default("desc"),
];
