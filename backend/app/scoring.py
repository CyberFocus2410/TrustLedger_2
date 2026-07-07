import io
import os
import pandas as pd
import numpy as np
import joblib

# Load trained Machine Learning models
MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
try:
    credit_score_model = joblib.load(os.path.join(MODELS_DIR, "credit_score_model.joblib"))
    credit_limit_model = joblib.load(os.path.join(MODELS_DIR, "credit_limit_model.joblib"))
    risk_model = joblib.load(os.path.join(MODELS_DIR, "risk_model.joblib"))
    feature_columns = joblib.load(os.path.join(MODELS_DIR, "feature_columns.joblib"))
    dataset_means = joblib.load(os.path.join(MODELS_DIR, "dataset_means.joblib"))
    has_models = True
except Exception as e:
    has_models = False

def calculate_credit_score_v2(csv_bytes: bytes) -> dict:
    """
    Parses a Paytm merchant CSV entirely in-memory using Pandas and executes
    Machine Learning inference (Random Forest) to output:
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
    df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
    df = df.dropna(subset=['Date'])
    
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
    total_volume = float(success_df['Amount'].sum())
    avg_txn_size = float(success_df['Amount'].mean()) if success_txns > 0 else 0.0
    std_txn_size = float(success_df['Amount'].std()) if success_txns > 1 else 0.0
    failure_rate = (failed_txns / total_txns) * 100 if total_txns > 0 else 0.0
    success_rate = (success_txns / total_txns) * 100 if total_txns > 0 else 0.0
    
    # Growth rate
    df_sorted = df.sort_values('Date')
    midpoint = len(df_sorted) // 2
    if midpoint > 0:
        first_half_vol = df_sorted.iloc[:midpoint][df_sorted.iloc[:midpoint]['Status'] == 'Success']['Amount'].sum()
        second_half_vol = df_sorted.iloc[midpoint:][df_sorted.iloc[midpoint:]['Status'] == 'Success']['Amount'].sum()
        growth_rate = (second_half_vol / first_half_vol) - 1.0 if first_half_vol > 0 else 0.0
    else:
        growth_rate = 0.0

    # Days span
    min_date = df['Date'].min()
    max_date = df['Date'].max()
    if pd.notna(min_date) and pd.notna(max_date):
        days_span = max(1, (max_date - min_date).days)
    else:
        days_span = 30
    txn_frequency = total_txns / days_span

    # Unique payers
    unique_payers = df['Payer_UPI'].nunique()
    unique_payers_ratio = unique_payers / total_txns if total_txns > 0 else 0.0

    # Peak hour ratio
    df['hour'] = df['Date'].dt.hour
    peak_hour_txns = len(df[(df['hour'] >= 23) | (df['hour'] <= 4)])
    peak_hour_ratio = peak_hour_txns / total_txns if total_txns > 0 else 0.0

    # Consistency
    daily_vol = success_df.groupby(success_df['Date'].dt.date)['Amount'].sum()
    consistency = float(daily_vol.std() / daily_vol.mean()) if len(daily_vol) > 1 and daily_vol.mean() > 0 else 1.0

    metrics = {
        "total_volume": round(total_volume, 2),
        "avg_txn_size": round(avg_txn_size, 2),
        "failure_rate": round(failure_rate, 2),
        "growth_rate_pct": round(growth_rate * 100, 2),
        "total_transactions": total_txns,
        "successful_transactions": success_txns
    }

    if has_models:
        # Prepare input features
        features = {
            "total_transactions": total_txns,
            "success_rate": success_rate,
            "total_volume": total_volume,
            "avg_txn_size": avg_txn_size,
            "std_txn_size": std_txn_size,
            "growth_rate": growth_rate,
            "txn_frequency_per_day": txn_frequency,
            "unique_payers_ratio": unique_payers_ratio,
            "peak_hour_ratio": peak_hour_ratio,
            "consistency_score": consistency
        }
        
        X_in = pd.DataFrame([features])[feature_columns]
        
        # ML Predictions
        final_score = int(np.clip(round(credit_score_model.predict(X_in)[0]), 300, 900))
        
        # Compute Pseudo-SHAP explanations
        contributions = {}
        
        diff_success = features["success_rate"] - dataset_means["success_rate"]
        contributions["Success Rate"] = {
            "val": diff_success * 2.0,
            "factor": "Stellar Transaction Success Rate" if diff_success >= 0 else "High Transaction Failure Rate / Declines"
        }
        
        diff_vol = np.log1p(features["total_volume"]) - np.log1p(dataset_means["total_volume"])
        contributions["Volume"] = {
            "val": diff_vol * 4.0,
            "factor": "High Transaction Volume" if diff_vol >= 0 else "Low Overall Transaction Volume"
        }
        
        diff_size = features["avg_txn_size"] - dataset_means["avg_txn_size"]
        contributions["Ticket Size"] = {
            "val": diff_size / 40.0,
            "factor": "Premium Average Ticket Size" if diff_size >= 0 else "Micro-transaction Volume Profile"
        }
        
        diff_growth = features["growth_rate"] - dataset_means["growth_rate"]
        contributions["Growth"] = {
            "val": diff_growth * 15.0,
            "factor": "Strong Month-on-Month Growth" if diff_growth >= 0 else "Declining Merchant Revenue Growth"
        }
        
        diff_payers = features["unique_payers_ratio"] - dataset_means["unique_payers_ratio"]
        contributions["Unique Payers"] = {
            "val": diff_payers * 25.0,
            "factor": "Diverse Customer Base" if diff_payers >= 0 else "Highly Clustered Customer Base (Self-Payment Risk)"
        }
        
        diff_peak = features["peak_hour_ratio"] - dataset_means["peak_hour_ratio"]
        contributions["Peak Hours"] = {
            "val": -diff_peak * 40.0,
            "factor": "Standard Business Hour Operations" if diff_peak <= 0 else "Unusual Midnight Transaction Velocity Spikes"
        }
        
        diff_const = dataset_means["consistency_score"] - features["consistency_score"]
        contributions["Consistency"] = {
            "val": diff_const * 10.0,
            "factor": "Highly Consistent Daily Volume" if diff_const >= 0 else "Irregular/Volatile Daily Sales Volume"
        }
        
        sorted_contribs = sorted(contributions.values(), key=lambda x: abs(x["val"]), reverse=True)
        top_3_factors = [c["factor"] for c in sorted_contribs[:3]]
    else:
        # Original rule-based scoring engine fallback
        base_score = 50
        score_adjustments = []
        
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
            
        score_adjustments.append({"factor": exp, "adjustment": vol_adj})
        
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
            
        score_adjustments.append({"factor": exp, "adjustment": fail_adj})
        
        if avg_txn_size >= 1000:
            size_adj = 20
            exp = "Premium Average Ticket Size"
        elif avg_txn_size >= 200:
            size_adj = 10
            exp = "Healthy Average Ticket Size"
        else:
            size_adj = -10
            exp = "Micro-transaction Volume Penalty"
            
        score_adjustments.append({"factor": exp, "adjustment": size_adj})
        
        if growth_rate >= 0.05:
            growth_adj = 15
            exp = "Skyrocketing Month-on-Month Growth" if growth_rate > 0.5 else "Stable Month-on-Month Growth"
        elif growth_rate <= -0.05:
            growth_adj = -15
            exp = "Declining Merchant Revenue Growth"
        else:
            growth_adj = 0
            exp = "Flat Growth Trend"
            
        score_adjustments.append({"factor": exp, "adjustment": growth_adj})
        
        if success_txns >= 300:
            const_adj = 20
            exp = "High Transaction Consistency"
        elif success_txns >= 100:
            const_adj = 10
            exp = "Standard Transaction Consistency"
        else:
            const_adj = -5
            exp = "Low Transaction Density"
            
        score_adjustments.append({"factor": exp, "adjustment": const_adj})
        
        total_adj = sum(item['adjustment'] for item in score_adjustments)
        final_score_0_100 = np.clip(base_score + total_adj, 0, 100)
        final_score = int(300 + final_score_0_100 * 6)
        
        sorted_adjustments = sorted(score_adjustments, key=lambda x: abs(x['adjustment']), reverse=True)
        top_3_factors = [item['factor'] for item in sorted_adjustments[:3]]

    # Ensure 3 factors
    while len(top_3_factors) < 3:
        top_3_factors.append("Stable Merchant Operations")
        
    return {
        "merchant_score": final_score,
        "top_factors": top_3_factors,
        "metrics": metrics
    }

if __name__ == '__main__':
    # Dry run check
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        file_path = os.path.join(current_dir, "../../mock_data/profile_excellent.csv")
        with open(file_path, 'rb') as f:
            data = f.read()
        res = calculate_credit_score_v2(data)
        print("ML-Based Excellent Merchant Score:", res['merchant_score'])
        print("Metrics:", res['metrics'])
        print("Factors:", res['top_factors'])
    except Exception as e:
        print("Scoring v2 check failed:", str(e))
