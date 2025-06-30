import { Request, Response, NextFunction } from 'express';

interface CustomError extends Error {
    statusCode?: number;
}

export const errorHandler = (err: CustomError, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);

    const statusCode = err.statusCode || 500;
    
    res.status(statusCode).json({
        message: err.message || 'An unexpected server error occurred.',
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};
