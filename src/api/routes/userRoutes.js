import { Router } from 'express';
import userController from '../controllers/userController.js';

const router = Router();

//Get
router.get('/users', userController.getUsers);
router.get('/users/:id', userController.getUserById);

//Post
router.post('/users', userController.createUser);


export default router;