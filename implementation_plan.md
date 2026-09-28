# Implementation Plan: Custom IMAP Mailbox Integration

This plan outlines the design and integration of a secure, free IMAP mailbox synchronization system alongside the existing Google Gmail and Zoho Mail OAuth 2.0 systems. 

---

## 💡 Overview & Answer to User Questions

### 1. Will the IMAP system be free?
**Yes, it is 100% free!** The IMAP protocol itself is a standard mail server access standard. There are no registration, subscription, or licensing fees. 

### 2. Can we build it completely separately without touching the existing integrations?
**Yes.** The new IMAP synchronization will be implemented as an entirely independent module:
- The existing Gmail and Zoho Mail OAuth codeflows, credentials collections (`gmail_credentials` and `zoho_credentials`), and database handlers will remain completely untouched and fully functional.
- We will store IMAP configurations in a new, dedicated Firestore collection: `imap_credentials`.
- We will provide separate dashboard views and linking modals specifically designed for IMAP settings.

### 3. Technical Architecture Constraint (Browser Sockets)
Web browsers run in a secure sandbox and cannot establish raw TCP socket connections (which the IMAP protocol requires on ports 993/143). To solve this:
- We will write a lightweight Node.js IMAP proxy server using the modern, high-performance `imapflow` package.
- This proxy will receive secure REST API requests from our frontend containing IMAP configurations, query the target IMAP mailboxes in the background, and return resolved Garena verification code emails as JSON.
- Just like your Zoho proxy, this IMAP proxy server can be deployed **completely free** on Render!

---

## Proposed Database Schema: `imap_credentials`

Each connected IMAP account will be stored in Firestore as a document under the `imap_credentials` collection:
```json
{
  "userId": "admin_uid_here",
  "userName": "Shivam Bhatt",
  "userEmail": "shivambhatt@admin.com",
  "imap_email": "recovery@my-domain.com",
  "imap_host": "imap.hostinger.com",
  "imap_port": 993,
  "imap_user": "recovery@my-domain.com",
  "imap_password": "encrypted_or_app_password",
  "imap_verified_by_admin": true,
  "createdAt": "2026-07-15T00:00:00.000Z"
}
```

---

## Proposed Changes

### Frontend Client Web Application

#### [NEW] [IMAPProxyCode](file:///c:/Users/harsh/Desktop/MY%2520NEW/scratch/imap-proxy-server/)
We will prepare a ready-to-deploy Node.js Express repository folder under the scratch directory that you can upload to GitHub and deploy to Render with one click.
- `index.js`: Setup Express server, import `imapflow`, and declare POST `/imap/fetch` endpoint.
- `package.json`: Declare dependencies (`express`, `cors`, `imapflow`, `dotenv`).

#### [MODIFY] [firestore.rules](file:///c:/Users/harsh/Desktop/MY%2520NEW/firestore.rules)
- Define secure read/write conditions for the new `/imap_credentials/{credId}` route.

#### [MODIFY] [Profile.jsx](file:///c:/Users/harsh/Desktop/MY%2520NEW/src/pages/Profile.jsx)
- Add a new "Link IMAP Mailbox" form section to allow admins to type their host, port, username, and password.
- Display active IMAP connections in the list with independent "Disconnect" buttons.

#### [MODIFY] [ClientFormModal.jsx](file:///c:/Users/harsh/Desktop/MY%2520NEW/src/components/ClientFormModal.jsx)
- Add "Link Auditor IMAP" selection options for client assignments.
- Display "Assign IMAP Monitoring" checkboxes for normal admins (with real-time filtering search bar).

#### [MODIFY] [ClientDashboard.jsx](file:///c:/Users/harsh/Desktop/MY%2520NEW/src/pages/ClientDashboard.jsx)
- Detect when a client's recovery mailbox is an IMAP link.
- Execute real-time queries through the IMAP proxy to fetch, filter (matching Garena), and display OTPs in the client dashboard.

#### [MODIFY] [GmailMonitor.jsx](file:///c:/Users/harsh/Desktop/MY%2520NEW/src/pages/GmailMonitor.jsx)
- Add a third tab option: **"IMAP Mailboxes"**.
- Allow superadmins to inspect active IMAP connections, view emails list, read email bodies, and assign operators.

---

## Verification Plan

### Automated Tests
- Build and run the React client locally (`npm run dev`) and test compilation correctness (`npm run build`).

### Manual Verification
- Test connection input handling inside the Profile settings view.
- Perform a live IMAP mail pull query using the diagnostic scripts.
