"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMyAccount = exports.updateMyPassword = exports.updateMyProfile = exports.getMyProfile = void 0;
const userService = __importStar(require("../services/userService"));
/**
 * GET /api/users/me - Get the current user's profile.
 * No input validation needed beyond authentication.
 */
const getMyProfile = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }
        const user = yield userService.findUserById(req.user.id);
        if (!user) {
            // Should not happen if token is valid, but good practice
            res.status(404).json({ message: 'User associated with token not found' });
            return;
        }
        res.json({ user });
    }
    catch (error) {
        next(error);
    }
});
exports.getMyProfile = getMyProfile;
/**
 * PATCH /api/users/me - Update the current user's profile (name, email).
 * Validation handled by middleware.
 */
const updateMyProfile = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }
        const userId = req.user.id;
        // Access validated and potentially sanitized body data
        const updateData = req.body;
        const updatedUser = yield userService.updateUserProfile(userId, updateData);
        res.json({ user: updatedUser, message: 'Profile updated successfully.' });
    }
    catch (error) {
        // Handle specific service errors (like email conflict)
        if (error instanceof Error && error.message.includes('Email already in use')) {
            res.status(409).json({ message: error.message });
        }
        else if (error instanceof Error && error.message.includes('No update data provided')) {
            res.status(400).json({ message: error.message }); // Should be caught by validator, but good fallback
        }
        else {
            next(error);
        }
    }
});
exports.updateMyProfile = updateMyProfile;
/**
 * PATCH /api/users/me/password - Update the current user's password.
 * Validation handled by middleware.
 */
const updateMyPassword = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }
        const userId = req.user.id;
        // Access validated body data
        const passwordData = req.body;
        yield userService.updateUserPassword(userId, passwordData);
        res.json({ message: 'Password updated successfully.' });
    }
    catch (error) {
        // Handle specific service errors
        if (error instanceof Error && error.message.includes('Invalid current password')) {
            res.status(400).json({ message: error.message });
        }
        else if (error instanceof Error && error.message.includes('required')) {
            res.status(400).json({ message: error.message }); // Should be caught by validator
        }
        else if (error instanceof Error && error.message.includes('User not found')) {
            res.status(404).json({ message: error.message });
        }
        else {
            next(error);
        }
    }
});
exports.updateMyPassword = updateMyPassword;
/**
 * DELETE /api/users/me - Delete the current user's account.
 * No input validation needed beyond authentication.
 */
const deleteMyAccount = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.id)) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }
        const userId = req.user.id;
        yield userService.deleteUserAccount(userId);
        res.status(204).send(); // Success, no content
    }
    catch (error) {
        // Handle specific service errors
        if (error instanceof Error && error.message.includes('not found during deletion')) {
            // Log the error server-side, but maybe return 404 or 204 to client?
            // Let's return 404 as the primary resource (user) wasn't found for the action.
            console.warn(`Attempted to delete non-existent user or related record: ${(_b = req.user) === null || _b === void 0 ? void 0 : _b.id}`);
            res.status(404).json({ message: 'User not found or already deleted.' });
        }
        else {
            next(error);
        }
    }
});
exports.deleteMyAccount = deleteMyAccount;
