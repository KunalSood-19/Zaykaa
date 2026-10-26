import defaultAuthService from './auth.service.js';

export class AuthController {
  /**
   * @param {import('./auth.service.js').AuthService} [service]
   */
  constructor(service = defaultAuthService) {
    this.service = service;
  }

  /**
   * Handles user registration.
   * POST /api/auth/register
   */
  register = async (req, res, next) => {
    try {
      const result = await this.service.register(req.body);
      return res.status(201).json({
        success: true,
        data: result,
        message: 'Registration successful',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Handles user login.
   * POST /api/auth/login
   */
  login = async (req, res, next) => {
    try {
      const result = await this.service.login(req.body);
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Login successful',
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * Retrieves profile of authenticated user.
   * GET /api/auth/me
   */
  getMe = async (req, res, next) => {
    try {
      return res.status(200).json({
        success: true,
        data: {
          user: req.user,
        },
        message: 'Profile retrieved successfully',
      });
    } catch (err) {
      return next(err);
    }
  };
}

const defaultAuthController = new AuthController();
export default defaultAuthController;
