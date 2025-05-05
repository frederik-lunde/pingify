"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prismaClient_1 = __importDefault(require("../prisma/prismaClient"));
const config_1 = require("../config/config");
const JWT_SECRET = config_1.securityConfig.jwtSecret;
const SALT_ROUNDS = 10;
function registerUser(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const existingUser = yield prismaClient_1.default.user.findUnique({ where: { email: data.email } });
        if (existingUser) {
            throw new Error('User with this email already exists');
        }
        const hashedPassword = yield bcrypt_1.default.hash(data.password, SALT_ROUNDS);
        // Prisma now generates a CUID for the id automatically
        const user = yield prismaClient_1.default.user.create({
            data: {
                email: data.email,
                password: hashedPassword,
                name: data.name
            }
        });
        const token = generateToken(user.id); // Pass the string ID
        const { password } = user, userWithoutPassword = __rest(user, ["password"]);
        return { user: userWithoutPassword, token };
    });
}
function loginUser(credentials) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield prismaClient_1.default.user.findUnique({ where: { email: credentials.email } });
        if (!user) {
            throw new Error('Invalid credentials');
        }
        const isPasswordValid = yield bcrypt_1.default.compare(credentials.password, user.password);
        if (!isPasswordValid) {
            throw new Error('Invalid credentials');
        }
        const token = generateToken(user.id); // Pass the string ID
        const { password } = user, userWithoutPassword = __rest(user, ["password"]);
        return { user: userWithoutPassword, token };
    });
}
// Changed userId type to string
function generateToken(userId) {
    return jsonwebtoken_1.default.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}
// Changed expected userId type to string
function verifyToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Type Guard: Check if the decoded payload is an object and has the userId property of type string
        if (typeof decoded === 'object' && decoded !== null && 'userId' in decoded && typeof decoded.userId === 'string') {
            return { userId: decoded.userId };
        }
        else {
            throw new Error('Invalid token payload structure');
        }
    }
    catch (error) {
        console.error("Token verification failed:", error.message || error);
        throw new Error('Invalid or expired token');
    }
}
