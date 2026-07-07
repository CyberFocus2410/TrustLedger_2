import os
import io
import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score

# Ensure backend/app/models directory exists
MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

def extract_features(df: pd.DataFrame) -> dict:
    """
    Extracts high-fidelity transaction features from a pandas DataFrame of transactions.
    Ensures each entry from the record is analyzed.
    """
    # Clean column names
    df.columns = df.columns.str.replace('"', '', regex=False).str.replace("'", '', regex=False).str.strip().str.lower()
    
    # Clean and convert amount to float
    if 'amount' in df.columns:
        if df['amount'].dtype == object:
            df['amount'] = df['amount'].astype(str).str.replace('₹', '', regex=False).str.replace(',', '', regex=False).str.strip()
        df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(0.0)
    else:
        df['amount'] = 0.0

    # Ensure status is cleaned
    if 'status' in df.columns:
        df['status'] = df['status'].astype(str).str.strip().str.capitalize()
    else:
        df['status'] = 'Success'

    # Clean date
    if 'date' in df.columns:
        df['date'] = pd.to_datetime(df['date'], errors='coerce')
        df = df.dropna(subset=['date'])
    
    total_txns = len(df)
    if total_txns == 0:
        return {}
        
    success_df = df[df['status'] == 'Success']
    success_txns = len(success_df)
    failed_txns = total_txns - success_txns
    
    success_amount = success_df['amount']
    total_volume = float(success_amount.sum())
    avg_txn_size = float(success_amount.mean()) if success_txns > 0 else 0.0
    std_txn_size = float(success_amount.std()) if success_txns > 1 else 0.0
    
    failure_rate = (failed_txns / total_txns) * 100 if total_txns > 0 else 0.0
    success_rate = (success_txns / total_txns) * 100 if total_txns > 0 else 0.0
    
    # Growth rate (split chronologically into two halves)
    df_sorted = df.sort_values('date')
    midpoint = len(df_sorted) // 2
    if midpoint > 0:
        first_half_success = df_sorted.iloc[:midpoint][df_sorted.iloc[:midpoint]['status'] == 'Success']
        second_half_success = df_sorted.iloc[midpoint:][df_sorted.iloc[midpoint:]['status'] == 'Success']
        first_half_vol = float(first_half_success['amount'].sum())
        second_half_vol = float(second_half_success['amount'].sum())
        growth_rate = (second_half_vol / first_half_vol) - 1.0 if first_half_vol > 0 else 0.0
    else:
        growth_rate = 0.0
        
    # Days span
    min_date = df['date'].min()
    max_date = df['date'].max()
    if pd.notna(min_date) and pd.notna(max_date):
        days_span = max(1, (max_date - min_date).days)
    else:
        days_span = 30
    txn_frequency = total_txns / days_span
    
    # Unique payers ratio
    unique_payers = df['payer_upi'].nunique() if 'payer_upi' in df.columns else 1
    unique_payers_ratio = unique_payers / total_txns if total_txns > 0 else 0.0
    
    # Peak hour ratio (transactions between 11 PM and 4 AM)
    df['hour'] = df['date'].dt.hour
    peak_hour_txns = len(df[(df['hour'] >= 23) | (df['hour'] <= 4)])
    peak_hour_ratio = peak_hour_txns / total_txns if total_txns > 0 else 0.0
    
    # Consistency of daily transactions
    daily_vol = success_df.groupby(success_df['date'].dt.date)['amount'].sum()
    if len(daily_vol) > 1:
        consistency = float(daily_vol.std() / daily_vol.mean()) if daily_vol.mean() > 0 else 1.0
    else:
        consistency = 1.0
        
    return {
        "total_transactions": total_txns,
        "success_transactions": success_txns,
        "failed_transactions": failed_txns,
        "success_rate": success_rate,
        "failure_rate": failure_rate,
        "total_volume": total_volume,
        "avg_txn_size": avg_txn_size,
        "std_txn_size": std_txn_size,
        "growth_rate": growth_rate,
        "txn_frequency_per_day": txn_frequency,
        "unique_payers_ratio": unique_payers_ratio,
        "peak_hour_ratio": peak_hour_ratio,
        "consistency_score": consistency,
        "days_span": days_span
    }

def generate_synthetic_profile(profile_type: str) -> pd.DataFrame:
    """
    Generates a realistic transaction ledger for a merchant profile type.
    """
    num_records = random.randint(50, 600)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=random.randint(15, 60))
    
    records = []
    
    for i in range(num_records):
        # Temporal clustering / distribution
        if profile_type == 'poor':
            # declining transaction rate
            rand_factor = random.betavariate(1, 2.2)
        elif profile_type == 'excellent':
            # strong growth rate
            rand_factor = random.betavariate(2.2, 1)
        elif profile_type == 'fraud':
            # clustered abnormal patterns
            rand_factor = random.betavariate(1, 1)
        else: # good
            rand_factor = random.random()
            
        seconds_diff = int((end_date - start_date).total_seconds() * rand_factor)
        txn_time = start_date + timedelta(seconds=seconds_diff)
        
        # In fraud profile, cluster some transactions late at night
        if profile_type == 'fraud' and random.random() < 0.40:
            # Force hours between 23 and 4
            hour = random.choice([23, 0, 1, 2, 3, 4])
            txn_time = txn_time.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))
            
        txn_id = f"TXN{random.randint(100000, 999999)}"
        
        # Payer UPI
        if profile_type == 'fraud':
            # Low amount of unique buyers (fake self-transactions)
            payer_upi = f"payer{random.randint(1, 5)}@okaxis"
        else:
            payer_upi = f"payer{random.randint(10, 500)}@okaxis"
            
        # Amount, status
        if profile_type == 'poor':
            amount = round(random.uniform(5.0, 80.0), 2)
            status = 'Failed' if random.random() < 0.20 else 'Success'
        elif profile_type == 'fraud':
            # weird ticket sizes (e.g. constant large amounts)
            amount = round(random.choice([5000.0, 10000.0, 20000.0]), 2)
            status = 'Failed' if random.random() < 0.12 else 'Success'
        elif profile_type == 'good':
            amount = round(random.uniform(100.0, 600.0), 2)
            status = 'Failed' if random.random() < 0.02 else 'Success'
        else:  # excellent
            amount = round(random.uniform(500.0, 4000.0), 2)
            status = 'Failed' if random.random() < 0.005 else 'Success'
            
        records.append({
            'Date': txn_time.strftime('%Y-%m-%d %H:%M:%S'),
            'Transaction_ID': txn_id,
            'Payer_UPI': payer_upi,
            'Amount': amount,
            'Status': status,
            'Payment_Mode': 'UPI'
        })
        
    df = pd.DataFrame(records)
    return df

def calculate_targets(features: dict, profile_type: str) -> tuple:
    """
    Uses smooth, mathematical, continuous formulation of credit risk factors
    to derive target credit scores, credit limits, and fraud risk scores.
    """
    total_volume = features["total_volume"]
    success_rate = features["success_rate"]
    avg_txn_size = features["avg_txn_size"]
    growth_rate = features["growth_rate"]
    unique_payers_ratio = features["unique_payers_ratio"]
    peak_hour_ratio = features["peak_hour_ratio"]
    consistency = features["consistency_score"] # (std/mean, lower is better)
    
    # 1. Base Score calculation (linear combination of raw signals)
    # We map to 0-100 base, then project to 300-900 range.
    score_pct = 50.0
    
    # Success rate impact: 80% is baseline. Max +25 points, Min -30 points.
    score_pct += np.clip((success_rate - 90.0) * 2.0, -35.0, 25.0)
    
    # Volume impact (logarithmic scaling of total volume up to 2 million)
    log_volume = np.log1p(total_volume)
    score_pct += np.clip((log_volume - 10.0) * 4.0, -15.0, 20.0)
    
    # Average ticket size impact
    score_pct += np.clip((avg_txn_size - 300.0) / 40.0, -15.0, 15.0)
    
    # Growth rate impact
    score_pct += np.clip(growth_rate * 15.0, -20.0, 15.0)
    
    # Unique payers ratio impact (low unique payers indicate fraud/collusion risk)
    score_pct += np.clip((unique_payers_ratio - 0.4) * 25.0, -30.0, 10.0)
    
    # Peak hour ratio impact (night transaction spikes are high risk)
    score_pct += np.clip((0.10 - peak_hour_ratio) * 40.0, -25.0, 5.0)
    
    # Consistency impact (coefficient of variation, lower is better)
    score_pct += np.clip((1.2 - consistency) * 10.0, -10.0, 10.0)
    
    # Final clipping and mapping
    score_pct = np.clip(score_pct, 0.0, 100.0)
    credit_score = int(300 + score_pct * 6.0)
    
    # Add random noise (+/- 10 points) to simulate statistical noise
    credit_score += int(np.random.normal(0, 5))
    credit_score = np.clip(credit_score, 300, 900)
    
    # 2. Target Credit Limit (INR)
    # Determined by monthly volume (scaled by score)
    days = features["days_span"]
    monthly_vol = (total_volume / days) * 30.0
    
    score_multiplier = (credit_score - 300) / 600.0 # 0.0 to 1.0
    credit_limit = int(monthly_vol * 0.35 * (0.2 + 0.8 * score_multiplier))
    
    # Apply baseline limits
    if credit_score >= 750:
        credit_limit = max(80000, min(1000000, credit_limit))
    elif credit_score >= 600:
        credit_limit = max(40000, min(300000, credit_limit))
    else:
        credit_limit = max(10000, min(50000, credit_limit))
        
    credit_limit = int(np.round(credit_limit / 5000.0) * 5000) # Round to nearest 5K
    
    # 3. Target Risk Score (0.0 to 1.0, higher is cleaner)
    risk_score = 0.5
    risk_score += (success_rate - 90.0) / 40.0
    risk_score += (unique_payers_ratio - 0.3) / 2.0
    risk_score -= peak_hour_ratio
    risk_score = np.clip(risk_score, 0.0, 1.0)
    
    # Add a bit of noise
    risk_score = float(np.clip(risk_score + np.random.normal(0, 0.02), 0.0, 1.0))
    
    return credit_score, credit_limit, risk_score

def train_model_pipeline():
    print("Initializing synthetic dataset generation...")
    profiles = ['poor', 'good', 'excellent', 'fraud']
    dataset = []
    
    # Generate 1500 profiles
    for i in range(1500):
        ptype = random.choices(profiles, weights=[0.25, 0.40, 0.25, 0.10])[0]
        df = generate_synthetic_profile(ptype)
        features = extract_features(df)
        if features:
            score, limit, risk = calculate_targets(features, ptype)
            features['target_score'] = score
            features['target_limit'] = limit
            features['target_risk'] = risk
            features['profile_type'] = ptype
            dataset.append(features)
            
    df_data = pd.DataFrame(dataset)
    print(f"Dataset generated. Total records: {len(df_data)}")
    
    # Define features
    feature_cols = [
        "total_transactions", "success_rate", "total_volume", 
        "avg_txn_size", "std_txn_size", "growth_rate", 
        "txn_frequency_per_day", "unique_payers_ratio", 
        "peak_hour_ratio", "consistency_score"
    ]
    
    X = df_data[feature_cols].fillna(0.0)
    y_score = df_data['target_score']
    y_limit = df_data['target_limit']
    y_risk = df_data['target_risk']
    
    print("\n--- Training Model for Credit Score ---")
    X_train, X_test, y_train, y_test = train_test_split(X, y_score, test_size=0.2, random_state=42)
    score_rf = RandomForestRegressor(n_estimators=150, max_depth=12, min_samples_leaf=2, random_state=42)
    score_rf.fit(X_train, y_train)
    score_preds = score_rf.predict(X_test)
    print(f"Credit Score Model - R2: {r2_score(y_test, score_preds):.4f}, MAE: {mean_absolute_error(y_test, score_preds):.2f}")
    
    print("\n--- Training Model for Credit Limit ---")
    X_train_lim, X_test_lim, y_train_lim, y_test_lim = train_test_split(X, y_limit, test_size=0.2, random_state=42)
    limit_rf = RandomForestRegressor(n_estimators=150, max_depth=12, min_samples_leaf=2, random_state=42)
    limit_rf.fit(X_train_lim, y_train_lim)
    limit_preds = limit_rf.predict(X_test_lim)
    print(f"Credit Limit Model - R2: {r2_score(y_test_lim, limit_preds):.4f}, MAE: {mean_absolute_error(y_test_lim, limit_preds):.2f}")
    
    print("\n--- Training Model for Risk/Fraud Attestation ---")
    X_train_risk, X_test_risk, y_train_risk, y_test_risk = train_test_split(X, y_risk, test_size=0.2, random_state=42)
    risk_rf = RandomForestRegressor(n_estimators=150, max_depth=10, min_samples_leaf=2, random_state=42)
    risk_rf.fit(X_train_risk, y_train_risk)
    risk_preds = risk_rf.predict(X_test_risk)
    print(f"Risk/Fraud Model - R2: {r2_score(y_test_risk, risk_preds):.4f}, MAE: {mean_absolute_error(y_test_risk, risk_preds):.4f}")
    
    # Save the models
    joblib.dump(score_rf, os.path.join(MODELS_DIR, "credit_score_model.joblib"))
    joblib.dump(limit_rf, os.path.join(MODELS_DIR, "credit_limit_model.joblib"))
    joblib.dump(risk_rf, os.path.join(MODELS_DIR, "risk_model.joblib"))
    
    # Save feature names list to make sure we run inference on the exact same columns
    joblib.dump(feature_cols, os.path.join(MODELS_DIR, "feature_columns.joblib"))
    
    # Also save overall dataset statistics to compute SHAP-like contributions relative to mean
    dataset_means = X.mean().to_dict()
    joblib.dump(dataset_means, os.path.join(MODELS_DIR, "dataset_means.joblib"))
    
    print("\nAll models trained and saved to backend/app/models/ directory successfully.")

if __name__ == '__main__':
    train_model_pipeline()
