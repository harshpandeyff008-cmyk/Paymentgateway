import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, User, LogOut, X, Mail, CreditCard, Crown, KeyRound, Key, Store, Boxes, ShieldAlert, Send, FileText, ShieldBan, Users, QrCode } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { logoutUser } from '../firebase/auth';
import { useToast } from '../context/ToastContext';

export default function Sidebar({ isOpen, setIsOpen }) {
  const { userDoc } = useAuth();
  const { showToast } = useToast();

  const handleLogout = async () => {
    try {
      await logoutUser();
      showToast("Signed out successfully", "success");
    } catch (error) {
      showToast("Error signing out", "error");
    }
  };

  const isSuperAdmin = userDoc?.role === 'superadmin';
  const isAdmin = userDoc?.role === 'admin' || isSuperAdmin;
  const isEmployee = userDoc?.role === 'employee' || userDoc?.role === 'staff';

  const adminLinks = [
    { to: '/admin-dashboard', label: 'Admin Panel', icon: LayoutDashboard },
    { to: '/admin/upi-gateway', label: 'UPI Gateway & Audit', icon: QrCode },
    { to: '/admin/users', label: 'Users Directory', icon: Users },
    { to: '/admin/premium-dashboard', label: 'Premium Dashboard', icon: Crown },
    { to: '/admin/gmail-monitor', label: 'Email Monitor', icon: Mail },
  ];

  // FF Store is strictly available ONLY to Super Admin and Employee
  if (isSuperAdmin) {
    adminLinks.push({ to: '/admin/ff-store', label: 'FF Store', icon: Store });
  }

  adminLinks.push(
    { to: '/admin/suspicious-logs', label: 'Suspicious Logs', icon: ShieldBan },
    { to: '/admin/inventory', label: 'ID Inventory & Booking', icon: Boxes },
    { to: '/admin/maintenance', label: 'Maintenance', icon: ShieldAlert },
    { to: '/admin/telegram-licenses', label: 'Telegram Licenses', icon: Send },
    { to: '/admin/terms-editor', label: 'Terms & Conditions', icon: FileText }
  );

  if (userDoc?.role === 'superadmin' || userDoc?.allowLicenseKeys === true) {
    adminLinks.push({ to: '/admin/license-keys', label: 'License Keys', icon: KeyRound });
    adminLinks.push({ to: '/admin/api-keys', label: 'API Keys', icon: Key });
  }

  adminLinks.push({ to: '/profile', label: 'My Profile', icon: User });

  const employeeLinks = [
    { to: '/admin/ff-store', label: 'FF Store Manager', icon: Store },
    { to: '/profile', label: 'My Profile', icon: User },
  ];

  const clientLinks = [
    { to: '/client-dashboard', label: 'My Dashboard', icon: LayoutDashboard },
    { to: '/client/subscription-info', label: 'Subscription Info', icon: CreditCard },
    { to: '/profile', label: 'My Profile', icon: User },
  ];

  const links = isAdmin
    ? adminLinks
    : isEmployee
    ? employeeLinks
    : clientLinks;

  const activeClass = "flex items-center gap-3.5 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold shadow-md shadow-indigo-600/25 transition-all duration-200 btn-tactile focus-ring";
  const inactiveClass = "flex items-center gap-3.5 px-4 py-3 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white font-medium transition-all duration-200 btn-tactile focus-ring";

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)} 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col w-72 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-r border-gray-200/80 dark:border-gray-800/80 shadow-2xl lg:shadow-none transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-20 px-6 border-b border-gray-200/80 dark:border-gray-800/80">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-gray-800 p-1 border border-gray-200 dark:border-gray-700 shadow-md shadow-red-500/10 shrink-0">
              <img src="/garena-logo.png" alt="Garena Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-extrabold text-gray-900 dark:text-white leading-none text-sm tracking-tight">FREE FIRE OFFICIAL DEALS</h1>
              <span className="text-xs text-red-600 dark:text-red-400 font-bold tracking-wide">Garena Partner Portal</span>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)} 
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl lg:hidden hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 btn-tactile focus-ring"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User context badge */}
        <div className="p-4 mx-4 my-5 rounded-2xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-200/60 dark:border-gray-800/60 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm shrink-0 border border-indigo-200/60 dark:border-indigo-900/60">
              {userDoc?.name ? userDoc.name.charAt(0).toUpperCase() : '?'}
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{userDoc?.name || 'User'}</p>
              <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/70 dark:border-indigo-900/60">
                {userDoc?.role === 'superadmin' ? 'Super Admin' : userDoc?.role === 'admin' ? 'Administrator' : isEmployee ? 'Store Staff / Employee' : 'Client Access'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) => (isActive ? activeClass : inactiveClass)}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-sm truncate">{link.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Logout Button */}
        <div className="p-4 border-t border-gray-200/80 dark:border-gray-800/80">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 font-semibold text-sm transition-all duration-200 btn-tactile focus-ring"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
