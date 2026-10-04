import { LeadsService } from './leads.service.js';

export const LeadsController = {
  /**
   * GET /api/v1/admin/leads/list
   */
  async getLeads(req, res) {
    try {
      const data = await LeadsService.getAllLeads();
      return res.json(data);
    } catch (err) {
      console.error('[LeadsController] Error:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch user leads: ' + err.message });
    }
  },

  /**
   * GET /api/v1/admin/leads/export-csv
   */
  async exportCsv(req, res) {
    try {
      const { leads } = await LeadsService.getAllLeads();
      const csv = LeadsService.generateCsv(leads);
      const filename = `ZeroFee_UPI_User_Leads_${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csv);
    } catch (err) {
      console.error('[LeadsController] Export CSV Error:', err);
      return res.status(500).json({ success: false, error: 'Failed to export CSV' });
    }
  }
};

export default LeadsController;
