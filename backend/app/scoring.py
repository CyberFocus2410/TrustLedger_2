import io
import pandas as pd
import numpy as np

def calculate_credit_score_v2(csv_bytes: bytes) -> dict:
    """
    Parses a Paytm merchant CSV entirely in-memory using Pandas.
    CSV layout: [Date, Transaction_ID, Payer_UPI, Amount, Status, Payment_Mode]
    Status: 'Success' or 'Failed'
    
    Returns:
    - merchant_score (300-900)
    - top_factors (list of 3 key strings mimicking SHAP values)
    - metrics (dict of computed properties)
    """
    try:
        csv_str = csv_bytes.decode('utf-8')
        df = pd.read_csv(io.StringIO(csv_str))
    except Exception as e:
        raise ValueError(f"Error parsing CSV: {str(e)}")
        
    required_cols = {'Date', 'Transaction_ID', 'Payer_UPI', 'Amount', 'Status', 'Payment_Mode'}
    missing_cols = required_cols - set(df.columns)
    if missing_cols:
        raise ValueError(f"CSV is missing required columns: {', '.join(missing_cols)}")
        
    # Standardize types
    df['Amount'] = pd.to_numeric(df['Amount'], errors='coerce').fillna(0.0)
    df['Status'] = df['Status'].astype(str).str.strip().str.capitalize()
    df.loc[df['Status'] == 'Failure', 'Status'] = 'Failed'
    df['Payment_Mode'] = df['Payment_Mode'].astype(str).str.upper()
    
    total_txns = len(df)
    if total_txns == 0:
        return {
            "merchant_score": 0,
            "top_factors": ["No transaction records found", "Insufficient data", "Micro-merchant history"],
            "metrics": {}
        }
        
    success_df = df[df['Status'] == 'Success']
    failed_df = df[df['Status'] == 'Failed']
    
    success_txns = len(success_df)
    failed_txns = len(failed_df)
    
    # Calculate key metrics
    # 1. Total transaction volume
    total_volume = float(success_df['Amount'].sum())
    
    # 2. Average transaction size
    avg_txn_size = float(success_df['Amount'].mean()) if success_txns > 0 else 0.0
    
    # 3. Failure rate
    failure_rate = (failed_txns / total_txns) * 100 if total_txns > 0 else 0.0
    
    # 4. Growth rate (splitting chronologically)
    df_sorted = df.sort_values('Date')
    midpoint = len(df_sorted) // 2
    if midpoint > 0:
        first_half_vol = df_sorted.iloc[:midpoint][df_sorted.iloc[:midpoint]['Status'] == 'Success']['Amount'].sum()
        second_half_vol = df_sorted.iloc[midpoint:][df_sorted.iloc[midpoint:]['Status'] == 'Success']['Amount'].sum()
        growth_rate = (second_half_vol / first_half_vol) - 1.0 if first_half_vol > 0 else 0.0
    else:
        growth_rate = 0.0
        
    # --- Scoring Engine (0-100 Scale) ---
    base_score = 50
    score_adjustments = []
    
    # 1. Volume contribution
    if total_volume >= 1000000:
        vol_adj = 20
        exp = "High Transaction Volume"
    elif total_volume >= 500000:
        vol_adj = 15
        exp = "Consistent Transaction Volume"
    elif total_volume >= 100000:
        vol_adj = 10
        exp = "Moderate Transaction Volume"
    else:
        vol_adj = 2
        exp = "Emerging Transaction Volume"
        
    score_adjustments.append({
        "factor": exp,
        "adjustment": vol_adj
    })
    
    # 2. Failure rate contribution
    if failure_rate <= 1.0:
        fail_adj = 25
        exp = "Low Failure Rate"
    elif failure_rate <= 3.0:
        fail_adj = 15
        exp = "Acceptable Failure Rate"
    elif failure_rate <= 10.0:
        fail_adj = 5
        exp = "Moderate Failure Rate"
    else:
        fail_adj = -20
        exp = "High Failure Rate"
        
    score_adjustments.append({
        "factor": exp,
        "adjustment": fail_adj
    })
    
    # 3. Average ticket size contribution
    if avg_txn_size >= 1000:
        size_adj = 20
        exp = "Premium Average Ticket Size"
    elif avg_txn_size >= 200:
        size_adj = 10
        exp = "Healthy Average Ticket Size"
    else:
        size_adj = -10
        exp = "Micro-transaction Volume Penalty"
        
    score_adjustments.append({
        "factor": exp,
        "adjustment": size_adj
    })
    
    # 4. Growth rate contribution
    if growth_rate >= 0.05:
        growth_adj = 15
        exp = "Skyrocketing Month-on-Month Growth" if growth_rate > 0.5 else "Stable Month-on-Month Growth"
    elif growth_rate <= -0.05:
        growth_adj = -15
        exp = "Declining Merchant Revenue Growth"
    else:
        growth_adj = 0
        exp = "Flat Growth Trend"
        
    score_adjustments.append({
        "factor": exp,
        "adjustment": growth_adj
    })
    
    # 5. Consistency contribution (Successful transactions count)
    if success_txns >= 300:
        const_adj = 20
        exp = "High Transaction Consistency"
    elif success_txns >= 100:
        const_adj = 10
        exp = "Standard Transaction Consistency"
    else:
        const_adj = -5
        exp = "Low Transaction Density"
        
    score_adjustments.append({
        "factor": exp,
        "adjustment": const_adj
    })
    
    # Calculate final score
    total_adj = sum(item['adjustment'] for item in score_adjustments)
    final_score_0_100 = base_score + total_adj
    final_score_0_100 = np.clip(final_score_0_100, 0, 100)
    final_score = int(300 + final_score_0_100 * 6)
    
    # Select top 3 factors based on absolute adjustment value
    sorted_adjustments = sorted(score_adjustments, key=lambda x: abs(x['adjustment']), reverse=True)
    top_3_factors = [item['factor'] for item in sorted_adjustments[:3]]
    
    # Fallback to make sure we always have 3 distinct factors
    while len(top_3_factors) < 3:
        top_3_factors.append("Stable Merchant Operations")
        
    metrics = {
        "total_volume": round(total_volume, 2),
        "avg_txn_size": round(avg_txn_size, 2),
        "failure_rate": round(failure_rate, 2),
        "growth_rate_pct": round(growth_rate * 100, 2),
        "total_transactions": total_txns,
        "successful_transactions": success_txns
    }
    
    return {
        "merchant_score": final_score,
        "top_factors": top_3_factors,
        "metrics": metrics
    }

if __name__ == '__main__':
    # Dry run check
    try:
        with open('mock_data/profile_excellent.csv', 'rb') as f:
            data = f.read()
        res = calculate_credit_score_v2(data)
        print("Excellent Merchant Score:", res['merchant_score'])
        print("Metrics:", res['metrics'])
        print("Factors:", res['top_factors'])
    except Exception as e:
        print("Scoring v2 check failed:", str(e))
