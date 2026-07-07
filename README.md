# 🛡️ TrustLedger Underwriting Protocol (v1.2.0)

[![Netlify Status](https://api.netlify.com/api/v1/badges/6a4ce9ff0948a957125f671a/deploy-status)](https://trust-ledger-v2.netlify.app)
[![Built with FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![Web3 Solidity](https://img.shields.io/badge/Solidity-%23363636.svg?style=flat&logo=solidity&logoColor=white)](https://soliditylang.org)
[![AgentField AI Protected](https://img.shields.io/badge/AgentField-Protected-indigo)](https://agentfield.ai)

An enterprise-grade Web3 merchant credit underwriting protocol. TrustLedger parses Paytm payment statements, scores nano-merchant transactional throughput via a Random Forest regression model, screens logs for adversarial data-injection payloads via **AgentFieldAI**, and mints audit-ready credit ratings on a decentralized, tamper-proof blockchain ledger.

---

## 📋 Table of Contents
1. [The Problem Statement](#-the-problem-statement)
2. [The TrustLedger Solution](#-the-trustledger-solution)
3. [System Architecture](#-system-architecture)
4. [AgentFieldAI Security Integration](#-agentfieldai-security-integration)
5. [Credit Scoring & CIBIL Mapping Methodology](#-credit-scoring--cibil-mapping-methodology)
6. [Decentralized Ledger (Blockchain) Integration](#-decentralized-ledger-blockchain-integration)
7. [Local Quickstart & Orchestration](#-local-quickstart--orchestration)
8. [Production Deployment](#-production-deployment)

---

## ⚡ The Problem Statement

Traditional micro-lending models fail to serve nano and micro-merchants in emerging markets for three key reasons:
* **Legacy Credit Scoring Limits**: Micro-merchants often operate in cash-preferred or informal digital ecosystems. They lack established CIBIL/bureau histories, causing credit applications to be rejected.
* **Underwriting Latency**: Manually collecting, validating, and scoring merchant bank/payment logs takes days or weeks, making immediate working capital loans impossible.
* **Data Manipulation & Fraud**: Uploaded CSV/PDF ledger logs can be easily falsified by applicants. Once a rating is assigned, manual databases are susceptible to back-office tampering, rate modification, and audit fraud.

---

## 💡 The TrustLedger Solution

TrustLedger establishes an automated, secure, and privacy-preserving rating pipeline:
* **Instant Dynamic Underwriting**: Parses standardized transactional payment logs (e.g. Paytm statements) to extract operational momentum in seconds.
* **Adversarial Input Isolation**: Uses AgentFieldAI to audit incoming files in real-time, blocking formula injection attacks (e.g., OWASP-CSV-FormulaAttestation) that target server-side analytical pipelines.
* **On-Chain Audit Trails**: Mints credit ratings, operational risk flags, and score parameters directly to a Solidity smart contract deployed on the blockchain. Lenders can verify a merchant's score without accessing private PII data.

---

## 🏗️ System Architecture

TrustLedger operates on a layered, modular microservice architecture:

```
            ┌───────────────────────────────────────────────┐
            │          Premium React client Console         │
            │           (https://trust-ledger-v2.app)       │
            └───────────────┬───────────────▲───────────────┘
                            │               │
                  Statement │ Uploads       │ Scoring Result
                  (CSV Log) │               │ & Web3 Attestation
                            ▼               │
            ┌───────────────────────────────────────────────┐
            │            FastAPI Backend Engine             │
            │             (Python / Port 8000)              │
            └───────┬───────────────────────────────▲───────┘
                    │                               │
       Adversarial  │ Scan                          │ Load Trained
       Scan Request │                               │ Scikit-Learn Model
                    ▼                               │
     ┌─────────────────────────────┐ ┌──────────────┴──────────────┐
     │        AgentFieldAI         │ │   ML Evaluation Engine      │
     │      Security Sandbox       │ │ (Random Forest Classifier)  │
     └─────────────────────────────┘ └─────────────────────────────┘
                    │
                    │ Attested & Verified
                    ▼
            ┌───────────────────────────────────────────────┐
            │         Local Hardhat Blockchain Node         │
            │          (Solidity / EVM Port 8545)           │
            └───────────────────────────────────────────────┘
```

### Component Breakdown
1. **Frontend (React + Vite)**: A premium glassmorphic UI utilizing Tailwind CSS, Lucide icons, bilingual TTS (English/Hindi) summaries, and smart contract providers.
2. **Backend Engine (FastAPI)**: Handlers for file parsing, transaction log extraction, and machine learning scoring endpoints.
3. **Machine Learning Model (Scikit-Learn)**: A Random Forest Regression model trained on merchant payment records to output high-accuracy ratings from 300 to 900.
4. **Smart Contract Ledger (Solidity)**: EVM-compatible ledger contract (`TrustLedger.sol`) mapping merchant addresses to verified rating structs on-chain.

---

## 🔒 AgentFieldAI Security Integration

Incoming transactional ledgers often contain raw user inputs, such as payment descriptions or custom payer handles (`payer_upi`). Adversaries can craft malicious spreadsheet commands (e.g., `=cmd|' /C calc'!A0`) to execute arbitrary code on downstream corporate financial parsers (OWASP CSV Injection).

### Protection Protocol
* **Sandbox Shield**: The backend acts as a security gateway. Before data reaches the calculation engine, it is scanned.
* **Attestation Rules**: If character sequences starting with `=`, `@`, `+`, or `-` are found in text columns, the upload is quarantined.
* **Threat Intercept Panel**: The React frontend isolates the attack payload and displays a **Sandbox Threat Intercepted** dialog. The security event is cryptographically recorded on the blockchain for audit tracking, and calculation is immediately blocked.

---

## 📈 Credit Scoring & CIBIL Mapping Methodology

The model calculates a merchant rating mapping to credit-bureau ranges (300 to 900) based on five operational factors:

| Metric | Basis of Calculation | Risk Correlation | Weight |
| :--- | :--- | :--- | :--- |
| **Operational Volumne** | Aggregate transactional throughput (revenue) over the statement duration. | Higher volume correlates to higher repayment capacity. | 35% |
| **Consistency Score** | Ratio of active transaction days relative to statement lifespan. | Predictable daily cashflow limits loan default risk. | 25% |
| **Settlement Rate** | Ratio of completed transactions vs. failed/refunded transfers. | High failure rates indicate network outages or merchant dispute risks. | 15% |
| **Customer Diversity** | Number of unique payer UPI IDs. | Reduces collusion risk (artificial volume generated via self-payments). | 15% |
| **Momentum Metric** | Weekly growth/shrinkage trends in daily transaction sizes. | Positively trending volume maps to higher future loan thresholds. | 10% |

---

## ⛓️ Decentralized Ledger (Blockchain) Integration

### Why Blockchain?
1. **Auditable Ratings**: Once an underwriter computes a merchant's score, it is signed by the backend's key and submitted to the smart contract. This rating is permanently locked on-chain, preventing manual modification.
2. **DeFi Lending Bridge**: Third-party lending protocols (or institutional lenders) can query the smart contract directly using a merchant's address to view their rating, metadata, and offer thresholds.
3. **PII Data Privacy**: Lenders do not need to read the merchant's underlying transactional statements (protecting customer identity and trade secrets). They only query the verified attestation on-chain.

### Contract API (`TrustLedger.sol`)
* `mintScore(address merchant, uint256 score, string f1, string f2, string f3)`: Stores rating parameters on the ledger.
* `getLatestScore(address merchant)`: Returns the current credit score and dynamic metadata for the target merchant.

---

## 💻 Local Quickstart & Orchestration

The project contains a unified orchestrator stack script (`start.ps1`) designed to configure, compile, and run all microservices concurrently.

### Prerequisites
* [Node.js](https://nodejs.org) (v18+)
* [Python](https://python.org) (v3.10+)

### Spin Up Dev Stack
Run the following script in an elevated PowerShell terminal:
```powershell
./start.ps1
```

The script automatically executes the following:
1. Cleans up port allocations (`8545`, `8000`, `5173`).
2. Builds the React/Vite production frontend assets.
3. Spawns a local Hardhat RPC blockchain network on `http://127.0.0.1:8545`.
4. Compiles and deploys the Solidity smart contracts onto the local node.
5. Launches the FastAPI server in a hidden background console on `http://127.0.0.1:8000`.
6. Launches the static web server preview at `http://localhost:5173`.

---

## 🌐 Production Deployment

The TrustLedger frontend is deployed on **Netlify**, utilizing redirects for modern Single-Page Applications (SPA):

### Web Console Deployment
```bash
cd frontend
npm run build
npx netlify deploy --prod
```

The build is configured via the root-level [netlify.toml](file:///c:/Users/Vivan/Documents/PROJECTS/TrustLedger/netlify.toml) file:
```toml
[build]
  publish = "frontend/dist"
  command = "npm run build"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```
This forces all client routes to load `index.html` dynamically, allowing React Router to manage tabs on Netlify.
