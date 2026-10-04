import { Router } from 'express';
import { LeadsController } from './leads.controller.js';
import { adminAuth } from '../../src/middlewares/adminAuth.js';

const router = Router();

// Protect marketing lead endpoints with admin auth middleware
router.get('/list', adminAuth, LeadsController.getLeads);
router.get('/export-csv', adminAuth, LeadsController.exportCsv);

export default router;
