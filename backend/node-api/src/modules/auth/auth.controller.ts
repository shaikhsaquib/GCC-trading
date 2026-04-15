import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { sendSuccess, sendCreated } from '../../middlewares/error-handler';

/**
 * AuthController — thin HTTP layer.
 * Extracts request data, delegates to AuthService, formats the response.
 * Zero business logic lives here.
 */
export class AuthController {
  constructor(private readonly service: AuthService) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.service.register(req.body);
      sendCreated(res, { user });
    } catch (err) { next(err); }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.login(req.body);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  verify2FA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.verify2FA(req.body);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  setup2FA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.setup2FA(req.user!.id);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  enable2FA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.enable2FA(req.user!.id, req.body);
      sendSuccess(res, { enabled: true });
    } catch (err) { next(err); }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tokens = await this.service.refresh(req.body.refreshToken);
      sendSuccess(res, tokens);
    } catch (err) { next(err); }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.headers.authorization?.slice(7) ?? '';
      await this.service.logout(token);
      sendSuccess(res, { loggedOut: true });
    } catch (err) { next(err); }
  };

  requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.requestPasswordReset(req.body.email);
      sendSuccess(res, { message: 'If that email exists, a reset link has been sent' });
    } catch (err) { next(err); }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.resetPassword(req.body);
      sendSuccess(res, { message: 'Password updated successfully' });
    } catch (err) { next(err); }
  };
}
