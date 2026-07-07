import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Calculator, Send } from 'lucide-react';

/**
 * FEATURE 1 — Score Breakdown Panel
 * 
 * Renders a weighted breakdown of how the underwriting score was calculated.
 * The score is determined by 5 weighted components:
 * - Transaction Volume Consistency: 30%
 * - Payment Failure Rate: 25%
 * - Revenue Growth Trend: 20%
 * - Average Ticket Size: 15%
 * - Settlement Regularity: 10%
 */
export interface ScoreBreakdownProps {
  scores: {
    volume: number;
    failureRate: number;
    growth: number;
    ticketSize: number;
    settlement: number;
  };
  isHighContrast?: boolean;
}

export const ScoreBreakdown: React.FC<ScoreBreakdownProps> = ({ scores, isHighContrast }) => {
  const { volume, failureRate, growth, ticketSize, settlement } = scores;

  // Compute the weighted total score (300-900)
  const weightedTotal = Math.round(
    volume * 0.3 + 
    failureRate * 0.25 + 
    growth * 0.2 + 
    ticketSize * 0.15 + 
    settlement * 0.1
  );

  // Helper to resolve bar colors based on score value
  const getProgressBarColor = (val: number) => {
    if (isHighContrast) return 'bg-white';
    if (val >= 750) return 'bg-gradient-to-r from-emerald-600 to-emerald-400';
    if (val >= 650) return 'bg-gradient-to-r from-indigo-600 to-indigo-400';
    if (val >= 550) return 'bg-gradient-to-r from-amber-500 to-yellow-400';
    return 'bg-gradient-to-r from-rose-600 to-rose-400';
  };

  const getTextColor = (val: number) => {
    if (isHighContrast) return 'text-white font-black';
    if (val >= 750) return 'text-emerald-400';
    if (val >= 650) return 'text-indigo-400';
    if (val >= 550) return 'text-amber-400';
    return 'text-rose-400';
  };

  // Helper to generate dynamic factor-specific underwriting insights
  const getInsightText = (factor: string, val: number) => {
    switch (factor) {
      case 'volume':
        if (val >= 650) return 'Predictable transaction volume consistency.';
        if (val >= 550) return 'Moderate consistency with seasonal deviations.';
        return 'Highly irregular transaction volume observed.';
      case 'failureRate': {
        const failRatePct = 100 - ((val - 300) / 600 * 100);
        if (val >= 650) return `Low payment failure rate: ${failRatePct.toFixed(1)}%.`;
        if (val >= 550) return `Standard payment failure rate: ${failRatePct.toFixed(1)}%.`;
        return `Suboptimal payment failure rate: ${failRatePct.toFixed(1)}%.`;
      }
      case 'growth':
        if (val >= 650) return 'Strong positive MoM revenue expansion.';
        if (val >= 550) return 'Stable revenue trajectory.';
        return 'Negative revenue contraction trends.';
      case 'ticketSize':
        if (val >= 650) return 'Premium ticket size suggests high customer value.';
        if (val >= 550) return 'Standard merchant average ticket size.';
        return 'Low ticket size threshold penalty applied.';
      case 'settlement':
        if (val >= 650) return 'Prompt daily settlement cycles verified.';
        if (val >= 550) return 'Standard settlement cycles with typical liquidity locks.';
        return 'Highly volatile or delayed settlement periods.';
      default:
        return '';
    }
  };

  const factors = [
    { key: 'volume', name: 'Transaction Volume Consistency', weight: 30, val: volume },
    { key: 'failureRate', name: 'Payment Failure Rate', weight: 25, val: failureRate },
    { key: 'growth', name: 'Revenue Growth Trend', weight: 20, val: growth },
    { key: 'ticketSize', name: 'Average Ticket Size', weight: 15, val: ticketSize },
    { key: 'settlement', name: 'Settlement Regularity', weight: 10, val: settlement },
  ];

  return (
    <div 
      tabIndex={0}
      className={`w-full backdrop-blur-md rounded-2xl p-6 border mt-6 text-left ${
        isHighContrast 
          ? 'bg-black border-white border-2 text-white font-bold' 
          : 'bg-[#0a0c16]/70 border-slate-900 shadow-md'
      }`}
    >
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-900/60">
        <h4 className={`text-[10px] font-bold uppercase tracking-wider ${isHighContrast ? 'text-white font-black' : 'text-slate-400'}`}>Score Composition Breakdown</h4>
        <span className={`text-xs font-bold ${getTextColor(weightedTotal)}`}>
          Weighted Total: {weightedTotal}/900
        </span>
      </div>

      <div className="space-y-4">
        {factors.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <div className={`flex justify-between text-[11px] font-semibold ${isHighContrast ? 'text-white font-black' : 'text-slate-300'}`}>
              <span>{f.name} ({f.weight}%)</span>
              <span className={getTextColor(f.val)}>{f.val}</span>
            </div>
            
            {/* Progress Bar Container */}
            <div className={`w-full h-2 rounded-full overflow-hidden ${isHighContrast ? 'bg-black border border-white' : 'bg-slate-950 border border-slate-900/40'}`}>
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${getProgressBarColor(f.val)}`}
                style={{ width: `${Math.round(((f.val - 300) / 600) * 100)}%` }}
              />
            </div>

            {/* Subtext Insight */}
            <p className={`text-[9.5px] font-medium leading-normal ${isHighContrast ? 'text-white font-bold' : 'text-slate-500'}`}>
              {getInsightText(f.key, f.val)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};


/**
 * FEATURE 2 — Demo Mode Banner
 * 
 * Replaces hardcoded file layout reminders with a clean indicator.
 * Provides preset merchant files loader triggers (Excellent, Good, Poor)
 * styled as pill buttons.
 */
export interface DemoModeBannerProps {
  onPresetLoad: (profile: 'excellent' | 'good' | 'poor' | 'injection') => void;
  isHighContrast?: boolean;
}

export const DemoModeBanner: React.FC<DemoModeBannerProps> = ({ onPresetLoad, isHighContrast }) => {
  return (
    <div 
      tabIndex={0}
      className={`w-full rounded-2xl p-5 text-left border ${
        isHighContrast 
          ? 'bg-black border-white border-2 text-white' 
          : 'bg-[#0d1020]/80 border-slate-900 shadow-md'
      }`}
    >
      <div className="flex flex-col space-y-3.5">
        <div className="flex items-center space-x-2">
          <span className={`text-[8px] font-bold tracking-wider uppercase px-2 py-0.5 rounded ${
            isHighContrast ? 'bg-white text-black font-black' : 'bg-indigo-600 text-white'
          }`}>
            DEMO PRESETS
          </span>
          <span className={`text-xs font-semibold ${isHighContrast ? 'text-white' : 'text-slate-300'}`}>
            Load sample transaction profile
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onPresetLoad('excellent')}
            className={`py-2 px-3 rounded-xl text-[10.5px] font-semibold transition duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
              isHighContrast 
                ? 'bg-black text-white border-2 border-white hover:bg-gray-900' 
                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:scale-[1.01]'
            }`}
          >
            Excellent Profile
          </button>
          <button
            onClick={() => onPresetLoad('good')}
            className={`py-2 px-3 rounded-xl text-[10.5px] font-semibold transition duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
              isHighContrast 
                ? 'bg-black text-white border-2 border-white hover:bg-gray-900' 
                : 'bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 hover:scale-[1.01]'
            }`}
          >
            Good Profile
          </button>
          <button
            onClick={() => onPresetLoad('poor')}
            className={`py-2 px-3 rounded-xl text-[10.5px] font-semibold transition duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
              isHighContrast 
                ? 'bg-black text-white border-2 border-white hover:bg-gray-900' 
                : 'bg-rose-500/10 border border-rose-500/20 text-rose-450 hover:bg-rose-500/20 hover:scale-[1.01]'
            }`}
          >
            Poor Profile
          </button>
          <button
            onClick={() => onPresetLoad('injection')}
            className={`py-2 px-3 rounded-xl text-[10.5px] font-semibold transition duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none flex items-center justify-center space-x-1.5 ${
              isHighContrast 
                ? 'bg-black text-white border-2 border-white hover:bg-gray-900' 
                : 'bg-rose-950/20 border border-rose-500/20 text-rose-400 hover:bg-rose-950/40 hover:scale-[1.01]'
            }`}
          >
            <AlertTriangle className="h-3 w-3 animate-pulse text-rose-400" />
            <span>CSV Attack Demo</span>
          </button>
        </div>
        <div className={`text-[10px] font-medium mt-2 pt-2 border-t ${
          isHighContrast ? 'border-white text-white' : 'border-slate-900 text-slate-500'
        }`}>
          Credit scoring node protocols.{' '}
          <a 
            href="https://agentfield.ai/?utm_source=luma" 
            target="_blank" 
            rel="noreferrer" 
            className={`font-bold transition duration-200 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
              isHighContrast ? 'text-white underline' : 'text-indigo-400 hover:text-indigo-300 hover:underline'
            }`}
          >
            Explore Agentfield API
          </a>
        </div>
      </div>
    </div>
  );
};


/**
 * FEATURE 3 — Lender Loan Offer Flow
 * 
 * Displayed below the credit report card inside the Lender Portal.
 * Enables lenders to input variables, calculate monthly payments (EMI),
 * and submit cryptographic loan offers back to the merchant on-chain.
 */
export interface LoanOfferPanelProps {
  verificationStatus: 'VALID' | 'INVALID' | string;
  merchantAddress: string;
  merchantScore: number;
  isHighContrast?: boolean;
}

export const LoanOfferPanel: React.FC<LoanOfferPanelProps> = ({
  verificationStatus,
  merchantAddress,
  merchantScore: _merchantScore,
  isHighContrast,
}) => {
  const [loanAmount, setLoanAmount] = useState<string>('500000');
  const [interestRate, setInterestRate] = useState<string>('12.5');
  const [tenure, setTenure] = useState<number>(12); // months
  const [computedEMI, setComputedEMI] = useState<number | null>(null);
  const [showToast, setShowToast] = useState<boolean>(false);

  if (verificationStatus !== 'VALID') return null;

  const handleCalculateEMI = () => {
    const P = parseFloat(loanAmount);
    const annualRate = parseFloat(interestRate);
    const n = tenure;

    if (isNaN(P) || P <= 0 || isNaN(annualRate) || annualRate < 0) {
      alert("Please enter valid positive values for Loan Amount and Interest Rate.");
      return;
    }

    const r = (annualRate / 12) / 100;
    let emi = 0;
    if (r === 0) {
      emi = P / n;
    } else {
      emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    }
    setComputedEMI(Math.round(emi));
  };

  const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    let currentEmi = computedEMI;
    if (!currentEmi) {
      // Calculate automatically on submit if not calculated already
      const P = parseFloat(loanAmount);
      const annualRate = parseFloat(interestRate);
      const n = tenure;
      if (isNaN(P) || P <= 0 || isNaN(annualRate) || annualRate < 0) {
        alert("Please enter valid positive values for Loan Amount and Interest Rate.");
        return;
      }
      const r = (annualRate / 12) / 100;
      const emi = r === 0 ? P / n : (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      currentEmi = Math.round(emi);
      setComputedEMI(currentEmi);
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/api/loan/offer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          merchant_address: merchantAddress,
          amount: parseFloat(loanAmount),
          interest_rate: parseFloat(interestRate),
          tenure: tenure,
          monthly_emi: currentEmi,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit loan offer to backend");
      }

      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
      }, 4000);
    } catch (error: any) {
      console.error("Failed to submit loan offer:", error);
      alert(`Error submitting loan offer: ${error.message}`);
    }
  };

  return (
    <div 
      tabIndex={0}
      className={`w-full rounded-3xl p-8 mt-6 text-left shadow-2xl relative border ${
        isHighContrast 
          ? 'bg-black border-white border-2 text-white' 
          : 'bg-[#0a0c16]/85 border-slate-900 shadow-xl'
      }`}
    >
      <div className={`flex items-center space-x-2.5 mb-4 border-b pb-4 ${
        isHighContrast ? 'border-white' : 'border-slate-900/60'
      }`}>
        <Calculator className={`h-5 w-5 ${isHighContrast ? 'text-white' : 'text-indigo-400'}`} />
        <h3 className="text-xs font-bold text-white uppercase tracking-wider">
          Draft Credit Loan Offer
        </h3>
      </div>

      {showToast && (
        <div className={`absolute top-4 right-8 border text-[10px] font-bold py-2 px-4 rounded-xl shadow-lg flex items-center space-x-2 animate-bounce z-50 ${
          isHighContrast ? 'bg-black border-white text-white border-2' : 'bg-indigo-600 border-indigo-400 text-white'
        }`}>
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>Offer submitted to blockchain ✓</span>
        </div>
      )}

      <form onSubmit={handleSubmitOffer} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Loan Amount Input */}
          <div className="space-y-1.5">
            <label className={`text-[9px] font-bold uppercase tracking-wider block ${
              isHighContrast ? 'text-white' : 'text-slate-500'
            }`}>
              Loan Amount (Principal)
            </label>
            <div className="relative">
              <span className={`absolute left-3 top-2.5 font-bold text-xs ${isHighContrast ? 'text-white' : 'text-slate-500'}`}>₹</span>
              <input
                type="number"
                placeholder="500000"
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
                className={`w-full rounded-xl py-2.5 pl-7 pr-3 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isHighContrast 
                    ? 'bg-black border-2 border-white text-white focus:border-white' 
                    : 'bg-[#060811] border border-slate-900 text-white focus:border-indigo-500'
                }`}
              />
            </div>
          </div>

          {/* Interest Rate Input */}
          <div className="space-y-1.5">
            <label className={`text-[9px] font-bold uppercase tracking-wider block ${
              isHighContrast ? 'text-white' : 'text-slate-500'
            }`}>
              Interest Rate (p.a.)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.05"
                placeholder="12.5"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className={`w-full rounded-xl py-2.5 pl-3 pr-8 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isHighContrast 
                    ? 'bg-black border-2 border-white text-white focus:border-white' 
                    : 'bg-[#060811] border border-slate-900 text-white focus:border-indigo-500'
                }`}
              />
              <span className={`absolute right-3 top-2.5 font-bold text-xs ${isHighContrast ? 'text-white' : 'text-slate-500'}`}>%</span>
            </div>
          </div>

          {/* Tenure Select */}
          <div className="space-y-1.5">
            <label className={`text-[9px] font-bold uppercase tracking-wider block ${
              isHighContrast ? 'text-white' : 'text-slate-500'
            }`}>
              Tenure Duration
            </label>
            <select
              value={tenure}
              onChange={(e) => setTenure(parseInt(e.target.value))}
              className={`w-full rounded-xl py-2.5 px-3 text-xs focus:outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isHighContrast 
                  ? 'bg-black border-2 border-white text-white focus:border-white' 
                  : 'bg-[#060811] border border-slate-900 text-slate-200 focus:border-indigo-500'
              }`}
            >
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
              <option value={12}>12 months</option>
              <option value={24}>24 months</option>
            </select>
          </div>
        </div>

        {/* Action Row */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            type="button"
            onClick={handleCalculateEMI}
            className={`w-full sm:w-auto text-xs font-bold py-2.5 px-6 rounded-xl transition duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none hover-scale ${
              isHighContrast 
                ? 'bg-black border-2 border-white text-white hover:bg-gray-900' 
                : 'bg-[#060811] border border-slate-900 text-slate-300 hover:bg-[#0c0e18] hover:text-white'
            }`}
          >
            Calculate EMI
          </button>

          {computedEMI !== null && (
            <div className={`flex-grow flex items-center space-x-3 w-full border rounded-xl py-2.5 px-4 ${
              isHighContrast ? 'bg-black border-white border-2' : 'bg-[#060811]/60 border-slate-900/60 shadow-inner'
            }`}>
              <span className={`text-[9px] font-bold uppercase tracking-wider ${isHighContrast ? 'text-white' : 'text-slate-500'}`}>
                Monthly EMI Payback:
              </span>
              <span className={`text-xs font-extrabold ${isHighContrast ? 'text-white font-black' : 'text-emerald-400'}`}>
                ₹{computedEMI.toLocaleString('en-IN')} / month
              </span>
            </div>
          )}
        </div>

        {/* Submit Offer CTA */}
        <button
          type="submit"
          className={`w-full font-bold text-xs py-3.5 rounded-xl transition duration-200 hover-scale shadow-md flex items-center justify-center space-x-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
            isHighContrast 
              ? 'bg-white text-black font-black border-2 border-black hover:bg-gray-100' 
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/10 hover:shadow-indigo-600/20'
          }`}
        >
          <Send className="h-4 w-4" />
          <span>Submit Offer to Merchant ({merchantAddress.slice(0, 6)}...{merchantAddress.slice(-4)})</span>
        </button>
      </form>
    </div>
  );
};


/**
 * FEATURE 4 — Risk Flag Section
 * 
 * Checks for operational metrics violations and warns underwriters of risk exposure.
 * Rendered in the Merchant Dashboard below the Top Credit Factors.
 */
export interface RiskFlagsProps {
  volumeConsistency: number;
  failureRate: number; // Raw failure percentage (e.g. 15 for 15% failed transactions)
  growth: number;
  isHighContrast?: boolean;
}

export const RiskFlags: React.FC<RiskFlagsProps> = ({
  volumeConsistency,
  failureRate,
  growth,
  isHighContrast,
}) => {
  const flags: string[] = [];

  // Derive risk signals from score parameters
  if (growth < 50) {
    flags.push("Flat or declining revenue expansion trend");
  }
  if (volumeConsistency < 60) {
    flags.push("Irregular transaction volume patterns");
  }
  if (failureRate > 30) {
    flags.push("Above-average payment failure threshold");
  }

  return (
    <div 
      tabIndex={0}
      className={`w-full rounded-2xl p-6 border mt-6 text-left ${
        isHighContrast 
          ? 'bg-black border-white border-2 text-white' 
          : 'bg-[#0a0c16]/70 border-slate-900 shadow-md'
      }`}
    >
      <span className={`text-[10px] font-bold uppercase tracking-wider block mb-4 ${
        isHighContrast ? 'text-white font-black' : 'text-amber-500'
      }`}>
        Risk Evaluation Signals
      </span>

      {flags.length > 0 ? (
        <div className="space-y-3">
          {flags.map((flag, index) => (
            <div
              key={index}
              className={`flex items-start space-x-3 p-3.5 rounded-xl border text-xs font-semibold ${
                isHighContrast 
                  ? 'border border-white bg-black text-white font-black' 
                  : 'border-amber-500/10 bg-amber-500/5 text-amber-400'
              }`}
            >
              <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${isHighContrast ? 'text-white' : 'text-amber-400'}`} />
              <span className={`leading-relaxed ${isHighContrast ? 'text-white' : 'text-slate-300'}`}>{flag}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={`flex items-start space-x-3 p-3.5 rounded-xl border text-xs font-semibold ${
          isHighContrast 
            ? 'border border-white bg-black text-white font-black' 
            : 'border-emerald-500/10 bg-emerald-500/5 text-emerald-400'
        }`}>
          <CheckCircle className={`h-4 w-4 shrink-0 mt-0.5 ${isHighContrast ? 'text-white' : 'text-emerald-400'}`} />
          <span className="leading-relaxed">No critical operational risk flags detected</span>
        </div>
      )}
    </div>
  );
};
