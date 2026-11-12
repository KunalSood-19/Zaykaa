import { authService } from './auth.service.js';

export const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, role } = req.body;
    const result = await authService.register({ name, email, password, phone, role });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user?.id);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    next(err);
  }
};
