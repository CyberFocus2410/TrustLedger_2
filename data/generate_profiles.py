import os
import csv
import random
from datetime import datetime, timedelta

def generate_merchant_csv(filename, profile_type, num_records=300):
    """
    Generates a synthetic Paytm transaction CSV profile.
    
    Profiles:
    - 'poor': low volume, high failures (~30%), long settlement delays, declining trend.
    - 'good': medium volume, moderate failures (~5%), average settlement delays, stable trend.
    - 'excellent': high volume, very low failures (<1%), fast settlements, growing trend.
    """
    
    # Baseline configuration
    end_date = datetime(2026, 6, 25, 18, 0, 0)
    start_date = end_date - timedelta(days=30)
    
    # Payment modes distribution
    payment_modes = ['UPI', 'Wallet', 'Net Banking', 'Credit Card', 'Debit Card']
    payment_weights = [0.60, 0.20, 0.05, 0.10, 0.05]
    
    records = []
    
    for i in range(num_records):
        # Determine time of transaction
        # For trend logic:
        # 'poor': more transactions in the first half of the month, dropping off in the second.
        # 'excellent': more transactions in the second half of the month (growth).
        # 'good': evenly distributed.
        progress = i / num_records
        if profile_type == 'poor':
            # Distribution weighted to early dates
            rand_factor = random.betavariate(1, 3)
        elif profile_type == 'excellent':
            # Distribution weighted to late dates
            rand_factor = random.betavariate(3, 1)
        else:
            # Flat distribution
            rand_factor = random.random()
            
        seconds_diff = int((end_date - start_date).total_seconds() * rand_factor)
        txn_time = start_date + timedelta(seconds=seconds_diff)
        
        # Unique Txn ID
        txn_id = f"TXN{profile_type[0].upper()}{100000 + i}"
        
        # Amount, Status, Settlement logic
        if profile_type == 'poor':
            amount = round(random.uniform(20.0, 400.0), 2)
            # 30% failure rate
            status = 'FAILURE' if random.random() < 0.30 else 'SUCCESS'
            
            if status == 'SUCCESS':
                settlement_status = 'Unsettled' if random.random() < 0.15 else 'Settled'
                # Average delay of ~36 hours (2160 mins)
                settlement_delay = int(random.normalvariate(2160, 600))
                settlement_delay = max(30, settlement_delay)
            else:
                settlement_status = 'N/A'
                settlement_delay = 0
                
        elif profile_type == 'good':
            amount = round(random.uniform(100.0, 1500.0), 2)
            # 5% failure rate
            status = 'FAILURE' if random.random() < 0.05 else 'SUCCESS'
            
            if status == 'SUCCESS':
                settlement_status = 'Unsettled' if random.random() < 0.02 else 'Settled'
                # Average delay of ~120 mins (2 hours)
                settlement_delay = int(random.normalvariate(120, 45))
                settlement_delay = max(10, settlement_delay)
            else:
                settlement_status = 'N/A'
                settlement_delay = 0
                
        else:  # excellent
            amount = round(random.uniform(500.0, 5000.0), 2)
            # 0.8% failure rate
            status = 'FAILURE' if random.random() < 0.008 else 'SUCCESS'
            
            if status == 'SUCCESS':
                settlement_status = 'Settled'  # 100% settled
                # Average delay of ~10 mins
                settlement_delay = int(random.normalvariate(10, 4))
                settlement_delay = max(1, settlement_delay)
            else:
                settlement_status = 'N/A'
                settlement_delay = 0
                
        payment_mode = random.choices(payment_modes, weights=payment_weights)[0]
        
        records.append({
            'transaction_id': txn_id,
            'timestamp': txn_time.strftime('%Y-%m-%d %H:%M:%S'),
            'amount': amount,
            'status': status,
            'payment_mode': payment_mode,
            'settlement_status': settlement_status,
            'settlement_delay_mins': settlement_delay
        })
        
    # Sort chronologically
    records.sort(key=lambda x: x['timestamp'])
    
    # Save to CSV
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, mode='w', newline='', encoding='utf-8') as f:
        fieldnames = ['transaction_id', 'timestamp', 'amount', 'status', 'payment_mode', 'settlement_status', 'settlement_delay_mins']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for rec in records:
            writer.writerow(rec)
            
    print(f"Generated {filename} successfully with {num_records} records.")

if __name__ == '__main__':
    generate_merchant_csv('data/poor_merchant.csv', 'poor', num_records=150)
    generate_merchant_csv('data/good_merchant.csv', 'good', num_records=300)
    generate_merchant_csv('data/excellent_merchant.csv', 'excellent', num_records=500)
