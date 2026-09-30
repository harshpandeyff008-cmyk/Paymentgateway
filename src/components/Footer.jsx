import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full bg-transparent border-t border-gray-200/60 dark:border-gray-800/60 py-8 mt-12">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-5 text-xs font-semibold text-gray-500 dark:text-gray-400">
        <div className="space-y-1.5">
          <div className="tracking-wide flex items-center gap-2">
            <img src="/garena-logo.png" alt="Free Fire Deals" className="w-4 h-4 object-contain inline-block" />
            <span>&copy; {new Date().getFullYear()} </span>
            <span className="text-gray-900 dark:text-white font-extrabold tracking-tight uppercase">DEALSBYSHIV — FF OFFICIAL DEALS</span>
            <span>. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>100% Verified Escrow Marketplace • DPDP Act 2023 Compliant • IT Act 2000</span>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed font-normal pt-1 max-w-xl">
            <strong>Disclaimer:</strong> DealsByShiv (freefireofficial.in) is an independent third-party gaming community marketplace &amp; escrow service. We are not affiliated with, authorized, or endorsed by Garena International Pte. Ltd. Free Fire is a registered trademark of Garena.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5">
          <Link 
            to="/pricing" 
            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-200 focus-ring rounded"
          >
            Pricing & Plans
          </Link>
          <Link 
            to="/contact-us" 
            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-200 focus-ring rounded"
          >
            Contact Us
          </Link>
          <Link 
            to="/terms-and-conditions" 
            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-200 focus-ring rounded"
          >
            Terms & Conditions
          </Link>
          <Link 
            to="/privacy-policy" 
            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-200 focus-ring rounded"
          >
            Privacy Policy
          </Link>
          <Link 
            to="/refund-policy" 
            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-200 focus-ring rounded"
          >
            Cancellation & Refund
          </Link>
        </div>
      </div>
    </footer>
  );
}
