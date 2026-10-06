"""
Smart Water Quality - tier prediction with simple, popular deep-learning models
================================================================================
Predicts the water tier  NORMAL / WARNING / ABNORMAL  from the 4 sensor values
that the ESP32 can actually measure (pH, temperature, dissolved oxygen, conductivity).

Models (all standard PyTorch, nothing exotic):
  1. SimpleMLP  - plain feed-forward network (the classic neural net)
  2. DeepMLP    - bigger MLP with BatchNorm + Dropout (the usual "better MLP")
  3. CNN1D      - small 1-D convolutional network that slides over the sensor values

How to run:
    pip install torch numpy pandas scikit-learn matplotlib
    python train_simple_dl.py --data processed --out results

    --data  folder that contains aqua_train.csv and aqua_test.csv (from the zip)
    --out   folder where results are written
    --seeds how many random seeds to average over (default 5)

Outputs (in --out):
    metrics_summary.csv      mean +- std of every metric for every model
    confusion_matrix.png     pooled confusion matrix of the best model
    training_curves.png      loss curves of the best model
    best_model.pt            weights of the best model (for FastAPI later)
    scaler.json              mean/std used to scale the 4 inputs (needed with best_model.pt)
"""
import argparse
import copy
import json
import os

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.metrics import (accuracy_score, balanced_accuracy_score, confusion_matrix,
                             f1_score, recall_score, roc_auc_score)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from torch.utils.data import DataLoader, TensorDataset

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# --------------------------------------------------------------------------- settings
FEATURES = ["ph", "temperature", "dissolvedOxygen", "conductivity_log10"]
TARGET = "cpcb_tier"
CLASSES = ["NORMAL", "WARNING", "ABNORMAL"]          # 0, 1, 2

LEARNING_RATE = 1e-3
WEIGHT_DECAY = 1e-4
BATCH_SIZE = 32
MAX_EPOCHS = 300
PATIENCE = 30                                         # stop if val loss doesn't improve for 30 epochs

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# --------------------------------------------------------------------------- models
class SimpleMLP(nn.Module):
    """4 inputs -> 64 -> 32 -> 3 classes."""
    def __init__(self, n_in=4, n_out=3):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_in, 64), nn.ReLU(),
            nn.Linear(64, 32), nn.ReLU(),
            nn.Linear(32, n_out),
        )

    def forward(self, x):
        return self.net(x)


class DeepMLP(nn.Module):
    """MLP with BatchNorm and Dropout to reduce overfitting on a small dataset."""
    def __init__(self, n_in=4, n_out=3, dropout=0.3):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_in, 128), nn.BatchNorm1d(128), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(128, 64), nn.BatchNorm1d(64), nn.ReLU(), nn.Dropout(dropout),
            nn.Linear(64, 32), nn.BatchNorm1d(32), nn.ReLU(),
            nn.Linear(32, n_out),
        )

    def forward(self, x):
        return self.net(x)


class CNN1D(nn.Module):
    """Treats the 4 sensor values as a tiny 1-D signal and applies convolutions."""
    def __init__(self, n_in=4, n_out=3):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv1d(1, 32, kernel_size=3, padding=1), nn.ReLU(),
            nn.Conv1d(32, 64, kernel_size=3, padding=1), nn.ReLU(),
        )
        self.head = nn.Sequential(
            nn.Flatten(),
            nn.Linear(64 * n_in, 64), nn.ReLU(), nn.Dropout(0.2),
            nn.Linear(64, n_out),
        )

    def forward(self, x):
        x = x.unsqueeze(1)             # (batch, 4) -> (batch, 1, 4)
        return self.head(self.conv(x))


MODELS = {"SimpleMLP": SimpleMLP, "DeepMLP": DeepMLP, "CNN1D": CNN1D}


# --------------------------------------------------------------------------- data
def load_data(folder):
    """Reads the CSVs and keeps only rows that have a tier label."""
    train = pd.read_csv(os.path.join(folder, "aqua_train.csv"))
    test = pd.read_csv(os.path.join(folder, "aqua_test.csv"))
    train = train.dropna(subset=[TARGET]).reset_index(drop=True)
    test = test.dropna(subset=[TARGET]).reset_index(drop=True)

    label_to_id = {name: i for i, name in enumerate(CLASSES)}
    X_train = train[FEATURES].values.astype(np.float32)
    y_train = train[TARGET].map(label_to_id).values
    X_test = test[FEATURES].values.astype(np.float32)
    y_test = test[TARGET].map(label_to_id).values
    return X_train, y_train, X_test, y_test


def to_loader(X, y, shuffle):
    ds = TensorDataset(torch.tensor(X, dtype=torch.float32), torch.tensor(y, dtype=torch.long))
    return DataLoader(ds, batch_size=BATCH_SIZE, shuffle=shuffle)


# --------------------------------------------------------------------------- training
def run_epoch(model, loader, loss_fn, optimizer=None):
    """One pass over the data. Trains if an optimizer is given, otherwise just evaluates."""
    training = optimizer is not None
    model.train(training)
    total_loss, n = 0.0, 0
    with torch.set_grad_enabled(training):
        for xb, yb in loader:
            xb, yb = xb.to(DEVICE), yb.to(DEVICE)
            loss = loss_fn(model(xb), yb)
            if training:
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
            total_loss += loss.item() * len(xb)
            n += len(xb)
    return total_loss / n


def train_one(model_name, X_train, y_train, X_test, y_test, seed):
    """Trains one model with one seed and returns metrics + the trained model."""
    torch.manual_seed(seed)
    np.random.seed(seed)

    # 85% train / 15% validation (validation is used for early stopping only)
    X_tr, X_val, y_tr, y_val = train_test_split(
        X_train, y_train, test_size=0.15, stratify=y_train, random_state=seed)

    # scale inputs (fit on training part only)
    scaler = StandardScaler().fit(X_tr)
    X_tr, X_val, X_te = scaler.transform(X_tr), scaler.transform(X_val), scaler.transform(X_test)

    # class weights so the rare ABNORMAL class is not ignored
    counts = np.bincount(y_tr, minlength=len(CLASSES))
    weights = len(y_tr) / (len(CLASSES) * counts)
    loss_fn = nn.CrossEntropyLoss(weight=torch.tensor(weights, dtype=torch.float32).to(DEVICE))

    model = MODELS[model_name]().to(DEVICE)
    optimizer = torch.optim.AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY)
    train_loader, val_loader = to_loader(X_tr, y_tr, True), to_loader(X_val, y_val, False)

    best_val, best_state, wait = float("inf"), None, 0
    history = {"train": [], "val": []}
    for epoch in range(MAX_EPOCHS):
        history["train"].append(run_epoch(model, train_loader, loss_fn, optimizer))
        val_loss = run_epoch(model, val_loader, loss_fn)
        history["val"].append(val_loss)
        if val_loss < best_val:                       # new best -> remember it
            best_val, best_state, wait = val_loss, copy.deepcopy(model.state_dict()), 0
        else:
            wait += 1
            if wait >= PATIENCE:
                break
    model.load_state_dict(best_state)                 # go back to the best epoch

    # evaluate on the untouched test set
    model.eval()
    with torch.no_grad():
        logits = model(torch.tensor(X_te, dtype=torch.float32).to(DEVICE))
        probs = torch.softmax(logits, dim=1).cpu().numpy()
    pred = probs.argmax(axis=1)

    metrics = {
        "accuracy": accuracy_score(y_test, pred),
        "balanced_acc": balanced_accuracy_score(y_test, pred),
        "macro_f1": f1_score(y_test, pred, average="macro"),
        "auc": roc_auc_score(y_test, probs, multi_class="ovr", average="macro"),
    }
    recalls = recall_score(y_test, pred, average=None, labels=[0, 1, 2], zero_division=0)
    for name, r in zip(CLASSES, recalls):
        metrics[f"recall_{name}"] = r

    return metrics, pred, model, scaler, history, best_val, epoch + 1


# --------------------------------------------------------------------------- main
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="processed")
    parser.add_argument("--out", default="results")
    parser.add_argument("--seeds", type=int, default=5)
    args = parser.parse_args()
    os.makedirs(args.out, exist_ok=True)

    X_train, y_train, X_test, y_test = load_data(args.data)
    print(f"Device: {DEVICE}")
    print(f"Train rows: {len(X_train)} | Test rows: {len(X_test)}")
    print("Train class counts:", dict(zip(CLASSES, np.bincount(y_train))))
    print("Test  class counts:", dict(zip(CLASSES, np.bincount(y_test))), "\n")

    all_rows, pooled_pred, best_runs = [], {}, {}
    for name in MODELS:
        pooled_pred[name] = []
        for seed in range(args.seeds):
            m, pred, model, scaler, hist, val_loss, epochs = train_one(
                name, X_train, y_train, X_test, y_test, seed)
            m.update(model=name, seed=seed)
            all_rows.append(m)
            pooled_pred[name].append(pred)
            # keep the run with the lowest VALIDATION loss (not test!) for saving
            if name not in best_runs or val_loss < best_runs[name]["val_loss"]:
                best_runs[name] = dict(val_loss=val_loss, model=model, scaler=scaler, hist=hist)
            print(f"{name:10s} seed {seed}: acc={m['accuracy']:.3f}  macroF1={m['macro_f1']:.3f}  "
                  f"AUC={m['auc']:.3f}  ({epochs} epochs)")
        print()

    # ---- summary table (mean +- std over seeds)
    df = pd.DataFrame(all_rows)
    metric_cols = [c for c in df.columns if c not in ("model", "seed")]
    summary = df.groupby("model")[metric_cols].agg(["mean", "std"]).round(3)
    summary.to_csv(os.path.join(args.out, "metrics_summary.csv"))
    df.to_csv(os.path.join(args.out, "metrics_per_seed.csv"), index=False)

    print("=" * 70)
    print("TEST RESULTS (mean over seeds)")
    print(df.groupby("model")[["accuracy", "balanced_acc", "macro_f1", "auc"] +
                              [f"recall_{c}" for c in CLASSES]].mean().round(3).to_string())

    # ---- pick best model by mean macro-F1
    best_name = df.groupby("model")["macro_f1"].mean().idxmax()
    print(f"\nBest model by mean macro-F1: {best_name}")

    # confusion matrix, pooled over all seeds of the best model
    y_all = np.concatenate([y_test] * args.seeds)
    p_all = np.concatenate(pooled_pred[best_name])
    cm = confusion_matrix(y_all, p_all, labels=[0, 1, 2])
    cm_pct = cm / cm.sum(axis=1, keepdims=True)
    fig, ax = plt.subplots(figsize=(5, 4))
    ax.imshow(cm_pct, cmap="Blues", vmin=0, vmax=1)
    ax.set_xticks(range(3)); ax.set_xticklabels(CLASSES)
    ax.set_yticks(range(3)); ax.set_yticklabels(CLASSES)
    ax.set_xlabel("Predicted"); ax.set_ylabel("Actual")
    ax.set_title(f"{best_name} - confusion matrix (row %)")
    for i in range(3):
        for j in range(3):
            ax.text(j, i, f"{cm_pct[i, j]*100:.0f}%", ha="center", va="center",
                    color="white" if cm_pct[i, j] > 0.5 else "black")
    fig.tight_layout(); fig.savefig(os.path.join(args.out, "confusion_matrix.png"), dpi=150)
    plt.close(fig)

    # training curves of the best model
    hist = best_runs[best_name]["hist"]
    fig, ax = plt.subplots(figsize=(6, 4))
    ax.plot(hist["train"], label="train loss")
    ax.plot(hist["val"], label="validation loss")
    ax.set_xlabel("Epoch"); ax.set_ylabel("Loss"); ax.set_title(f"{best_name} - training curves")
    ax.legend(); fig.tight_layout()
    fig.savefig(os.path.join(args.out, "training_curves.png"), dpi=150)
    plt.close(fig)

    # save weights + scaler so FastAPI can load them later
    torch.save(best_runs[best_name]["model"].state_dict(), os.path.join(args.out, "best_model.pt"))
    sc = best_runs[best_name]["scaler"]
    with open(os.path.join(args.out, "scaler.json"), "w") as f:
        json.dump({"model": best_name, "features": FEATURES, "classes": CLASSES,
                   "mean": sc.mean_.tolist(), "std": sc.scale_.tolist()}, f, indent=2)

    print(f"\nSaved everything to: {args.out}/")


if __name__ == "__main__":
    main()
