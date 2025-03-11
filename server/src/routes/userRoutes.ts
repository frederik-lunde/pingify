import { Router } from 'express';
import * as userController from '../controllers/userController';

const userRouter: Router = Router();

userRouter.get('/', userController.getUsers);
userRouter.get('/:id', userController.getUserById);
userRouter.post('/', userController.createUser);

export default userRouter;
    