import os
import json
from web3 import Web3
from dotenv import load_dotenv

# Load env variables
load_dotenv()

# Configuration
# Default to Hardhat local node
RPC_URL = os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545")
# Standard Hardhat Account #0 private key for local development
DEFAULT_PRIV_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
ISSUER_PRIVATE_KEY = os.getenv("ISSUER_PRIVATE_KEY", DEFAULT_PRIV_KEY)

# Connect to Web3
w3 = Web3(Web3.HTTPProvider(RPC_URL))

# Global placeholder for contract info
contract_cache = None

def get_contract_info():
    global contract_cache
    if contract_cache is not None:
        return contract_cache

    current_dir = os.path.dirname(os.path.abspath(__file__))
    info_path = os.path.join(current_dir, "contract_info.json")
    
    if not os.path.exists(info_path):
        # Return none or empty, backend will handle gracefully if contract isn't deployed yet
        return None
        
    with open(info_path, "r") as f:
        contract_cache = json.load(f)
    return contract_cache

def get_contract_instance():
    info = get_contract_info()
    if not info:
        raise ValueError("Contract info not found. Has the smart contract been deployed?")
        
    contract_address = info["address"]
    abi = info["abi"]
    
    # Check web3 connection
    if not w3.is_connected():
        raise ConnectionError(f"Failed to connect to blockchain RPC at {RPC_URL}")
        
    return w3.eth.contract(address=contract_address, abi=abi)

def mint_merchant_score(merchant_address: str, score: int, f1: str, f2: str, f3: str) -> str:
    """
    Calls the TrustLedger smart contract to mint a credit score for the merchant address.
    Uses the backend's issuer private key to sign and submit the transaction.
    Returns the transaction hash.
    """
    contract = get_contract_instance()
    
    # Resolve checksum addresses
    merchant_checksum = Web3.to_checksum_address(merchant_address)
    
    # Retrieve issuer address from private key
    account = w3.eth.account.from_key(ISSUER_PRIVATE_KEY)
    issuer_address = account.address
    
    # Pass score strictly bounded 0-100 directly
    scaled_score = int(score)

    print(f"Minting score {scaled_score} for merchant {merchant_checksum} using issuer {issuer_address}")
    
    # Build transaction
    nonce = w3.eth.get_transaction_count(issuer_address)
    
    # Get gas estimates
    try:
        gas_estimate = contract.functions.mintScore(
            merchant_checksum,
            scaled_score,
            f1,
            f2,
            f3
        ).estimate_gas({'from': issuer_address})
    except Exception as e:
        print(f"Gas estimation failed, using fallback: {str(e)}")
        gas_estimate = 200000  # Conservative fallback
        
    chain_id = w3.eth.chain_id
    
    tx = contract.functions.mintScore(
        merchant_checksum,
        scaled_score,
        f1,
        f2,
        f3
    ).build_transaction({
        'chainId': chain_id,
        'gas': int(gas_estimate * 1.2),  # add buffer
        'gasPrice': w3.eth.gas_price,
        'nonce': nonce,
    })
    
    # Sign transaction
    signed_tx = w3.eth.account.sign_transaction(tx, private_key=ISSUER_PRIVATE_KEY)
    
    # Send transaction
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    
    # Return transaction hash hex
    return w3.to_hex(tx_hash)

def lookup_merchant_score(merchant_address: str) -> dict:
    """
    Queries the TrustLedger smart contract (read-only view) for a merchant's score record.
    """
    contract = get_contract_instance()
    merchant_checksum = Web3.to_checksum_address(merchant_address)
    
    try:
        result = contract.functions.getScore(merchant_checksum).call()
        score, timestamp, f1, f2, f3, exists = result
        
        # Retain score strictly bounded 0-100 directly
        descaled_score = score

        return {
            "score": descaled_score,
            "timestamp": timestamp,
            "factor1": f1,
            "factor2": f2,
            "factor3": f3,
            "exists": exists
        }
    except Exception as e:
        print(f"Error querying contract for merchant {merchant_address}: {str(e)}")
        return {
            "exists": False,
            "error": str(e)
        }

def submit_loan_offer(merchant_address: str, amount: float, interest_rate: float, tenure: int, monthly_emi: float) -> str:
    """
    Submits a loan offer to the TrustLedger smart contract on behalf of a lender (using the backend issuer key).
    Returns the transaction hash.
    """
    contract = get_contract_instance()
    merchant_checksum = Web3.to_checksum_address(merchant_address)
    
    account = w3.eth.account.from_key(ISSUER_PRIVATE_KEY)
    issuer_address = account.address
    
    nonce = w3.eth.get_transaction_count(issuer_address)
    chain_id = w3.eth.chain_id
    
    # Scale interest rate to 2 decimals, e.g. 12.5% -> 1250
    scaled_rate = int(interest_rate * 100)
    
    try:
        gas_estimate = contract.functions.submitLoanOffer(
            merchant_checksum,
            int(amount),
            scaled_rate,
            int(tenure),
            int(monthly_emi)
        ).estimate_gas({'from': issuer_address})
    except Exception as e:
        print(f"Gas estimation failed for submitLoanOffer, using fallback: {str(e)}")
        gas_estimate = 300000
        
    tx = contract.functions.submitLoanOffer(
        merchant_checksum,
        int(amount),
        scaled_rate,
        int(tenure),
        int(monthly_emi)
    ).build_transaction({
        'chainId': chain_id,
        'gas': int(gas_estimate * 1.2),
        'gasPrice': w3.eth.gas_price,
        'nonce': nonce,
    })
    
    signed_tx = w3.eth.account.sign_transaction(tx, private_key=ISSUER_PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    return w3.to_hex(tx_hash)

def update_loan_offer_status(offer_id: int, new_status: str) -> str:
    """
    Updates the status of a loan offer on-chain.
    Signs using the backend key (which is authorized as an issuer).
    Returns the transaction hash.
    """
    contract = get_contract_instance()
    account = w3.eth.account.from_key(ISSUER_PRIVATE_KEY)
    issuer_address = account.address
    
    nonce = w3.eth.get_transaction_count(issuer_address)
    chain_id = w3.eth.chain_id
    
    try:
        gas_estimate = contract.functions.updateOfferStatus(
            int(offer_id),
            new_status
        ).estimate_gas({'from': issuer_address})
    except Exception as e:
        print(f"Gas estimation failed for updateOfferStatus, using fallback: {str(e)}")
        gas_estimate = 150000
        
    tx = contract.functions.updateOfferStatus(
        int(offer_id),
        new_status
    ).build_transaction({
        'chainId': chain_id,
        'gas': int(gas_estimate * 1.2),
        'gasPrice': w3.eth.gas_price,
        'nonce': nonce,
    })
    
    signed_tx = w3.eth.account.sign_transaction(tx, private_key=ISSUER_PRIVATE_KEY)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    return w3.to_hex(tx_hash)

def get_merchant_offers(merchant_address: str) -> list:
    """
    Queries the TrustLedger smart contract to list all loan offers for a merchant.
    """
    contract = get_contract_instance()
    merchant_checksum = Web3.to_checksum_address(merchant_address)
    
    try:
        offer_ids = contract.functions.getMerchantOfferIds(merchant_checksum).call()
        offers = []
        for o_id in offer_ids:
            res = contract.functions.getLoanOffer(o_id).call()
            # struct fields: id, lender, merchant, amount, interestRate, tenure, monthlyEMI, status, timestamp
            offers.append({
                "id": res[0],
                "lender": res[1],
                "merchant": res[2],
                "amount": res[3],
                "interest_rate": float(res[4]) / 100.0,
                "tenure": res[5],
                "monthly_emi": res[6],
                "status": res[7],
                "timestamp": res[8]
            })
        return offers
    except Exception as e:
        print(f"Error reading loan offers from chain: {str(e)}")
        return []
