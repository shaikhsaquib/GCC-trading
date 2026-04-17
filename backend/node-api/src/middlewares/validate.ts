import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ValidationError } from '../core/errors';

/**
 * Zod schema validation middleware factory.
 *
 * Usage:
 *   router.post('/register', validate(registerSchema), controller.register)
 *
 * Validates req.body by default. Pass `source` to validate query or params.
 */
export function validate(
  schema: AnyZodObject,
  source: 'body' | 'query' | 'params' = 'body',
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = schema.parse(req[source]);
      // Replace with parsed (typed + stripped unknown) data
      req[source] = data;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.errors
          .map(e => `${e.path.join('.')}: ${e.message}`)
          .join(', ');
        next(new ValidationError(message));
      } else {
        next(err);
      }
    }
  };
}
