"""
Preprocess the two water-quality datasets for the Smart Water Quality project.

    python preprocess_water_quality.py --aqua aquaattributes.xlsx --kaggle water_potability.csv --outdir processed

Pipeline (per dataset), ordered to avoid train/test leakage:
  1. load + fix types ("-" placeholders -> NaN), unify column names to dashboard names
  2. drop duplicates, drop rows with no core readings
  3. physically impossible values -> NaN
  4. stratified 80/20 split
  5. everything learned from data (clip bounds, medians, scaler) is fitted on TRAIN only
  6. clip outliers (train 1st-99th pct) -> median-impute (+ missing flags) -> log10 of skewed columns
"""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

SEED = 42

# Same illustrative ranges as the dashboard (src/data/parameters.ts). Not validated drinking-water limits.
DASH_RANGES = {"ph": (6.5, 8.5), "temperature": (15, 35), "dissolvedOxygen": (5, 12), "conductivity": (0, 1000)}


def load_aqua(path: str) -> tuple[pd.DataFrame, dict]:
    raw = pd.read_excel(path, sheet_name="Sheet1")
    df = raw.rename(columns={
        "Stationcode": "station_code", "Locations": "location", "State": "state",
        "Temperature": "temperature", "D.O": "dissolvedOxygen", "pH": "ph",
        "Conductivity": "conductivity", "B.O.D": "bod", "Nitrate": "nitrate",
        "Fecalcaliform": "fecal_coliform", "Totalcaliform": "total_coliform", "class": "label",
    })
    # Lat/Lon are unreliable in this file (e.g. Beas river rows placed in Hungary/Assam) -> dropped.
    df = df.drop(columns=["Lat", "Lon", "Capitalcity"])
    for c in ["conductivity", "nitrate", "fecal_coliform"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")  # turns "-" into NaN
    # The source 'class' column turned out to be exactly (6.5 <= pH <= 8.0) for every row, so it is
    # kept only for reference; a proper multi-parameter label (cpcb_class) is derived in process().
    df["source_class_ph_rule"] = df.pop("label").str.strip().str.lower().map({"yes": 1, "no": 0})
    cfg = {
        "core": ["ph", "temperature", "dissolvedOxygen", "conductivity"],
        "extra": ["bod", "nitrate", "fecal_coliform", "total_coliform"],
        "log": ["conductivity", "bod", "nitrate", "fecal_coliform", "total_coliform"],
        "plausible": {"ph": (0, 14), "temperature": (0, 45), "dissolvedOxygen": (0, 15),
                      "conductivity": (0, 50000), "bod": (0, 500), "nitrate": (0, 1000),
                      "fecal_coliform": (0, 1e9), "total_coliform": (0, 1e9)},
        "id_cols": ["station_code", "location", "state"],
        "derive_tds": True,
    }
    return df, cfg


def load_kaggle(path: str) -> tuple[pd.DataFrame, dict]:
    raw = pd.read_csv(path)
    df = raw.rename(columns={
        "ph": "ph", "Solids": "tds", "Conductivity": "conductivity", "Turbidity": "turbidity",
        "Hardness": "hardness", "Chloramines": "chloramines", "Sulfate": "sulfate",
        "Organic_carbon": "organic_carbon", "Trihalomethanes": "trihalomethanes", "Potability": "label",
    })
    cfg = {
        "core": ["ph", "turbidity", "tds", "conductivity"],
        "extra": ["hardness", "chloramines", "sulfate", "organic_carbon", "trihalomethanes"],
        "log": [],
        "plausible": {"ph": (0, 14), "turbidity": (0, 1000), "tds": (0, 100000), "conductivity": (0, 20000)},
        "id_cols": [],
        "derive_tds": False,
    }
    return df, cfg


def cpcb_class(row: pd.Series):
    """
    CPCB 'designated best use' class from https://cpcb.nic.in/water-quality-criteria/ .
    Needs pH, DO, BOD and total coliform (NaN if any is missing). Class D omits free ammonia and
    class E omits SAR/boron (not in the data), so D and E are evaluated on the available parameters only.
    """
    ph, do, bod, tc, ec = row["ph"], row["dissolvedOxygen"], row["bod"], row["total_coliform"], row["conductivity"]
    if any(pd.isna(x) for x in (ph, do, bod, tc)):
        return np.nan
    if 6.5 <= ph <= 8.5 and do >= 6 and bod <= 2 and tc <= 50:
        return "A"
    if 6.5 <= ph <= 8.5 and do >= 5 and bod <= 3 and tc <= 500:
        return "B"
    if 6 <= ph <= 9 and do >= 4 and bod <= 3 and tc <= 5000:
        return "C"
    if 6.5 <= ph <= 8.5 and do >= 4:
        return "D"
    if pd.isna(ec):
        return np.nan
    return "E" if (6 <= ph <= 8.5 and ec <= 2250) else "Below E"


# Illustrative 3-level grouping for the dashboard (my own mapping, not an official CPCB grouping).
TIER = {"A": "NORMAL", "B": "NORMAL", "C": "WARNING", "D": "WARNING", "E": "ABNORMAL", "Below E": "ABNORMAL"}


def rule_status(row: pd.Series) -> str:
    """NORMAL/WARNING/ABNORMAL from the dashboard's configured ranges (>25% of range outside = ABNORMAL)."""
    worst = "NORMAL"
    for p, (lo, hi) in DASH_RANGES.items():
        v = row[p]
        if lo <= v <= hi:
            continue
        outside = lo - v if v < lo else v - hi
        if outside > (hi - lo) * 0.25:
            return "ABNORMAL"
        worst = "WARNING"
    return worst


def process(df: pd.DataFrame, cfg: dict, name: str, outdir: Path) -> dict:
    rep: dict = {"dataset": name, "raw_rows": int(len(df))}
    feats = cfg["core"] + cfg["extra"]

    # 2. duplicates / empty rows
    n0 = len(df)
    df = df.drop_duplicates().dropna(subset=cfg["core"], how="all").reset_index(drop=True)
    rep["dropped_duplicate_or_empty_rows"] = int(n0 - len(df))

    # 3. implausible values -> NaN
    bad = {}
    for c, (lo, hi) in cfg["plausible"].items():
        m = (df[c] < lo) | (df[c] > hi)
        bad[c] = int(m.sum())
        df.loc[m, c] = np.nan
    rep["implausible_set_to_nan"] = {k: v for k, v in bad.items() if v}
    rep["missing_before_imputation"] = {c: int(df[c].isna().sum()) for c in feats}

    # label: Kaggle has its own; Aquaattributes gets CPCB class derived from the RAW (un-imputed) values
    if name == "aqua":
        df["cpcb_class"] = df.apply(cpcb_class, axis=1)
        df["cpcb_tier"] = df["cpcb_class"].map(TIER)
        strat = df["cpcb_class"].fillna("UNLABELLED").replace({"Below E": "E", "A": "A"})  # merge tiny strata
        rep["cpcb_class_counts"] = df["cpcb_class"].value_counts(dropna=False).astype(int).to_dict()
        rep["cpcb_tier_counts"] = df["cpcb_tier"].value_counts(dropna=False).astype(int).to_dict()
    else:
        strat = df["label"]

    # 4. stratified split
    train, test = train_test_split(df, test_size=0.2, random_state=SEED, stratify=strat)
    train, test = train.copy(), test.copy()
    rep["train_rows"], rep["test_rows"] = int(len(train)), int(len(test))

    # 5/6. fit on train, apply to both
    params = {"clip": {}, "median": {}}
    for c in feats:
        lo, hi = train[c].quantile([0.01, 0.99])
        params["clip"][c] = [float(lo), float(hi)]
    for part in (train, test):
        for c in cfg["core"]:
            part[f"{c}_was_missing"] = part[c].isna().astype(int)
        for c in feats:
            lo, hi = params["clip"][c]
            part[c] = part[c].clip(lo, hi)
    for c in feats:
        params["median"][c] = float(train[c].median())
    for part in (train, test):
        for c in feats:
            part[c] = part[c].fillna(params["median"][c])
        for c in cfg["log"]:
            part[f"{c}_log10"] = np.log10(part[c] + 1)
        if cfg["derive_tds"]:
            part["tds_derived"] = (part["conductivity"] * 0.64).round(1)  # rule of thumb TDS ~ 0.64 x EC
        if name == "aqua":
            part["status_rule"] = part.apply(rule_status, axis=1)

    # z-score scaler for the model-input columns (train stats only)
    model_cols = feats + [f"{c}_log10" for c in cfg["log"]]
    params["scaler"] = {c: {"mean": float(train[c].mean()), "std": float(train[c].std() or 1.0)} for c in model_cols}
    rep["params"] = params
    rep["core_features"], rep["extra_features"] = cfg["core"], cfg["extra"]
    if name == "aqua":
        rep["status_rule_counts_train"] = train["status_rule"].value_counts().to_dict()

    train.to_csv(outdir / f"{name}_train.csv", index=False)
    test.to_csv(outdir / f"{name}_test.csv", index=False)
    pd.concat([train.assign(split="train"), test.assign(split="test")]).to_csv(outdir / f"{name}_clean_full.csv", index=False)
    (outdir / f"{name}_preprocessing_report.json").write_text(json.dumps(rep, indent=2))
    return rep


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--aqua")
    ap.add_argument("--kaggle")
    ap.add_argument("--outdir", default="processed")
    a = ap.parse_args()
    out = Path(a.outdir)
    out.mkdir(parents=True, exist_ok=True)
    if a.aqua:
        df, cfg = load_aqua(a.aqua)
        print(json.dumps({k: v for k, v in process(df, cfg, "aqua", out).items() if k != "params"}, indent=2))
    if a.kaggle:
        df, cfg = load_kaggle(a.kaggle)
        print(json.dumps({k: v for k, v in process(df, cfg, "kaggle", out).items() if k != "params"}, indent=2))


if __name__ == "__main__":
    main()
