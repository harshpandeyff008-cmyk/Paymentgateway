import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import UserManagementTable from '../components/UserManagementTable';
import { useAuth } from '../context/AuthContext';

export default function AdminUsers() {
  const { currentUser, userDoc } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Access control
  useEffect(() => {
    if (userDoc) {
      const isPrivileged = userDoc.role === 'admin' || userDoc.role === 'superadmin';
      if (!isPrivileged) {
        navigate('/login', { replace: true });
      }
    }
  }, [userDoc, navigate]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 font-sans overflow-hidden">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden lg:pl-72">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <UserManagementTable />
        </main>
      </div>
    </div>
  );
}
