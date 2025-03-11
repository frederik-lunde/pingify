import { Router, Request, Response, NextFunction } from 'express';

const testRouter: Router = Router();

testRouter.get('/error', (req: Request, res: Response, next: NextFunction) => {
  const error = new Error('This is a test error');
  // Optionally, add a custom status code to the error
  // @ts-ignore
  error.status = 406;
  next(error);
});

export default testRouter;
