const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const Admin = require('../models/Admin');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signAdminToken } = require('../utils/tokens');
const { AppError } = require('../middlewares/errorHandler');
const { env } = require('../config');

const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
});

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username: username.toLowerCase().trim() });

    if (!admin) {
      throw new AppError('Invalid username or password.', 401, 'INVALID_CREDENTIALS');
    }

    const isValid = await admin.comparePassword(password);
    if (!isValid) {
      throw new AppError('Invalid username or password.', 401, 'INVALID_CREDENTIALS');
    }

    const token = signAdminToken({
      id: admin.adminId,
      username: admin.username,
    });

    // Set secure HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.json({
      success: true,
      data: {
        admin: {
          id: admin.adminId,
          username: admin.username,
        },
        token,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    });

    res.json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    res.json({
      success: true,
      data: {
        admin: req.admin,
      },
    });
  } catch (err) {
    next(err);
  }
}

const bootstrapSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
});

async function bootstrap(req, res, next) {
  try {
    const { username, password } = req.body;
    const count = await Admin.countDocuments();
    if (count > 0) {
      throw new AppError('Admin account already exists. Bootstrap not permitted.', 403, 'FORBIDDEN');
    }
    const passwordHash = await hashPassword(password);
    const admin = await Admin.create({
      adminId: uuidv4(),
      username: username.toLowerCase().trim(),
      passwordHash,
    });
    res.status(201).json({
      success: true,
      message: 'Initial administrator account created.',
      data: {
        admin: {
          id: admin.adminId,
          username: admin.username,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  loginSchema,
  bootstrapSchema,
  login,
  logout,
  getMe,
  bootstrap,
};
