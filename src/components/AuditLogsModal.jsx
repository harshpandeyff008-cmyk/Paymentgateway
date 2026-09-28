import React, { useState, useEffect } from 'react';
import { X, History, ChevronRight, Loader } from 'lucide-react';
import { fetchAuditLogs } from '../firebase/firestore';

/**
 * Modal dialog showing administrative audit records.
 * Visualizes granular difference details for each profile edit.
 */
export default function AuditLogsModal({ isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLogs();
      setLogs(data);
    } catch (error) {
      console.error("Failed to load audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE_CLIENT':
        return 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50';
      case 'DELETE_CLIENT':
        return 'text-rose-700 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50';
      case 'UPDATE_CLIENT':
      default:
        return 'text-blue-700 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50';
    }
  };

  const getActionLabel = (action) => {
    switch (action) {
      case 'CREATE_CLIENT': return 'Created';
      case 'DELETE_CLIENT': return 'Deleted';
      case 'UPDATE_CLIENT': return 'Updated';
      default: return action;
    }
  };

  const renderChanges = (changes) => {
    if (!changes || Object.keys(changes).length === 0) return null;
    
    return (
      <div className="mt-2 space-y-1 text-xs">
        {Object.entries(changes).map(([field, delta]) => {
          let fieldLabel = field;
          
          if (field === 'remainingBalance') fieldLabel = 'Balance';
          if (field === 'amountPaid') fieldLabel = 'Amount Paid';
          if (field === 'productName') fieldLabel = 'Product';
          if (field === 'validityDays') fieldLabel = 'Validity Days';
          if (field === 'expiryDate') fieldLabel = 'Expiry Date';
          if (field === 'purchaseDate') fieldLabel = 'Purchase Date';

          const oldVal = delta.old !== null ? String(delta.old) : 'None';
          const newVal = delta.new !== null ? String(delta.new) : 'None';

          return (
            <div key={field} className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 font-medium">
              <span className="capitalize text-gray-400 dark:text-gray-550">{fieldLabel}:</span>
              <span className="line-through opacity-70">{oldVal}</span>
              <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
              <span className="font-semibold text-gray-700 dark:text-gray-200">{newVal}</span>
            </div>
          );
        })}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl shadow-2xl animate-modal-pop max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-150 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Admin Audit Log</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-2">
              <Loader className="w-8 h-8 text-indigo-600 animate-spin" />
              <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Loading history logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
              No audit logs recorded yet.
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div 
                  key={log.id} 
                  className="p-4 bg-gray-50/50 dark:bg-gray-800/20 border border-gray-100 dark:border-gray-800 rounded-2xl flex flex-col space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {log.targetName || 'Unknown User'}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Modified by {log.adminEmail}
                      </p>
                    </div>
                    
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${getActionColor(log.action)}`}>
                      {getActionLabel(log.action)}
                    </span>
                  </div>

                  {renderChanges(log.changes)}

                  <div className="text-[10px] text-gray-400 dark:text-gray-500 text-right pt-1 font-semibold">
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
