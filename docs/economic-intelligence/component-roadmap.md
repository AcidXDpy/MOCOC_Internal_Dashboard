# Seven Components, Built for Complementary Depth

Companion to [sections 18-20 of the technical design](technical-design.md). Status checked against the parallel integration's `research/INTERFACE.md` and `public/economy/model-results.json` on 2026-09-07; this documentation task does not claim to implement or independently rerun those engines. The current forecast targets **Morris County unemployment rate**, not GDP. Its output reports a weaker final-holdout result than seasonal naive; a more elaborate model has not demonstrated superiority.

Scores below are design judgments on 1-10. Scientific defensibility is conditional on the listed evidence gates, not a rating of already established conclusions. Difficulty includes data reconciliation and validation. "Wow factor" means explanatory/research value, not animation. Build times are incremental focused engineering/research effort after usable data arrive, assuming one experienced developer; external acquisition can dominate elapsed time. Work already implemented is credited rather than scheduled for needless replacement.

## C1. County Labor Inference and the Future Spatial Dynamic Signature

**Research question:** Can a model predict current/future county labor conditions more accurately and with better uncertainty than strong simple baselines, and does additional regional/spatial information improve it?

**Mathematical formulation:** The operational univariate family is $y_t=\ell_t+s_t+\epsilon_t$, $\ell_t=\ell_{t-1}+b_{t-1}+\eta_t$, $b_t=b_{t-1}+\zeta_t$, with seasonal component $s_t$ and missing-observation handling. The proposed signature adds $y_{j,r}=\mathcal H_{j,r}(\lambda_j f+\kappa_jF)+\epsilon_{j,r}$ and $f_t=(\phi I+\psi W)f_{t-1}+bF_t+\eta_t$, subject to identifiability/stability constraints in section 19.

**Data required:** Acquired Morris LAUS employment/unemployment-rate history, January 2000-July 2026, one explicit missing month. Next acquire all-NJ/selected adjacent-county monthly history, QCEW and genuinely distinct development/workplace signals, source-release metadata and future prediction archive. ACS household context is slow context, not extra monthly observations.

**Statistical method:** Seasonal naive/last-value/local-trend/SARIMA benchmarks, rolling origins and final holdout; univariate state-space projection now. Later conventional dynamic factor, then hierarchical spatial extension only after incremental value is shown.

**Implementation steps:** Audit source grid/units; retain missing observations; compare horizons separately; publish strongest defensible baseline alongside challenger; log real predictions/releases prospectively; expand panel; derive mixed-frequency measurement operators; test nonspatial factor; add one spatial mechanism; evaluate and promote by gate. Current-month extrapolation without contemporaneous signals remains an experimental projection.

**Python/R libraries:** statsmodels, NumPy/SciPy, pandas; optional PyMC/Stan and ArviZ for the mature hierarchy. Existing fitted implementation should be preserved when its contract is correct.

**Validation methodology:** Nested chronological selection, untouched final holdout, MAE/RMSE/interval score and coverage by horizon, state-space convergence, naive comparison, break sensitivity. Actual latest-vintage backtests are retrospective/pseudo-real-time, not vintage. Add withheld-county tests and source/weight ablations for the signature. Parameter/structural-break uncertainty absent from current nominal bands is a limitation, not a passed calibration check.

**Visualization:** Observations, forecast fan, current-month projection, baseline losses, information cutoff and later release-news decomposition.

**What a user learns:** What county unemployment is estimated to be, the strength of supporting information, whether the model beats a simple rule, and which future observations could change the estimate. An unemployment-rate change is in percentage points unless a relative-percent transformation is explicitly requested.

**Technical difficulty:** 5/10 baseline; 9/10 hierarchical signature.

**Scientific defensibility:** 9/10 for correctly labeled baseline comparisons; 8/10 for signature only after gates. Predictive superiority is presently unestablished.

**Wow factor:** 8/10 baseline with honest evaluation; 10/10 mature signature.

**Time-to-build relative to value:** Current implementation exists; allow 1-2 weeks for audit/prospective logging and horizon calibration, 6-10 weeks for a serious signature prototype after the multivariate panel exists. Highest initial value per week.

## C2. Spatial Context and Exposure-Adjusted Economic Intensity

**Research question:** Where are observed economic outcomes spatially patterned, and which areas differ from expected outcomes given exposure and context?

**Mathematical formulation:** Current context uses PCA and $I=(G/S_0)(z'Wz)/(z'z)$. Later count model:

$$
Y_{gt}\sim\operatorname{NegBin}(\mu_{gt},\kappa),\qquad
\log\mu_{gt}=\log E_{gt}+X_{gt}\beta+u_g+v_g+\delta_t.
$$

For a continuous SDM outcome use $y=\rho Wy+X\beta+WX\theta+\epsilon$ with direct/indirect impacts from $(I-\rho W)^{-1}(\beta_kI+\theta_kW)$.

**Data required:** Acquired ACS 2024 Morris tract estimates/boundaries, 105 eligible tracts in the inspected output. Next LODES annual workplace measures, parcel/commercial support, appropriate exposure, harmonized historical boundaries. Closure-risk models need verified establishments at risk and observed events.

**Statistical method:** Current household-context PCA and conditional/global Moran permutation/LISA FDR; exploratory residential context. Later pooled spatial count effects/SLX and carefully identified spatial regressions. GWR/KDE remain diagnostics where coverage supports them.

**Implementation steps:** Preserve eligible/excluded tract ledger; verify row-standardized graph/representative points; report mixed PCA loadings and no health score; test neighbor choices; harmonize annual workplace outcomes; compare nonspatial versus spatial models; compute calibrated exceedance maps with exposure and uncertainty.

**Python/R libraries:** GeoPandas, Shapely, pyproj, libpysal/esda/spreg; PyMC/Stan for BYM2/count extensions. Do not require a database migration just to estimate spatial dependence offline.

**Validation methodology:** Null simulations/permutations with explicit exchangeability, multiplicity sensitivity, alternate k/contiguity/travel weights, source MOE sensitivity, spatial-block holdouts, predictive residual maps, prior sensitivity and exposure sensitivity. Current independent MOE perturbation is a sensitivity experiment, not a full survey-error correction. PCA explained variance does not validate health.

**Visualization:** Household-context inputs/loadings, income association map, then observed/predicted/residual commercial-intensity maps with uncertainty and coverage.

**What a user learns:** Whether a residential/context pattern is unusual under a chosen spatial null; later, where measured outcomes differ conditionally from comparable areas. It does not prove neighborhood effects on individual firms or causal spillovers.

**Technical difficulty:** 6/10 current exploration; 8/10 calibrated spatial panel.

**Scientific defensibility:** 8/10 for conditional descriptive results; 7/10 for a mature association model; causal claims separately gated.

**Wow factor:** 8/10 when uncertainty and mechanisms of spatial support are inspectable.

**Time-to-build relative to value:** Current maps/calculations exist; 1-2 weeks for audit, 3-5 weeks after actual annual outcome/exposure acquisition for the spatial engine. High value; local survival hotspots must wait.

## C3. Industry Structure, Commuting Networks and Falsifiable Complexity

**Research question:** How specialized/diversified is the region, which observed relationships connect areas, and does complexity explain anything beyond size and ordinary composition?

**Mathematical formulation:** $RCA_{gs}=(X_{gs}/X_{g+})/(X_{+s}/X_{++})$; $H_g=-\sum_s p_{gs}\log p_{gs}$; $T=D_d^{-1}MD_u^{-1}M'$ for a proposed ECI-like eigenvector. For commuting exposure, $P_{gh}=F_{gh}/\sum_kF_{gk}$ has a measured OD-flow meaning distinct from similarity.

**Data required:** Acquired 2018-2023 NJ county CBP, 21 counties and 16 common sectors in the current comparison. Next NES universe, QCEW sector employment and LODES OD/WAC, plus richer stable sector detail where not suppressed. Directory graph remains a selected sample.

**Statistical method:** Current RCA/share/entropy/centrality and specialization-similarity graph. Later measured commuting graph, bipartite degree-aware nulls, probabilistic specialization and complexity only with stable eigenspaces and held-out incremental value.

**Implementation steps:** Freeze complete-sector universe and show omitted coverage; verify column/row totals and NAICS versions; separate graph layers; compute simple metrics first; ingest OD and define flow direction; compare graph/threshold choices; test complexity predictions of subsequent sustained industry emergence; discard complexity if unstable or redundant.

**Python/R libraries:** pandas/DuckDB as useful, NumPy/SciPy, NetworkX; optional igraph/Leiden for reproducible communities, scikit-learn/statsmodels for prediction comparisons.

**Validation methodology:** Verify marginal identities, denominator sensitivity, suppression and industry aggregation; perturb input/edges; repeat community seeds/resolution; degree-preserving nulls; leave-county/time holdouts for emergence; compare income/size/LQ/diversity baselines. Current 21 x 16 broad-sector structure is informative descriptively but thin for a strong local complexity interpretation.

**Visualization:** Sector-incidence/RCA heatmap, composition bars, commuting matrix/access map, graph with explicit edge legend, rank/threshold sensitivity.

**What a user learns:** What the region specializes in and depends on under a measured definition; whether a sophisticated structural summary has measurable incremental information. A central similarity node is not a measured supplier or economic anchor.

**Technical difficulty:** 6/10 descriptive/OD engine; 8/10 credible complexity research.

**Scientific defensibility:** 9/10 descriptive shares with coverage; 6/10 complexity until predictive/robustness tests pass.

**Wow factor:** 8/10 for interpretable measured networks; 9/10 if complexity survives falsification.

**Time-to-build relative to value:** Current structure exists; 2-4 weeks for commuting and uncertainty, 3-5 additional weeks for complexity research. Prioritize measured OD over ornate graph layout.

## C4. Development Evidence, Project Transitions and Count Forecasting

**Research question:** Do verified development events and project progression help explain/forecast authorized activity or eventual occupancy?

**Mathematical formulation:** For permit count $Y_{gt}$, $\log\mu_{gt}=\log E_{gt}+\alpha_g+s_t+\beta'X_{g,t\mid a}+\ell_{gt}$, $Y_{gt}\sim\operatorname{NegBin}(\mu_{gt},\kappa)$, with publication-available project features. Project transition hazards can estimate time from approval to occupancy after stage history exists.

**Data required:** DCA microdata and audited Reporter summaries with real local coverage/history; project IDs, stage dates, published planning documents, evidence spans and verified occupancy. SQLite/ACS ingestion and evidence-span extraction are reported in integration; they do not establish a complete permit/project history by themselves.

**Statistical method:** Rules/NER and TF-IDF classification baseline, reviewed structured extraction, deduplicated event ledger, seasonal negative-binomial/state-space counts; later project-duration model.

**Implementation steps:** Audit DCA schema/local codes/retention; reconcile reports; archive documents with publication date/hash; label stratified gold set; extract parcel/project/date/status/units with spans; review and deduplicate; derive as-of features; fit no-text/structured-only/text-enhanced count models; evaluate economic and workflow value.

**Python/R libraries:** Existing warehouse/parsers, standard text parsing and PDF/OCR where needed, scikit-learn, statsmodels; optional constrained extraction model only after baseline audit. No vector database requirement.

**Validation methodology:** Project/time split, span and field accuracy, numeric/unit/negation checks, rare-class precision/recall, stage-confusion and duplication rates, measured review time, count deviance/interval score, rolling-origin incremental forecast tests. No assumed historical release times for modern document downloads.

**Visualization:** Evidence-linked project timeline, proposed/approved/permitted/occupied funnel with unmatched status, authorized-area/count forecast, source-coverage timeline.

**What a user learns:** What is actually proposed or authorized, what progresses, what remains uncertain and whether documents contain useful leading information. Authorized value is not realized investment or GDP.

**Technical difficulty:** 7/10, mostly source/event semantics.

**Scientific defensibility:** 8/10 for reviewed measured events; 7/10 for forecast extension after sufficient history.

**Wow factor:** 9/10 when a chart point opens the exact supporting source span.

**Time-to-build relative to value:** 2-3 weeks acquisition/annotation audit, 3-5 weeks for a validated event/count path. Retention gaps may force prospective data collection; in that case publish the evidence ledger while forecasts wait.

## C5. Establishment Survival and Competing Risks

**Research question:** What is the probability an operating establishment survives another 1/3/5 years, conditional on industry, age and observed local context?

**Mathematical formulation:** $h_i(t)=h_{0,s(i)}(t)\exp(X_i(t)'\beta+b_{g(i)})$; conditional survival $S_i(t+h)/S_i(t)$; interval event likelihood $S_i(L)-S_i(R)$ divided by survival at delayed entry where relevant. Competing-cause incidence is $F_k(t)=\int_0^tS(u-)h_k(u)\,du$.

**Data required:** Dated establishment population/risk-set enumeration including nonmembers, verified openings/closures/relocations, inspection/censoring dates and location/industry spells. Current reusable Kaplan-Meier engine is gated; no observed cohort survival output is asserted.

**Statistical method:** Start delayed-entry Kaplan-Meier and cause-specific cumulative incidence; then compact penalized Cox/AFT or hierarchical discrete-time hazard. Do not jump to individual Bayesian risk predictions without events.

**Implementation steps:** Define identity/event rules; audit retrospective coverage; begin prospective cohort; adjudicate apparent disappearances; generate risk sets; fit descriptive curves; simulate covariate model identifiability; fit only if gate passes; evaluate horizon-specific predictions and censoring assumptions.

**Python/R libraries:** Existing tested KM code; lifelines/scikit-survival, optional PyMC or R survival tools for justified interval/multistate models.

**Validation methodology:** Event counts and follow-up distribution, censoring/selection sensitivity, PH checks, temporal/geographic holdouts, Brier/calibration at eligible horizons, competing-risk identities, entity-link perturbations. Test fixtures validate estimators, not local data or causal claims. Fewer observed events may justify only a pooled curve or no published curve.

**Visualization:** Cohort survival/cumulative-incidence curves, at-risk table, censoring bands, interval-event evidence; aggregate privacy-preserving comparisons.

**What a user learns:** Measured survival experience and conditional associations for a defined cohort. No claim that changing a neighborhood covariate will cause the predicted survival improvement.

**Technical difficulty:** 7/10 model, 9/10 cohort construction.

**Scientific defensibility:** 8/10 after event/risk-set gates; presently no local estimate is defensible from directory history.

**Wow factor:** 9/10 with a real longitudinal ecosystem dataset.

**Time-to-build relative to value:** 3-6 weeks after adequate data arrive, but credible long-horizon outcomes may require years of observation or independently verified historical records. Do not fabricate history to accelerate delivery.

## C6. One Identified Policy Study

**Research question:** Did one documented disruption/development/policy change an observed local outcome relative to a credible untreated counterfactual?

**Mathematical formulation:** $ATT(g,t)=E[Y_t(1)-Y_t(0)\mid G=g]$; a common-adoption two-period contrast is $\tau=\Delta\bar Y_T-\Delta\bar Y_C$. Use group-time methods for staggered adoption rather than automatically extending common-adoption TWFE.

**Data required:** Verified treatment/adoption/announcement dates, stable pre/post outcome panel, assignment/exposure rules, plausible controls, covariates and concurrent-event history. Current common-adoption DiD engine rejects unsupported designs and remains gated. Its minimum-unit/period checks are computational guards, not proof of identification/power.

**Statistical method:** One prespecified DiD/event study or synthetic-control design with direct/spillover estimand. Matching can support overlap; RD/IV only when actual institutions supply defensible variation.

**Implementation steps:** Select event by institutional credibility, not observed effect size; write design/DAG/estimand; audit measurement and donor exposure; assess prehistory/power; lock treatment/control choices and holdout; estimate appropriate effects; run placebo/sensitivity/inference checks; publish the design and limitations, including failure to identify.

**Python/R libraries:** Existing tested common-adoption engine for eligible design; R `did` for staggered heterogeneous effects; statsmodels for design-specific regressions; appropriate synthetic-control implementation after method review.

**Validation methodology:** Balance/overlap, pretreatment fit and economically meaningful trend deviations, anticipation, controls' spillover exposure, placebo units/dates, alternative windows/buffers, treatment-level inference, confounding sensitivity. No p-value can validate exclusion/parallel trends. Few treated areas may require case-study restraint.

**Visualization:** Event-study effect intervals, raw treated/control trajectories, donor weights/placebos, exposure and spillover rings, study evidence.

**What a user learns:** A study-specific effect under explicit assumptions, its range and limits; not a generic causal score for every map change.

**Technical difficulty:** 9/10 for design and defensible interpretation.

**Scientific defensibility:** 8/10 when institutional and data gates hold; unavailable otherwise.

**Wow factor:** 10/10 for one credible local study, even with an uncertain or null effect.

**Time-to-build relative to value:** 4-8 weeks after an eligible event/outcome panel is found. Stop early when identification fails; reallocating effort to better measurement has higher value than forcing causal output.

## C7. Conditional Resilience and Transparent Allocation

**Research question:** Under explicit assumptions, where is exposure concentrated and which feasible allocation best satisfies specified objectives and equity/risk constraints?

**Mathematical formulation:** Current illustrative exposure $z=(I-\gamma W)^{-1}d$, $\rho(\gamma W)<1$; binary allocation $\max\sum_kb_kx_k$ subject to $\sum_kc_kx_k\le B$, geographic floors/sector caps and $x_k\in\{0,1\}$. Robust extension maximizes worst-case benefit; measurement placement can maximize uncertainty reduction.

**Data required:** Current observed CBP sector mix/similarity and explicit assumed coupling; browser-entered hypothetical project costs/benefits/constraints. Later measured supplier/commuting exposure, actual cost capacity and causally supported benefits where obtainable. No transactions or intervention returns are presently observed by the graph.

**Statistical method:** Conditional graph sensitivity, direct-only reference, bounded scenario grid/Monte Carlo, binary optimization and Pareto/robust comparisons. A later local IO model requires distinct production/leakage assumptions; a supplier interpretation is not a label change.

**Implementation steps:** Verify matrix convention/stability; preserve exposure units; display coupling as assumed; compare zero/alternate coupling; isolate hypothetical project inputs from observed warehouse tables; solve/verify constraints; show infeasibility and alternative solutions; add value-of-information placement when measurement models exist.

**Python/R libraries:** Current TypeScript browser solver/tests; NumPy/SciPy/NetworkX for batch scenarios, SciPy MILP or Pyomo when larger problems warrant them. A small exhaustive solver can be auditable and sufficient.

**Validation methodology:** Tiny-matrix analytical cases, stability/spectral checks, no-shock/no-coupling identities, flow/unit sensitivity, independently checked feasibility/objective for small optimization cases, infeasible/zero-budget cases and scenario sensitivity. Simulation correctness is not empirical transmission validation; optimization correctness is not evidence of policy effectiveness.

**Visualization:** Direct/propagated exposure, sensitivity envelope, explicit hypothetical project table, budget/equity frontier, selected/alternative project sets and binding constraints.

**What a user learns:** Which assumptions drive a result, where observed concentration creates exposure, and how policy preferences constrain choices. "Equivalent establishment exposure" is a scenario scaling unit, never a predicted count of business closures.

**Technical difficulty:** 6/10 transparent scenario/solver; 9/10 empirical response calibration.

**Scientific defensibility:** 9/10 as clearly conditional mathematics; 3/10 as an empirical economic-impact forecast without new evidence, so that claim is prohibited.

**Wow factor:** 8/10 when choices and tradeoffs are inspectable.

**Time-to-build relative to value:** Current browser tools exist; 1-2 weeks for audit/sensitivity and decision-record exports, 2-4 weeks for measurement-placement/robust extensions. Calibrated policy returns are a separate research effort, not a short implementation step.

## Shared Delivery and Acceptance

Keep source/provenance, information-time filtering, measurement support and validation shared across all components. The exact dependency order appears in the final ten conclusions of [the technical design](technical-design.md). Release small but complete components: actual observations, an interpretable model, baseline/uncertainty, source drill-down and an explicit unavailable state. A reusable gated engine can be valuable delivered software without publishing an unsupported empirical result.
