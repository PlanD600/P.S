
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Middleware to protect routes by verifying a JWT.
 * It checks for a 'Bearer' token in the Authorization header.
 * If the token is valid, it decodes the payload and attaches it to `req.user`.
 */
export const protect = (req: Request, res: Response, next: NextFunction) => {
    let token;

    if ((req as any).headers.authorization && (req as any).headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header (e.g., "Bearer <token>")
            token = (req as any).headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET!);
            
            // Attach user to the request object for use in subsequent controllers
            (req as any).user = decoded as Express.Request['user'];
            
            next();
        } catch (error) {
            console.error(error);
            return (res as any).status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return (res as any).status(401).json({ message: 'Not authorized, no token provided' });
    }
};

/**
 * Middleware factory to check for specific user roles.
 * @param roles A list of authorized roles.
 */
export const authorize = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!(req as any).user || !roles.includes((req as any).user.role)) {
            return (res as any).status(403).json({ message: 'User role not authorized to access this route' });
        }
        next();
    }
}