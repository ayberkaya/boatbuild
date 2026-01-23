"""
Trideck 45M REBASE Import Processor
-----------------------------------
Rules:
- Historical raw import - no automatic inference
- Hak ediş: Do NOT auto-infer
- All records start as CONDITIONAL
- Manual review required in CRM
"""

import pandas as pd
import os

def process_import(input_file: str, output_file: str = None):
    """
    Process the Excel import file and prepare for CRM.
    
    - Reads the Excel file
    - Adds CONDITIONAL status to all records
    - Does NOT infer hak ediş values
    - Exports to CSV for CRM import
    """
    
    if output_file is None:
        base_name = os.path.splitext(input_file)[0]
        output_file = f"{base_name}_CRM_READY.csv"
    
    print(f"Reading: {input_file}")
    
    # Read Excel file
    df = pd.read_excel(input_file)
    
    print(f"\n=== FILE STRUCTURE ===")
    print(f"Total records: {len(df)}")
    print(f"Columns: {list(df.columns)}")
    
    print(f"\n=== COLUMN DETAILS ===")
    for col in df.columns:
        non_null = df[col].notna().sum()
        print(f"  {col}: {non_null} non-null values")
    
    print(f"\n=== SAMPLE DATA (first 5 rows) ===")
    print(df.head().to_string())
    
    # Add CRM processing columns
    if 'CRM_STATUS' not in df.columns:
        df['CRM_STATUS'] = 'CONDITIONAL'
        print(f"\n[+] Added CRM_STATUS = 'CONDITIONAL' for all {len(df)} records")
    
    if 'CRM_REVIEW_REQUIRED' not in df.columns:
        df['CRM_REVIEW_REQUIRED'] = True
        print(f"[+] Added CRM_REVIEW_REQUIRED = True for all records")
    
    if 'HAK_EDIS_AUTO_INFER' not in df.columns:
        df['HAK_EDIS_AUTO_INFER'] = False
        print(f"[+] Added HAK_EDIS_AUTO_INFER = False (disabled per rules)")
    
    # Export to CSV
    df.to_csv(output_file, index=False, encoding='utf-8-sig')
    print(f"\n=== OUTPUT ===")
    print(f"Exported to: {output_file}")
    print(f"Ready for CRM import with manual review workflow")
    
    return df


if __name__ == "__main__":
    input_file = "Trideck_45M_REBASE_IMPORT.xlsx"
    
    if os.path.exists(input_file):
        df = process_import(input_file)
    else:
        print(f"Error: File not found: {input_file}")
