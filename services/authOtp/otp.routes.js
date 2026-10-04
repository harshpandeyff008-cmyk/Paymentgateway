import { Router } from 'express';
import { OtpController } from './otp.controller.js';

const router = Router();

router.post('/send', OtpController.sendOtp);
router.post('/verify', OtpController.verifyOtp);
router.post('/register', OtpController.register);
router.post('/login', OtpController.login);
router.post('/reset-password', OtpController.resetPassword);

export default router;

