import os
import csv
import random
from datetime import datetime, timedelta

def generate_mock_csv(filename, profile_type, num_records=300):
    """
    Generates synthetic Paytm statements under mock_data/
    Columns: [Date, Transaction_ID, Payer_UPI, Amount, Status, Payment_Mode]
    Status is either 'Success' or 'Failed'
    """
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    
    end_date = datetime(2026, 6, 25, 18, 0, 0)
    start_date = end_date - timedelta(days=30)
    
    payment_modes = ['UPI', 'Wallet', 'Net Banking', 'Credit Card', 'Debit Card']
    payment_weights = [0.70, 0.15, 0.05, 0.07, 0.03]
    
    records = []
    
    for i in range(num_records):
        progress = i / num_records
        
        # Temporal trends
        if profile_type == 'poor':
            # Less active as time goes on (declining)
            rand_factor = random.betavariate(1, 2)
        elif profile_type == 'excellent':
            # Skyrocketing growth in volume/count towards end of month
            rand_factor = random.betavariate(2.5, 1)
        else:  # good
            # Consistent transaction frequency
            rand_factor = random.random()
            
        seconds_diff = int((end_date - start_date).total_seconds() * rand_factor)
        txn_time = start_date + timedelta(seconds=seconds_diff)
        
        # Unique Txn ID and Payer UPI
        txn_id = f"PAYTM{profile_type[0].upper()}{100000 + i}"
        payer_upi = f"payer{random.randint(100, 999)}@okaxis"
        
        # Amount, Status, Payment Mode
        if profile_type == 'poor':
            # Avg ticket < 50 INR
            amount = round(random.uniform(5.0, 60.0), 2)
            # Failure rate > 15% (e.g. 18%)
            status = 'Failed' if random.random() < 0.18 else 'Success'
            
        elif profile_type == 'good':
            # Avg ticket 200 - 500 INR
            amount = round(random.uniform(200.0, 500.0), 2)
            # Failure rate < 3% (e.g. 2%)
            status = 'Failed' if random.random() < 0.02 else 'Success'
            
        else:  # excellent
            # Avg ticket > 1000 INR, Skyrocketing monthly growth
            amount = round(random.uniform(1000.0, 3500.0), 2)
            # 99.5% success rate (0.5% failure rate)
            status = 'Failed' if random.random() < 0.005 else 'Success'
            
        payment_mode = random.choices(payment_modes, weights=payment_weights)[0]
        
        records.append({
            'Date': txn_time.strftime('%Y-%m-%d %H:%M:%S'),
            'Transaction_ID': txn_id,
            'Payer_UPI': payer_upi,
            'Amount': amount,
            'Status': status,
            'Payment_Mode': payment_mode
        })
        
    # Sort chronologically
    records.sort(key=lambda x: x['Date'])
    
    with open(filename, mode='w', newline='', encoding='utf-8') as f:
        fieldnames = ['Date', 'Transaction_ID', 'Payer_UPI', 'Amount', 'Status', 'Payment_Mode']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for rec in records:
            writer.writerow(rec)
            
    print(f"Generated {filename} with {num_records} records.")

if __name__ == '__main__':
    generate_mock_csv('mock_data/profile_poor.csv', 'poor', num_records=150)
    generate_mock_csv('mock_data/profile_good.csv', 'good', num_records=300)
    generate_mock_csv('mock_data/profile_excellent.csv', 'excellent', num_records=500)
