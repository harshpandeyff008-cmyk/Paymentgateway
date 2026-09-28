import React, { useState, useEffect } from 'react';
import { X, Shield, Search, ChevronLeft, ChevronRight, Loader, RefreshCw, Map } from 'lucide-react';
import { getAllUserSessions } from '../firebase/firestore';
import { useAuth } from '../context/AuthContext';

/**
 * Premium Modal to view all users' session telemetry & geolocations in a single place.
 */
export default function EveryUserSessionsModal({ isOpen, onClose }) {
  const { currentUser, userDoc } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    if (isOpen && userDoc) {
      fetchSessions();
    }
  }, [isOpen, userDoc]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const data = await getAllUserSessions(userDoc?.role, currentUser?.uid);
      setSessions(data);
      setCurrentPage(1);
    } catch (err) {
      console.error("Failed to load user sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Filter sessions by search term
  const filteredSessions = sessions.filter(session => {
    const nameStr = session.clientName || '';
    const emailStr = session.clientEmail || '';
    const ipStr = session.ip || '';
    const countryStr = session.country || '';
    
    return (
      nameStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emailStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ipStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      countryStr.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Pagination calculations
  const totalItems = filteredSessions.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSessions = filteredSessions.slice(startIndex, startIndex + itemsPerPage);

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="absolute inset-0 bg-transparent" 
        onClick={onClose} 
      />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-4xl bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden animate-scale-up z-10 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-6 pb-4 border-b border-gray-150 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
          <div className="flex items-center gap-2.5 text-indigo-650 dark:text-indigo-400">
            <Shield className="w-5.5 h-5.5 shrink-0" />
            <h3 className="text-xl font-black tracking-tight text-gray-950 dark:text-white">Global User Session Logs</h3>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchSessions}
              disabled={loading}
              className="p-1.5 border border-gray-250 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-850 rounded-xl text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all bg-white dark:bg-gray-900"
              title="Refresh Logs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 border border-gray-250 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-850 rounded-xl text-gray-400 hover:text-gray-650 dark:hover:text-gray-200 transition-all bg-white dark:bg-gray-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="p-6 pb-2 shrink-0 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search user, email, IP or country..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all font-semibold"
            />
          </div>
          <span className="text-xs font-bold text-gray-450 dark:text-gray-500 uppercase">
            Total Logged Sessions: {totalItems}
          </span>
        </div>

        {/* Scrollable list content */}
        <div className="flex-1 overflow-y-auto p-6 pt-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <Loader className="w-9 h-9 text-indigo-600 animate-spin" />
              <span className="text-xs font-bold text-gray-450 dark:text-gray-500 uppercase tracking-wider">Syncing global session records...</span>
            </div>
          ) : paginatedSessions.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-gray-200 dark:border-gray-800 rounded-3xl">
              <Shield className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <h4 className="font-extrabold text-sm text-gray-950 dark:text-white">No Telemetry Logs Found</h4>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs mx-auto font-semibold">
                Try modifying your query filter. Telemetry logs are populated when clients authenticate into their panels.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden border border-gray-150 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs font-semibold leading-relaxed">
                  <thead>
                    <tr className="border-b border-gray-150 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-[10px] font-extrabold uppercase text-gray-400 dark:text-gray-500 tracking-wider">
                      <th className="p-4 pl-6">Client</th>
                      <th className="p-4">Network IP &amp; Country</th>
                      <th className="p-4">GPS Location</th>
                      <th className="p-4">Browser &amp; Platform</th>
                      <th className="p-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 dark:divide-gray-800 text-gray-600 dark:text-gray-350">
                    {paginatedSessions.map((sess) => (
                      <tr key={sess.id} className="hover:bg-gray-50/30 dark:hover:bg-gray-800/10 transition-colors">
                        <td className="p-4 pl-6">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-650 dark:text-indigo-400 font-bold shrink-0">
                              {sess.clientName ? sess.clientName.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div>
                              <p className="font-extrabold text-gray-900 dark:text-white leading-tight">{sess.clientName}</p>
                              <span className="text-[10px] text-gray-450 dark:text-gray-500 mt-0.5 inline-block">{sess.clientEmail}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 font-semibold">
                          <p className="text-gray-900 dark:text-white leading-normal">{sess.ip}</p>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 inline-block">{sess.country}</span>
                        </td>
                        <td className="p-4">
                          {sess.latitude && sess.longitude ? (
                            <a 
                              href={`https://www.google.com/maps?q=${sess.latitude},${sess.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-650 hover:underline inline-flex items-center gap-1 font-extrabold"
                            >
                              <span>{sess.latitude.toFixed(4)}, {sess.longitude.toFixed(4)}</span>
                              <Map className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">Denied</span>
                          )}
                        </td>
                        <td className="p-4 max-w-[180px] truncate" title={sess.userAgent}>
                          <p className="text-gray-850 dark:text-gray-300 leading-normal truncate">{sess.userAgent.split(') ')[0]})</p>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 inline-block">
                            {sess.screenResolution} | {sess.platform} ({sess.language})
                          </span>
                        </td>
                        <td className="p-4 text-gray-500 dark:text-gray-400">
                          {new Date(sess.timestamp).toLocaleString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Pagination */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-850 flex items-center justify-between shrink-0 bg-gray-50/30 dark:bg-gray-900/30">
          <span className="text-xs font-bold text-gray-450 dark:text-gray-500">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} logs
          </span>
          
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevPage}
              disabled={currentPage === 1 || loading}
              className="p-1.5 border border-gray-250 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-850 rounded-xl text-gray-500 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all bg-white dark:bg-gray-900"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-black text-gray-700 dark:text-gray-300 px-2 select-none">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={goToNextPage}
              disabled={currentPage === totalPages || loading}
              className="p-1.5 border border-gray-250 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-850 rounded-xl text-gray-500 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all bg-white dark:bg-gray-900"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
