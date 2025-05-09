
import { VALID_ALERT_TYPES } from "../../types"; 
import {
  validateOptionalIntQueryParam,
  validateRequiredIntParam,
  validateOptionalDateQueryParam,
  validateOptionalEnumQueryParam,
} from "./commonValidators";


export const getUserAlertsValidationRules = () => [
  validateOptionalIntQueryParam("limit"),
  
  validateOptionalEnumQueryParam("type", VALID_ALERT_TYPES),
  validateOptionalDateQueryParam("from"),
  validateOptionalDateQueryParam("to"),
  validateOptionalIntQueryParam("websiteId"),
];


export const dismissAlertValidationRules = () => [
  validateRequiredIntParam("alertId"),
];


export const getAlertsByWebsiteValidationRules = () => [
  validateRequiredIntParam("websiteId"),
  validateOptionalIntQueryParam("limit"),
  
  validateOptionalEnumQueryParam("type", VALID_ALERT_TYPES),
  validateOptionalDateQueryParam("from"),
  validateOptionalDateQueryParam("to"),
];


export const getUserAlertStatsValidationRules = () => [
  validateOptionalIntQueryParam("days").default(7),
];
