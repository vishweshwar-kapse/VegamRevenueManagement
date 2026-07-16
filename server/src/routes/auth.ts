import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import User from '../models/User';
import { generateToken, protect, AuthRequest } from '../middleware/auth';
import { uploadAvatar } from '../middleware/upload';
import { isMailerConfigured, sendOtpEmail } from '../services/mailer';

const router = Router();

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;
const hashOtp = (otp: string) => crypto.createHash('sha256').update(otp).digest('hex');

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { email, password } = req.body;

      // Find user with password
      const user = await User.findOne({ email, isActive: true }).select('+password');
      if (!user) {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
        return;
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
        return;
      }

      const token = generateToken(String(user._id), user.role);

      res.json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', protect, async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({
    success: true,
    user: req.user,
  });
});

/**
 * POST /api/auth/change-password
 * Change current user's password
 */
router.post(
  '/change-password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters'),
  ],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { currentPassword, newPassword } = req.body;

      const user = await User.findById(req.user?._id).select('+password');
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        res.status(400).json({ success: false, message: 'Current password is incorrect' });
        return;
      }

      user.password = newPassword;
      user.mustChangePassword = false;
      await user.save();

      res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/profile/avatar
 * Upload / replace the current user's profile picture.
 */
router.post(
  '/profile/avatar',
  protect,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    uploadAvatar(req, res, (err: unknown) => {
      if (err) {
        res.status(400).json({ success: false, message: (err as Error).message });
        return;
      }
      next();
    });
  },
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = (req as Request).file;
      if (!file) {
        res.status(400).json({ success: false, message: 'No image file was uploaded' });
        return;
      }
      const avatarUrl = `/uploads/avatars/${file.filename}`;
      const user = await User.findById(req.user?._id);
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }
      user.avatarUrl = avatarUrl;
      await user.save();
      res.json({ success: true, data: { avatarUrl } });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/profile/email/request-otp
 * Start an email change: generate an OTP and email it to the NEW address.
 */
router.post(
  '/profile/email/request-otp',
  protect,
  [body('newEmail').isEmail().normalizeEmail().withMessage('A valid email is required')],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      if (!isMailerConfigured()) {
        res.status(503).json({
          success: false,
          message: 'Email sending is not configured on the server. Ask your administrator to set the SMTP settings.',
        });
        return;
      }

      const { newEmail } = req.body;
      if (newEmail === req.user?.email) {
        res.status(400).json({ success: false, message: 'That is already your current email address' });
        return;
      }
      const taken = await User.findOne({ email: newEmail, _id: { $ne: req.user?._id } });
      if (taken) {
        res.status(409).json({ success: false, message: 'That email address is already in use' });
        return;
      }

      const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      const user = await User.findById(req.user?._id).select(
        '+pendingEmail +emailOtpHash +emailOtpExpires +emailOtpAttempts'
      );
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }
      user.pendingEmail = newEmail;
      user.emailOtpHash = hashOtp(otp);
      user.emailOtpExpires = new Date(Date.now() + OTP_TTL_MS);
      user.emailOtpAttempts = 0;
      await user.save();

      try {
        await sendOtpEmail(newEmail, otp, user.name);
      } catch {
        res.status(502).json({
          success: false,
          message: 'Could not send the verification email. Please check the server SMTP configuration.',
        });
        return;
      }

      res.json({ success: true, message: `A 6-digit code was sent to ${newEmail}. It expires in 10 minutes.` });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/profile/email/verify-otp
 * Confirm the OTP and switch the account to the pending email.
 */
router.post(
  '/profile/email/verify-otp',
  protect,
  [body('otp').trim().notEmpty().withMessage('Enter the verification code')],
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }

      const { otp } = req.body;
      const user = await User.findById(req.user?._id).select(
        '+pendingEmail +emailOtpHash +emailOtpExpires +emailOtpAttempts'
      );
      if (!user || !user.pendingEmail || !user.emailOtpHash || !user.emailOtpExpires) {
        res.status(400).json({ success: false, message: 'No pending email change. Request a code first.' });
        return;
      }
      if (user.emailOtpExpires.getTime() < Date.now()) {
        res.status(400).json({ success: false, message: 'The code has expired. Please request a new one.' });
        return;
      }
      if ((user.emailOtpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
        res.status(429).json({ success: false, message: 'Too many incorrect attempts. Request a new code.' });
        return;
      }
      if (hashOtp(String(otp).trim()) !== user.emailOtpHash) {
        user.emailOtpAttempts = (user.emailOtpAttempts || 0) + 1;
        await user.save();
        res.status(400).json({ success: false, message: 'Incorrect code. Please try again.' });
        return;
      }

      // Re-check uniqueness in case someone claimed it meanwhile.
      const taken = await User.findOne({ email: user.pendingEmail, _id: { $ne: user._id } });
      if (taken) {
        res.status(409).json({ success: false, message: 'That email address was taken in the meantime.' });
        return;
      }

      user.email = user.pendingEmail;
      user.pendingEmail = undefined;
      user.emailOtpHash = undefined;
      user.emailOtpExpires = undefined;
      user.emailOtpAttempts = 0;
      await user.save();

      res.json({ success: true, data: { email: user.email }, message: 'Email address updated' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
