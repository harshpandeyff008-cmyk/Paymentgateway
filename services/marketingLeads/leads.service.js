import { query } from '../../db/database.js';

export const LeadsService = {
  /**
   * Fetch all registered users/merchants formatted as marketing leads
   */
  async getAllLeads() {
    try {
      const users = await query.all(`
        SELECT 
          id,
          name,
          email,
          phone,
          role,
          plan,
          qr_credits,
          api_key,
          upi_vpa,
          business_name,
          website_url,
          website_urls,
          settlement_type,
          created_at,
          updated_at
        FROM users
        ORDER BY id DESC
      `);

      let totalWithPhone = 0;
      let totalPaid = 0;

      const formattedLeads = users.map(u => {
        const rawPhone = (u.phone || '').trim();
        const cleanPhone = rawPhone.replace(/[^0-9+]/g, '');
        const hasPhone = cleanPhone.length >= 10;
        if (hasPhone) totalWithPhone++;

        const isPaid = u.plan && u.plan !== 'NONE';
        if (isPaid) totalPaid++;

        const createdDate = u.created_at ? new Date(u.created_at).toISOString().split('T')[0] : 'N/A';
        const createdTime = u.created_at ? new Date(u.created_at).toLocaleTimeString('en-IN') : '';

        return {
          id: u.id,
          name: u.name || 'User',
          email: u.email || '',
          phone: cleanPhone || 'N/A',
          rawPhone: u.phone || '',
          hasPhone,
          role: u.role || 'user',
          plan: u.plan || 'NONE',
          isPaid,
          qrCredits: u.qr_credits || 0,
          apiKey: u.api_key || '',
          upiVpa: u.upi_vpa || 'Not Linked',
          businessName: u.business_name || '',
          websiteUrl: u.website_url || u.website_urls || 'None',
          settlementType: u.settlement_type || 'GOOGLE_OAUTH',
          createdAt: u.created_at,
          formattedDate: `${createdDate} ${createdTime}`.trim()
        };
      });

      return {
        success: true,
        stats: {
          totalUsers: users.length,
          totalWithPhone,
          totalPaid,
          freeTier: users.length - totalPaid
        },
        leads: formattedLeads
      };
    } catch (err) {
      console.error('[LeadsService] Error fetching leads:', err);
      throw err;
    }
  },

  /**
   * Convert leads data array to CSV format
   */
  generateCsv(leads = []) {
    const headers = [
      'ID',
      'Name',
      'Email',
      'Mobile Number',
      'Plan',
      'QR Credits',
      'Website',
      'UPI VPA',
      'Role',
      'Joined Date',
      'API Key'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = leads.map(l => [
      l.id,
      escapeCsv(l.name),
      escapeCsv(l.email),
      escapeCsv(l.phone !== 'N/A' ? l.phone : ''),
      escapeCsv(l.plan),
      l.qrCredits,
      escapeCsv(l.websiteUrl !== 'None' ? l.websiteUrl : ''),
      escapeCsv(l.upiVpa !== 'Not Linked' ? l.upiVpa : ''),
      escapeCsv(l.role),
      escapeCsv(l.formattedDate),
      escapeCsv(l.apiKey)
    ].join(','));

    return [headers.join(','), ...rows].join('\r\n');
  }
};

export default LeadsService;
