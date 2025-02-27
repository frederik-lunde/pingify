import { Router } from 'express';
import userController from '../controllers/userController.js';

const router = Router();

router.get('/users', userController.getUsers);
router.get('/users/:id', userController.getUserById);

router.post('/users', userController.createUser);


export default router;