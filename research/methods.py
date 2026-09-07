"""Reusable numerical methods. Synthetic fixtures live exclusively in tests."""

from __future__ import annotations

import warnings

import networkx as nx
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.decomposition import PCA
from sklearn.metrics.pairwise import haversine_distances
from sklearn.preprocessing import StandardScaler
from statsmodels.duration.survfunc import SurvfuncRight
from statsmodels.formula.api import ols
from statsmodels.stats.multitest import multipletests
from statsmodels.tsa.statespace.structural import UnobservedComponents


def finite_matrix(values, minimum_rows=3):
    x = np.asarray(values, dtype=float)
    if x.ndim != 2 or len(x) < minimum_rows or not np.isfinite(x).all():
        raise ValueError("A finite matrix with sufficient rows is required")
    return x


def pca_context(values, anchor=0, seed=731, bootstrap=250, blocks=None):
    x = finite_matrix(values, minimum_rows=30)
    if x.shape[1] < 3 or len(x) < 10 * x.shape[1]:
        raise ValueError("Need at least three domains and ten rows per variable")
    if np.any(np.std(x, axis=0) < 1e-10):
        raise ValueError("Constant PCA variable")
    scaler = StandardScaler().fit(x)
    z = scaler.transform(x)
    pca = PCA().fit(z)
    sign = 1 if pca.components_[0, anchor] >= 0 else -1
    loading = pca.components_[0] * sign
    scores = pca.transform(z)[:, 0] * sign
    rng = np.random.default_rng(seed)
    stability = []
    blocks = np.arange(len(x)) if blocks is None else np.asarray(blocks)
    groups = np.unique(blocks)
    for _ in range(bootstrap):
        chosen = rng.choice(groups, size=len(groups), replace=True)
        idx = np.concatenate([np.flatnonzero(blocks == group) for group in chosen])
        if np.any(x[idx].std(axis=0) < 1e-10):
            continue
        boot_z = StandardScaler().fit_transform(x[idx])
        boot_loading = PCA().fit(boot_z).components_[0]
        stability.append(abs(float(loading @ boot_loading)))
    return {
        "scores": scores, "scaledScores": 50 + 10 * scores / np.std(scores),
        "loadings": loading, "explainedVarianceRatio": pca.explained_variance_ratio_[0],
        "conditionNumber": np.linalg.cond(z),
        "stability": {"medianLoadingCosine": np.median(stability),
                      "p10LoadingCosine": np.quantile(stability, 0.1),
                      "replicates": len(stability)},
    }


def spatial_weights(coordinates, k=6):
    coords = finite_matrix(coordinates, minimum_rows=k + 1)
    if coords.shape[1] != 2 or not 1 <= k < len(coords):
        raise ValueError("Coordinates must be latitude/longitude and k < n")
    if np.any(np.abs(coords[:, 0]) > 90) or np.any(np.abs(coords[:, 1]) > 180):
        raise ValueError("Invalid latitude/longitude")
    distance = haversine_distances(np.radians(coords))
    np.fill_diagonal(distance, np.inf)
    nearest = np.argsort(distance, axis=1)[:, :k]
    w = np.zeros(distance.shape)
    w[np.arange(len(w))[:, None], nearest] = 1
    w = np.maximum(w, w.T)
    return w / w.sum(axis=1, keepdims=True)


def moran_permutation(values, weights, permutations=999, seed=731):
    x = np.asarray(values, dtype=float)
    w = np.asarray(weights, dtype=float)
    n = len(x)
    if n < 5 or w.shape != (n, n) or not np.isfinite(x).all() or not np.isfinite(w).all():
        raise ValueError("Finite values and matching weights required")
    if permutations < 99 or np.any(w < 0) or not np.allclose(np.diag(w), 0):
        raise ValueError("Need >=99 permutations and nonnegative, zero-diagonal weights")
    if not np.allclose(w.sum(axis=1), 1) or x.std() <= 0:
        raise ValueError("Weights must be row-standardized; values must vary")
    z = (x - x.mean()) / x.std()
    lag = w @ z
    observed = float(z @ lag / (z @ z) * n / w.sum())
    expected = -1 / (n - 1)
    rng = np.random.default_rng(seed)
    simulations = np.stack([rng.permutation(z) for _ in range(permutations)])
    sim_i = np.einsum("bi,ij,bj->b", simulations, w, simulations) / (z @ z)
    p = (1 + np.count_nonzero(np.abs(sim_i - expected) >= abs(observed - expected))) / (permutations + 1)
    local = z * lag
    local_p = []
    # Conditional permutations hold the focal tract fixed and reassign all other values.
    for i in range(n):
        others = np.delete(z, i)
        wi = np.delete(w[i], i)
        sim = np.stack([rng.permutation(others) for _ in range(permutations)])
        local_sim = z[i] * (sim @ wi)
        local_expected = -z[i] ** 2 / (n - 1)
        local_p.append((1 + np.count_nonzero(np.abs(local_sim - local_expected) >=
                                            abs(local[i] - local_expected))) / (permutations + 1))
    q = multipletests(local_p, method="fdr_bh")[1]
    return {"statistic": observed, "expected": expected, "pValue": p,
            "localI": local, "localP": np.asarray(local_p), "localQ": q,
            "z": z, "lag": lag}


def seasonal_naive(y, horizon, alpha=0.1):
    values = np.asarray(y, dtype=float)
    if np.isfinite(values).sum() < 36 or np.isinf(values).any() or not 1 <= horizon <= 12:
        raise ValueError("Seasonal naive needs >=36 observed months and horizon 1..12")
    prediction = []
    for h in range(horizon):
        candidates = values[len(values) - 12 + h::-12]
        available = candidates[np.isfinite(candidates)]
        if not len(available):
            raise ValueError("No observed same-calendar-month baseline")
        prediction.append(available[0])
    prediction = np.asarray(prediction)
    errors = values[12:] - values[:-12]
    width = np.nanquantile(np.abs(errors[-120:]), 1 - alpha)
    return prediction, prediction - width, prediction + width, {"interval": "trailing empirical seasonal errors"}


def state_space(y, horizon, alpha=0.1):
    values = np.asarray(y, dtype=float)
    if np.isfinite(values).sum() < 60 or np.isinf(values).any():
        raise ValueError("State-space model needs >=60 observed months")
    with warnings.catch_warnings(record=True) as captured:
        warnings.simplefilter("always")
        fitted = UnobservedComponents(values, level="local level", seasonal=12,
                                     stochastic_seasonal=False).fit(disp=False, maxiter=300)
    forecast = fitted.get_forecast(horizon)
    interval = np.asarray(forecast.conf_int(alpha=alpha))
    diagnostics = {"converged": bool(fitted.mle_retvals.get("converged", False)),
                   "aic": float(fitted.aic),
                   "warnings": sorted(set(str(w.message) for w in captured)),
                   "model": "Gaussian local level + deterministic 12-month seasonal state",
                   "parameterUncertaintyIncluded": False}
    if not diagnostics["converged"]:
        raise RuntimeError("State-space maximum likelihood did not converge")
    return np.asarray(forecast.predicted_mean), interval[:, 0], interval[:, 1], diagnostics


FORECASTERS = {"seasonal_naive": seasonal_naive, "local_level_seasonal": state_space}


def forecast_metrics(rows):
    output = []
    for name in FORECASTERS:
        data = [r for r in rows if r["model"] == name]
        if not data:
            continue
        err = np.array([r["value"] - r["actual"] for r in data])
        output.append({"model": name, "mae": float(np.abs(err).mean()),
                       "rmse": float(np.sqrt((err ** 2).mean())),
                       "coverage": float(np.mean([r["lower"] <= r["actual"] <= r["upper"] for r in data])),
                       "meanIntervalWidth": float(np.mean([r["upper"] - r["lower"] for r in data])),
                       "n": len(data)})
    return output


def rolling_forecast(series, folds=30, horizon=3, training_window=120):
    if folds < 12 or not 1 <= horizon <= 6 or training_window < 60:
        raise ValueError("Need >=12 origins, horizon 1..6, and >=60 training months")
    if not isinstance(series.index, pd.DatetimeIndex) or series.index.has_duplicates:
        raise ValueError("A unique monthly datetime index is required")
    if not series.index.equals(pd.date_range(series.index[0], periods=len(series), freq="MS")):
        raise ValueError("Missing or non-month-start periods; interpolation is forbidden")
    if len(series) < 60 + folds + horizon or np.isinf(series).any():
        raise ValueError("Insufficient complete observations for rolling validation")
    origins = list(range(len(series) - folds - horizon + 1, len(series) - horizon + 1))
    records = []
    failures = []
    for origin in origins:
        train = series.iloc[max(0, origin - training_window):origin].to_numpy()
        for name, method in FORECASTERS.items():
            try:
                pred, low, high, _ = method(train, horizon)
            except (RuntimeError, ValueError) as exc:
                failures.append({"model": name, "origin": str(series.index[origin - 1].date()), "error": str(exc)})
                continue
            for h in range(horizon):
                if pd.isna(series.iloc[origin + h]):
                    continue
                records.append({"origin": str(series.index[origin - 1].date()),
                                "date": str(series.index[origin + h].date()), "horizon": h + 1,
                                "actual": float(series.iloc[origin + h]), "model": name,
                                "value": float(pred[h]), "lower": float(low[h]), "upper": float(high[h])})
    # Purge overlapping target months between selection folds and final holdout origins.
    split_origin = origins[-10]
    holdout_start = series.index[split_origin]
    selected_rows = [r for r in records if pd.Timestamp(r["date"]) < holdout_start]
    holdout = [r for r in records if pd.Timestamp(r["origin"]) >= series.index[split_origin - 1]]
    scores = forecast_metrics(selected_rows)
    expected_count = sum(pd.notna(series.iloc[o + h]) for o in origins if o < split_origin
                         for h in range(min(horizon, split_origin - o)))
    eligible = [s for s in scores if s["n"] == expected_count]
    if not eligible:
        raise RuntimeError("No forecaster completed all selection folds")
    selected = min(eligible, key=lambda r: r["mae"])["model"]
    pred, low, high, diagnostics = FORECASTERS[selected](series.iloc[-training_window:], 6)
    return selected, pred, low, high, {
        "design": f"{folds} rolling origins; 1-{horizon} month horizons; rolling {training_window}-month training; final 10 origins held out; overlapping selection targets purged",
        "vintagePolicy": "Pseudo out-of-sample, latest-vintage observations. Release-time revisions are not reconstructed.",
        "folds": folds, "metrics": scores, "holdoutMetrics": forecast_metrics(holdout),
        "predictions": records, "failures": failures,
        "selectionRule": "Lowest selection MAE among models completing every selection fold; no holdout-based selection",
    }, diagnostics


def labor_anomalies(series, start=60, calibration_window=120):
    values = np.asarray(series, dtype=float)
    if len(values) < start + 12 or np.isinf(values).any():
        raise ValueError("Insufficient monthly series")
    seasonal_error = values[12:] - values[:-12]
    rows = []
    for t in range(start, len(values)):
        if not np.isfinite(values[t]) or not np.isfinite(values[t - 12]):
            continue
        prior = seasonal_error[max(0, t - 12 - calibration_window):t - 12]
        prior = prior[np.isfinite(prior)]
        center = np.median(prior)
        scale = 1.4826 * np.median(np.abs(prior - center))
        scale = max(scale, 0.1)
        residual = values[t] - values[t - 12]
        score = (residual - center) / scale
        p = (1 + np.count_nonzero(np.abs(prior - center) >= abs(residual - center))) / (len(prior) + 1)
        rows.append({"date": str(series.index[t].date()), "value": values[t],
                     "expected": values[t - 12] + center, "residual": residual - center,
                     "score": score, "pValue": p, "calibrationCount": len(prior)})
    # One displayed family is fixed at the last 36 months. No retrospective threshold fitting.
    rows = rows[-36:]
    q = multipletests([r["pValue"] for r in rows], method="fdr_bh")[1]
    for row, qi in zip(rows, q):
        row["qValue"] = qi
        row["flagged"] = bool(qi <= 0.05)
        row["screeningFlag"] = bool(abs(row["score"]) >= 3)
    return rows


def rca_matrix(counts):
    x = finite_matrix(counts)
    if np.any(x < 0) or np.any(x.sum(axis=1) <= 0) or np.any(x.sum(axis=0) <= 0):
        raise ValueError("Positive row/column totals and nonnegative counts required")
    return (x / x.sum(axis=1, keepdims=True)) / (x.sum(axis=0) / x.sum())


def specialization_network(rca, threshold=0.55):
    matrix = finite_matrix(rca)
    incidence = (matrix >= 1).astype(float)
    ubiquity = incidence.sum(axis=0)
    overlap = incidence.T @ incidence
    denominator = np.maximum(ubiquity[:, None], ubiquity[None, :])
    proximity = np.divide(overlap, denominator, out=np.zeros_like(overlap), where=denominator > 0)
    np.fill_diagonal(proximity, 0)
    graph = nx.Graph()
    graph.add_nodes_from(range(matrix.shape[1]))
    for i in range(matrix.shape[1]):
        for j in range(i + 1, matrix.shape[1]):
            if proximity[i, j] >= threshold:
                graph.add_edge(i, j, weight=float(proximity[i, j]), distance=float(1 / proximity[i, j]))
    return graph, proximity


def conditional_diffusion(shares, adjacency, sector, shock=0.2, coupling=0.25):
    shares = np.asarray(shares, dtype=float)
    a = np.asarray(adjacency, dtype=float)
    n = len(shares)
    if (a.shape != (n, n) or not np.isfinite(a).all() or not np.isfinite(shares).all()
            or np.any(a < 0) or np.any(shares < 0) or not np.isclose(shares.sum(), 1)
            or not 0 <= coupling < 1 or not 0 <= shock <= 1 or not 0 <= sector < n):
        raise ValueError("Invalid conditional scenario inputs")
    degree = a.sum(axis=1, keepdims=True)
    w = np.divide(a, degree, out=np.zeros_like(a), where=degree > 0)
    direct = np.zeros(n)
    direct[sector] = shock
    total = np.linalg.solve(np.eye(n) - coupling * w, direct)
    return {"direct": direct, "total": total, "aggregate": float(shares @ total),
            "spectralRadius": float(max(abs(np.linalg.eigvals(coupling * w))))}


def kaplan_meier(durations, events, entry=None):
    duration = np.asarray(durations, dtype=float)
    event = np.asarray(events)
    if len(duration) < 3 or duration.shape != event.shape or not np.isfinite(duration).all():
        raise ValueError("Matching finite survival inputs required")
    if np.any(duration <= 0) or not np.isin(event, [0, 1]).all():
        raise ValueError("Durations must be positive and event indicators binary")
    entries = None if entry is None else np.asarray(entry, dtype=float)
    if entries is not None and (entries.shape != duration.shape or not np.isfinite(entries).all()
                                or np.any(entries < 0) or np.any(entries >= duration)):
        raise ValueError("Entry must precede exit and be nonnegative")
    fit = SurvfuncRight(duration, event.astype(int), entry=entries)
    return {"times": fit.surv_times, "survival": fit.surv_prob,
            "standardError": fit.surv_prob_se, "atRisk": fit.n_risk,
            "events": fit.n_events, "n": len(duration)}


def difference_in_differences(frame):
    required = {"unit", "period", "outcome", "treated", "post"}
    if not required.issubset(frame.columns):
        raise ValueError(f"DiD requires {sorted(required)}")
    data = frame[list(required)].copy()
    if data.isna().any().any() or data.duplicated(["unit", "period"]).any():
        raise ValueError("Missing values or duplicate unit-period observations")
    if not np.isfinite(data.outcome).all() or not data.treated.isin([0, 1]).all() or not data.post.isin([0, 1]).all():
        raise ValueError("Finite outcomes and binary treatment/post required")
    if data.groupby("unit").treated.nunique().max() != 1 or data.groupby("period").post.nunique().max() != 1:
        raise ValueError("Only common-adoption binary treatment is supported")
    periods = data.groupby("period").post.first().sort_index()
    if periods.nunique() != 2 or np.any(np.diff(periods.to_numpy()) < 0):
        raise ValueError("Need pre and post periods with a single common adoption time")
    if len(periods[periods == 0]) < 3 or len(periods[periods == 1]) < 2:
        raise ValueError("At least three pre and two post periods required")
    units = data.groupby("unit").treated.first()
    if min(units.value_counts().get(0, 0), units.value_counts().get(1, 0)) < 10:
        raise ValueError("At least ten treated and ten control clusters required")
    if not data.groupby("unit").size().eq(len(periods)).all():
        raise ValueError("Balanced panel required by this simple estimator")
    data["did"] = data.treated * data.post
    fitted = ols("outcome ~ did + C(unit) + C(period)", data).fit(
        cov_type="cluster", cov_kwds={"groups": data.unit, "use_correction": True}, use_t=True)
    ci = fitted.conf_int().loc["did"]
    return {"effect": float(fitted.params["did"]), "standardError": float(fitted.bse["did"]),
            "lower": float(ci.iloc[0]), "upper": float(ci.iloc[1]),
            "pValue": float(fitted.pvalues["did"]), "clusters": len(units), "observations": len(data),
            "interpretation": "Causal only under parallel trends, no anticipation, no spillovers, and stable composition"}
