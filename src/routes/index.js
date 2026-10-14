import { Router } from 'express';
import orderRoutes from './order.routes.js';
import adminRoutes from './admin.routes.js';
import healthRoutes from './health.routes.js';
import userRoutes from './user.routes.js';
import { OrderController } from '../controllers/order.controller.js';

import { UserController } from '../controllers/user.controller.js';

import otpRoutes from '../../services/authOtp/otp.routes.js';
import leadsRoutes from '../../services/marketingLeads/leads.routes.js';

const router = Router();

// Health Check
router.use('/', healthRoutes);

// QR Code generation endpoint
router.get('/qr', OrderController.getQrCode);

// Public Plans Endpoint
router.get('/plans', UserController.getPlans);

// Authentication & OTP routes
router.use('/auth/otp', otpRoutes);

// Marketing Leads & User Data Management
router.use('/admin/leads', leadsRoutes);

// Specific feature routers
router.use('/orders', orderRoutes);
router.use('/order', orderRoutes);
router.use('/session', orderRoutes);
router.use('/admin', adminRoutes);
router.use('/user', userRoutes);


export default router;
