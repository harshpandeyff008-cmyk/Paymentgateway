import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowLeft, Shield, Sparkles, Zap, Package } from 'lucide-react';
import Footer from '../components/Footer';

export default function Pricing() {
  const plans = [
    {
      name: "Starter License",
      price: "₹999",
      period: "per month",
      desc: "Perfect for individual developers and small businesses managing client contracts.",
      features: [
        "Up to 10 Client accounts",
        "Automated subscription tracking",
        "Basic secure client dashboard",
        "Standard session monitoring",
        "Email support (24h turnaround)"
      ],
      icon: Package,
      color: "border-gray-200 dark:border-gray-800",
      btnText: "Get Started",
      popular: false
    },
    {
      name: "Professional Plan",
      price: "₹1,999",
      period: "per month",
      desc: "Ideal for growth-oriented teams needing real-time telemetry and compliance checks.",
      features: [
        "Unlimited Client accounts",
        "Real-time IP & country logs",
        "Security Center Compliance & alerts",
        "Telegram Chat Widget integration",
        "Priority support (< 2 hours)",
        "Extended validity renewal dashboard"
      ],
      icon: Zap,
      color: "border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/20",
      btnText: "Choose Professional",
      popular: true
    },
    {
      name: "Enterprise Suite",
      price: "₹4,999",
      period: "per month",
      desc: "Enterprise-grade safety, audit logs, and fully custom security configurations.",
      features: [
        "All features in Professional",
        "Dedicated database resources",
        "Advanced admin audit logger",
        "Bulk client import/export",
        "24/7 dedicated support representative",
        "SLA guarantee of 99.9%"
      ],
      icon: Shield,
      color: "border-gray-200 dark:border-gray-800",
      btnText: "Contact Sales",
      popular: false
    }
  ];

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-indigo-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4 overflow-hidden">
      {/* Decorative background gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-200/10 dark:bg-indigo-950/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-300/15 dark:bg-indigo-900/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto w-full pt-10 pb-6 relative z-10 flex-1 flex flex-col justify-center">
        {/* Navigation header */}
        <div className="flex items-center justify-between mb-12">
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

        {/* Content Header */}
        <div className="text-center max-w-2xl mx-auto space-y-4 mb-14">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 uppercase tracking-wider">
            <Sparkles className="w-3 h-3" />
            Transparent Pricing
          </span>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight sm:text-5xl">
            Flexible Licenses for Your Operations
          </h1>
          <p className="text-base text-gray-500 dark:text-gray-400 font-medium">
            Gain complete control over subscription terms, client telemetry, and payment monitoring with no hidden fees.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, idx) => {
            const Icon = plan.icon;
            return (
              <div 
                key={idx} 
                className={`relative flex flex-col justify-between p-8 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md border rounded-3xl shadow-xl transition-all duration-300 hover:translate-y-[-4px] ${plan.color}`}
              >
                {plan.popular && (
                  <span className="absolute top-0 right-6 -translate-y-1/2 inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white shadow-lg shadow-indigo-650/20">
                    Most Popular
                  </span>
                )}
                
                <div className="space-y-6">
                  {/* Icon & Plan name */}
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-gray-900 dark:text-white text-lg tracking-tight">
                      {plan.name}
                    </span>
                    <div className="p-2 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-650 dark:text-gray-300">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Pricing details */}
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-black text-gray-950 dark:text-white tracking-tight">
                      {plan.price}
                    </span>
                    <span className="text-xs font-bold text-gray-550 dark:text-gray-450 uppercase">
                      / {plan.period}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 leading-relaxed">
                    {plan.desc}
                  </p>

                  {/* Features list */}
                  <ul className="space-y-3 pt-4 border-t border-gray-100 dark:border-gray-850">
                    {plan.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2.5 text-xs font-semibold text-gray-750 dark:text-gray-300 leading-relaxed">
                        <Check className="w-4 h-4 text-emerald-550 dark:text-emerald-450 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-8">
                  <Link 
                    to="/login"
                    className={`w-full py-3 px-4 rounded-xl text-center text-xs font-bold transition-all block ${
                      plan.popular 
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20' 
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-850 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-750'
                    }`}
                  >
                    {plan.btnText}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Footer />
    </div>
  );
}
