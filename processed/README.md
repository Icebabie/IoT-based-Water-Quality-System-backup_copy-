# Processed water-quality data

Run: `python preprocess_water_quality.py --aqua aquaattributes.xlsx --kaggle water_potability.csv --outdir processed`

| File | What it is |
|---|---|
| `aqua_*` | HydroShare "Aquaattributes" (India, 1,361 stations). Label to use: `cpcb_tier` / `cpcb_class` (derived; 207 rows unlabelled = missing BOD/coliform). |
| `kaggle_*` | Kaggle water potability (not Indian). Label: `label` (1 = potable). |
| `*_train.csv`, `*_test.csv` | Stratified 80/20 split, cleaned, un-scaled. Train rows only were used to learn clip bounds, medians and scaler. |
| `*_clean_full.csv` | Train + test with a `split` column. |
| `*_preprocessing_report.json` | Counts of everything changed, plus the clip bounds, medians and z-score scaler to reuse at inference time. |

Notes
- `source_class_ph_rule` in the aqua files is the original `class` column. It equals (6.5 <= pH <= 8.0) exactly, so do not train on it.
- `tds_derived` = 0.64 x conductivity (rule of thumb), not a measured value.
- `*_was_missing` columns flag imputed core readings; `*_log10` columns are log10(x+1) of skewed variables.
- `cpcb_tier` is an illustrative grouping (A,B = NORMAL; C,D = WARNING; E,Below E = ABNORMAL). It is not an official CPCB grouping. Classes D and E are evaluated without free ammonia / SAR / boron, which are not in the data.
- Latitude/longitude were dropped from the aqua file because many are wrong (e.g. Beas river rows placed in Hungary and Assam).
