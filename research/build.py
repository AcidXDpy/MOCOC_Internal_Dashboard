"""Single command public economic analysis: python -m research.build."""

from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.metadata
import json
from datetime import date
from pathlib import Path

import networkx as nx
import numpy as np
import pandas as pd
import requests
from shapely.geometry import mapping, shape
from sklearn.cluster import KMeans
from sklearn.metrics.pairwise import haversine_distances

from .acquire import Acquisition, DATA, NJ_COUNTIES, ROOT, SECTORS, utc_now
from .methods import (conditional_diffusion, labor_anomalies, moran_permutation,
                      pca_context, rca_matrix, rolling_forecast, spatial_weights,
                      specialization_network, state_space)

OUTPUT = ROOT / "public" / "economy" / "model-results.json"


def envelope(key, title, status, evidence, name, library, formula, description,
             source_ids=(), requirements=(), limitations=(), result=None):
    return {"id": key, "title": title, "status": status, "evidenceType": evidence,
            "method": {"name": name, "library": library, "formula": formula,
                       "description": description},
            "sourceIds": list(source_ids), "requirements": list(requirements),
            "limitations": list(limitations), "result": result}


def requirement(name, met, detail):
    return {"name": name, "met": bool(met), "detail": detail}


def clean_json(value):
    if isinstance(value, dict):
        return {str(k): clean_json(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, np.ndarray)):
        return [clean_json(v) for v in value]
    if isinstance(value, (np.bool_, bool)):
        return bool(value)
    if isinstance(value, (np.integer, int)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        return round(float(value), 8) if np.isfinite(value) else None
    return value


def prediction_points(dates, values, lower, upper):
    return [{"date": str(d.date()), "value": v, "lower": lo, "upper": hi}
            for d, v, lo, hi in zip(dates, values, lower, upper)]


def tract_frame(acs, geo):
    boundaries = {f["properties"]["geoid"]: f for f in geo["features"]}
    rows = []
    for geoid, tables in acs["data"].items():
        if not geoid.startswith("14000US34027") or geoid not in boundaries:
            continue
        point = shape(boundaries[geoid]["geometry"]).representative_point()
        row = {"geoid": geoid, "name": acs["geography"][geoid]["name"],
               "latitude": point.y, "longitude": point.x}
        for name, table, field in [("income", "B19013", "B19013001"),
                                   ("povertyPopulation", "B17001", "B17001001"),
                                   ("povertyCount", "B17001", "B17001002"),
                                   ("adultPopulation", "B23025", "B23025001"),
                                   ("employed", "B23025", "B23025004")]:
            estimate = tables[table]["estimate"][field]
            moe = tables[table]["error"][field]
            row[name] = estimate if estimate is not None and estimate >= 0 else None
            row[name + "Moe"] = moe if moe is not None and moe >= 0 else None
        rows.append(row)
    frame = pd.DataFrame(rows)
    frame["povertyRate"] = 100 * frame.povertyCount / frame.povertyPopulation.where(frame.povertyPopulation > 0)
    frame["employmentRatio"] = 100 * frame.employed / frame.adultPopulation.where(frame.adultPopulation > 0)
    return frame


def export_tract_boundaries(geo):
    features = []
    for feature in geo["features"]:
        properties = feature["properties"]
        geoid = properties["geoid"]
        if not geoid.startswith("14000US34027"):
            continue
        geometry = shape(feature["geometry"]).simplify(0.00015, preserve_topology=True)
        if not geometry.is_valid or geometry.is_empty:
            raise ValueError(f"Invalid simplified boundary: {geoid}")
        features.append({"type": "Feature", "properties": {
            "GEOID": geoid, "geoid": geoid, "fips": geoid.removeprefix("14000US"),
            "name": properties["name"], "vintage": "2024"}, "geometry": mapping(geometry)})
    result = {"type": "FeatureCollection", "features": features,
              "metadata": {"sourceId": "tiger2024-tracts", "crs": "EPSG:4326",
                           "simplification": "0.00015 degrees, topology preserved per feature; display only",
                           "joinKey": "properties.geoid matches spatial.result.tracts[].geoid",
                           "note": "Includes tracts excluded from statistics; absent analytical values must remain missing."}}
    path = OUTPUT.parent / "tracts.geojson"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
    return path


def build_health(tracts):
    required = ["income", "incomeMoe", "povertyRate", "employmentRatio"]
    complete = tracts.dropna(subset=required).copy()
    complete = complete[(complete.income > 0) & (complete.income < 250000)
                        & (complete.incomeMoe / complete.income < 0.5)]
    x = np.column_stack([np.log(complete.income), -complete.povertyRate, complete.employmentRatio])
    coords = complete[["latitude", "longitude"]].to_numpy()
    blocks = KMeans(n_clusters=8, n_init=10, random_state=731).fit_predict(coords)
    calculated = pca_context(x, blocks=blocks)
    coherent_direction = bool(np.all(calculated["loadings"] >= 0))
    variables = [{"id": "log_income", "label": "Log median household income", "direction": 1},
                 {"id": "negative_poverty", "label": "Negative poverty rate", "direction": 1},
                 {"id": "employment_ratio", "label": "Employed / population age 16+", "direction": 1}]
    records = complete[["geoid", "name", "latitude", "longitude"]].to_dict("records")
    for record, score, raw in zip(records, calculated["scaledScores"], calculated["scores"]):
        record.update(score=score, componentScore=raw)
    return envelope("health", "Household socioeconomic context", "experimental", "modeled",
                    "Standardized PCA with spatial-block loading stability", "scikit-learn PCA, KMeans",
                    "z_ij=(x_ij-mean_j)/sd_j; PC1_i=z_i v1; score_i=50+10 PC1_i/sd(PC1)",
                    "An exploratory cross-sectional composite, oriented toward higher income. Scores are relative to included county tracts.",
                    ["acs2024-tracts", "tiger2024-tracts"],
                    [requirement("Three observed household indicators", True, f"{len(complete)} complete tracts"),
                     requirement("External commercial-health validation", False, "No vacancies, openings, closure or sales outcome panel"),
                     requirement("Coherent favorable component loadings", coherent_direction,
                                 "Mixed signs imply an income/workforce-composition contrast, not an ordered health scale" if not coherent_direction else "All transformed indicator loadings share orientation"),
                     requirement("Temporal momentum index", False, "Single pooled ACS vintage")],
                    ["This is not a validated local economic health score; overallEconomicHealthScore remains null.",
                     "Income and poverty are correlated; explained variance is not evidence of economic validity.",
                     "Employment ratio is influenced by age composition and retirement, not just labor demand.",
                     "The observed component loads negatively on employment/population; higher scores cannot be interpreted as uniformly healthier.",
                     "No score confidence interval: cross-variable ACS sampling covariances are unavailable.",
                     "Tracts with missing, top-coded income >=250000, or income MOE/estimate >=0.5 are excluded.",
                     "Spatial-block bootstrap is a descriptive stability diagnostic, not calibrated inferential uncertainty."],
                    {"indexName": "Household socioeconomic context", "interpretation": "Relative ACS 2020-2024 tract context; mean 50, SD 10; not bounded to 0-100",
                     "overallEconomicHealthScore": None, "orientationGatePassed": coherent_direction, "variables": variables,
                     "explainedVarianceRatio": calculated["explainedVarianceRatio"],
                     "loadings": [{"variable": v["id"], "weight": weight} for v, weight in zip(variables, calculated["loadings"])],
                     "sampleSize": len(complete), "excludedTracts": len(tracts) - len(complete),
                     "conditionNumber": calculated["conditionNumber"], "stability": calculated["stability"],
                     "tracts": records, "validation": "250 resamples of eight geographic KMeans blocks; sign-invariant loading cosine. No predictive outcome validation."})


def build_spatial(tracts):
    frame = tracts.dropna(subset=["income", "incomeMoe"]).copy()
    frame = frame[(frame.income > 0) & (frame.income < 250000)]
    coords = frame[["latitude", "longitude"]].to_numpy()
    # Income levels, not log values, are analyzed so the displayed variable matches the statistic.
    weights = spatial_weights(coords, k=6)
    result = moran_permutation(frame.income, weights)
    rows = frame[["geoid", "name", "latitude", "longitude", "income", "incomeMoe"]].rename(
        columns={"income": "value", "incomeMoe": "marginOfError"}).to_dict("records")
    for i, row in enumerate(rows):
        z, lag = result["z"][i], result["lag"][i]
        cluster = ("high" if z > 0 else "low") + "-" + ("high" if lag > 0 else "low")
        row.update(standardizedValue=z, spatialLag=lag, localI=result["localI"][i],
                   pValue=result["localP"][i], qValue=result["localQ"][i],
                   cluster=cluster if result["localQ"][i] <= 0.05 else "not-significant")
    sensitivity = []
    for k in [4, 8]:
        m = moran_permutation(frame.income, spatial_weights(coords, k), permutations=999)
        sensitivity.append({"k": k, "statistic": m["statistic"], "pValue": m["pValue"]})
    # Measurement-error sensitivity holds the graph fixed and perturbs estimates using source MOEs.
    rng = np.random.default_rng(732)
    simulations = rng.normal(frame.income.to_numpy(), frame.incomeMoe.to_numpy() / 1.644853627,
                             size=(300, len(frame)))
    centered = simulations - simulations.mean(axis=1, keepdims=True)
    simulated_i = np.einsum("bi,ij,bj->b", centered, weights, centered) / np.sum(centered ** 2, axis=1)
    return envelope("spatial", "Spatial income association", "ready", "modeled",
                    "Global and conditional Local Moran permutation tests", "NumPy, scipy, scikit-learn, Shapely",
                    "I=(n/S0)(z'Wz)/(z'z); I_i=z_i (Wz)_i; p=(1+extreme permutations)/(B+1)",
                    "Tests spatial association in observed tract median household income, with two-sided randomization tests and BH-adjusted local p-values.",
                    ["acs2024-tracts", "tiger2024-tracts"],
                    [requirement("Real tract estimates and boundaries", True, f"{len(frame)} eligible tracts"),
                     requirement("Causal spatial identification", False, "No causal spillover interpretation")],
                    ["Income clustering is residential context, not a business hotspot or a causal spillover.",
                     "Graph uses interior representative points, not contiguity or road travel times.",
                     "Permutation p-values condition on estimates; ACS survey error is not part of the null test.",
                     "Independent normal MOE perturbations are sensitivity analysis only; survey covariance is unknown.",
                     "BH local correction assumes an appropriate dependence structure; shared-neighbor tests remain exploratory.",
                     "Missing and top-coded median incomes are excluded, potentially changing the graph."],
                    {"variable": "Median household income", "unit": "2024 inflation-adjusted USD", "period": "ACS 2020-2024",
                     "n": len(frame), "permutations": 999,
                     "weightDefinition": "Union-symmetrized 6 nearest neighbors by haversine distance, then row-standardized; diagonal zero",
                     "global": {k: result[k] for k in ["statistic", "expected", "pValue"]},
                     "sensitivity": sensitivity, "tracts": rows,
                     "measurementError": {"draws": 300, "moranP05": np.quantile(simulated_i, 0.05),
                                          "moranP95": np.quantile(simulated_i, 0.95),
                                          "label": "MOE sensitivity range, not a confidence interval"}})


def build_labor(frame, as_of):
    frame = frame[pd.to_datetime(frame.date) <= pd.Timestamp(as_of)].copy()
    series = pd.Series(frame.value.to_numpy(), index=pd.to_datetime(frame.date))
    selected, pred, low, high, validation, diagnostics = rolling_forecast(series)
    holdout = {m["model"]: m for m in validation["holdoutMetrics"]}
    diagnostics["holdoutAssessment"] = {
        "selectedModelMae": holdout[selected]["mae"],
        "seasonalNaiveMae": holdout["seasonal_naive"]["mae"],
        "selectedModelBeatsSeasonalNaive": holdout[selected]["mae"] < holdout["seasonal_naive"]["mae"],
        "observedIntervalCoverage": holdout[selected]["coverage"],
        "note": "Selection is frozen before holdout. A worse holdout score is retained and reported, not used to reselect."}
    last = series.index[-1]
    dates = pd.date_range(last + pd.offsets.MonthBegin(), periods=6, freq="MS")
    source_ids = sorted(frame.sourceId.unique())
    limits = ["Target is county resident unemployment rate, not Mount Olive GDP or commercial activity.",
              "Latest-vintage backtests are not real-time-vintage backtests; revisions may improve retrospective results.",
              "Overlapping forecast horizons create dependent errors; aggregate metrics have no claimed standard errors.",
              "90% intervals are nominal and do not include parameter uncertainty or future structural breaks.",
              "The selected state-space model underperforms seasonal naive on the final holdout; broad intervals over-cover this small evaluation sample. Predictive superiority is not established.",
              "Missing October 2025 is retained. Kalman filtering skips its observation update; validation never scores it.",
              "Seasonal-naive baseline uses the last observed same-calendar-month value if the previous year is missing.",
              "Selected model is chosen using 1-3 month validation; months 4-6 are extrapolations without matching-horizon validation."]
    forecast = envelope("forecast", "County unemployment forecast", "ready", "modeled",
                        "Rolling-origin benchmark selection", "statsmodels UnobservedComponents, NumPy",
                        "y_t=level_t+season_t+epsilon_t; level_t=level_(t-1)+eta_t",
                        "Seasonal-naive and local-level seasonal state-space forecasts compete on purged selection folds; final ten origins are held out.",
                        source_ids, [requirement("Monthly observed county history", True, f"{series.count()} published months; {series.isna().sum()} missing"),
                                     requirement("Historical release vintages", False, "Latest BLS vintage only")], limits,
                        {"target": "Morris County unemployment rate", "unit": "percent", "frequency": "monthly",
                         "seasonalAdjustment": "Not seasonally adjusted; 12-month seasonality modeled",
                         "trainingStart": str(series.index[-120].date()), "historyStart": str(series.index[0].date()),
                         "observedThrough": str(last.date()), "selectedModel": selected, "intervalLevel": 0.9,
                         "history": [{"date": str(d.date()), "value": value} for d, value in series.items()],
                         "predictions": prediction_points(dates, pred, low, high), "validation": validation,
                         "diagnostics": diagnostics})
    current = pd.Timestamp(as_of).to_period("M").to_timestamp()
    gap = (current.year - last.year) * 12 + current.month - last.month
    if not 1 <= gap <= 12:
        nowcast = envelope("nowcast", "Current-month county labor projection", "blocked", "readiness",
                           "State-space extrapolation", "statsmodels", "E[y_t | observations through T]",
                           "A nowcast requires an unpublished current month within the 12-month projection limit.", source_ids,
                           [requirement("Current month within projection range", False, f"Gap is {gap} months")])
    else:
        npred, nlo, nhi, ndiag = state_space(series.iloc[-120:], gap)
        path = prediction_points(pd.date_range(last + pd.offsets.MonthBegin(), periods=gap, freq="MS"), npred, nlo, nhi)
        nowcast = envelope("nowcast", "Current-month county labor projection", "experimental", "modeled",
                           "Kalman state-space projection to current month", "statsmodels UnobservedComponents",
                           "E[y_(T+h)|y_1,...,y_T]; Var[y_(T+h)|Y_T] from Kalman prediction",
                           "Projects lagged official county unemployment data to the current month; no contemporaneous external signals are available.",
                           source_ids, [requirement("County monthly series", True, str(last.date())),
                                        requirement("Higher-frequency contemporaneous signals", False, "No permits, traffic, sales or search feed")],
                           limits + ["This is a univariate current-month projection, not a mixed-frequency nowcast."],
                           {"target": "Morris County unemployment rate", "unit": "percent",
                            "asOfMonth": str(current.date()), "observedThrough": str(last.date()),
                            "informationSet": "Published county LAUS observations only; no current-month covariates",
                            "monthsBeyondObservation": gap, "intervalLevel": 0.9, "estimate": path[-1],
                            "path": path, "stateSpaceModel": ndiag})
    rows = labor_anomalies(series)
    anomalies = envelope("anomalies", "County labor early-warning screen", "experimental", "modeled",
                         "Past-only seasonal residual MAD and empirical-tail screening", "NumPy, statsmodels multiple testing",
                         "e_t=y_t-y_(t-12); score=(e_t-median(e_past))/(1.4826 MAD(e_past))",
                         "Robust residual scores use only prior seasonal differences; empirical tail ranks receive BH correction within the displayed family.",
                         source_ids, [requirement("Historical monthly residual calibration", True, "Up to 120 preceding seasonal differences")],
                         ["Robust score magnitude is a screening statistic, not a calibrated Gaussian z-score.",
                          "Empirical p-values require exchangeability; serial dependence and regime changes weaken that approximation.",
                          "No alert is a recession classification or a prediction of business closure.",
                          "Absence of a flag does not establish economic stability; finite calibration samples limit p-value resolution."],
                         {"target": "County unemployment seasonal residual", "unit": "percentage points",
                          "threshold": 3, "calibrationCount": rows[-1]["calibrationCount"],
                          "observations": rows, "alerts": [r for r in rows if r["flagged"]],
                          "falseDiscoveryRate": 0.05,
                          "interpretation": "Red alerts require BH q<=0.05; |MAD score|>=3 is a separate unconfirmed screening flag."})
    return forecast, nowcast, anomalies


def graph_statistics(graph):
    positions = nx.spring_layout(graph, seed=731, iterations=100, weight="weight")
    between = nx.betweenness_centrality(graph, weight="distance", normalized=True)
    if graph.number_of_edges():
        communities = nx.community.louvain_communities(graph, seed=731, weight="weight")
    else:
        communities = [{n} for n in graph]
    labels = {node: i for i, group in enumerate(communities) for node in group}
    return positions, between, labels


def directory_network(snapshot):
    businesses = snapshot.get("businesses", [])
    graph = nx.Graph()
    graph.add_nodes_from(b["id"] for b in businesses)
    edges = []
    for i, a in enumerate(businesses):
        for b in businesses[i + 1:]:
            same = bool(a.get("industry") and a["industry"] == b.get("industry"))
            distance = None
            if all(isinstance(v, (int, float)) and np.isfinite(v) for v in
                   [a.get("latitude"), a.get("longitude"), b.get("latitude"), b.get("longitude")]):
                coord = np.radians([[a["latitude"], a["longitude"]], [b["latitude"], b["longitude"]]])
                distance = float(haversine_distances(coord)[0, 1] * 6371.0088)
            nearby = distance is not None and distance <= 0.5
            if same or nearby:
                relation = "same-industry-and-proximity" if same and nearby else "same-industry" if same else "proximity-within-500m"
                edges.append({"source": a["id"], "target": b["id"], "relation": relation, "distanceKm": distance})
                graph.add_edge(a["id"], b["id"], weight=1, distance=1)
    positions, betweenness, communities = graph_statistics(graph)
    nodes = [{"id": b["id"], "label": b["name"], "industry": b.get("industry"),
              "latitude": b.get("latitude"), "longitude": b.get("longitude"),
              "x": float(positions[b["id"]][0]), "y": float(positions[b["id"]][1]),
              "degree": graph.degree(b["id"]), "betweenness": betweenness[b["id"]],
              "community": communities[b["id"]]} for b in businesses]
    return {"nodes": nodes, "edges": edges,
            "relationTypes": ["same-industry", "proximity-within-500m", "same-industry-and-proximity"],
            "coverageNote": "Public Chamber directory snapshot, 2026-07-16. Voluntary listings span multiple municipalities and counties; not a township business census. Graph edges show category/proximity only. Centrality is not economic influence."}


def build_network(cbp, snapshot):
    year = max(cbp)
    raw = pd.DataFrame(cbp[year])
    if set(raw.fipscty) != NJ_COUNTIES:
        raise ValueError("CBP matrix must contain exactly the 21 New Jersey county FIPS")
    raw["establishments"] = pd.to_numeric(raw.est, errors="coerce")
    raw["employment"] = pd.to_numeric(raw.emp, errors="coerce")
    sectors = raw[raw.sector.isin(SECTORS)].copy()
    matrix = sectors.pivot(index="fipscty", columns="sector", values="establishments")
    # Only sectors actually published for every county enter comparative denominators.
    matrix = matrix.dropna(axis=1)
    matrix = matrix.loc[:, matrix.sum() > 0]
    rca = rca_matrix(matrix.to_numpy())
    graph, proximity = specialization_network(rca)
    pos, betweenness, communities = graph_statistics(graph)
    morris = list(matrix.index).index("027")
    counts = matrix.loc["027"].to_numpy()
    shares = counts / counts.sum()
    keys = list(matrix.columns)
    nodes = []
    for i, sector in enumerate(keys):
        record = sectors[(sectors.fipscty == "027") & (sectors.sector == sector)].iloc[0]
        nodes.append({"id": sector, "label": SECTORS[sector], "establishments": counts[i],
                      "employment": record.employment, "employmentNoiseFlag": record.get("emp_nf"),
                      "share": shares[i], "rca": rca[morris, i], "degree": graph.degree(i),
                      "weightedDegree": graph.degree(i, weight="weight"), "betweenness": betweenness[i],
                      "community": communities[i], "x": pos[i][0], "y": pos[i][1]})
    counties = []
    for i, (county, row) in enumerate(matrix.iterrows()):
        p = row.to_numpy() / row.sum()
        counties.append({"fips": "34" + county, "name": "Morris County" if county == "027" else "NJ county " + county,
                         "establishments": row.sum(), "diversity": int((rca[i] >= 1).sum()),
                         "entropy": float(-np.sum(p[p > 0] * np.log(p[p > 0])))})
    entropy = float(-np.sum(shares[shares > 0] * np.log(shares[shares > 0])))
    annual = []
    for y, records in sorted(cbp.items()):
        row = next(r for r in records if r["fipscty"] == "027" and r["naics"] == "------")
        annual.append({"year": y, "establishments": int(row["est"]), "employment": int(row["emp"]),
                       "payrollThousands": int(row["ap"]), "employmentNoiseFlag": row.get("emp_nf"),
                       "payrollNoiseFlag": row.get("ap_nf")})
    excluded_sectors = sorted(set(SECTORS) - set(keys))
    excluded_morris = sectors[(sectors.fipscty == "027") & sectors.sector.isin(excluded_sectors)]
    result = {"year": year, "measure": "Employer establishment counts", "referenceGeography": "New Jersey counties, complete published sectors",
              "nGeographies": len(matrix), "nodes": nodes,
              "edges": [{"source": keys[i], "target": keys[j], "weight": data["weight"]} for i, j, data in graph.edges(data=True)],
              "counties": counties, "concentration": {"hhi": float(shares @ shares),
              "effectiveSectors": float(1 / (shares @ shares)), "normalizedEntropy": entropy / np.log(len(shares))},
              "sectorCoverage": {"included": keys, "excluded": excluded_sectors,
                                 "includedMorrisEstablishments": int(counts.sum()),
                                 "excludedMorrisEstablishments": int(excluded_morris.establishments.sum()),
                                 "totalMorrisEstablishments": annual[-1]["establishments"],
                                 "exclusionReason": "Not published for every NJ county; missing source records are not assumed zero",
                                 "morrisEstablishmentShare": float(counts.sum() / annual[-1]["establishments"])},
              "edgeMeaning": "Co-specialization proximity: min[P(RCA_i>=1|RCA_j>=1), P(RCA_j>=1|RCA_i>=1)] across NJ counties; edges >=0.55. Association only, no supplier/customer claims.",
              "complexityReadiness": "ECI ranking withheld: 21 county rows and broad sectors are a fragile economic-complexity basis; report RCA and diversification descriptively.",
              "annualTotals": annual, "directoryNetwork": directory_network(snapshot)}
    network = envelope("network", "Industry specialization and relation networks", "ready", "observed",
                       "RCA, co-specialization graph, diversification and centrality", "NetworkX, NumPy, pandas",
                       "RCA_gi=(E_gi/sum_i E_gi)/(sum_g E_gi/sum_gi E_gi); proximity_ij=co-occurrence_ij/max(ubiquity_i,ubiquity_j)",
                       "Compares observed county industry establishment shares to a New Jersey reference and measures graph structure.",
                       [f"cbp-{y}-nj" for y in sorted(cbp)] + (["directory-snapshot"] if snapshot else []),
                       [requirement("Comparable county-sector counts", True, f"{len(matrix)} counties, {len(keys)} complete sectors"),
                        requirement("Observed transactions or worker flows", False, "No calibrated interindustry dependency")],
                       ["CBP excludes nonemployers and many public-sector activities; establishments are not firms.",
                        "Shares and RCA use only sectors published for every included county; coverage is reported explicitly.",
                        "Industry similarity and directory relations do not identify economic anchors or causal supply links.",
                        "County differences may reflect land use, size and demographics; no causal interpretation.",
                        "Annual employment is a March reference-week count; payroll is nominal, not inflation-adjusted.",
                        "2018-2023 is the fixed comparison window; no claim that 2023 is the newest release."], result)
    sector_index = keys.index("72") if "72" in keys else int(np.argmax(shares))
    adjacency = nx.to_numpy_array(graph, nodelist=range(len(keys)), weight="weight")
    scenarios = []
    for coupling in [0, 0.15, 0.3]:
        stress = conditional_diffusion(shares, adjacency, sector_index, coupling=coupling)
        scenarios.append({"coupling": coupling, "aggregateExposureShare": stress["aggregate"],
                          "spectralRadius": stress["spectralRadius"],
                          "sectors": [{"id": keys[i], "label": SECTORS[keys[i]],
                                       "directShock": stress["direct"][i], "totalShock": stress["total"][i],
                                       "weightedExposure": shares[i] * stress["total"][i]} for i in range(len(keys))]})
    sensitivity = [{"shockFraction": shock, "coupling": coupling,
                    "aggregateExposureShare": conditional_diffusion(shares, adjacency, sector_index, shock, coupling)["aggregate"]}
                   for shock in [0.1, 0.2, 0.3] for coupling in [0, 0.15, 0.3]]
    resilience = envelope("resilience", "Conditional industry exposure stress test", "experimental", "conditional",
                          "Linear network sensitivity under explicit assumed coupling", "NumPy linear algebra, NetworkX",
                          "s=(I-cW)^(-1)d; exposure=p's; 0<=c<1",
                          "Uses observed establishment shares as exposure weights and hypothetical coupling over an association graph.",
                          [f"cbp-{year}-nj"],
                          [requirement("Observed sector mix", True, f"CBP {year}"),
                           requirement("Estimated transmission coefficients", False, "Coupling 0, 0.15 and 0.30 are analyst illustration assumptions")],
                          ["Outputs are conditional exposure units, not predicted closures, employment loss, dollar impact, or GDP.",
                           "Association-graph edges are not economic transmission evidence; zero coupling is the direct-only baseline.",
                           "A linear response can overstate large shocks; these are small-shock sensitivity illustrations."],
                          {"basis": "Observed employer establishment shares in included sectors",
                           "sectorId": keys[sector_index], "sectorLabel": SECTORS[keys[sector_index]], "shockFraction": 0.2,
                           "directExposureShare": shares[sector_index] * 0.2,
                           "directExposureEquivalentEstablishments": counts[sector_index] * 0.2,
                           "assumptions": ["Illustrative 20% sector activity stress, not an estimated event probability",
                                           "Hypothetical neighbor coupling 0, 0.15, 0.30",
                                           "Equivalent-establishment units normalize exposure; they are not predicted actual closures"],
                           "scenarios": scenarios, "sensitivity": sensitivity})
    return network, resilience


def readiness_models():
    policy = envelope("policy", "Policy allocation assumptions", "blocked", "readiness",
                      "User-specified binary resource allocation", "Browser javascript-lp-solver maintained by main application",
                      "max sum_j assumed_benefit_j x_j, subject to cost, equity and risk constraints; x_j in {0,1}",
                      "The live browser policy lab solves explicit user scenarios. Python does not supply estimated causal benefits.",
                      requirements=[requirement("User costs, benefit assumptions and constraints", False, "Configured in the browser policy lab")],
                      limitations=["An optimizer chooses under its inputs; it does not validate intervention effectiveness.",
                                   "No synthetic proposal benefits are written into observed model results."])
    survival = envelope("survival", "Business survival readiness", "blocked", "readiness",
                        "Kaplan-Meier with optional delayed entry", "statsmodels.duration.SurvfuncRight",
                        "S(t)=product_(t_j<=t)(1-d_j/n_j)",
                        "Reusable right-censored survival estimator is implemented and tested on synthetic fixtures only.",
                        requirements=[requirement("Business opening and verified closure dates", False, "Directory presence is not survival history"),
                                      requirement("Censoring dates and delayed-entry records", False, "Must distinguish closure from missing or unlisted"),
                                      requirement("Representative business cohort", False, "Voluntary Chamber members are selected")],
                        limitations=["No observed survival estimates are published.",
                                     "Independent censoring is required; membership renewal dates cannot substitute for business closure.",
                                     "Cox and competing-risk models need more covariates and events than this snapshot provides."])
    causal = envelope("causal", "Causal policy evaluation readiness", "blocked", "readiness",
                      "Common-adoption panel difference-in-differences", "statsmodels OLS with unit-clustered covariance",
                      "Y_it=alpha_i+lambda_t+beta(Treated_i * Post_t)+epsilon_it",
                      "Reusable balanced-panel estimator with common treatment timing, unit/time effects and clustered uncertainty; tested on synthetic fixtures only.",
                      requirements=[requirement("Defined intervention and adoption date", False, "No identified intervention in observed data"),
                                    requirement("Measured outcome and comparison panel", False, "At least 3 pre and 2 post periods; 10 treated and 10 control units enforced"),
                                    requirement("Defensible identification", False, "Parallel trends, no anticipation, no interference, stable composition")],
                      limitations=["No causal effect is estimated from the current snapshot.",
                                   "Parallel trends is an assumption, not established by a nonsignificant pretrend test.",
                                   "Staggered adoption is rejected; this estimator is not a general heterogeneous-treatment TWFE solution.",
                                   "Twenty clusters is a minimum guard, not assurance of calibrated inference; small-cluster bootstrap may be needed."])
    return policy, survival, causal


def export_observations(acquisition, labor, cbp, tracts):
    source_map = {s["id"]: s for s in acquisition.sources}
    fields = ["indicator_id", "indicator_name", "domain", "unit", "geography_id", "geography_name",
              "geography_type", "geography_vintage", "period_start", "period_end", "frequency", "value",
              "status", "source_id", "source_name", "source_url", "release_key", "release_date", "retrieved_at",
              "margin_of_error", "method", "quality_flags"]
    records = []

    def add(source_id, **values):
        source = source_map[source_id]
        records.append({"source_id": source_id, "source_name": source["name"], "source_url": source["url"],
                        "release_key": source_id + ":" + source["sha256"][:12], "release_date": "",
                        "retrieved_at": source["retrievedAt"], "status": "observed", "quality_flags": "[]", **values})

    for name, frame in labor.items():
        for row in frame.to_dict("records"):
            start = pd.Timestamp(row["date"])
            add(row["sourceId"], indicator_id="laus_" + name, indicator_name="County " + name,
                domain="labor", unit="percent" if name == "unemployment_rate" else "persons",
                geography_id="05000US34027", geography_name="Morris County, NJ", geography_type="county",
                geography_vintage="BLS LAUS source geography", period_start=row["date"],
                period_end=str((start + pd.offsets.MonthEnd()).date()), frequency="monthly",
                value=row["value"] if pd.notna(row["value"]) else "", status="observed" if pd.notna(row["value"]) else "missing",
                quality_flags=json.dumps(row["footnotes"] + ["not_seasonally_adjusted", "latest_vintage"]),
                method="Direct source observation")
    for year, rows in cbp.items():
        for row in rows:
            if row["fipscty"] != "027" or row["naics"] != "------":
                continue
            for col, label, unit in [("est", "establishments", "establishments"), ("emp", "employment", "persons"), ("ap", "annual_payroll", "USD_thousands_nominal")]:
                add(f"cbp-{year}-nj", indicator_id="cbp_" + label, indicator_name="County CBP " + label,
                    domain="industry", unit=unit, geography_id="05000US34027", geography_name="Morris County, NJ",
                    geography_type="county", geography_vintage="CBP source-year geography",
                    period_start=f"{year}-01-01", period_end=f"{year}-12-31", frequency="annual",
                    value=row[col], method="Direct county total", quality_flags=json.dumps(["employer_businesses_only", "employment_March_reference_week"] + ([row.get("emp_nf", "")] if col == "emp" else [])))
    if tracts is not None:
        for row in tracts.to_dict("records"):
            for field, indicator, unit in [("income", "B19013001", "USD_2024"), ("povertyPopulation", "B17001001", "persons"),
                                            ("povertyCount", "B17001002", "persons"), ("adultPopulation", "B23025001", "persons"),
                                            ("employed", "B23025004", "persons")]:
                value = row[field]
                add("acs2024-tracts", indicator_id=indicator, indicator_name=field, domain="household_context", unit=unit,
                    geography_id=row["geoid"], geography_name=row["name"], geography_type="tract", geography_vintage="2024",
                    period_start="2020-01-01", period_end="2024-12-31", frequency="five_year_pooled",
                    value=value if pd.notna(value) else "", status="observed" if pd.notna(value) else "missing",
                    margin_of_error=row[field + "Moe"] if pd.notna(row[field + "Moe"]) else "",
                    method="Direct ACS estimate", quality_flags=json.dumps(["ACS_90pct_MOE", "five_year_pooled"]))
    with (DATA / "observations.csv").open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(records)
    return len(records)


def build(refresh=False, offline=False):
    acquired = Acquisition(refresh=refresh, offline=offline)
    as_of = date.today().isoformat()
    snapshot_path = ROOT / "public" / "economy" / "source-snapshot.json"
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8")) if snapshot_path.exists() else {}
    models = {}
    labor = {}
    for indicator in ["unemployment_rate", "employment"]:
        print(f"Acquiring {indicator}", flush=True)
        labor[indicator] = acquired.labor(indicator, date.today().year)
    print("Fitting rolling-origin forecasts", flush=True)
    models["forecast"], models["nowcast"], models["anomalies"] = build_labor(labor["unemployment_rate"], as_of)
    print("Acquiring tract estimates and geometry", flush=True)
    tracts = None
    try:
        acs, geo = acquired.tracts()
        export_tract_boundaries(geo)
        tracts = tract_frame(acs, geo)
        models["health"] = build_health(tracts)
        print("Running spatial permutations", flush=True)
        models["spatial"] = build_spatial(tracts)
    except (requests.RequestException, ValueError) as exc:
        acquired.errors.append({"source": "tract-models", "error": str(exc)})
        for key in ["health", "spatial"]:
            models.setdefault(key, envelope(key, key.title(), "blocked", "readiness", "Tract analysis", "scikit-learn / NumPy",
                                             "", "Observed data failed eligibility", requirements=[requirement("Valid tract inputs", False, str(exc))]))
    print("Building industry and relation networks", flush=True)
    cbp = acquired.cbp()
    if not cbp:
        raise RuntimeError("No usable CBP year acquired")
    if snapshot:
        acquired.sources.append({"id": "directory-snapshot", "name": "Public Chamber directory snapshot",
                                 "url": "https://memberservices.membee.com/feeds/directory/directory/action/Directory/cid/1193/id/601",
                                 "retrievedAt": None, "observationStart": snapshot["directorySnapshotDate"],
                                 "observationEnd": snapshot["directorySnapshotDate"], "geography": "Mixed directory footprint",
                                 "frequency": "snapshot", "variables": ["industry", "latitude", "longitude"],
                                 "sha256": hashlib.sha256(snapshot_path.read_bytes()).hexdigest(),
                                 "cachePath": "public/economy/source-snapshot.json", "releaseDate": None,
                                 "notes": ["Snapshot as-of date supplied by repository; original retrieval timestamp unavailable.",
                                           "SHA256 covers the shared source snapshot; graph uses only businesses."]})
    models["network"], models["resilience"] = build_network(cbp, snapshot)
    models["policy"], models["survival"], models["causal"] = readiness_models()
    count = export_observations(acquired, labor, cbp, tracts)
    result = {"schemaVersion": "1.0.0", "generatedAt": utc_now(), "asOfDate": as_of,
              "sources": acquired.sources,
              "coverage": {"geography": {"name": "Morris County, New Jersey", "fips": "34027",
                                          "scopeNote": "County labor/CBP, county-wide ACS tracts, and a separately selected multi-county Chamber directory footprint."},
                           "observedDataOnly": True,
                           "vintagePolicy": "Observed input values only; modeled results and hypothetical scenarios explicitly typed. Data are latest-vintage snapshots acquired at source-specific times, not reconstructed real-time vintages.",
                           "warnings": ["Never interpret these outputs as local GDP growth.",
                                        "ACS is a pooled 2020-2024 sample; CBP comparison window is 2018-2023; LAUS has its own monthly availability.",
                                        "October 2025 county LAUS is missing in BLS because of the lapse in appropriations.",
                                        "Existing Chamber categories are directory labels, not verified NAICS classifications."],
                           "acquisitionErrors": acquired.errors, "observationExportRows": count,
                           "tractBoundaryUrl": "/economy/tracts.geojson" if tracts is not None else None,
                           "laborObservedThrough": models["forecast"]["result"]["observedThrough"],
                           "runtimeVersions": {p: importlib.metadata.version(p) for p in ["numpy", "scipy", "pandas", "statsmodels", "scikit-learn", "networkx", "shapely"]}},
              **models}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(clean_json(result), indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)}; {count} raw observation rows", flush=True)
    print({k: v["status"] for k, v in models.items()}, flush=True)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="Download new source snapshots; updates retrieval dates and hashes")
    parser.add_argument("--offline", action="store_true", help="Require cached source responses and make no network calls")
    args = parser.parse_args()
    build(refresh=args.refresh, offline=args.offline)
