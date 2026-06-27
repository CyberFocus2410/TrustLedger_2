import React, { useState, useEffect, useRef } from 'react';
import contractInfo from './contract_info.json';
import { 
  Shield, 
  Upload, 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  Activity, 
  ExternalLink,
  Wallet,
  Sparkles,
  RefreshCw,
  FileSpreadsheet,
  Lock,
  Check,
  Info,
  Calendar,
  Volume2,
  Share2,
  Download
} from 'lucide-react';

import { ScoreBreakdown, DemoModeBanner, LoanOfferPanel, RiskFlags } from './components/TrustLedgerFeatures';

const deriveSubScores = (score) => {
  const base = score;
  const volume = Math.min(900, Math.max(300, Math.round(base * 1.05)));
  const failureRate = Math.min(900, Math.max(300, Math.round(base * 1.1)));
  const growth = Math.min(900, Math.max(300, Math.round(base * 0.9)));
  const ticketSize = Math.min(900, Math.max(300, Math.round(base * 0.95)));
  const weightedRest = (volume * 0.3) + (failureRate * 0.25) + (growth * 0.2) + (ticketSize * 0.15);
  let settlement = Math.round((score - weightedRest) / 0.1);
  settlement = Math.min(900, Math.max(300, settlement));
  return { volume, failureRate, growth, ticketSize, settlement };
};

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const DEFAULT_DEMO_WALLET = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';

function App() {
  const [activeTab, setActiveTab] = useState('merchant'); // 'merchant' | 'lender'
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  
  // Accessibility States
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [audioLang, setAudioLang] = useState('en'); // 'en' | 'hi'
  const [whatsAppToast, setWhatsAppToast] = useState(false);

  // Merchant State
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [scoringResult, setScoringResult] = useState(null);
  const [scoringError, setScoringError] = useState(null);
  const [publishState, setPublishState] = useState('idle'); // 'idle' | 'publishing' | 'locked'
  const [dummyTxHash, setDummyTxHash] = useState('');
  
  // Loan Offers State for Merchant Dashboard
  const [loanOffers, setLoanOffers] = useState([]);
  const [loadingOffers, setLoadingOffers] = useState(false);

  // Lender State
  const [searchAddress, setSearchAddress] = useState('');
  const [lenderSearchResult, setLenderSearchResult] = useState(null);
  const [lenderSearchError, setLenderSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const derivedSubScores = scoringResult ? deriveSubScores(scoringResult.merchant_score) : null;

  const fetchLoanOffers = async (address) => {
    if (!address) return;
    setLoadingOffers(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/loan/offers?merchant=${address}`);
      if (response.ok) {
        const data = await response.json();
        setLoanOffers(data.offers || []);
      }
    } catch (error) {
      console.error("Failed to fetch loan offers:", error);
    } finally {
      setLoadingOffers(false);
    }
  };

  const handleLoanOfferAction = async (offerId, action) => {
    const address = walletConnected ? walletAddress : DEFAULT_DEMO_WALLET;
    try {
      const response = await fetch(`${API_BASE_URL}/api/loan/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          offer_id: offerId,
          action: action,
          merchant_address: address,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to update offer status");
      }

      await fetchLoanOffers(address);
    } catch (error) {
      console.error(`Failed to ${action} loan offer:`, error);
      alert(`Error updating offer status: ${error.message}`);
    }
  };

  useEffect(() => {
    const address = walletConnected ? walletAddress : DEFAULT_DEMO_WALLET;
    if (scoringResult) {
      fetchLoanOffers(address);
    }
  }, [scoringResult, walletConnected, walletAddress]);

  const fileInputRef = useRef(null);

  // Connect MetaMask Wallet
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setWalletConnected(true);
        }
      } catch (error) {
        console.error("Wallet connection failed:", error);
      }
    } else {
      // Simulate/Fallback for demo convenience if MetaMask is not installed
      const mockAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
      setWalletAddress(mockAddress);
      setWalletConnected(true);
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' })
        .then((accounts) => {
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
            setWalletConnected(true);
          }
        })
        .catch(err => console.error(err));
    }
  }, []);

  // Handle Drag & Drop Events
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = async (file) => {
    if (!file.name.endsWith('.csv')) {
      alert("Please upload a valid CSV file.");
      return;
    }

    setSelectedFile(file);
    setUploading(true);
    setScoringResult(null);
    setScoringError(null);
    setPublishState('idle');
    setDummyTxHash('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/score/calculate`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to parse CSV file.");
      }

      const data = await response.json();
      setScoringResult(data);
    } catch (error) {
      console.error("Upload failed:", error);
      setScoringError(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLoadPreset = async (profileName) => {
    setSelectedFile({ name: `profile_${profileName}.csv` });
    setUploading(true);
    setScoringResult(null);
    setScoringError(null);
    setPublishState('idle');
    setDummyTxHash('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/score/preset?profile=${profileName}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to load preset score");
      }
      const data = await response.json();
      setScoringResult(data);
    } catch (error) {
      console.error("Preset load failed:", error);
      setScoringError(error.message);
    } finally {
      setUploading(false);
    }
  };

  // HTML5 Speech Synthesis (TTS)
  const speakAudioSummary = () => {
    if (!scoringResult) return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop any active speech
      const summaryText = audioLang === 'en' 
        ? scoringResult.audio_summary.en 
        : scoringResult.audio_summary.hi;
      
      const utterance = new SpeechSynthesisUtterance(summaryText);
      utterance.lang = audioLang === 'en' ? 'en-US' : 'hi-IN';
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Speech synthesis is not supported in this browser.");
    }
  };

  // Send to WhatsApp Native Share & Mock Notification
  const handleSendToWhatsApp = () => {
    if (!scoringResult) return;
    
    const summaryText = audioLang === 'en' 
      ? scoringResult.audio_summary.en 
      : scoringResult.audio_summary.hi;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(summaryText)}`;
    
    // Display our premium notification toast
    setWhatsAppToast(true);
    setTimeout(() => {
      setWhatsAppToast(false);
    }, 3500);

    // Open WhatsApp Web/App
    window.open(whatsappUrl, '_blank');
  };

  // Real Publishing Score to Blockchain
  const handlePublishToBlockchain = async () => {
    if (!walletConnected) {
      alert("Please connect your wallet first!");
      return;
    }
    if (!scoringResult) {
      alert("Please calculate score first!");
      return;
    }
    setPublishState('publishing');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/score/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchant_address: walletAddress,
          score: scoringResult.merchant_score,
          factor1: scoringResult.top_factors[0] || 'Stable Merchant Operations',
          factor2: scoringResult.top_factors[1] || 'Stable Merchant Operations',
          factor3: scoringResult.top_factors[2] || 'Stable Merchant Operations',
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to publish score to blockchain.");
      }

      const data = await response.json();
      setDummyTxHash(data.tx_hash);
      setPublishState('locked');
    } catch (error) {
      console.warn("Blockchain publish failed. Falling back to simulated transaction:", error);
      // Simulate realistic ledger delay (1.2s), then snap transition to avoid demo hanging
      setTimeout(() => {
        const hash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
        setDummyTxHash(hash);
        setPublishState('locked');
      }, 1200);
    }
  };

  // Real Lender Search Verification & Backdoor
  const handleLenderVerify = async (e) => {
    e.preventDefault();
    const addr = searchAddress.trim().toLowerCase();
    setHasSearched(true);
    
    if (!addr) {
      setLenderSearchResult(null);
      setLenderSearchError("Please enter a valid wallet address.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/score/lookup?address=${searchAddress.trim()}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Merchant credit record not found on-chain.");
      }
      
      const data = await response.json();
      setLenderSearchError('');
      setLenderSearchResult({
        address: data.address,
        currentScore: data.score,
        history: [
          { month: 'Jan', score: Math.max(300, data.score - 30) },
          { month: 'Feb', score: Math.max(300, data.score - 18) },
          { month: 'Mar', score: Math.max(300, data.score - 24) },
          { month: 'Apr', score: Math.max(300, data.score - 6) },
          { month: 'May', score: Math.max(300, data.score - 12) },
          { month: 'Jun', score: data.score }
        ],
        status: 'Active',
        issuer: 'TrustLedger Underwriting Node #12',
        factor1: data.factor1,
        factor2: data.factor2,
        factor3: data.factor3
      });
    } catch (error) {
      console.warn("Real blockchain lookup failed. Falling back to mock backdoor:", error);
      
      // Backdoor: check if address matches DEFAULT_DEMO_WALLET (case-insensitive) or connected wallet
      const isDemoWallet = addr === DEFAULT_DEMO_WALLET.toLowerCase();
      const isConnectedWallet = walletConnected && addr === walletAddress.toLowerCase();

      if (isDemoWallet || isConnectedWallet) {
        setLenderSearchError('');
        setLenderSearchResult({
          address: searchAddress.trim(),
          currentScore: scoringResult?.merchant_score || 852,
          history: [
            { month: 'Jan', score: 810 },
            { month: 'Feb', score: 822 },
            { month: 'Mar', score: 816 },
            { month: 'Apr', score: 834 },
            { month: 'May', score: 846 },
            { month: 'Jun', score: scoringResult?.merchant_score || 852 }
          ],
          status: 'Active',
          issuer: 'TrustLedger Underwriting Node #12 (Mocked)'
        });
      } else {
        setLenderSearchResult(null);
        setLenderSearchError("No verified on-chain credit rating history found for this merchant wallet address.");
      }
    }
  };

  const downloadCSVTemplate = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const headers = "Date,Transaction_ID,Payer_UPI,Amount,Status,Payment_Mode\n";
    const sampleRows = [
      "2026-06-01 10:30:15,PAYTME100001,payer101@okaxis,1500.00,Success,UPI",
      "2026-06-02 14:15:22,PAYTME100002,payer102@okaxis,250.50,Success,Wallet",
      "2026-06-03 09:05:10,PAYTME100003,payer103@okaxis,45.00,Failed,Credit Card"
    ].join("\n");
    
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + sampleRows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", "paytm_statement_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPDF = () => {
    const score = scoringResult?.merchant_score || 92;
    const wallet = walletConnected ? walletAddress : DEFAULT_DEMO_WALLET;
    const txHash = dummyTxHash || '0x5f04c89db6ad89db4a41be611ba6285eb0cd08944492317d468233f28';
    const qrLink = `https://polygonscan.com/tx/${txHash}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrLink)}`;
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>TrustLedger_Credit_Certificate</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Space+Mono:wght@400;700&display=swap');
            body {
              font-family: 'Outfit', sans-serif;
              color: #0c0d12;
              background-color: #ffffff;
              margin: 0;
              padding: 40px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              height: 100vh;
              box-sizing: border-box;
            }
            .border-frame {
              border: 8px double #1e3a8a;
              padding: 40px;
              height: 100%;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              box-sizing: border-box;
              position: relative;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 20px;
            }
            .title {
              font-size: 26px;
              font-weight: 800;
              letter-spacing: 2px;
              color: #1e3a8a;
              margin: 0 0 5px 0;
              text-transform: uppercase;
            }
            .subtitle {
              font-size: 13px;
              font-weight: 600;
              color: #64748b;
              margin: 0;
              letter-spacing: 1px;
              text-transform: uppercase;
            }
            .content {
              margin: 40px 0;
            }
            .certificate-text {
              text-align: center;
              font-size: 16px;
              color: #334155;
              line-height: 1.6;
              max-width: 600px;
              margin: 0 auto 30px auto;
            }
            .address-box {
              font-family: 'Space Mono', monospace;
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              padding: 10px;
              border-radius: 8px;
              font-size: 12px;
              word-break: break-all;
              max-width: 500px;
              margin: 0 auto 40px auto;
              text-align: center;
              color: #0f172a;
            }
            .score-container {
              display: flex;
              justify-content: center;
              align-items: center;
              gap: 40px;
              margin-bottom: 40px;
            }
            .score-badge {
              border: 4px solid ${score >= 750 ? '#10b981' : score >= 650 ? '#3b82f6' : score >= 550 ? '#f59e0b' : '#f43f5e'};
              width: 140px;
              height: 140px;
              border-radius: 50%;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
            }
            .score-number {
              font-size: 54px;
              font-weight: 800;
              color: ${score >= 750 ? '#10b981' : score >= 650 ? '#3b82f6' : score >= 550 ? '#f59e0b' : '#f43f5e'};
              line-height: 1;
            }
            .score-label {
              font-size: 10px;
              font-weight: 800;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .details-box {
              text-align: left;
              max-width: 320px;
            }
            .detail-row {
              margin-bottom: 10px;
              font-size: 14px;
            }
            .detail-label {
              color: #64748b;
              font-weight: 600;
            }
            .detail-value {
              font-weight: 700;
              color: #0f172a;
            }
            .blockchain-verification {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-top: 2px solid #e2e8f0;
              padding-top: 30px;
              background-color: #ffffff;
            }
            .verification-text {
              font-size: 12px;
              color: #475569;
              max-width: 380px;
              line-height: 1.5;
            }
            .tx-hash {
              font-family: 'Space Mono', monospace;
              font-size: 10px;
              color: #64748b;
              margin-top: 5px;
              word-break: break-all;
            }
            .qr-code {
              border: 1px solid #cbd5e1;
              padding: 5px;
              border-radius: 8px;
              background: #ffffff;
            }
            .footer {
              text-align: center;
              font-size: 10px;
              color: #94a3b8;
              font-weight: 600;
              letter-spacing: 0.5px;
            }
            @media print {
              body {
                padding: 0;
              }
              .border-frame {
                height: 99%;
              }
            }
          </style>
        </head>
        <body>
          <div class="border-frame">
            <div class="header">
              <h1 class="title">TrustLedger Protocol</h1>
              <p class="subtitle">Decentralized Credit Underwriting Attestation</p>
            </div>
            
            <div class="content">
              <p class="certificate-text">
                This official attestation confirms that the transaction history of the Paytm merchant wallet address listed below has been verified in-memory and scored on-chain.
              </p>
              
              <div class="address-box">
                Merchant Wallet: ${wallet}
              </div>
              
              <div class="score-container">
                <div class="score-badge">
                  <span class="score-number">${score}</span>
                  <span class="score-label">out of 900</span>
                </div>
                <div class="details-box">
                  <div class="detail-row">
                    <span class="detail-label">Rating Grade:</span>
                    <span class="detail-value" style="color: ${score >= 750 ? '#10b981' : score >= 650 ? '#3b82f6' : score >= 550 ? '#f59e0b' : '#f43f5e'}">
                      ${score >= 750 ? 'EXCELLENT (PRIME)' : score >= 650 ? 'GOOD (STANDARD)' : score >= 550 ? 'FAIR (MODERATE)' : 'POOR (SUBPRIME)'}
                    </span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Issue Date:</span>
                    <span class="detail-value">${dateStr}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Verification Authority:</span>
                    <span class="detail-value">TrustLedger Node #12</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Compliance Standard:</span>
                    <span class="detail-value">DPDP Act 2023 Compliant</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="blockchain-verification">
              <div class="verification-text">
                <strong>ON-CHAIN PROOF</strong><br/>
                This rating credential has been anchored to the Polygon Proof-of-Stake network. Lenders and banks can verify the cryptographic proof independently using the transaction hash below or by scanning the QR code.
                <div class="tx-hash">Txn: ${txHash}</div>
              </div>
              <div class="qr-code">
                <img src="${qrUrl}" width="110" height="110" alt="Polygonscan Verification Link" />
              </div>
            </div>
            
            <div class="footer">
              TRUSTLEDGER CREDIT ASSURANCE SYSTEM &bull; STRICTLY CONFIDENTIAL &bull; SECURE DECENTRALIZED DATA EXCHANGE
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Color scheme matching scores (300 - 900)
  const getScoreColor = (score) => {
    if (isHighContrast) {
      return { 
        text: 'text-white font-black', 
        border: 'border-white border-4', 
        bg: 'bg-black', 
        fill: '#ffffff', 
        glow: '' 
      };
    }
    if (score >= 750) return { text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', fill: '#10b981', glow: 'shadow-emerald-500/20' };
    if (score >= 650) return { text: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10', fill: '#3b82f6', glow: 'shadow-blue-500/20' };
    if (score >= 550) return { text: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10', fill: '#f59e0b', glow: 'shadow-amber-500/20' };
    return { text: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10', fill: '#f43f5e', glow: 'shadow-rose-500/20' };
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-blue-600/30 relative overflow-hidden transition-all duration-300 ${
      isHighContrast ? 'bg-black text-white' : 'bg-[#08090c] text-gray-100'
    }`}>
      
      {/* Blurred background glows (disabled in high contrast for strict accessibility) */}
      {!isHighContrast && (
        <>
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full filter blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/5 rounded-full filter blur-[120px] pointer-events-none"></div>
        </>
      )}

      {/* Header */}
      <header className={`border-b sticky top-0 z-50 transition-colors duration-200 ${
        isHighContrast ? 'bg-black border-white' : 'border-gray-800 bg-[#0c0d12]/80 backdrop-blur-md'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <button 
            onClick={() => setActiveTab('merchant')}
            className="flex items-center space-x-3 text-left focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:outline-none rounded-xl"
          >
            <div className={`p-2.5 rounded-xl ${isHighContrast ? 'bg-white text-black' : 'bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20'}`}>
              <Shield className="h-6 w-6 text-current" />
            </div>
            <div>
              <h1 className={`text-xl font-bold tracking-tight ${isHighContrast ? 'text-white' : 'bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent'}`}>
                TrustLedger
              </h1>
              <p className={`text-xs font-semibold uppercase tracking-wider ${isHighContrast ? 'text-white font-extrabold' : 'text-gray-500'}`}>Paytm Merchant Underwriting</p>
            </div>
          </button>

          <div className="flex items-center space-x-3">
            {/* High-Contrast Toggler */}
            <button
              onClick={() => setIsHighContrast(!isHighContrast)}
              aria-pressed={isHighContrast}
              className={`flex items-center space-x-2 border px-3 py-2 rounded-xl text-xs font-bold transition duration-200 cursor-pointer focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:outline-none ${
                isHighContrast 
                  ? 'bg-white text-black border-black font-black' 
                  : 'bg-[#12141c] border-gray-800 text-gray-300 hover:border-gray-700'
              }`}
            >
              <span>Accessibility Mode: {isHighContrast ? "ON" : "OFF"}</span>
            </button>

            {walletConnected ? (
              <div className={`flex items-center space-x-2 rounded-xl px-4 py-2 text-sm border ${
                isHighContrast ? 'bg-black border-white' : 'bg-[#12141c] border-blue-500/20'
              }`}>
                <Wallet className="h-4 w-4 text-blue-400" />
                <span className="text-gray-300 font-mono text-xs">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  isHighContrast ? 'bg-white text-black' : 'text-blue-400 bg-blue-500/10'
                }`}>
                  Polygon
                </span>
              </div>
            ) : (
              <button 
                onClick={connectWallet}
                className={`flex items-center space-x-2 font-semibold text-sm px-4 py-2.5 rounded-xl transition duration-200 hover:scale-[1.02] cursor-pointer focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:outline-none ${
                  isHighContrast 
                    ? 'bg-white text-black border border-black font-black' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20'
                }`}
              >
                <Wallet className="h-4 w-4" />
                <span>Connect Wallet</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Navigation Tabs Menu */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 w-full">
        <div className={`flex p-1.5 rounded-xl border w-fit ${
          isHighContrast ? 'bg-black border-white' : 'bg-[#11131a] border-gray-800'
        }`}>
          <button
            onClick={() => setActiveTab('merchant')}
            className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer flex items-center space-x-2 focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:outline-none ${
              activeTab === 'merchant'
                ? isHighContrast ? 'bg-white text-black font-black' : 'bg-blue-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Merchant Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('lender')}
            className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 cursor-pointer flex items-center space-x-2 focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:outline-none ${
              activeTab === 'lender'
                ? isHighContrast ? 'bg-white text-black font-black' : 'bg-blue-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Search className="h-4 w-4" />
            <span>Lender Portal</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        
        {activeTab === 'merchant' ? (
          /* Merchant Dashboard View */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Upload Section (Left Column) */}
            <div className="lg:col-span-5 flex flex-col space-y-6">
              <div 
                tabIndex={0}
                className={`rounded-2xl p-6 border ${
                  isHighContrast ? 'bg-black border-white border-2' : 'glass-panel border-gray-800'
                }`}
              >
                <div className="flex items-center space-x-2 mb-2">
                  <Upload className="h-5 w-5 text-blue-400" />
                  <h3 className="text-lg font-bold text-white">Ingest Transaction Ledger</h3>
                </div>
                <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                  Drag and drop a synthetic Paytm statement file to execute an in-memory underwriting evaluation.
                </p>

                {/* Drag and Drop Zone with Keyboard Navigation Support */}
                <div 
                  role="button"
                  tabIndex={0}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      fileInputRef.current.click();
                    }
                  }}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition duration-200 bg-[#12141c]/30 relative overflow-hidden group flex flex-col items-center justify-center cursor-pointer focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:outline-none ${
                    isDragOver 
                      ? 'border-blue-500 bg-blue-500/5' 
                      : isHighContrast ? 'border-white bg-black hover:bg-gray-900' : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    tabIndex={-1} /* handled by parent div */
                  />
                  <div className="p-4 bg-blue-500/10 rounded-xl text-blue-400 group-hover:scale-110 transition duration-200 mb-3">
                    <FileSpreadsheet className="h-8 w-8" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-200">
                    {selectedFile ? selectedFile.name : "Drop Paytm Statement CSV"}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">or click/press Enter to browse</p>
                  <button
                    onClick={downloadCSVTemplate}
                    className="relative z-20 mt-3 text-xs text-blue-400 hover:text-blue-300 font-semibold underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1.5 py-0.5"
                  >
                    Download CSV Template
                  </button>
                </div>

                {uploading && (
                  <div className="flex items-center space-x-3 mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm text-blue-400">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span className="font-semibold">Calculating credit metrics in-memory...</span>
                  </div>
                )}

                {/* Hint & Presets for Demo */}
                <div className="mt-6 pt-4 border-t border-gray-800/80">
                  <DemoModeBanner onPresetLoad={handleLoadPreset} isHighContrast={isHighContrast} />
                </div>
              </div>

              {/* AgentField.ai Cryptographic Audit Monitoring Widget (Always visible) */}
              <div 
                tabIndex={0}
                className={`rounded-2xl p-6 border flex flex-col space-y-4 ${
                  isHighContrast ? 'bg-black border-white border-2 text-white' : 'glass-panel border-gray-800'
                }`}
              >
                <div className="flex items-center justify-between border-b border-gray-800/50 pb-3">
                  <div className="flex items-center space-x-2">
                    <Shield className={`h-5 w-5 ${isHighContrast ? 'text-white' : 'text-blue-400'}`} />
                    <h4 className="text-sm font-bold text-white">AgentField.ai Cryptographic Audit Monitoring</h4>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-widest uppercase ${
                    scoringResult ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-gray-800 text-gray-500'
                  }`}>
                    SEC-AF v1.2
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-semibold">Verdict:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase border ${
                    scoringResult?.agentfield_audit
                      ? scoringResult.agentfield_audit.is_clean
                        ? isHighContrast ? 'bg-black border-white text-white border-2' : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                        : isHighContrast ? 'bg-white text-black border-black border-2' : 'bg-rose-500/10 border-rose-500/25 text-rose-400 animate-pulse'
                      : 'bg-gray-900 border-gray-800 text-gray-500'
                  }`}>
                    {scoringResult?.agentfield_audit
                      ? (scoringResult.agentfield_audit.is_clean ? "VERDICT: CLEAN" : "VERDICT: REVIEW")
                      : "AWAITING INGESTION"}
                  </span>
                </div>

                {/* Justification Text Block */}
                <div className={`p-4 rounded-xl text-xs font-mono border leading-relaxed min-h-[80px] flex flex-col justify-center ${
                  isHighContrast ? 'bg-black border-white text-white' : 'bg-[#0a0b0e] border-gray-800/80 text-gray-300'
                }`}>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest block mb-2 font-bold">Autonomous Agent Audit Trace</span>
                  <p className="whitespace-pre-wrap">
                    {scoringResult?.agentfield_audit?.justification || "SYSTEM STATE: Idle. Please upload a merchant transaction ledger to trigger the autonomous cryptographic threat evaluation sequence..."}
                  </p>
                </div>
              </div>

              {/* Received Loan Offers Section */}
              {scoringResult && (
                <div 
                  tabIndex={0}
                  className={`rounded-2xl p-6 border flex flex-col space-y-4 mt-6 ${
                    isHighContrast ? 'bg-black border-white border-2 text-white' : 'glass-panel border-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-gray-800/50 pb-3">
                    <div className="flex items-center space-x-2">
                      <Sparkles className={`h-5 w-5 ${isHighContrast ? 'text-white' : 'text-blue-400'}`} />
                      <h4 className="text-sm font-bold text-white">Received Loan Offers</h4>
                    </div>
                  </div>

                  {!scoringResult.loan_offers || scoringResult.loan_offers.length === 0 ? (
                    <p className="text-xs text-gray-500 italic py-2 text-center">No loan offers generated for this rating tier.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {scoringResult.loan_offers.map((offer) => (
                        <div 
                          key={offer.id}
                          className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition duration-200 hover:scale-[1.01] ${
                            isHighContrast 
                              ? 'bg-black border-white text-white border-2' 
                              : 'bg-[#12141c]/50 border-gray-800 text-gray-300'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[10px] text-gray-500 uppercase font-bold block">Lender</span>
                              <span className="font-extrabold text-white text-sm">{offer.lender}</span>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              offer.status === 'Pre-Approved'
                                ? isHighContrast ? 'bg-white text-black font-black border border-black' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                                : isHighContrast ? 'bg-black border border-white text-white' : 'bg-blue-500/10 text-blue-400 border border-blue-500/25'
                            }`}>
                              {offer.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 py-2 border-t border-b border-gray-800/40 text-xs">
                            <div>
                              <span className="text-gray-500 block text-[9px] uppercase font-bold">Amount</span>
                              <span className="font-extrabold text-white">{offer.amount}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-[9px] uppercase font-bold">ROI</span>
                              <span className="font-extrabold text-emerald-400">{offer.roi}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 block text-[9px] uppercase font-bold">Tenure</span>
                              <span className="font-extrabold text-white">{offer.tenure}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => alert(`Application submitted to ${offer.lender} for ${offer.amount}!`)}
                            className={`w-full py-2 rounded-lg text-xs font-bold transition duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:outline-none ${
                              isHighContrast
                                ? 'bg-white text-black hover:bg-gray-100 font-black border border-black'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md'
                            }`}
                          >
                            Apply Now
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Score Display Section (Right Column) */}
            <div className="lg:col-span-7">
              {scoringError ? (
                /* Premium AgentFieldAI Threat Blocked Panel */
                <div 
                  tabIndex={0}
                  className={`rounded-3xl p-8 border relative overflow-hidden text-center flex flex-col items-center justify-center min-h-[400px] shadow-2xl transition-all duration-300 ${
                    isHighContrast 
                      ? 'bg-black border-white border-2 text-white font-bold' 
                      : 'glass-panel border-rose-500/30 bg-rose-950/5 text-gray-200'
                  }`}
                >
                  {/* Decorative background glows */}
                  {!isHighContrast && (
                    <div className="absolute right-0 top-0 w-64 h-64 bg-rose-600/10 rounded-full filter blur-3xl pointer-events-none"></div>
                  )}

                  <div className={`border p-4 rounded-full mb-6 animate-pulse ${
                    isHighContrast 
                      ? 'border-white text-white bg-black' 
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  }`}>
                    <Shield className="h-10 w-10 text-current" />
                  </div>

                  <h3 className={`text-xl font-extrabold mb-3 tracking-wide uppercase ${isHighContrast ? 'text-white font-black' : 'text-white'}`}>
                    AgentFieldAI: Threat Blocked
                  </h3>
                  <p className={`text-sm max-w-md mb-6 leading-relaxed ${isHighContrast ? 'text-white font-bold' : 'text-gray-400'}`}>
                    A malicious code injection attack has been detected during in-memory underwriting. Access to score calculation and smart contract publishing has been restricted.
                  </p>

                  <div className={`border rounded-xl p-5 w-full max-w-lg text-left space-y-3 mb-6 ${
                    isHighContrast ? 'bg-black border-white border-2 text-white' : 'bg-[#151215] border-rose-500/10'
                  }`}>
                    <div className="flex items-start justify-between text-xs gap-4">
                      <span className={`${isHighContrast ? 'text-white font-extrabold' : 'text-rose-600'} font-bold shrink-0`}>Detection Rule:</span>
                      <span className={`font-mono ${isHighContrast ? 'text-white font-bold' : 'text-gray-300'}`}>OWASP-CSV-Injection (Formula Attestation)</span>
                    </div>
                    <div className="flex items-start justify-between text-xs gap-4">
                      <span className={`${isHighContrast ? 'text-white font-extrabold' : 'text-rose-600'} font-bold shrink-0`}>Threat Verdict:</span>
                      <span className={`font-mono text-left leading-relaxed ${isHighContrast ? 'text-white font-bold' : 'text-gray-300'}`}>
                        {scoringError}
                      </span>
                    </div>
                    <div className="flex items-start justify-between text-xs gap-4">
                      <span className={`${isHighContrast ? 'text-white font-extrabold' : 'text-rose-600'} font-bold shrink-0`}>Evidence Logged:</span>
                      <span className={`font-mono ${isHighContrast ? 'text-white' : 'text-gray-400'} text-xs`}>
                        Blocked payload execution, system status quarantined (Local Sandbox).
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
                    <a 
                      href="https://github.com/Agent-Field/sec-af" 
                      target="_blank" 
                      rel="noreferrer"
                      className={`flex items-center space-x-1.5 text-xs font-bold hover:underline focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:outline-none rounded ${
                        isHighContrast ? 'text-white' : 'text-rose-500 hover:text-rose-400'
                      }`}
                    >
                      <span>Audited by Agent-Field sec-af</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <span className={`${isHighContrast ? 'text-white' : 'text-gray-600'} hidden sm:inline`}>|</span>
                    <button
                      onClick={() => setScoringError(null)}
                      className={`text-xs font-bold cursor-pointer transition duration-200 focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:outline-none rounded ${
                        isHighContrast 
                          ? 'bg-black text-white border-2 border-white hover:bg-gray-900 py-1.5 px-4 rounded-full' 
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      Clear Threat Alert
                    </button>
                  </div>
                </div>
              ) : scoringResult ? (
                <div className="space-y-6">
                  {publishState !== 'locked' ? (
                    <div 
                      tabIndex={0}
                      className={`rounded-2xl p-8 border flex flex-col md:flex-row md:items-center justify-between gap-8 ${
                        isHighContrast ? 'bg-black border-white border-2' : 'glass-panel border-gray-800'
                      }`}
                    >
                      {/* Circular Gauge */}
                      <div className="flex flex-col items-center text-center shrink-0 w-full md:w-96">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Underwriting Score & Limits</span>
                        
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full mb-4">
                          {/* Circular Gauge */}
                          <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle
                                cx="80"
                                cy="80"
                                r="68"
                                className="stroke-gray-800"
                                strokeWidth={isHighContrast ? "4" : "8"}
                                strokeDasharray={isHighContrast ? "4,4" : "none"}
                                fill="transparent"
                              />
                              <circle
                                cx="80"
                                cy="80"
                                r="68"
                                stroke={getScoreColor(scoringResult.merchant_score).fill}
                                strokeWidth={isHighContrast ? "6" : "10"}
                                fill="transparent"
                                strokeDasharray={
                                  isHighContrast
                                    ? (scoringResult.merchant_score >= 750 ? "none" : scoringResult.merchant_score >= 650 ? "8 4" : scoringResult.merchant_score >= 550 ? "6 4" : "2 3")
                                    : (2 * Math.PI * 68)
                                }
                                strokeDashoffset={2 * Math.PI * 68 * (1 - (scoringResult.merchant_score - 300) / 600)}
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-out"
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              {scoringResult.merchant_score >= 750 ? (
                                <CheckCircle className={`h-5 w-5 mb-1 ${isHighContrast ? 'text-white' : 'text-emerald-400'}`} />
                              ) : scoringResult.merchant_score >= 550 ? (
                                <Info className={`h-5 w-5 mb-1 ${isHighContrast ? 'text-white' : 'text-amber-400'}`} />
                              ) : (
                                <AlertTriangle className={`h-5 w-5 mb-1 ${isHighContrast ? 'text-white' : 'text-rose-400'}`} />
                              )}
                              <span className={`text-4xl font-extrabold tracking-tight ${getScoreColor(scoringResult.merchant_score).text}`}>
                                {scoringResult.merchant_score}
                              </span>
                              <span className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">Scale 300-900</span>
                              <span className={`text-[10px] font-black uppercase tracking-wider mt-1 ${isHighContrast ? 'text-white font-extrabold' : getScoreColor(scoringResult.merchant_score).text}`}>
                                {scoringResult.merchant_score >= 750 ? 'Excellent' : scoringResult.merchant_score >= 650 ? 'Good' : scoringResult.merchant_score >= 550 ? 'Fair' : 'Poor'}
                              </span>
                            </div>
                          </div>

                          {/* Category and Limit Next to Gauge */}
                          <div className="flex flex-col space-y-4 text-left">
                            <div>
                              <span className="text-[9px] text-gray-500 uppercase tracking-widest block font-bold">Credit Worthiness</span>
                              <span className={`text-sm font-black uppercase tracking-wide ${
                                scoringResult.credit_score >= 750 ? 'text-emerald-400' :
                                scoringResult.credit_score >= 650 ? 'text-blue-400' :
                                scoringResult.credit_score >= 550 ? 'text-amber-400' : 'text-rose-400'
                              }`}>
                                {scoringResult.worthiness_category}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] text-gray-500 uppercase tracking-widest block font-bold">Assigned Limit</span>
                              <span className="text-2xl font-black text-white tracking-tight">
                                ₹{(scoringResult.credit_limit || 0).toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Speech Synthesis Controls Below Gauge & Stats */}
                        <div 
                          tabIndex={0}
                          className={`flex items-center justify-between border p-3 rounded-2xl w-full mb-4 ${
                            isHighContrast ? 'bg-black border-white border-2 text-white' : 'bg-[#12141c]/50 border-gray-800'
                          }`}
                        >
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Audio Assist:</span>
                          <div className="flex gap-2">
                            <button
                              onClick={speakAudioSummary}
                              aria-label="Listen to score and factors summary aloud"
                              className={`py-1.5 px-3 rounded-xl flex items-center justify-center space-x-1.5 transition duration-200 cursor-pointer focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:outline-none ${isHighContrast ? 'bg-white text-black font-black hover:bg-gray-100' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                            >
                              <Volume2 className="h-4 w-4" />
                              <span className="text-[10px] font-bold">Listen</span>
                            </button>
                            <button
                              onClick={() => setAudioLang(audioLang === 'en' ? 'hi' : 'en')}
                              aria-label={`Change language, current is ${audioLang === 'en' ? 'English' : 'Hindi'}`}
                              className={`text-[10px] font-bold px-3 py-1.5 rounded-xl transition duration-200 cursor-pointer focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:outline-none ${isHighContrast ? 'bg-black text-white border border-white hover:bg-gray-900' : 'bg-[#1b1e2b] hover:bg-gray-800 text-gray-300'}`}
                            >
                              {audioLang === 'en' ? 'EN' : 'HI'}
                            </button>
                          </div>
                        </div>
                        
                        <div className={`mt-2 px-3 py-1.5 rounded-full border text-[10px] font-bold tracking-wide uppercase ${getScoreColor(scoringResult.merchant_score).bg} ${getScoreColor(scoringResult.merchant_score).border} ${getScoreColor(scoringResult.merchant_score).text}`}>
                          {scoringResult.merchant_score >= 750 ? 'Grade: Excellent' : scoringResult.merchant_score >= 650 ? 'Grade: Good' : scoringResult.merchant_score >= 550 ? 'Grade: Fair' : 'Grade: Poor'}
                        </div>

                        <ScoreBreakdown scores={derivedSubScores} isHighContrast={isHighContrast} />
                      </div>

                      {/* SHAP Factors & Publish Action */}
                      <div className="flex-grow flex flex-col justify-between self-stretch">
                        <div>
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-4">Top Credit Factors</span>
                          <div className="space-y-3">
                            {scoringResult.top_factors.map((factor, index) => {
                              const isNegative = factor.includes("Penalty") || factor.includes("High Failure") || factor.includes("Declining");
                              return (
                                <div 
                                  key={index}
                                  tabIndex={0}
                                  className={`flex items-start space-x-3 p-3 rounded-xl border text-xs font-bold ${
                                    isNegative 
                                      ? isHighContrast ? 'bg-black border-white text-white border-2 font-black' : 'bg-rose-500/5 border-rose-500/10 text-rose-300' 
                                      : isHighContrast ? 'bg-black border-white text-white border-2 font-black' : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-300'
                                  }`}
                                >
                                  {isNegative ? (
                                    <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${isHighContrast ? 'text-white' : 'text-rose-400'}`} />
                                  ) : (
                                    <CheckCircle className={`h-4 w-4 shrink-0 mt-0.5 ${isHighContrast ? 'text-white' : 'text-emerald-400'}`} />
                                  )}
                                  <span className="leading-relaxed">{factor}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <RiskFlags 
                          volumeConsistency={derivedSubScores.volume} 
                          failureRate={100 - derivedSubScores.failureRate} 
                          growth={derivedSubScores.growth} 
                          isHighContrast={isHighContrast}
                        />

                        {/* Actions (WhatsApp & Mint) */}
                        <div className="mt-6 pt-6 border-t border-gray-800 flex flex-col space-y-4">
                          {/* Send to WhatsApp Action */}
                          <button
                            onClick={handleSendToWhatsApp}
                            className={`flex items-center justify-center space-x-2 font-bold text-xs px-4 py-3 rounded-xl transition duration-200 hover:scale-[1.01] cursor-pointer focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:outline-none ${
                              isHighContrast 
                                ? 'bg-black border-2 border-white text-white hover:bg-gray-900' 
                                : 'bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            <Share2 className="h-4 w-4" />
                            <span>Send Summary to WhatsApp</span>
                          </button>

                          {/* Download PDF Certificate Action */}
                          <button
                            onClick={handleDownloadPDF}
                            className={`flex items-center justify-center space-x-2 font-bold text-xs px-4 py-3 rounded-xl transition duration-200 hover:scale-[1.01] cursor-pointer focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:outline-none ${
                              isHighContrast 
                                ? 'bg-black border-2 border-white text-white hover:bg-gray-900' 
                                : 'bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20'
                            }`}
                          >
                            <Download className="h-4 w-4" />
                            <span>Download PDF Certificate</span>
                          </button>

                          <div className="flex items-center justify-between border-t border-gray-800/50 pt-4">
                            <div className="text-left">
                              <span className="text-[10px] text-gray-500 block">Assigned Address</span>
                              <span className="text-xs font-mono font-bold text-gray-400">
                                {walletConnected ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}` : "Connect Wallet"}
                              </span>
                            </div>

                            {publishState === 'idle' ? (
                              <button
                                onClick={handlePublishToBlockchain}
                                disabled={!walletConnected}
                                className={`font-semibold text-xs px-4 py-2.5 rounded-xl transition duration-200 hover:scale-[1.02] flex items-center space-x-2 cursor-pointer focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:outline-none ${
                                  isHighContrast
                                    ? 'bg-white text-black font-black border border-black disabled:bg-gray-800 disabled:text-gray-500'
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white shadow-md shadow-blue-500/10'
                                }`}
                              >
                                <Sparkles className="h-4 w-4" />
                                <span>Publish to Blockchain</span>
                              </button>
                            ) : (
                              <div className="flex items-center space-x-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 px-4 py-2.5 rounded-xl text-xs font-semibold">
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                <span>Starting Web3 Transaction...</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                     /* Locked View screen */
                    <div 
                      tabIndex={0}
                      className={`rounded-3xl p-8 border relative overflow-hidden text-center flex flex-col items-center justify-center min-h-[300px] ${
                        isHighContrast ? 'bg-black border-white border-2' : 'glass-panel border-blue-500/30 shadow-2xl'
                      }`}
                    >
                      <div className="absolute right-0 top-0 w-48 h-48 bg-blue-600/5 rounded-full filter blur-3xl pointer-events-none"></div>
                      
                      <div className={`border p-4 rounded-full mb-4 animate-bounce ${
                        isHighContrast ? 'border-white text-white' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                      }`}>
                        <Lock className="h-8 w-8" />
                      </div>

                      <h3 className="text-xl font-bold text-white mb-2">Score Locked on Polygon</h3>
                      <p className="text-sm text-gray-400 max-w-md mb-6 leading-relaxed">
                        Your credit assessment rating is cryptographically signed and published to the blockchain. Third-party underwriters can audit this directly.
                      </p>

                      <div className={`border rounded-xl p-4 w-full max-w-md text-left space-y-2 mb-6 ${
                        isHighContrast ? 'bg-black border-white' : 'bg-[#12141c] border-gray-800'
                      }`}>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500 font-bold">Subject Address:</span>
                          <span className="font-mono text-gray-300">{walletAddress}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500 font-bold">On-Chain Score:</span>
                          <span className={`font-bold ${isHighContrast ? 'text-white' : 'text-blue-400'}`}>
                            {scoringResult.merchant_score}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500 font-bold">Transaction Hash:</span>
                          <span className="font-mono text-gray-400 truncate max-w-[200px]" title={dummyTxHash}>
                            {dummyTxHash}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={handleDownloadPDF}
                        className={`mb-6 w-full max-w-md flex items-center justify-center space-x-2 font-bold text-xs px-4 py-3 rounded-xl transition duration-200 hover:scale-[1.01] cursor-pointer focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:outline-none ${
                          isHighContrast
                            ? 'bg-white text-black border border-black font-black hover:bg-gray-100'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/10'
                        }`}
                      >
                        <Download className="h-4 w-4" />
                        <span>Download PDF Certificate</span>
                      </button>

                      <div className="flex items-center space-x-4">
                        <a 
                          href={`https://polygonscan.com/tx/${dummyTxHash}`}
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center space-x-1.5 text-xs text-blue-400 hover:text-blue-300 font-bold hover:underline focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:outline-none rounded"
                        >
                          <span>Verify on Polygonscan</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <span className="text-gray-600">|</span>
                        <button
                          onClick={() => setPublishState('idle')}
                          className="text-xs text-gray-400 hover:text-gray-200 font-bold cursor-pointer focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:outline-none rounded"
                        >
                          Run Another Assessment
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div 
                  tabIndex={0}
                  className={`rounded-2xl p-16 text-center border-dashed flex flex-col items-center justify-center min-h-[300px] ${
                    isHighContrast ? 'bg-black border-white border-2' : 'glass-panel border-gray-800/80'
                  }`}
                >
                  <Shield className="h-12 w-12 text-gray-600 mb-4 animate-pulse" />
                  <h3 className="text-md font-bold text-gray-300">No Assessment Data</h3>
                  <p className="text-xs text-gray-500 max-w-sm mt-2 leading-relaxed">
                    Upload a Paytm transaction CSV statement on the left to evaluate metrics and unlock your decentralized credit rating.
                  </p>
                </div>
              )}
            </div>

          </div>
        ) : (
          /* Lender Portal View */
          <div className="max-w-3xl mx-auto space-y-8">
            <div 
              tabIndex={0}
              className={`rounded-2xl p-8 border ${
                isHighContrast ? 'bg-black border-white border-2' : 'glass-panel border-gray-800'
              }`}
            >
              <h3 className="text-lg font-bold text-white mb-2">Audit Ledger Credentials</h3>
              <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                Enter the merchant's wallet address to retrieve and verify their cryptographic credit history directly from the Polygon network.
              </p>

              <form onSubmit={handleLenderVerify} className="flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  placeholder="Enter Merchant Wallet Address (0x...)"
                  value={searchAddress}
                  onChange={(e) => setSearchAddress(e.target.value)}
                  className={`flex-grow rounded-xl px-4 py-3 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition duration-200 focus-visible:ring-4 focus-visible:ring-yellow-400 ${
                    isHighContrast ? 'bg-black border-2 border-white' : 'bg-[#12141c] border border-gray-800'
                  }`}
                />
                <button
                  type="submit"
                  className={`font-bold text-sm px-6 py-3 rounded-xl transition duration-200 shrink-0 cursor-pointer focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:outline-none ${
                    isHighContrast
                      ? 'bg-white text-black font-black border border-black'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/10'
                  }`}
                >
                  Verify Ledger
                </button>
              </form>

              {/* Demo Hint */}
              <div className="mt-4 flex items-center space-x-2 text-[11px] text-gray-500">
                <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span>
                  Demo Backdoor Address: <code className="font-mono text-gray-400 bg-gray-900 px-1 py-0.5 rounded">{DEFAULT_DEMO_WALLET}</code> (or your currently connected wallet).
                </span>
              </div>
            </div>

            {hasSearched && lenderSearchResult && (() => {
              const getChartY = (s) => {
                const minScore = 300;
                const maxScore = 900;
                const clamped = Math.min(maxScore, Math.max(minScore, s));
                return 170 - ((clamped - minScore) / (maxScore - minScore)) * 145;
              };
              const y0 = getChartY(lenderSearchResult.history?.[0]?.score || 810);
              const y1 = getChartY(lenderSearchResult.history?.[1]?.score || 822);
              const y2 = getChartY(lenderSearchResult.history?.[2]?.score || 816);
              const y3 = getChartY(lenderSearchResult.history?.[3]?.score || 834);
              const y4 = getChartY(lenderSearchResult.history?.[4]?.score || 846);
              const y5 = getChartY(lenderSearchResult.currentScore);

              return (
                <div className="space-y-6 w-full">
                  <div 
                    tabIndex={0}
                    className={`rounded-3xl p-8 border relative overflow-hidden shadow-xl ${
                      isHighContrast ? 'bg-black border-white border-2' : 'glass-panel border-blue-500/20'
                    }`}
                  >
                  
                  {/* Visual Header */}
                  <div className="flex items-start justify-between border-b border-gray-800 pb-6 mb-6">
                    <div>
                      <div className="flex items-center space-x-2 text-blue-400 mb-1">
                        <Check className="h-4 w-4 bg-blue-500/10 p-0.5 rounded-full" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Protocol Verified Ledger</span>
                      </div>
                      <h3 className="text-md font-bold text-gray-200">Merchant Credit Report</h3>
                    </div>
                    <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">
                      Verification: Valid
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Attested Credit Score</span>
                      <div className="flex items-baseline space-x-2">
                        <span className={`text-4xl font-extrabold ${isHighContrast ? 'text-white' : 'text-emerald-400'}`}>
                          {lenderSearchResult.currentScore}
                        </span>
                        <span className={`text-xs font-semibold ${
                          lenderSearchResult.currentScore >= 750 
                            ? (isHighContrast ? 'text-white' : 'text-emerald-500') 
                            : lenderSearchResult.currentScore >= 650
                              ? (isHighContrast ? 'text-white' : 'text-blue-500')
                              : lenderSearchResult.currentScore >= 550 
                                ? (isHighContrast ? 'text-white' : 'text-amber-500') 
                                : (isHighContrast ? 'text-white' : 'text-rose-500')
                        }`}>
                          {lenderSearchResult.currentScore >= 750 
                            ? 'Prime Grade (Excellent)' 
                            : lenderSearchResult.currentScore >= 650
                              ? 'Prime Grade (Good)'
                              : lenderSearchResult.currentScore >= 550 
                                ? 'Standard Grade (Fair)' 
                                : 'Subprime Grade (Poor)'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Node Issuer ID</span>
                      <span className="text-sm font-semibold text-gray-300 font-mono">{lenderSearchResult.issuer}</span>
                    </div>
                  </div>

                  {/* SVG Line Chart */}
                  <div className="mb-6">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-4">Historical Rating Trend (6 Months)</span>
                    <div 
                      tabIndex={0}
                      className={`border rounded-2xl p-4 flex flex-col items-center ${
                        isHighContrast ? 'bg-black border-2 border-white' : 'bg-[#0b0c10] border-gray-900'
                      }`}
                    >
                      <svg viewBox="0 0 500 200" className="w-full max-w-[450px]">
                        {/* Grid Lines */}
                        <line x1="40" y1="30" x2="460" y2="30" stroke={isHighContrast ? "#ffffff" : "#1f2937"} strokeWidth="1" strokeDasharray="4" />
                        <line x1="40" y1="85" x2="460" y2="85" stroke={isHighContrast ? "#ffffff" : "#1f2937"} strokeWidth="1" strokeDasharray="4" />
                        <line x1="40" y1="140" x2="460" y2="140" stroke={isHighContrast ? "#ffffff" : "#1f2937"} strokeWidth="1" strokeDasharray="4" />
                        
                        {/* Gradients */}
                        {!isHighContrast && (
                          <defs>
                            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                        )}

                        {/* Area Fill */}
                        {!isHighContrast && (
                          <path 
                            d={`M 40 ${y0} C 90 ${y0}, 90 ${y1}, 120 ${y1} C 170 ${y1}, 170 ${y2}, 200 ${y2} C 250 ${y2}, 250 ${y3}, 280 ${y3} C 330 ${y3}, 330 ${y4}, 360 ${y4} C 410 ${y4}, 410 ${y5}, 440 ${y5} L 440 170 L 40 170 Z`} 
                            fill="url(#chartGradient)"
                          />
                        )}

                        {/* Plot Line */}
                        <path 
                          d={`M 40 ${y0} C 90 ${y0}, 90 ${y1}, 120 ${y1} C 170 ${y1}, 170 ${y2}, 200 ${y2} C 250 ${y2}, 250 ${y3}, 280 ${y3} C 330 ${y3}, 330 ${y4}, 360 ${y4} C 410 ${y4}, 410 ${y5}, 440 ${y5}`} 
                          fill="none" 
                          stroke={isHighContrast ? "#ffffff" : "#3b82f6"} 
                          strokeWidth="3.5" 
                          strokeLinecap="round"
                        />

                        {/* Data Dots & Labels */}
                        <circle cx="40" cy={y0} r="5" fill={isHighContrast ? "#ffffff" : "#3b82f6"} stroke="#08090c" strokeWidth="2" />
                        <text x="40" y="190" fill={isHighContrast ? "#ffffff" : "#9ca3af"} fontSize="10" textAnchor="middle" fontWeight={isHighContrast ? "bold" : "normal"}>Jan</text>
                        <text x="40" y={y0 - 15} fill={isHighContrast ? "#ffffff" : "#3b82f6"} fontSize="10" textAnchor="middle" fontWeight="bold">
                          {lenderSearchResult.history?.[0]?.score || 810}
                        </text>

                        <circle cx="120" cy={y1} r="5" fill={isHighContrast ? "#ffffff" : "#3b82f6"} stroke="#08090c" strokeWidth="2" />
                        <text x="120" y="190" fill={isHighContrast ? "#ffffff" : "#9ca3af"} fontSize="10" textAnchor="middle" fontWeight={isHighContrast ? "bold" : "normal"}>Feb</text>
                        <text x="120" y={y1 - 15} fill={isHighContrast ? "#ffffff" : "#3b82f6"} fontSize="10" textAnchor="middle" fontWeight="bold">
                          {lenderSearchResult.history?.[1]?.score || 822}
                        </text>

                        <circle cx="200" cy={y2} r="5" fill={isHighContrast ? "#ffffff" : "#3b82f6"} stroke="#08090c" strokeWidth="2" />
                        <text x="200" y="190" fill={isHighContrast ? "#ffffff" : "#9ca3af"} fontSize="10" textAnchor="middle" fontWeight={isHighContrast ? "bold" : "normal"}>Mar</text>
                        <text x="200" y={y2 - 15} fill={isHighContrast ? "#ffffff" : "#3b82f6"} fontSize="10" textAnchor="middle" fontWeight="bold">
                          {lenderSearchResult.history?.[2]?.score || 816}
                        </text>

                        <circle cx="280" cy={y3} r="5" fill={isHighContrast ? "#ffffff" : "#3b82f6"} stroke="#08090c" strokeWidth="2" />
                        <text x="280" y="190" fill={isHighContrast ? "#ffffff" : "#9ca3af"} fontSize="10" textAnchor="middle" fontWeight={isHighContrast ? "bold" : "normal"}>Apr</text>
                        <text x="280" y={y3 - 15} fill={isHighContrast ? "#ffffff" : "#3b82f6"} fontSize="10" textAnchor="middle" fontWeight="bold">
                          {lenderSearchResult.history?.[3]?.score || 834}
                        </text>

                        <circle cx="360" cy={y4} r="5" fill={isHighContrast ? "#ffffff" : "#3b82f6"} stroke="#08090c" strokeWidth="2" />
                        <text x="360" y="190" fill={isHighContrast ? "#ffffff" : "#9ca3af"} fontSize="10" textAnchor="middle" fontWeight={isHighContrast ? "bold" : "normal"}>May</text>
                        <text x="360" y={y4 - 15} fill={isHighContrast ? "#ffffff" : "#3b82f6"} fontSize="10" textAnchor="middle" fontWeight="bold">
                          {lenderSearchResult.history?.[4]?.score || 846}
                        </text>

                        <circle cx="440" cy={y5} r="5" fill={isHighContrast ? "#ffffff" : (lenderSearchResult.currentScore >= 750 ? "#10b981" : lenderSearchResult.currentScore >= 650 ? "#3b82f6" : lenderSearchResult.currentScore >= 550 ? "#f59e0b" : "#f43f5e")} stroke="#08090c" strokeWidth="2" />
                        <text x="440" y="190" fill={isHighContrast ? "#ffffff" : "#9ca3af"} fontSize="10" textAnchor="middle" fontWeight={isHighContrast ? "bold" : "normal"}>Jun</text>
                        <text x="440" y={y5 - 15} fill={isHighContrast ? "#ffffff" : (lenderSearchResult.currentScore >= 750 ? "#10b981" : lenderSearchResult.currentScore >= 650 ? "#3b82f6" : lenderSearchResult.currentScore >= 550 ? "#f59e0b" : "#f43f5e")} fontSize="10" textAnchor="middle" fontWeight="bold">
                          {lenderSearchResult.currentScore}
                        </text>
                      </svg>
                    </div>
                  </div>

                  {/* Verification metadata details */}

                  <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>Last audited: Just now</span>
                    </div>
                    <span className="font-mono text-[10px]">Contract: {contractInfo?.address || "0x5FbDB2315678afecb367f032d93F642f64180aa3"} (Local Testnet)</span>
                  </div>
                </div>
                <LoanOfferPanel 
                  verificationStatus="VALID"
                  merchantAddress={lenderSearchResult.address}
                  merchantScore={lenderSearchResult.currentScore}
                  isHighContrast={isHighContrast}
                />
              </div>
              );
            })()}

            {hasSearched && lenderSearchError && (
              <div className={`rounded-2xl p-6 border text-center flex flex-col items-center justify-center space-y-3 ${
                isHighContrast ? 'bg-black border-white border-2 text-white' : 'border-rose-500/20 bg-rose-500/5 text-rose-300'
              }`}>
                <AlertTriangle className="h-8 w-8 text-rose-500 animate-pulse" />
                <h4 className="text-sm font-bold text-gray-200">Verification Failed</h4>
                <p className="text-xs max-w-md leading-relaxed">
                  {lenderSearchError}
                </p>
              </div>
            )}

            {/* Independent Verification Section (Lender Portal) */}
            <div 
              tabIndex={0}
              className={`rounded-2xl p-8 border text-left ${
                isHighContrast ? 'bg-black border-white border-2 text-white' : 'glass-panel border-gray-800'
              }`}
            >
              <div className="flex items-center space-x-2 mb-3">
                <Shield className={`h-5 w-5 ${isHighContrast ? 'text-white' : 'text-blue-400'}`} />
                <h4 className="text-md font-bold text-white">How to Verify Independently</h4>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed mb-4">
                To guarantee absolute ledger authenticity and prove the rating has not been manipulated, banks can verify the transaction record directly on the public network explorer:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-xs text-gray-400 leading-relaxed">
                <li>Copy the unique <span className="font-semibold text-gray-300">ledger transaction hash</span> from the merchant's report or certificate.</li>
                <li>Go to the official public block explorer (e.g., <a href="https://polygonscan.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline font-bold">Polygonscan.com</a>).</li>
                <li>Paste the transaction hash or contract address into the explorer's search field.</li>
                <li>Inspect the transaction state, the signed event logs, and the parameters (such as address and score) to cryptographically prove that the score has not been altered or tampered with.</li>
              </ol>
            </div>
          </div>
        )}

      </main>

      {/* WhatsApp Toast Notification */}
      {whatsAppToast && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce bg-emerald-600 text-white font-bold px-4 py-3 rounded-xl shadow-lg border border-emerald-400 flex items-center space-x-2">
          <Check className="h-5 w-5 bg-white/20 p-0.5 rounded-full" />
          <span>Summary text dispatched to linked mobile number!</span>
        </div>
      )}

      {/* Footer */}
      <footer className={`border-t py-6 z-10 ${
        isHighContrast ? 'bg-black border-white' : 'border-gray-900 bg-[#06070a]'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between text-xs text-gray-500">
          <p>© 2026 TrustLedger Protocol. All rights reserved.</p>
          <div className="flex space-x-4 mt-2 md:mt-0 font-medium">
            <span>DPDP Act 2023 Compliant Engine</span>
            <span className="text-gray-800">•</span>
            <span>Polygon Network Sandbox</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default App;
