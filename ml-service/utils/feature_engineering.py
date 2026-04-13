"""
feature_engineering.py
─────────────────────────────────────────────────────────────
Consistent feature engineering for training AND inference.
Fixes:
✔ Protocol handling (no crashes)
✔ Cross-vendor consistency
✔ Stable feature columns
"""

import pandas as pd
import numpy as np

# ─────────────────────────────────────────────────────────────
# KNOWN PROTOCOLS
# ─────────────────────────────────────────────────────────────
KNOWN_PROTOCOLS = ["tcp", "udp", "icmp", "arp", "igmp", "other"]
PROTOCOL_COLS   = [f"protocol_{p}" for p in KNOWN_PROTOCOLS]

# Columns to drop
DROP_COLS = [
    'sAddress', 'rAddress', 'sMACs', 'rMACs',
    'sIPs', 'rIPs', 'startDate', 'endDate', 'state'
]


# ─────────────────────────────────────────────────────────────
# MAIN FUNCTION
# ─────────────────────────────────────────────────────────────
def engineer_features(df: pd.DataFrame, fit_protocols: bool = False) -> pd.DataFrame:
    df = df.copy()

    # ── Drop identifiers ──
    df.drop(columns=[c for c in DROP_COLS if c in df.columns], inplace=True)

    # ── Basic aggregates ──
    df['total_packets'] = (df['sPackets'] + df['rPackets']).replace(0, 1)
    df['total_bytes']   = df['sBytesSum'] + df['rBytesSum']

    # ── Behavioral features ──
    df['packet_rate']      = df['total_packets'] / (df['duration'] + 1e-6)
    df['bytes_per_packet'] = df['total_bytes'] / df['total_packets']
    df['packet_ratio']     = df['sPackets'] / (df['rPackets'] + 1)
    df['load_diff']        = df['sLoad'] - df['rLoad']

    # ── TCP features ──
    df['syn_ack_ratio'] = df['sSynRate'] / (df['sAckRate'] + 1)
    df['fin_rst_ratio'] = df['sFinRate'] / (df['sRstRate'] + 1)

    # ── Payload ──
    df['payload_ratio'] = df['sPayloadAvg'] / (df['rPayloadAvg'] + 1)

    # ── Log transform ──
    df['duration_log'] = np.log1p(df['duration'])

    # ─────────────────────────────────────────
    # 🔥 FIXED PROTOCOL HANDLING
    # ─────────────────────────────────────────
    if 'protocol' in df.columns:

        df['protocol'] = (
            df['protocol']
            .fillna("other")
            .astype(str)
            .str.lower()
            .str.strip()
        )

        df['protocol'] = df['protocol'].apply(
            lambda p: p if p in KNOWN_PROTOCOLS else 'other'
        )

        df = pd.get_dummies(df, columns=['protocol'])

    # ── Ensure all protocol columns exist ──
    for col in PROTOCOL_COLS:
        if col not in df.columns:
            df[col] = 0

    # ── Remove unexpected protocol columns ──
    extra_proto = [
        c for c in df.columns
        if c.startswith('protocol_') and c not in PROTOCOL_COLS
    ]
    df.drop(columns=extra_proto, inplace=True)

    # ── Cleanup ──
    df.replace([np.inf, -np.inf], 0, inplace=True)
    df.fillna(0, inplace=True)

    return df


# ─────────────────────────────────────────────────────────────
# SCRIPT MODE
# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("📦 Loading balanced_dataset.csv ...")

    df_raw = pd.read_csv("balanced_dataset.csv")

    print(f"   Raw shape: {df_raw.shape}")
    print(f"   Classes:\n{df_raw['state'].value_counts()}\n")

    labels = df_raw['state'].copy()

    df_eng = engineer_features(df_raw, fit_protocols=True)

    df_eng['state'] = labels.values

    df_eng.to_csv("final_dataset.csv", index=False)

    print("✅ Feature engineering completed!")
    print(f"   Final shape: {df_eng.shape}")
    print(f"   Total features: {len(df_eng.columns)}")
