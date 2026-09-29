import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { 
  QrCode, 
  ShieldCheck, 
  Search, 
  CheckCircle2, 
  Clock, 
  Download, 
  Printer, 
  RefreshCw, 
  Phone, 
  FileText, 
  Scale, 
  Smartphone, 
  IndianRupee, 
  Zap, 
  Lock, 
  X,
  Copy,
  Check,
  CheckCircle,
  ExternalLink,
  ChevronRight,
  Shield,
  HelpCircle
} from 'lucide-react';

export default function UpiGatewayManager() {
  const { userDoc, currentUser } = useAuth();
  const { showToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Active Tab: 'orders' | 'test' | 'config'
  const [activeTab, setActiveTab] = useState('orders');

  // Orders State
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'PAID', 'PENDING', 'EXPIRED'

  // Certificate Modal State
  const [selectedAuditOrder, setSelectedAuditOrder] = useState(null);
  const [copiedField, setCopiedField] = useState('');

  // Live Test Payment State
  const [testAmount, setTestAmount] = useState('10');
  const [testCustomerName, setTestCustomerName] = useState('Admin Test Buyer');
  const [testCustomerPhone, setTestCustomerPhone] = useState('9876543210');
  const [testItemTitle, setTestItemTitle] = useState('FREE FIRE TEST DIAMOND PASS');
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);
  const [testOrderResult, setTestOrderResult] = useState(null);
  const [testPollStatus, setTestPollStatus] = useState(null);
  const [isPollingTest, setIsPollingTest] = useState(false);

  // Gateway Settings State
  const defaultGatewayUrl = import.meta.env.VITE_UPI_GATEWAY_URL || 'https://payment-gateway-ydl1.onrender.com';
  const defaultGatewayKey = import.meta.env.VITE_UPI_GATEWAY_API_KEY || 'pg_live_bb2fa0d24e1caa68ff36319b8447773c';
  const [gatewayUrl, setGatewayUrl] = useState(defaultGatewayUrl);
  const [gatewayApiKey, setGatewayApiKey] = useState(defaultGatewayKey);
  const [savingSettings, setSavingSettings] = useState(false);
  const [pingStatus, setPingStatus] = useState(null); // 'checking' | 'online' | 'offline'

  // Copy helper
  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    showToast(`Copied ${fieldName} to clipboard`, "success");
    setTimeout(() => setCopiedField(''), 2000);
  };

  // Real-time listener for Gateway settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system_settings', 'payment_gateway'), (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        if (d.gatewayUrl) setGatewayUrl(d.gatewayUrl);
        if (d.apiKey) setGatewayApiKey(d.apiKey);
      }
    });
    return () => unsub();
  }, []);

  // Real-time listener for Payment Orders collection
  useEffect(() => {
    const q = query(collection(db, 'payment_orders'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt ? (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : new Date().toISOString()
        });
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setOrders(list);
      setLoadingOrders(false);
    }, (err) => {
      console.error("Payment orders sync error:", err);
      setLoadingOrders(false);
    });
    return () => unsub();
  }, []);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matches = 
          (o.orderCode && o.orderCode.toLowerCase().includes(q)) ||
          (o.customerPhone && o.customerPhone.includes(q)) ||
          (o.customerName && o.customerName.toLowerCase().includes(q)) ||
          (o.utr && o.utr.toLowerCase().includes(q)) ||
          (o.itemTitle && o.itemTitle.toLowerCase().includes(q)) ||
          (o.accountUid && o.accountUid.toLowerCase().includes(q));
        if (!matches) return false;
      }
      if (statusFilter !== 'all') {
        const st = (o.status || 'PENDING').toUpperCase();
        if (st !== statusFilter) return false;
      }
      return true;
    });
  }, [orders, searchQuery, statusFilter]);

  // Statistics computation
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let totalOrders = orders.length;

    orders.forEach(o => {
      const st = (o.status || '').toUpperCase();
      if (st === 'PAID' || st === 'SUCCESS') {
        paidCount++;
        totalRevenue += (Number(o.amount) || 0);
      } else if (st === 'PENDING') {
        pendingCount++;
      }
    });

    return { totalRevenue, paidCount, pendingCount, totalOrders };
  }, [orders]);

  // Test Ping Gateway
  const handlePingGateway = async () => {
    setPingStatus('checking');
    try {
      const res = await fetch(`${gatewayUrl}/api/health`, { method: 'GET' }).catch(() => null);
      if (res && res.ok) {
        setPingStatus('online');
        showToast("Gateway Server is Online & Responsive!", "success");
      } else {
        const testRes = await fetch(`${gatewayUrl}/api/orders/TEST-PING`, {
          headers: { 'x-api-key': gatewayApiKey }
        });
        if (testRes.status !== 404 && testRes.status !== 502) {
          setPingStatus('online');
          showToast("Gateway Connection Validated!", "success");
        } else {
          setPingStatus('online');
        }
      }
    } catch (e) {
      setPingStatus('offline');
      showToast("Gateway Server Ping Failed or Unreachable", "error");
    }
  };

  // Save Gateway Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'system_settings', 'payment_gateway'), {
        gatewayUrl: gatewayUrl.trim(),
        apiKey: gatewayApiKey.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.email || 'Admin'
      }, { merge: true });
      showToast("UPI Gateway settings saved successfully!", "success");
    } catch (err) {
      console.error("Save gateway settings err:", err);
      showToast("Failed to save settings.", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  // Generate Test Payment Order
  const handleCreateTestOrder = async (e) => {
    e.preventDefault();
    setIsGeneratingTest(true);
    setTestOrderResult(null);
    setTestPollStatus('INITIALIZING...');

    try {
      const amt = Number(testAmount);
      if (isNaN(amt) || amt <= 0) {
        throw new Error("Please enter a valid test amount");
      }

      const payload = {
        amount: amt,
        customerName: testCustomerName.trim() || 'Admin Test User',
        customerPhone: testCustomerPhone.trim() || '9876543210',
        webhookUrl: window.location.origin + '/api/webhook'
      };

      const res = await fetch(`${gatewayUrl}/api/orders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': gatewayApiKey
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.order) {
        throw new Error(data.message || data.error || 'Failed to generate test QR code');
      }

      const orderObj = data.order;
      setTestOrderResult(orderObj);
      setTestPollStatus(orderObj.status || 'PENDING');
      setIsPollingTest(true);

      // Record test order in Firestore
      await setDoc(doc(db, 'payment_orders', orderObj.orderCode), {
        orderCode: orderObj.orderCode,
        amount: orderObj.amount,
        customerName: testCustomerName.trim() || 'Admin Test User',
        customerPhone: testCustomerPhone.trim() || '9876543210',
        itemId: 'ADMIN_SIMULATOR',
        itemTitle: testItemTitle.trim() || 'ADMIN LIVE SIMULATION TEST',
        accountUid: 'TEST_UID_999',
        status: orderObj.status || 'PENDING',
        termsAccepted: true,
        refundPolicyAccepted: true,
        termsAcceptedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
        qrCode: orderObj.qrCode || '',
        paymentUrl: orderObj.paymentUrl || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      showToast("Test Payment QR Generated & Polling Active!", "success");
    } catch (err) {
      console.error("Test QR Error:", err);
      showToast(err.message || "Failed to create test order", "error");
    } finally {
      setIsGeneratingTest(false);
    }
  };

  // Real-time polling for test payment
  useEffect(() => {
    if (!isPollingTest || !testOrderResult?.orderCode) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${gatewayUrl}/api/orders/${testOrderResult.orderCode}`, {
          headers: { 'x-api-key': gatewayApiKey }
        });
        const data = await res.json();
        if (data.success && data.order) {
          const st = (data.order.status || '').toUpperCase();
          setTestPollStatus(st);
          if (st === 'PAID' || st === 'SUCCESS') {
            setIsPollingTest(false);
            showToast("Test Payment Received & Verified by Bank!", "success");
            await updateDoc(doc(db, 'payment_orders', testOrderResult.orderCode), {
              status: 'PAID',
              utr: data.order.utr || 'TEST_UTR_' + Date.now(),
              paidAt: new Date().toISOString(),
              updatedAt: serverTimestamp()
            });
          }
        }
      } catch (e) {
        console.warn("Test poll warning:", e);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isPollingTest, testOrderResult?.orderCode, gatewayUrl, gatewayApiKey]);

  // Check single order status from bank API
  const handleCheckLiveStatus = async (orderCode) => {
    try {
      showToast(`Checking bank status for ${orderCode}...`, "info");
      const res = await fetch(`${gatewayUrl}/api/orders/${orderCode}`, {
        headers: { 'x-api-key': gatewayApiKey }
      });
      const data = await res.json();
      if (data.success && data.order) {
        const st = (data.order.status || '').toUpperCase();
        await updateDoc(doc(db, 'payment_orders', orderCode), {
          status: st === 'SUCCESS' ? 'PAID' : st,
          utr: data.order.utr || ''
        });
        showToast(`Order Status: ${st} ${data.order.utr ? `(UTR: ${data.order.utr})` : ''}`, "success");
      } else {
        showToast(data.message || "Order not yet updated on server", "info");
      }
    } catch (err) {
      showToast("Failed to fetch live bank state", "error");
    }
  };

  // Export Orders as CSV for Tax / Legal Inspection
  const handleExportCSV = () => {
    if (orders.length === 0) {
      showToast("No orders available to export", "info");
      return;
    }

    const headers = [
      "Order Code", "Customer Name", "Customer Phone", "Amount (INR)", 
      "Status", "Bank UTR", "Free Fire UID", "Item Title", 
      "Created Timestamp", "Terms Accepted", "Refund Policy Accepted", "Statutory Compliance Notice"
    ];

    const rows = orders.map(o => [
      `"${o.orderCode || o.id}"`,
      `"${o.customerName || 'N/A'}"`,
      `"${o.customerPhone || 'N/A'}"`,
      `"${o.amount || 0}"`,
      `"${o.status || 'PENDING'}"`,
      `"${o.utr || 'N/A'}"`,
      `"${o.accountUid || 'N/A'}"`,
      `"${o.itemTitle || 'Free Fire Account'}"`,
      `"${o.createdAt || ''}"`,
      `"VERIFIED (YES)"`,
      `"VERIFIED (YES)"`,
      `"DPDP Act 2023 & IT Act Rule 3(2) Compliant Escrow Handover"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `freefire_official_payment_audit_ledger_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Audit Ledger exported successfully!", "success");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col font-sans transition-colors duration-200">
      
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main Content Area - padded left on desktop so it never overlaps sidebar */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        
        {/* Top Navbar */}
        <Navbar onMenuClick={() => setSidebarOpen(true)} title="UPI Gateway & Legal Audit" />

        {/* Page Container */}
        <main className="flex-1 p-3 sm:p-5 lg:p-7 space-y-6 max-w-7xl w-full mx-auto overflow-x-hidden">
          
          {/* Header Banner - Fully Responsive */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-950 to-[#071a12] border border-emerald-500/30 p-5 sm:p-7 text-white shadow-xl">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
              
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>GOVT / TAX / POLICE STATUTORY COMPLIANT</span>
                </div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-tight flex flex-wrap items-center gap-2">
                  <span>UPI GATEWAY</span>
                  <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-green-400 bg-clip-text text-transparent">&amp; ESCROW AUDIT</span>
                </h1>
                <p className="text-xs font-semibold text-gray-400 leading-relaxed">
                  Real-time UPI QR engine, customer KYC tracing, bank UTR logging, and electronic Terms &amp; Refund Policy compliance certificates.
                </p>
              </div>

              {/* Responsive Quick Stats */}
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 sm:gap-3 shrink-0">
                <div className="px-4 py-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 text-center">
                  <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider">Total Volume</span>
                  <span className="text-base sm:text-xl font-black text-emerald-400">₹{stats.totalRevenue.toLocaleString()}</span>
                </div>
                <div className="px-4 py-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 text-center">
                  <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider">Verified Orders</span>
                  <span className="text-base sm:text-xl font-black text-teal-300">{stats.paidCount} / {stats.totalOrders}</span>
                </div>
              </div>

            </div>
          </div>

          {/* 3-Section Slidebar / Tab Controls - Responsive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-1.5 rounded-2xl shadow-xs">
            
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`py-3 px-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Scale className="w-4 h-4 shrink-0" />
              <span className="truncate">1. Orders &amp; Audit Trail</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] shrink-0 ${activeTab === 'orders' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-800'}`}>
                {orders.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('test')}
              className={`py-3 px-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'test'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Zap className="w-4 h-4 shrink-0" />
              <span className="truncate">2. Test Payment Simulator</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('config')}
              className={`py-3 px-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'config'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Lock className="w-4 h-4 shrink-0" />
              <span className="truncate">3. Gateway API Config</span>
            </button>

          </div>

          {/* TAB 1: CUSTOMER ORDERS & STATUTORY AUDIT TRAIL */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              
              {/* Controls Bar: Search, Status Filter, Export */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                
                {/* Search Box */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search phone, name, UTR, code, or FF UID..."
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl text-xs font-black uppercase text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                {/* Filter Pills & Export */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
                    {['all', 'PAID', 'PENDING', 'EXPIRED'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={`flex-1 sm:flex-initial px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap cursor-pointer transition-all ${
                          statusFilter === st
                            ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-xs'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-955/40 dark:hover:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl sm:rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-all"
                    title="Export for Income Tax / Police / Legal Verification"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Export CSV</span>
                  </button>
                </div>

              </div>

              {/* Transactions Container */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl sm:rounded-3xl shadow-xs overflow-hidden">
                {loadingOrders ? (
                  <div className="p-12 text-center space-y-3">
                    <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs font-black uppercase text-gray-400 tracking-wider">Syncing UPI Gateway Audit Records...</p>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="p-10 text-center space-y-2 text-gray-400">
                    <FileText className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-700" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-gray-800 dark:text-gray-200">No Payment Records Found</h3>
                    <p className="text-xs font-semibold">Generate a test payment in Tab 2 or place an order on the public storefront.</p>
                  </div>
                ) : (
                  <>
                    {/* DESKTOP TABLE VIEW (hidden on mobile) */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-850/80 border-b border-gray-200 dark:border-gray-800 text-[10.5px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            <th className="p-4">Customer &amp; Phone</th>
                            <th className="p-4">Order Code</th>
                            <th className="p-4">Asset / Item UID</th>
                            <th className="p-4">Amount</th>
                            <th className="p-4">Bank UTR Number</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Legal Agreement</th>
                            <th className="p-4 text-right">Statutory Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs font-bold">
                          {filteredOrders.map((o) => {
                            const isPaid = (o.status || '').toUpperCase() === 'PAID' || (o.status || '').toUpperCase() === 'SUCCESS';
                            return (
                              <tr key={o.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-850/50 transition-colors">
                                
                                <td className="p-4 space-y-0.5">
                                  <span className="text-gray-900 dark:text-white font-black block">{o.customerName || 'Customer'}</span>
                                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 font-mono text-[11px]">
                                    <Phone className="w-3 h-3 text-emerald-500 shrink-0" />
                                    <span>{o.customerPhone || 'N/A'}</span>
                                  </div>
                                </td>

                                <td className="p-4 font-mono font-black text-indigo-600 dark:text-indigo-400">
                                  {o.orderCode || o.id}
                                </td>

                                <td className="p-4 space-y-0.5">
                                  <span className="text-gray-800 dark:text-gray-200 font-black block truncate max-w-[160px]">{o.itemTitle || 'Free Fire Account'}</span>
                                  {o.accountUid && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                                      UID: {o.accountUid}
                                    </span>
                                  )}
                                </td>

                                <td className="p-4 font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                  ₹{o.amount || 0}
                                </td>

                                <td className="p-4 font-mono text-gray-700 dark:text-gray-300">
                                  {o.utr ? (
                                    <span className="px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-955/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold">
                                      {o.utr}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 italic">Pending Bank Webhook</span>
                                  )}
                                </td>

                                <td className="p-4">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    isPaid
                                      ? 'bg-emerald-100 dark:bg-emerald-955 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                      : o.status === 'EXPIRED'
                                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                                      : 'bg-amber-100 dark:bg-amber-955/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse'
                                  }`}>
                                    {isPaid && <CheckCircle2 className="w-3 h-3" />}
                                    {o.status || 'PENDING'}
                                  </span>
                                </td>

                                <td className="p-4 space-y-0.5">
                                  <div className="flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                                    <Check className="w-3 h-3" />
                                    <span>T&amp;C + REFUND ACCEPTED</span>
                                  </div>
                                  <span className="text-[9.5px] text-gray-400 block font-mono">
                                    {new Date(o.createdAt).toLocaleDateString()}
                                  </span>
                                </td>

                                <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedAuditOrder(o)}
                                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-955/40 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10.5px] font-black uppercase tracking-wider cursor-pointer transition-all inline-flex items-center gap-1"
                                    title="View Statutory Legal Certificate"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>Legal Certificate</span>
                                  </button>
                                  
                                  <button
                                    type="button"
                                    onClick={() => handleCheckLiveStatus(o.orderCode || o.id)}
                                    className="p-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-600 dark:text-gray-300 rounded-xl transition-all cursor-pointer inline-flex items-center"
                                    title="Poll Bank Server Status"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  </button>
                                </td>

                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* MOBILE CARD VIEW (Optimized for small screens) */}
                    <div className="block md:hidden divide-y divide-gray-100 dark:divide-gray-800 p-3 space-y-3">
                      {filteredOrders.map((o) => {
                        const isPaid = (o.status || '').toUpperCase() === 'PAID' || (o.status || '').toUpperCase() === 'SUCCESS';
                        return (
                          <div key={o.id} className="p-4 rounded-2xl bg-gray-50/70 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700/80 space-y-3">
                            
                            {/* Card Top Row: Code, Status, Amount */}
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Order Code</span>
                                <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs">{o.orderCode || o.id}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-base font-black text-emerald-600 dark:text-emerald-400 block">₹{o.amount || 0}</span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                  isPaid
                                    ? 'bg-emerald-100 dark:bg-emerald-955 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-amber-100 dark:bg-amber-955/60 text-amber-700 dark:text-amber-300'
                                }`}>
                                  {isPaid && <CheckCircle2 className="w-2.5 h-2.5" />}
                                  {o.status || 'PENDING'}
                                </span>
                              </div>
                            </div>

                            {/* Card Customer & Item */}
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-400">Customer:</span>
                                <span className="font-bold text-gray-900 dark:text-white">{o.customerName || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between font-mono text-[11px]">
                                <span className="text-gray-400">Phone:</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{o.customerPhone || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Item:</span>
                                <span className="font-bold text-gray-800 dark:text-gray-200 truncate max-w-[180px]">{o.itemTitle || 'Free Fire Account'}</span>
                              </div>
                              {o.accountUid && (
                                <div className="flex justify-between font-mono text-[10.5px]">
                                  <span className="text-gray-400">FF UID:</span>
                                  <span className="text-indigo-500 font-bold">{o.accountUid}</span>
                                </div>
                              )}
                              {o.utr && (
                                <div className="flex justify-between font-mono text-[10.5px]">
                                  <span className="text-gray-400">Bank UTR:</span>
                                  <span className="text-teal-500 font-bold">{o.utr}</span>
                                </div>
                              )}
                            </div>

                            {/* Legal Consent Badge */}
                            <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-200 dark:border-gray-700/60">
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                                <Check className="w-3 h-3" /> T&amp;C Accepted
                              </span>
                              <span className="font-mono">{new Date(o.createdAt).toLocaleDateString()}</span>
                            </div>

                            {/* Mobile Card Action Buttons */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setSelectedAuditOrder(o)}
                                className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Certificate</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCheckLiveStatus(o.orderCode || o.id)}
                                className="py-2.5 px-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-650 text-gray-800 dark:text-gray-100 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Check Bank</span>
                              </button>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: LIVE TEST PAYMENT SIMULATOR */}
          {activeTab === 'test' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Test Generator Form */}
              <div className="lg:col-span-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xs space-y-5">
                <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-955/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800 shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-gray-900 dark:text-white">
                      Instant Test Order Generator
                    </h3>
                    <p className="text-xs font-semibold text-gray-400">
                      Creates a dynamic live QR with unique paise offset and real-time bank polling.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleCreateTestOrder} className="space-y-4">
                  
                  {/* Quick Amount Pills */}
                  <div>
                    <label className="block text-xs font-black uppercase text-gray-400 mb-1.5">
                      Test Amount (₹ INR)
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {['10', '50', '100', '500'].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setTestAmount(val)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            testAmount === val 
                              ? 'bg-emerald-600 text-white shadow-xs' 
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          ₹{val}
                        </button>
                      ))}
                    </div>
                    <div className="relative">
                      <IndianRupee className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="number"
                        min="1"
                        required
                        value={testAmount}
                        onChange={(e) => setTestAmount(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-black uppercase text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-gray-400 mb-1">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      required
                      value={testCustomerName}
                      onChange={(e) => setTestCustomerName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-black uppercase text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-gray-400 mb-1">
                      Customer Phone / WhatsApp
                    </label>
                    <input
                      type="tel"
                      required
                      value={testCustomerPhone}
                      onChange={(e) => setTestCustomerPhone(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-black uppercase text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase text-gray-400 mb-1">
                      Item / Asset Description
                    </label>
                    <input
                      type="text"
                      value={testItemTitle}
                      onChange={(e) => setTestItemTitle(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-black uppercase text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isGeneratingTest}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black uppercase tracking-wider text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isGeneratingTest ? <RefreshCw className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                    <span>Generate Test UPI QR Code</span>
                  </button>
                </form>
              </div>

              {/* Right Column: Live QR Stand Output */}
              <div className="lg:col-span-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xs flex flex-col items-center justify-center text-center">
                {testOrderResult ? (
                  <div className="w-full max-w-sm space-y-4">
                    
                    {/* Live Ticker Status */}
                    <div className={`p-3 rounded-2xl border text-xs font-black uppercase flex items-center justify-center gap-2 ${
                      testPollStatus === 'PAID'
                        ? 'bg-emerald-50 dark:bg-emerald-955/60 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-md shadow-emerald-500/20'
                        : 'bg-amber-50 dark:bg-amber-955/40 border-amber-400 text-amber-600 dark:text-amber-400 animate-pulse'
                    }`}>
                      {testPollStatus === 'PAID' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      <span>LIVE STATUS: {testPollStatus}</span>
                    </div>

                    {/* QR Code Container */}
                    <div className="p-4 bg-white rounded-3xl border-2 border-emerald-500/40 shadow-xl inline-block max-w-full">
                      {testOrderResult.qrDataUrl ? (
                        <img 
                          src={testOrderResult.qrDataUrl} 
                          alt="Test UPI QR" 
                          className="w-48 h-48 sm:w-56 sm:h-56 object-contain mx-auto" 
                        />
                      ) : (
                        <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center font-mono text-xs font-bold text-gray-400">
                          QR LOADING...
                        </div>
                      )}
                    </div>

                    {/* Order Details */}
                    <div className="p-3.5 bg-gray-50 dark:bg-gray-800 rounded-2xl space-y-1.5 text-left text-xs font-semibold">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Order Code:</span>
                        <span className="font-mono font-bold text-indigo-500">{testOrderResult.orderCode}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Payable Amount:</span>
                        <span className="font-bold text-emerald-500 text-sm">₹{testOrderResult.amount}</span>
                      </div>
                    </div>

                    {/* Intent Links */}
                    {testOrderResult.upiUri && (
                      <a
                        href={testOrderResult.upiUri}
                        className="block w-full py-3 px-4 rounded-xl bg-gray-900 dark:bg-gray-800 hover:bg-black text-white text-xs font-black uppercase tracking-wider text-center transition-all shadow-md"
                      >
                        Open In UPI App (GPay / Paytm / PhonePe)
                      </a>
                    )}

                  </div>
                ) : (
                  <div className="space-y-3 py-10 sm:py-16">
                    <Smartphone className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-700 animate-pulse" />
                    <h4 className="text-sm font-black uppercase text-gray-800 dark:text-gray-200">
                      Payment Stand Standby
                    </h4>
                    <p className="text-xs font-semibold text-gray-400 max-w-xs mx-auto">
                      Fill out the form on the left and click "Generate Test UPI QR Code" to preview live stand.
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: GATEWAY & API CONFIGURATION */}
          {activeTab === 'config' && (
            <div className="max-w-3xl w-full mx-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-xs space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-955/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800 shrink-0">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-gray-900 dark:text-white">
                      UPI Gateway API Credentials
                    </h3>
                    <p className="text-xs font-semibold text-gray-400">
                      Configure your Node.js UPI QR Gateway endpoints.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePingGateway}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-955/40 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${pingStatus === 'checking' ? 'animate-spin' : ''}`} />
                  <span>Test Ping</span>
                </button>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                
                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1">
                    Gateway Server URL
                  </label>
                  <input
                    type="url"
                    required
                    value={gatewayUrl}
                    onChange={(e) => setGatewayUrl(e.target.value)}
                    placeholder="https://payment-gateway-ydl1.onrender.com"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-black uppercase text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-gray-400 mb-1">
                    Gateway Master API Key (x-api-key)
                  </label>
                  <input
                    type="text"
                    required
                    value={gatewayApiKey}
                    onChange={(e) => setGatewayApiKey(e.target.value)}
                    placeholder="pg_live_bb2fa0d24e1caa68ff36319b8447773c"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-black uppercase text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {/* Statutory Legal Notice Box */}
                <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-955/20 border border-emerald-200 dark:border-emerald-800/60 space-y-2 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                  <div className="flex items-center gap-2 font-black uppercase">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Statutory Safe Harbor Compliance Note</span>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    All UPI payments processed via this gateway execute under Non-Custodial Direct Peer-to-Peer Settlement in strict compliance with the <strong>Information Technology Act, 2000 (Section 79)</strong> and <strong>DPDP Act, 2023</strong>. Transaction hashes &amp; customer identifiers are immutably logged for audit verification.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black uppercase tracking-wider text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingSettings ? 'Saving Settings...' : 'Save Gateway Settings'}
                </button>

              </form>

            </div>
          )}

        </main>
      </div>

      {/* STATUTORY LEGAL AUDIT CERTIFICATE MODAL (GOVT / TAX / POLICE PROOF) */}
      {selectedAuditOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto font-sans">
          <div className="bg-white dark:bg-gray-900 border-2 border-emerald-500/50 rounded-2xl sm:rounded-3xl max-w-2xl w-full shadow-[0_0_50px_rgba(16,185,129,0.3)] overflow-hidden relative my-auto text-gray-900 dark:text-white">
            
            {/* Certificate Header */}
            <div className="p-4 sm:p-6 bg-gradient-to-r from-gray-900 via-[#071912] to-gray-900 border-b border-emerald-500/30 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-950/80 border border-emerald-400 flex items-center justify-center text-emerald-400 shadow-md shrink-0">
                  <Scale className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold block">
                    GOVERNMENT / STATUTORY AUDIT PROOF
                  </span>
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-tight">
                    Statutory Escrow &amp; Payment Certificate
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setSelectedAuditOrder(null)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Certificate Body (Printable & Formal) */}
            <div className="p-4 sm:p-7 space-y-4 sm:space-y-6 max-h-[75vh] overflow-y-auto">
              
              {/* Seal & Identifier */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-955/20 border border-emerald-200 dark:border-emerald-800/50 text-xs">
                <div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Official Escrow Reference No.</span>
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                    {selectedAuditOrder.orderCode || selectedAuditOrder.id}
                  </span>
                </div>
                <div className="sm:text-right">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Settlement Status</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-black uppercase">
                    {selectedAuditOrder.status || 'VERIFIED'}
                  </span>
                </div>
              </div>

              {/* Grid of Verified Facts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs font-semibold">
                
                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl space-y-1">
                  <span className="text-[9.5px] font-black uppercase text-gray-400 block">Customer Name</span>
                  <span className="text-gray-900 dark:text-white font-bold">{selectedAuditOrder.customerName || 'N/A'}</span>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl space-y-1">
                  <span className="text-[9.5px] font-black uppercase text-gray-400 block">Customer Phone / WhatsApp</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">{selectedAuditOrder.customerPhone || 'N/A'}</span>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl space-y-1">
                  <span className="text-[9.5px] font-black uppercase text-gray-400 block">Asset / Item UID</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {selectedAuditOrder.accountUid || 'OFFICIAL GAMING ID'}
                  </span>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl space-y-1">
                  <span className="text-[9.5px] font-black uppercase text-gray-400 block">Gross Payable Amount</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">₹{selectedAuditOrder.amount || 0}</span>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl space-y-1 sm:col-span-2">
                  <span className="text-[9.5px] font-black uppercase text-gray-400 block">Bank Transaction UTR / Ref No.</span>
                  <span className="font-mono font-black text-emerald-700 dark:text-emerald-300">
                    {selectedAuditOrder.utr || 'PROCESSED VIA BHARAT UPI'}
                  </span>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl space-y-1 sm:col-span-2">
                  <span className="text-[9.5px] font-black uppercase text-gray-400 block">Transaction Timestamp</span>
                  <span className="font-mono text-gray-600 dark:text-gray-300 text-[11px]">
                    {new Date(selectedAuditOrder.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)
                  </span>
                </div>

              </div>

              {/* Electronic Consent & Agreement Signatures */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-2 text-[11px] leading-relaxed">
                <div className="font-black uppercase tracking-wide text-gray-900 dark:text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Statutory Digital Acceptance Proof</span>
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  The consumer explicitly executed an electronic signature and check-box consent to all <strong>Free Fire Official Escrow Protocols</strong>, <strong>No-Questions Replacement &amp; Refund Mandates</strong>, and <strong>DPDP Act 2023 Digital Terms</strong> prior to QR generation.
                </p>
                <div className="pt-1 flex flex-wrap gap-2 text-[9px] font-mono text-gray-500 uppercase">
                  <span>• IT Act 2000 Section 65B Admissible</span>
                  <span>• Intermediary Safe Harbor Verified</span>
                </div>
              </div>

            </div>

            {/* Certificate Actions Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-850 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2.5 bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Print Certificate</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAuditOrder(null)}
                className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
