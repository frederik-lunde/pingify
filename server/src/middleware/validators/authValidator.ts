
import { body, validationResult, ValidationChain } from "express-validator";
import { Request, Response, NextFunction } from "express";



export const registerValidationRules = (): ValidationChain[] => {
  return [
    body("email")
      .trim() 
      .isEmail()
      .withMessage("Please provide a valid email address.")
      .normalizeEmail(), 

    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long."),
    
    

    body("name")
      .optional() 
      .trim()
      .escape() 
      .isLength({ max: 100 })
      .withMessage("Name cannot exceed 100 characters."),
  ];
};

export const loginValidationRules = (): ValidationChain[] => {
  return [
    body("email")
      .trim()
      .isEmail()
      .withMessage("Please provide a valid email address.")
      .normalizeEmail(),

    body("password")
      .notEmpty() 
      .withMessage("Password is required."),
  ];
};



export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    
    res.status(400).json({ errors: errors.array() });
    return; 
  }
  
  next();
};
