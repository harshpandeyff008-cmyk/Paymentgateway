import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, Send, Loader } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import Footer from '../components/Footer';

export default function ContactUs() {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSending(true);
    
    // Simulate sending message
    setTimeout(() => {
      showToast("Thank you! Your message has been sent to Free Fire Official Deals Support. We will respond shortly.", "success");
      setName('');
      setEmail('');
      setMessage('');
      setSending(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-indigo-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4">
      <div className="max-w-5xl mx-auto w-full pt-10 pb-6 relative z-10 flex-1 flex flex-col justify-center">
        {/* Navigation header */}
        <div className="flex items-center justify-between mb-8">
          <Link 
            to="/login" 
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-650 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white dark:bg-gray-800 p-1 border border-gray-200 dark:border-gray-700 shadow-md flex items-center justify-center shrink-0">
              <img src="/garena-logo.png" alt="Garena Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-sm font-black text-gray-900 dark:text-white tracking-tight">FREE FIRE OFFICIAL DEALS</span>
          </div>
        </div>

        {/* Content Box */}
        <div className="grid grid-cols-1 md:grid-cols-5 bg-white/70 dark:bg-gray-900/70 border border-gray-150 dark:border-gray-800 backdrop-blur-md rounded-3xl shadow-xl overflow-hidden">
          {/* Left panel: Info */}
          <div className="md:col-span-2 bg-indigo-600 dark:bg-indigo-950 p-8 md:p-12 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10" />
            
            <div className="space-y-6 relative z-10">
              <div>
                <span className="text-xs font-black uppercase tracking-wider bg-white/10 px-2.5 py-1 rounded-md">
                  Contact Center
                </span>
                <h1 className="text-3xl font-black tracking-tight mt-3">Get in Touch</h1>
                <p className="text-xs text-indigo-150 dark:text-indigo-200 mt-2 font-semibold">
                  Have a question about subscriptions, client panels, or billing issues? Let us know.
                </p>
              </div>

              <div className="space-y-4 pt-6 text-xs font-semibold leading-relaxed">
                <div className="bg-white/10 p-4 rounded-xl border border-white/10 space-y-1">
                  <span className="text-[10px] text-indigo-200/80 font-bold uppercase tracking-wider block">Registered Merchant Info</span>
                  <span className="text-sm font-black text-white block uppercase tracking-wide">Coming Soon</span>
                </div>
              </div>
            </div>

            <div className="text-[10px] text-indigo-250/60 font-semibold pt-6 relative z-10 border-t border-white/10 mt-8">
              Verification Status: Pending
            </div>
          </div>

          {/* Right panel: Contact form */}
          <form onSubmit={handleSubmit} className="md:col-span-3 p-8 md:p-12 space-y-6">
            <h2 className="text-lg font-black text-gray-950 dark:text-white tracking-tight border-b border-gray-100 dark:border-gray-850 pb-3">
              Send a Message
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-550 dark:text-gray-450 uppercase mb-1.5">
                  Your Name
                </label>
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name..."
                  className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-gray-900 dark:text-white transition-all font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-550 dark:text-gray-450 uppercase mb-1.5">
                  Email Address
                </label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-gray-900 dark:text-white transition-all font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-550 dark:text-gray-450 uppercase mb-1.5">
                  Message Details
                </label>
                <textarea 
                  rows="4"
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your query here..."
                  className="w-full px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-gray-900 dark:text-white transition-all font-semibold resize-none"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={sending}
              className="w-full md:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-650/20 hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              {sending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{sending ? 'Sending...' : 'Send Message'}</span>
            </button>
          </form>
        </div>
      </div>

      <Footer />
    </div>
  );
}
