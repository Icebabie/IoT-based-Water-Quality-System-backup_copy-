"""
Preprocess a water-quality CSV into a clean, model-ready dataset for the
Smart Water Quality Monitoring project.

Usage:
    python preprocess_water_quality.py --input raw.csv --outdir processed/

Maps whatever columns the raw file has onto the six dashboard parameters
(ph, turbidity, temperature, tds, conductivity, dissolvedOxygen). Parameters
missing from the raw file are left out (or TDS derived from conductivity).
"""
import argparse
import json
import re
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

# Column-name aliases (matched after lower-casing and stripping punctuation).
ALIASES = {
    "ph": ["ph", "phmean", "phvalue"],
    "turbidity": ["turbidity", "turb", "ntu"],
    "temperature": ["temperature", "temp", "watertemp", "temperaturec", "tempmean"],
    "tds": ["tds", "solids", "totaldissolvedsolids"],
    "conductivity": ["conductivity", "ec", "electricalconductivity", "conductivitymean", "cond"],
    "dissolvedoxygen": ["do", "dissolvedoxygen", "dissolvedo2", "domean", "oxygen"],
}
KEYS = {"dissolvedoxygen": "dissolvedOxygen"}  # canonical camelCase names

# Physically plausible limits: values outside are sensor/entry errors -> NaN.
PLAUSIBLE = {
    "ph": (0, 14), "turbidity": (0, 1000), "temperature": (0, 50),
    "tds": (0, 100000), "conductivity": (0, 20000), "dissolvedOxygen": (0, 20),
}
# Same demo ranges as the dashboard (src/data/parameters.ts). Illustrative only.
RANGES = {
    "ph": (6.5, 8.5), "turbidity": (0, 5), "temperature": (15, 35),
    "tds": (0, 500), "conductivity": (0, 1000), "dissolvedOxygen": (5, 12),
}


def norm(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(name).lower())


def map_columns(df: pd.DataFrame) -> pd.DataFrame:
    found = {}
    for col in df.columns:
        n = norm(col)
        for canon, names in ALIASES.items():
            if n in names and canon not in found:
                found[canon] = col
    out = pd.DataFrame({KEYS.get(c, c): pd.to_numeric(df[src], errors="coerce") for c, src in found.items()})
    for extra in df.columns:  # keep a label column if the file has one
        if norm(extra) in ("potability", "wqiclass", "class", "label"):
            out["source_label"] = df[extra].values
    return out


def row_status(row: pd.Series, params: list[str]) -> str:
    worst = "NORMAL"
    for p in params:
        lo, hi = RANGES[p]
        v = row[p]
        if lo <= v <= hi:
            continue
        outside = lo - v if v < lo else v - hi
        if outside > (hi - lo) * 0.25:
            return "ABNORMAL"
        worst = "WARNING"
    return worst


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--outdir", default="processed")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    out = Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)
    report: dict = {}

    raw = pd.read_csv(args.input)
    report["raw_rows"], report["raw_columns"] = len(raw), list(map(str, raw.columns))

    df = map_columns(raw)
    params = [c for c in PLAUSIBLE if c in df.columns]
    report["parameters_found"] = params
    report["parameters_missing"] = [c for c in PLAUSIBLE if c not in df.columns]

    # 1. drop duplicates and rows with no parameter values at all
    n0 = len(df)
    df = df.drop_duplicates().dropna(subset=params, how="all").reset_index(drop=True)
    report["dropped_duplicate_or_empty_rows"] = n0 - len(df)

    # 2. impossible values -> NaN
    bad = {}
    for p in params:
        lo, hi = PLAUSIBLE[p]
        mask = (df[p] < lo) | (df[p] > hi)
        bad[p] = int(mask.sum())
        df.loc[mask, p] = np.nan
    report["implausible_values_set_to_nan"] = bad

    # 3. derive TDS from conductivity if the file has no TDS (rule of thumb TDS ~ 0.64 * EC)
    if "tds" not in df.columns and "conductivity" in df.columns:
        df["tds"] = (df["conductivity"] * 0.64).round(1)
        df["tds_is_derived"] = 1
        params.append("tds")
        report["tds_derived_from_conductivity"] = True

    # 4. missing-value indicators, then median imputation
    report["missing_before_imputation"] = {p: int(df[p].isna().sum()) for p in params}
    for p in params:
        if df[p].isna().any():
            df[f"{p}_was_missing"] = df[p].isna().astype(int)
            df[p] = df[p].fillna(df[p].median())

    # 5. winsorise extreme outliers (1st-99th percentile), keeps rows, tames skew
    for p in params:
        lo, hi = df[p].quantile([0.01, 0.99])
        df[p] = df[p].clip(lo, hi)

    # 6. rule-based status label (matches dashboard thresholds) -- see caveat in README
    df["status"] = df.apply(row_status, axis=1, params=params)
    report["status_counts"] = df["status"].value_counts().to_dict()
    if df["status"].nunique() < 2:
        print("WARNING: rule-based status has a single class. The file's units/scale probably "
              "differ from the dashboard ranges (e.g. 'Solids' in the Kaggle potability file is "
              "~22,000 ppm). Adjust RANGES or use the file's own label (source_label) instead.")

    # 7. stratified train/test split (80/20) and save un-scaled + scaled copies
    strat = df["status"] if df["status"].value_counts().min() >= 2 else None
    train, test = train_test_split(df, test_size=0.2, random_state=args.seed, stratify=strat)
    mu, sd = train[params].mean(), train[params].std().replace(0, 1)  # fit on train only
    report["scaler"] = {"mean": mu.to_dict(), "std": sd.to_dict()}

    df.to_csv(out / "processed_full.csv", index=False)
    train.to_csv(out / "train.csv", index=False)
    test.to_csv(out / "test.csv", index=False)
    (out / "preprocessing_report.json").write_text(json.dumps(report, indent=2, default=str))
    print(json.dumps(report, indent=2, default=str))


if __name__ == "__main__":
    main()
