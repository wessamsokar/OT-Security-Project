import os
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import accuracy_score, precision_recall_fscore_support

from utils.feature_engineering import engineer_features


def load_dataset(root: str) -> pd.DataFrame:
    files = sorted(Path(root).rglob("*.csv"))
    if not files:
        raise FileNotFoundError(f"No CSV files found under {root}")

    frames = []
    for path in files:
        df = pd.read_csv(path)
        if "state" not in df.columns:
            continue
        df = df[df["state"].notna()].copy()
        df["__file"] = os.path.basename(path)
        frames.append(df)

    if not frames:
        raise ValueError("No CSVs with a 'state' column were found.")

    return pd.concat(frames, ignore_index=True)


def main() -> None:
    data = load_dataset("Datasets")
    y_true = data["state"].astype(str).values

    features = data.drop(columns=["state", "__file"], errors="ignore")
    eng = engineer_features(features, fit_protocols=False)

    xgb_model = joblib.load("models/xgboost_model.pkl")
    xgb_feats = joblib.load("preprocessing/xgb_features.pkl")
    label_encoder = joblib.load("preprocessing/label_encoder.pkl")

    X = eng.reindex(columns=xgb_feats, fill_value=0)
    y_pred_enc = xgb_model.predict(X)
    y_pred = label_encoder.inverse_transform(y_pred_enc)

    labels = sorted(set(y_true) | set(y_pred))
    pr, rc, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, labels=labels, average="macro", zero_division=0
    )
    pr_w, rc_w, f1_w, _ = precision_recall_fscore_support(
        y_true, y_pred, labels=labels, average="weighted", zero_division=0
    )
    acc = accuracy_score(y_true, y_pred)

    y_true_bin = (pd.Series(y_true) != "BENIGN").astype(int)
    y_pred_bin = (pd.Series(y_pred) != "BENIGN").astype(int)
    pr_b, rc_b, f1_b, _ = precision_recall_fscore_support(
        y_true_bin, y_pred_bin, average="binary", zero_division=0
    )

    print("Rows:", len(y_true))
    print("Labels:", labels)
    print("\nMulti-class (macro):")
    print(f"  Precision: {pr:.4f}")
    print(f"  Recall:    {rc:.4f}")
    print(f"  F1:        {f1:.4f}")
    print("\nMulti-class (weighted):")
    print(f"  Precision: {pr_w:.4f}")
    print(f"  Recall:    {rc_w:.4f}")
    print(f"  F1:        {f1_w:.4f}")
    print(f"\nAccuracy:   {acc:.4f}")
    print("\nBinary (attack vs benign):")
    print(f"  Precision: {pr_b:.4f}")
    print(f"  Recall:    {rc_b:.4f}")
    print(f"  F1:        {f1_b:.4f}")


if __name__ == "__main__":
    main()
