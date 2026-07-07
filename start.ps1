# TrustLedger Production Launcher & Lifecycle Monitor
# This script builds the production assets, starts the local blockchain network, deploys contracts,
# launches the FastAPI server and Vite preview server, and gracefully shuts down all processes on exit.

$ErrorActionPreference = "Stop"

Clear-Host
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         *** TRUSTLEDGER DEPLOYMENT CONTROL PANEL ***      " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Port Cleanup Helper
function Stop-ProcessOnPort($port) {
    Write-Host "Checking port $port..." -NoNewline
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connection) {
        $processId = $connection.OwningProcess[0]
        $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host " found process '$($proc.Name)' (PID $processId). Terminating..." -ForegroundColor Yellow
            Stop-Process -Id $processId -Force
            Start-Sleep -Seconds 1
        }
    } else {
        Write-Host " free." -ForegroundColor Green
    }
}

# 2. Port Check & Cleanup
Write-Host "[1/6] Cleaning up port allocations..." -ForegroundColor Blue
Stop-ProcessOnPort 8545
Stop-ProcessOnPort 8000
Stop-ProcessOnPort 5173
Write-Host "[OK] Ports clear." -ForegroundColor Green
Write-Host ""

# 3. Compile Production Frontend
Write-Host "[2/6] Building production web frontend bundle..." -ForegroundColor Blue
Set-Location "$PSScriptRoot/frontend"
npm run build
Set-Location $PSScriptRoot
Write-Host "[OK] Frontend build complete." -ForegroundColor Green
Write-Host ""

# 4. Start Hardhat blockchain node
Write-Host "[3/6] Starting local Hardhat blockchain network..." -ForegroundColor Blue
$blockchainLog = "$PSScriptRoot/blockchain.log"
$hardhatJob = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npx", "hardhat", "node", "--hostname", "0.0.0.0" `
    -WorkingDirectory "$PSScriptRoot/blockchain" `
    -NoNewWindow -PassThru `
    -RedirectStandardOutput $blockchainLog `
    -RedirectStandardError "$PSScriptRoot/blockchain_error.log"

Write-Host "[OK] Blockchain node spawned (PID: $($hardhatJob.Id)). Logging to: blockchain.log" -ForegroundColor Green
Write-Host "Waiting for blockchain RPC node initialization (8s)..." -ForegroundColor Gray
Start-Sleep -Seconds 8
Write-Host ""

# 5. Deploy TrustLedger Smart Contract
Write-Host "[4/6] Deploying smart contract ledger on local network..." -ForegroundColor Blue
Set-Location "$PSScriptRoot/blockchain"
npx hardhat run scripts/deploy.js --network localhost
Set-Location $PSScriptRoot
Write-Host "[OK] Contract deployed successfully and metadata exported to servers." -ForegroundColor Green
Write-Host ""

# 6. Start FastAPI Python Backend Server
Write-Host "[5/6] Starting credit rating API engine..." -ForegroundColor Blue
$backendJob = Start-Process -FilePath "$PSScriptRoot/backend/.venv/Scripts/python.exe" `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000" `
    -WorkingDirectory "$PSScriptRoot/backend" `
    -WindowStyle Hidden -PassThru

Write-Host "[OK] Backend uvicorn server spawned in hidden window (PID: $($backendJob.Id))." -ForegroundColor Green
Start-Sleep -Seconds 2
Write-Host ""

# 7. Start React Frontend Preview Server
Write-Host "[6/6] Launching static web server..." -ForegroundColor Blue
$frontendLog = "$PSScriptRoot/frontend.log"
$frontendJob = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npx", "vite", "preview", "--port", "5173", "--host" `
    -WorkingDirectory "$PSScriptRoot/frontend" `
    -NoNewWindow -PassThru `
    -RedirectStandardOutput $frontendLog `
    -RedirectStandardError "$PSScriptRoot/frontend_error.log"

Write-Host "[OK] Frontend web preview server spawned (PID: $($frontendJob.Id)). Logging to: frontend.log" -ForegroundColor Green
Write-Host ""

# 8. Open Web Browser
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "[SUCCESS] Deployment Successful! Launching client console..." -ForegroundColor Green
Write-Host "URL: http://localhost:5173/" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""

Start-Process "http://localhost:5173/"

Write-Host "Press ENTER to terminate all services and exit..." -ForegroundColor Yellow
Read-Host

Write-Host ""
Write-Host "Stopping all child processes..." -ForegroundColor Blue

# Cleanup processes
function Safe-Kill($job) {
    if ($job) {
        $proc = Get-Process -Id $job.Id -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "Stopping PID $($job.Id)..."
            Stop-Process -Id $job.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

Safe-Kill $frontendJob
Safe-Kill $backendJob
Safe-Kill $hardhatJob

Write-Host "[OK] Clean teardown successful. Have a nice day!" -ForegroundColor Green
