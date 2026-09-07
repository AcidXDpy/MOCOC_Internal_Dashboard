# Local Economic Intelligence: Technical Design

Design date: 2026-09-07. Scope: Mount Olive's local economy in its wider Morris County/New Jersey economic setting. The Chamber is the institutional host, not the statistical population.

This document answers all 20 sections of the supplied brief. Read with the [source acquisition matrix](source-acquisition-matrix.md), [implementation architecture](implementation-architecture.md), [validity and release gates](validation-and-release-gates.md), and [seven-component roadmap](component-roadmap.md). Equations define both current method families and proposed extensions; implementation status is stated separately. Numerical examples, scores, sample targets and build estimates are design judgments unless explicitly identified as observations.

### Present Implementation and Evidence

The economic platform now has 11 analysis routes at the application root and an integrated research reader. SQLite is the primary warehouse; Python computes models from acquired source caches and exports typed public results. The inspected result bundle, generated 2026-09-07, contains the following evidence boundaries. Integration can continue without treating every aspirational model as already complete.

| Area                                   | Actual present state                                                                                                                                                                                               | Claim boundary                                                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Labor data and forecasts               | Morris County LAUS employment/unemployment-rate history January 2000-July 2026; 318 published months and one explicit gap per series; county unemployment forecasts and rolling/final-holdout comparisons computed | Latest-vintage retrospective comparisons, not vintage backtests. State-space forecast loses to seasonal naive on the final holdout; superiority is unestablished.           |
| Current-month estimate                 | Univariate county unemployment projection using lagged official observations                                                                                                                                       | Experimental projection, no contemporaneous commercial signals and no mixed-frequency nowcast claim. Nominal bands are not full parameter/break uncertainty.                |
| Household context and spatial analysis | ACS 2024 Morris tract context; 105 eligible tracts in PCA and income Moran/LISA outputs; permutations, local FDR and sensitivity calculations                                                                      | Household context is not health or business vitality. PCA has mixed signs; full economic-health score remains null. Spatial associations are noncausal.                     |
| Structure/network                      | 2018-2023 CBP NJ county comparisons; graph uses 21 counties and 16 common sectors; RCA/diversity/similarity calculations                                                                                           | Similarity is not observed transactions or transmission; omitted-sector coverage matters.                                                                                   |
| Scenarios/policy                       | Conditional graph exposure and a browser binary allocation tool with hypothetical project inputs                                                                                                                   | No predicted lost businesses/jobs/GDP or identified intervention returns. A scenario is not an acquired observation.                                                        |
| Warehouse/documents                    | SQLite source/provenance schema, ACS ingestion and evidence-span workflow; Python source-cache acquisition/build path                                                                                              | The implemented orchestrator builds models, imports observations/results into SQLite, checks quality and exports an audit bundle; models still estimate from source caches. |
| Survival/causal                        | Reusable tested Kaplan-Meier/common-adoption DiD engines with gated null economic results                                                                                                                          | No observed survival cohort or identified local treatment effect. The hierarchical spatial dynamic signature remains proposed.                                              |

Scheduled GitHub recomputation is an artifact-generation workflow with review before publication, not evidence that future releases will be acquired successfully or automatically deployed. The architecture document describes the implemented orchestrator and weekly review-artifact workflow separately from richer panel/model extensions.

### Notation

Geography g, industry s, indicator j, establishment i, time t and release r have section-specific definitions; vectors/matrices are dimensioned by the relevant panel. $\operatorname{NegBin}(\mu,\kappa)$ denotes mean $\mu$ and variance $\mu+\mu^2/\kappa$. A rate in percent and its change in percentage points are distinct. All likelihoods are conditional on the stated observation frame, support and information set; mathematical notation does not establish that those inputs exist.

## 1. Redefine the Project

Build an economic observatory with three linked but distinct supports: a monthly county labor/activity panel, an annual tract-level spatial/structural panel, and a prospective verified establishment/project event panel. The platform should answer a named empirical question at a stated geography, reference period and information cutoff, with evidence and uncertainty attached. A map may connect these supports for exploration; the model must not pretend they have the same resolution.

The directory layer has **116 public directory listings**, not a census of the local economy. They include organizations outside Mount Olive, different organization types and synthetic membership lifecycle fields. There is no verified business birth/death history in those fields. Chamber membership selects on organization size, visibility, networking and willingness to join; those probabilities are unknown. Neither multiplying a sample average by a business count nor assigning arbitrary weights makes this representative. Restrict sample statements to the listings. The independently acquired county/tract sources above extend economic coverage without making this directory representative. Compare its sector/geographic composition to independent population benchmarks as a coverage diagnostic.

Define local boundaries before examining performance: township administrative boundary for local reporting; parcels or prespecified corridor polygons for local exposure; Morris County as an observed labor-market reporting unit; all NJ counties plus a documented adjacent-county extension for statistical pooling. Tracts crossing a corridor need allocation assumptions, not a relabeled tract total. Report resident welfare and workplace commercial activity separately: more jobs at a local workplace need not mean more local residents employed, and rising property values need not improve access for existing firms.

### Research Questions: 40 in Eight Groups

| Group              | ID  | Research question / defensible outcome                                                                                                         |
| ------------------ | --- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Economic structure | Q01 | Which industries account for observed workplace employment growth, separating national industry growth, local mix and local residual growth?   |
| Economic structure | Q02 | Is diversification associated with smaller subsequent employment drawdowns after controlling for starting size and composition?                |
| Economic structure | Q03 | How differently do employer-establishment and nonemployer-receipt measures describe specialization?                                            |
| Economic structure | Q04 | Does a geography-industry complexity analogue predict later diversification beyond income, size and ordinary location quotients?               |
| Economic structure | Q05 | How much does the directory's industry and geographic composition differ from external population benchmarks?                                  |
| Spatial economics  | Q06 | Where is employment or verified commercial occupancy unusually low relative to population, accessibility and land-use capacity?                |
| Spatial economics  | Q07 | Do growth residuals cluster after accounting for common shocks and neighboring-area dependence?                                                |
| Spatial economics  | Q08 | At what distance or travel time does predictive geographic dependence decay, and is that scale stable out of sample?                           |
| Spatial economics  | Q09 | Are verified closure rates clustered after conditioning on the number of establishments at risk?                                               |
| Spatial economics  | Q10 | How does access to employment and commercial centers differ across income and commuting groups?                                                |
| Business dynamics  | Q11 | What is the 1/3/5-year conditional survival probability of a verified establishment cohort by industry and local context?                      |
| Business dynamics  | Q12 | How often does apparent closure instead represent relocation, merger, rebranding or missing observation?                                       |
| Business dynamics  | Q13 | Which local characteristics predict the time from development approval to occupancy?                                                           |
| Business dynamics  | Q14 | Is establishment growth driven by entrants, incumbent expansion, relocations or source-coverage changes?                                       |
| Business dynamics  | Q15 | Do repeated corridor observations predict vacancy duration or reoccupation?                                                                    |
| Forecasting        | Q16 | Can a release-aware model improve current Morris County resident-employment estimates over a seasonal naive forecast?                          |
| Forecasting        | Q17 | Do mixed-frequency workplace and development signals improve county employment forecasts beyond LAUS history and common state conditions?      |
| Forecasting        | Q18 | Can approved-development events improve permit or occupancy forecasts beyond seasonal count models?                                            |
| Forecasting        | Q19 | How early can a persistent labor slowdown be detected at a controlled false-alert rate?                                                        |
| Forecasting        | Q20 | Do pooled spatial dynamic factors improve withheld-area and withheld-time predictions without losing interval calibration?                     |
| Networks           | Q21 | Which areas depend most on inbound commuters, and how sensitive is accessibility to transport disruption?                                      |
| Networks           | Q22 | Which employment centers are consistently central under plausible commuting-network definitions?                                               |
| Networks           | Q23 | Do industry relatedness measures predict later local industry entry beyond industry prevalence?                                                |
| Networks           | Q24 | How much do inferred economic-anchor rankings change when directory coverage, weights or edge definitions change?                              |
| Networks           | Q25 | Does a commuting-defined neighborhood improve prediction relative to geographic adjacency alone?                                               |
| Causal inference   | Q26 | Did a documented road disruption change measured activity in exposed corridors relative to credible unaffected corridors?                      |
| Causal inference   | Q27 | Did a completed commercial development change nearby verified openings, occupancy or traffic after allowing for anticipation and displacement? |
| Causal inference   | Q28 | Did a zoning or district policy alter development applications/permits relative to eligible comparison areas?                                  |
| Causal inference   | Q29 | Is there a discontinuity in outcomes at a genuine policy eligibility threshold with no sorting around it?                                      |
| Causal inference   | Q30 | Did an infrastructure opening improve accessibility and subsequently commercial outcomes, using a prespecified donor pool?                     |
| Policy             | Q31 | Which geographies combine persistent underperformance, poor access and high uncertainty, warranting investigation or better measurement?       |
| Policy             | Q32 | Which sectors/geographies are exposed under a specified employer or industry contraction, across credible leakage assumptions?                 |
| Policy             | Q33 | Which projects balance expected measurable benefits, access for underserved areas and downside risk under explicit policy weights?             |
| Policy             | Q34 | How much do policy priorities change when deprivation is measured with ACS uncertainty and alternate boundaries?                               |
| Policy             | Q35 | Which claims remain stable across economic definitions and which depend on disputed choices of welfare, growth or vitality?                    |
| Optimization       | Q36 | Where should limited traffic/vacancy measurement be placed to reduce decision-relevant uncertainty most?                                       |
| Optimization       | Q37 | Which feasible set of projects maximizes a validated outcome under budget, geographic equity and risk constraints?                             |
| Optimization       | Q38 | Where would a shared service facility minimize demand-weighted travel time without worsening access for the least-served areas?                |
| Optimization       | Q39 | What diversified intervention portfolio minimizes worst-case loss across transparent economic scenarios?                                       |
| Optimization       | Q40 | When is additional data collection more valuable than an immediate intervention under current uncertainty?                                     |

### Scored Top Ten

Scores are ordinal editorial assessments on 1-5, not fitted probabilities. M = mathematical sophistication; V = attainable statistical validity; U = usefulness; O = originality; F = feasibility after stated acquisition; P = final-product potential. Equal weights prevent silently favoring novelty over validity: `total=M+V+U+O+F+P`, maximum 30. Ties favor validity then feasibility. Feasibility includes acquisition, not only coding. Re-score after source audit; a rank does not waive an evidence gate.

| Rank | Question                                 | M   | V   | U   | O   | F   | P   | Total | Reason / limiting condition                                                         |
| ---- | ---------------------------------------- | --- | --- | --- | --- | --- | --- | ----- | ----------------------------------------------------------------------------------- |
| 1    | Q20 Spatial dynamic factor prediction    | 5   | 4   | 5   | 5   | 3   | 5   | 27    | Strong centerpiece with real pooled panel; not estimable from directory snapshots   |
| 2    | Q16 County resident-employment nowcast   | 4   | 5   | 5   | 3   | 5   | 4   | 26    | Clear observable target and baselines; revisions limit historical evaluation claims |
| 3    | Q06 Spatial underperformance             | 5   | 4   | 5   | 4   | 3   | 5   | 26    | Valuable conditional residuals; population exposure and boundary choice matter      |
| 4    | Q36 Measurement placement                | 5   | 4   | 4   | 5   | 3   | 4   | 25    | Actionable without invented treatment effects; needs honest measurement-error model |
| 5    | Q19 Calibrated early warning             | 4   | 4   | 5   | 4   | 4   | 4   | 25    | Shares forecast infrastructure; false alarms and source failures must be measured   |
| 6    | Q21 Commuting dependence                 | 4   | 4   | 4   | 4   | 4   | 4   | 24    | Public aggregate graph with interpretable edges; not a supplier graph               |
| 7    | Q18 Development-informed count forecasts | 4   | 4   | 4   | 4   | 3   | 4   | 23    | Tests the economic value of NLP; audited history and publication dates required     |
| 8    | Q11 Conditional establishment survival   | 5   | 3   | 5   | 4   | 1   | 5   | 23    | Strong later contribution, currently no population risk set or verified deaths      |
| 9    | Q26 Road-disruption effect               | 5   | 3   | 5   | 4   | 1   | 5   | 23    | Compelling if stable activity outcomes and untreated comparisons exist              |
| 10   | Q04 Local complexity's incremental value | 5   | 3   | 3   | 5   | 2   | 4   | 22    | Interesting falsifiable research; may simply reproduce size and urbanization        |

## 2. Build a Local Economic Data Warehouse

The [31-source acquisition matrix](source-acquisition-matrix.md) gives exact available variables or explicitly requested schemas, support, cadence, cost/access, joins, biases and model uses. The [architecture contract](implementation-architecture.md) defines tables and versioned pipeline behavior. These are required parts of this section, not a list of optional reading.

Maintain three panels:

| Panel                         | Unit / intended history                                                                                                                                              | What it can support                                                                 | What it cannot establish                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| County monthly / quarterly    | All 21 NJ counties, target 120-180 monthly LAUS observations per county; QCEW workplace history at native reporting frequency; adjacent counties added by prior rule | County labor conditions and workplace activity; time validation and partial pooling | Monthly tract sales, municipal GDP, independent observations from repeated national controls |
| Tract annual / multiyear      | Morris plus prespecified nearby tracts, harmonized boundaries; LODES annual workplace employment; ACS five-year contextual observations                              | Spatial structure/access, annual workplace change, measured-area pooling            | Independent annual ACS snapshots, employer births, fine-sector reliable estimates everywhere |
| Establishment / project event | Verified census/risk set including nonmembers and exits; permit/project status history; prospective observations with dates                                          | Survival, opening/closure rates, project transitions, later local policy outcomes   | Backfilled event dates from Chamber renewal fields or online listing disappearance           |

Use stable IDs for legal entity, establishment, location spell and parcel. Record joins as first-class evidence: method, score, source, reviewer and alternatives. A relocated firm creates a new location spell, not automatically a birth and death. A business can occupy several parcels; a parcel can host many businesses. Preserve many-to-many bridges instead of exploding row counts unnoticed.

Measure rate $r_{gt}=\mathrm{events}_{gt}/\mathrm{exposure}_{gt}$, where exposure is establishment-months at risk, commercial floor-area-months or population-years, depending on the outcome. The correct denominator is part of the estimand. Resident population can normalize access; it is a poor sole exposure for a highway-oriented business corridor. A zero count with zero exposure is undefined, not zero risk.

Store both valid time (when the phenomenon occurred) and information time (when it became knowable), plus retrieval time (when this system obtained it). Supersede revisions without overwriting them. Reproduce every displayed number through an immutable run ID. Never combine yearly source files solely on a `year` column: a five-year ACS window, March CBP employment, annual LODES jobs and monthly LAUS employment refer to different phenomena.

## 3. Construct an Economic Health Index

An index is a measurement model and a value judgment. Start with separate labor momentum, commercial vitality, development activity and structural diversity measures. Resilience is a response to an explicit shock or a verified historical drawdown, not a positive adjective attached to diversification. Income, rising rents and construction intensity do not have universally positive welfare signs.

Let `x_gjt` be geography g's indicator j over its proper period, with source uncertainty `s_gjt`. Orient/transform measures according to a published measurement definition, fit location/scale on a fixed training window, and retain raw units. Separate structural levels from cyclical changes; otherwise the index mainly ranks wealthy areas as healthy. Missing measures reduce coverage, not the score itself.

| Method                          | Actual formulation / use                                                                                                                               | Judgment                                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PCA baseline                    | $v_1=\arg\max_{\lVert v\rVert=1}v'\operatorname{Cov}(Z)v$, score $Zv_1$; training-only standardization and eigenvector sign fixed to a declared anchor | Maximizes variance, not health or reliability. Use as comparator; inspect loadings, bootstrap rank stability and duplicate inputs.                                          |
| Static factor / latent variable | $z_g=\Lambda f_g+\epsilon_g$, $\epsilon_g\sim N(0,R_g)$; `R_g` includes known source error plus estimated idiosyncratic variance                       | More explicit about noisy measurement than PCA; few independent geographies cannot identify many factors/loadings.                                                          |
| Dynamic factor                  | $z_t=\Lambda f_t+\epsilon_t$, $f_t=Af_{t-1}+\eta_t$ with missing observations and frequency-specific measurement operators                             | Main mature momentum family; integrates asynchronous indicators but requires a real time panel.                                                                             |
| Bayesian hierarchical factor    | $\lambda_{gj}\sim N(\lambda_j,\tau_j^2)$ with sparse/shared deviations and spatially structured local states                                           | Partial pooling and uncertainty propagation; prior domination must be quantified; detailed centerpiece in section 19.                                                       |
| Constrained composite           | $I_g=w'z_g$, $w\ge0$, $\mathbf1'w=1$; optimize validation loss plus regularization subject to domain constraints                                       | Transparent policy weights are legitimate if labeled normative. Predictive weights require a separately observed target. It is not an automatic health discovery procedure. |
| Entropy weighting               | For nonnegative comparable `p_gj`, $e_j=-\sum_g p_{gj}\log(p_{gj})/\log G$ and $w_j=(1-e_j)/\sum_k(1-e_k)$                                             | Rewards dispersion, which may be noise; depends on transformation and boundary. Sensitivity benchmark only.                                                                 |
| Autoencoder                     | Minimize reconstruction error with a bottleneck and held-out reconstruction/prediction checks                                                          | Reject for this first build. Small dependent panel plus flexible nonlinear weights sacrifices identifiability without an established nonlinear measurement need.            |

Proposed sub-indices:

| Sub-index                     | Measured content                                                                                     | Release boundary                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Labor Momentum                | Resident-employment change/trend; later distinct workplace growth target                             | County only initially; a single-series trend is called county labor conditions, not a broad factor index |
| Commercial Vitality           | Verified occupancy/visits, establishment activity and openings relative to risk set                  | Local score unavailable until stable repeated outcome coverage exists                                    |
| Industry Diversity            | Employment/establishment shares, entropy, concentration; employer and nonemployer universes separate | Annual; present explicit formulas and benchmark geography                                                |
| Development Activity/Pressure | Audited permit count, authorized floor area and project progression relative to land capacity        | Monthly/quarterly if coverage supports it; pressure has no forced positive sign                          |
| Business Resilience           | Conditional survival and/or drawdown/recovery distribution under specified shocks                    | Separate historical estimate from scenario result; unavailable where events/history absent               |

Validate an index by asking whether its proposed construct survives alternative indicators, loadings, scaling, geography, time and measurement-error draws. Compare prediction of a withheld target (for example future QCEW workplace growth or independently audited occupancy), not merely correlation with the same ingredients. Fit measurement structure only in training folds; assess out-of-period/out-of-area error and rank intervals. Check invariance of loadings across urban/suburban areas and pre/post disruption regimes. Use leave-one-source-out ablations to reveal whether a supposedly broad score is merely LAUS under a different name. The [OECD/JRC handbook](https://www.oecd.org/en/publications/handbook-on-constructing-composite-indicators-methodology-and-user-guide_9789264043466-en.html) provides the primary framework for composite sensitivity analysis; the specific validation plan here is a design choice.

If desired, map a fixed-baseline latent score to $I_{gt}=100+10(f_{gt}-\mu_{\mathrm{train}})/s_{\mathrm{train}}$; it is an index point scale, not percent growth or a percentile of prosperity. Show posterior/predictive intervals and probability of change, not spurious integer neighborhood league tables. A continuously refreshed interface is acceptable; an annual measure remains annual between releases.

## 4. Spatial Econometrics

Choose spatial support and weights before outcome-driven exploration. Let `A_gh` denote binary adjacency, $D=\operatorname{diag}(A\mathbf1)$, and $W=D^{-1}A$ for nonisolated areas. Alternatives include k-nearest neighbors, a prespecified distance threshold or lagged commuting shares. Record islands, self-weights, CRS, bandwidth and normalization. A travel-time graph encodes a different hypothesis from queen contiguity. Distances/areas require an appropriate projected CRS and explicit units, not longitude/latitude degrees or display-map pixel distances.

### Dependence and Hotspots

For centered values $z_g=y_g-\bar y$, $S_0=\sum_{g,h}w_{gh}$:

$$
I=\frac{G}{S_0}\frac{z'Wz}{z'z},\qquad
I_g=\frac{z_g}{m_2}\sum_h w_{gh}z_h,\quad m_2=G^{-1}\sum_g z_g^2.
$$

Global Moran's I tests spatial pattern relative to a specified null, not causation. Local Moran distinguishes high-high, low-low and outlier configurations. Permuting raw rates with unequal exposures is generally inappropriate; use conditional simulations from an exposure-adjusted null or carefully justified residual permutations. Correct local multiplicity, display uncertainty and test sensitivity to weights. `esda.Moran`/`Moran_Local` are implementations, not automatic validation of exchangeability.

For Getis-Ord local `Gi*`, including the selected self-weight:

$$
G_g^*=\frac{\sum_h w_{gh}x_h-\bar x\sum_h w_{gh}}
 {s\sqrt{[G\sum_h w_{gh}^2-(\sum_h w_{gh})^2]/(G-1)}},
\quad s^2=G^{-1}\sum_h x_h^2-\bar x^2.
$$

This detects local concentrations of high/low values, unlike a high-low LISA outlier. On sparse closures, prefer calibrated count-model residuals and simulated null maps to Gaussian z-score labels. See [PySAL esda APIs](https://pysal.org/esda/stable/api.html) and [G_Local weighting conventions](https://pysal.org/esda/stable/generated/esda.G_Local.html); explicitly set star/self-weight behavior and random seed.

### Spatial Regression and Interpretation

$$
\begin{aligned}
\text{SAR: } &y=\rho Wy+X\beta+\epsilon,\\
\text{SEM: } &y=X\beta+u,\quad u=\lambda Wu+\epsilon,\\
\text{SDM: } &y=\rho Wy+X\beta+WX\theta+\epsilon.
\end{aligned}
$$

For SDM, the matrix of partial derivatives for covariate k is

$$
S_k=(I-\rho W)^{-1}(\beta_k I+\theta_k W).
$$

Mean diagonal of `S_k` is the average direct association; mean row sum minus mean diagonal is the average indirect association. `beta_k` alone is not the total spillover. Invertibility requires appropriate spectral bounds, not simply an unconstrained estimate. `Wy` is simultaneous/endogenous; OLS on the SAR equation is inconsistent under its own setup. Use appropriate ML/GMM with defensible assumptions and sensitivity, not an invented external instrument. SEM indicates residual dependence and does not itself measure economic propagation. [PySAL's spatial-lag/SDM implementation and impacts](https://pysal.org/spreg/notebooks/13_ML_estimation_spatial_lag.html) support an auditable implementation.

A spatial panel can use

$$
y_{gt}=\alpha_g+\delta_t+\rho(Wy_t)_g+
\phi y_{g,t-1}+x_{gt}'\beta+(Wx_t)_g'\theta+\epsilon_{gt}.
$$

Area/time effects remove fixed heterogeneity/common time shocks but do not establish exogeneity. Short panels with lagged outcomes incur dynamic-panel bias; overlapping ACS windows aggravate dependence. Start with a simpler fixed-effects/SLX baseline, or a hierarchical count model, before joint endogenous spatial and temporal lags. Do not fit arbitrary county-specific coefficients to 21 counties.

For openings/closures with exposure `E_gt`, use

$$
Y_{gt}\sim\operatorname{NegBin}(\mu_{gt},\kappa),\quad
\log\mu_{gt}=\log E_{gt}+\alpha+X_{gt}\beta+u_g+v_g+\delta_t.
$$

Use a scaled CAR/BYM2 spatial effect and independent heterogeneity, with proper priors and component-specific sum constraints. Check residual spatial correlation, overdispersion and calibration; model rates, not raw count hotspots. With no verified risk set, use workplace employment/permit intensity under an explicitly suitable exposure instead of claiming closure risk. [Stan's spatial case study](https://mc-stan.org/learn-stan/case-studies/icar_stan.html) explains the spatial-prior implementation.

### Local Regression and Point Patterns

GWR estimates $\beta(s)=[X'K_sX]^{-1}X'K_sy$. Bandwidth is selected inside spatial validation; effective local sample size is $n_{\mathrm{eff}}(s)=(\sum_i k_{si})^2/\sum_i k_{si}^2$. Nearby observations are still correlated. Local multicollinearity, edge instability and multiple comparisons can make coefficient maps attractive but unreliable. Treat GWR/MGWR as exploratory sensitivity, with coefficients masked where uncertainty or design rank fails; prefer pooled spatial effects for primary claims.

Point-pattern intensity can be modeled as $\lambda(s)=\exp[X(s)\beta+u(s)]$, likelihood $\sum_i\log\lambda(s_i)-\int_D\lambda(s)\,ds$. Numerical quadrature must respect the commercial-land/network support and edge effects. An observed directory pattern has intensity $\lambda_{\mathrm{obs}}(s)=q(s)\lambda_{\mathrm{economy}}(s)$ with unknown inclusion `q(s)`; its true economic intensity is not identifiable from the sample alone.

KDE $\widehat\lambda(s)=\sum_iK_h(s-s_i)/e_h(s)$ is a smoothed observed-point density with edge correction `e_h`, not a probability of economic success. Road-constrained KDE can suit corridors. DBSCAN/HDBSCAN describe density clusters but do not produce economic significance tests; select scales substantively and assess resampling stability. Inhomogeneous Poisson/Cox processes require complete or modeled observation coverage. Hawkes/self-exciting formation is deferred until long event histories distinguish contagion from shared zoning, reporting batches and common shocks.

Outputs: raw and exposure-adjusted maps side by side; LISA categories with false-discovery masks; posterior exceedance $P(\mathrm{relative\ risk}>1.2\mid\mathrm{data})$ with the threshold declared; conditional residual maps; spatial-impact interval plots; bandwidth/weight sensitivity; linked scatterplots and source coverage. Label these conditional associations unless section 9's identification requirements are met.

## 5. Business and Industry Network Analysis

Maintain separate graph layers. A proximity edge means spatial opportunity; a LODES OD edge means reported commuting flow; a verified supplier edge means a documented commercial relationship; an industry-similarity edge means statistical similarity; event co-attendance means a Chamber social connection. No graph algorithm converts one meaning into another. Shared customers/suppliers are unavailable until an authorized dataset exists. Do not infer supplier transactions from shared NAICS or language embeddings.

For an observed directed weighted graph `A`, strength is $s_i^{\mathrm{out}}=\sum_j A_{ij}$. Betweenness $b_i=\sum_{\substack{s\ne t\\s,t\ne i}}\sigma_{st}(i)/\sigma_{st}$ measures shortest-path brokerage only under the chosen path-cost interpretation. For commuting counts, inverse flow can be a similarity cost but is not physical travel time. Eigenvector centrality solves $Av=\lambda v$; PageRank solves $p=\alpha P'p+(1-\alpha)v_0$. Check direction, dangling nodes and sensitivity to teleportation/weighting. [NetworkX centrality definitions](https://networkx.org/documentation/stable/reference/algorithms/centrality.html) and [PageRank implementation](https://networkx.org/documentation/stable/reference/algorithms/generated/networkx.algorithms.link_analysis.pagerank_alg.pagerank.html) should govern reproducible calculations.

Use clustering coefficient for triadic closure, k-core for persistent dense participation, assortativity for similarity mixing relative to a degree-aware null, and structural-hole constraint $C_i=\sum_j(p_{ij}+\sum_qp_{iq}p_{qj})^2$ for brokerage under a declared relationship meaning. Louvain and Leiden optimize partition objectives; resolution and random initialization can change communities. Compare repeated seeds, co-assignment stability and degree-preserving null graphs. A central member in an incomplete directory is not an economic anchor. Publish an anchor only as an independently supported employment/access/verified relationship exposure and show rank uncertainty under missing edges.

### Local Economic Complexity

Let `X_gs` be nonsuppressed employment or establishment count in geography g, sector s, from a single consistent universe. Define

$$
RCA_{gs}=\frac{X_{gs}/\sum_kX_{gk}}{\sum_hX_{hs}/\sum_{h,k}X_{hk}},
\quad M_{gs}=\mathbf1(RCA_{gs}>1),
\quad d_g=\sum_s M_{gs},\quad u_s=\sum_g M_{gs}.
$$

The geography operator $T=D_d^{-1}MD_u^{-1}M'$ and industry operator $U=D_u^{-1}M'D_d^{-1}M$ have trivial leading eigenvectors under regular conditions. Standardize an identified nontrivial second eigenvector for an **ECI-like local specialization score**, and the counterpart for a **PCI-like sector score**. Isolated zero-degree rows/columns require removal/reporting; disconnected components and small eigengaps make cross-component rankings unstable. The [original Hidalgo-Hausmann paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC2705545/) concerns country-product capabilities inferred from trade; a local employment analogue needs new validation and should not inherit that interpretation automatically.

A business x one-primary-industry incidence matrix is nearly trivial: every business row has degree one, and projections mostly reproduce category labels. A geography x industry panel with dozens of areas and sufficiently detailed, reliably observed industries is more promising. Start with county x three-digit industries if suppression permits, not 116 members x broad categories. At tract level LODES broad industries may be too coarse to produce useful complexity rankings. Disaggregation is not automatically information.

Estimate sector relatedness $\phi_{st}=\min\{P(M_s=1\mid M_t=1),P(M_t=1\mid M_s=1)\}$; relatedness density for a missing sector is $\omega_{gs}=\sum_t\phi_{st}M_{gt}/\sum_t\phi_{st}$. Test whether `omega_gs` predicts next-period entry into sustained specialization beyond starting employment, diversity, income and sector prevalence, with all relatedness computed from training years. Threshold entry should require persistence/sensitivity to RCA cutoffs to avoid classifying noise as economic emergence.

Handle measurement uncertainty by drawing plausible shares from a hierarchical count model or source-error distribution and recomputing RCA/eigenvectors. Report probability $P(RCA>1)$ and rank intervals, including uncertainty about sign alignment/eigenvector identity. Shrinkage cannot reconstruct confidential suppressed cells for public release. Compare to entropy, HHI, employment LQ, simple diversity and a size-only model; complexity is retained only for incremental predictive value and stable interpretation.

Bipartite projections `MM'` inflate links involving ubiquitous industries. Normalize or use a degree-preserving bipartite null, and retain the original incidence heatmap. Resilience tests remove nodes/edges under explicit measured or scenario layers, tracking lost access, disconnected demand and flow rerouting, not merely an arbitrary graph connectivity score.

## 6. Business Dynamics and Survival

The outcome is closure of an operating establishment, not membership lapse or legal-entity status. Define time origin (verified opening), cohort/risk set, observation entry, closure interval and competing outcomes before fitting. Existing surviving listings create left truncation; businesses that disappeared before enumeration are absent entirely. Survival analysis handles known delayed entry, but cannot recover an unobserved population of past failures from current directory survivors.

Kaplan-Meier $\widehat S(t)=\prod_{t_k\le t}(1-d_k/n_k)$ uses the at-risk set at each event time, including delayed-entry rules. It assumes appropriately noninformative censoring conditional on the design; loss of contact related to distress violates that. If closure is only known between visits L and R, the likelihood contribution is $S(L)-S(R)$, not a point event at an invented midpoint. Right censoring contributes `S(C)`; conditioning on delayed entry a divides contributions by `S(a)`.

For a time-varying Cox model,

$$
h_i(t|X_i(t))=h_{0,s(i)}(t)\exp[\beta'X_i(t)+b_{g(i)}],
\qquad P(T_i>t+h|T_i>t)=\frac{S_i(t+h)}{S_i(t)}.
$$

Industry-stratified baselines or partial pooling can reflect different age hazards. Covariates must be known at t; future neighborhood income or a later discovered closure cannot leak into predictors. Assess proportional hazards with residual/time-interaction diagnostics; avoid interpreting hazard ratios as probability ratios. An AFT model $\log T_i=X_i\beta+\sigma\epsilon_i$ provides time-ratio interpretation and a parametric alternative when PH fails. Hierarchical discrete-time hazards can better match monthly/quarterly inspections. See [lifelines' time-varying survival implementation](https://lifelines.readthedocs.io/en/latest/Time%20varying%20survival%20regression.html).

For competing causes k (closure, relocation, acquisition with changed identity), cause-specific hazards imply

$$
F_k(t)=\int_0^t S(u-)h_k(u)du,\quad
S(t)=\exp\{-\sum_k\int_0^t h_k(u)du\}.
$$

Use Aalen-Johansen/cause-specific or carefully justified subdistribution modeling for cumulative incidence; `1-KM` treating all competing events as ordinary censoring does not estimate the real closure probability. Recurrent expansion/contraction events can use counting-process or gap-time models with establishment clustering, but define the measured event threshold consistently. Bayesian frailty models add group pooling and prior uncertainty, not identification of causal environmental effects.

A reasonable planning target is several hundred verified establishments and roughly 100-200 well-documented closure events for a compact model; this is not a universal events-per-variable law. Actual effective information depends on censoring, imbalance, covariate variation and clustering, to be evaluated by simulation. With fewer events publish pooled descriptive survival/uncertainty or stop. Five-year probabilities require observed follow-up covering that horizon or an explicitly labeled extrapolation. Validate calibration at 1/3/5 years, time-dependent Brier scores with defensible censoring weights, discrimination, subgroup calibration and geographic/temporal holdouts. Never publish individual closure-risk rankings from thin public evidence.

## 7. Economic Nowcasting

A nowcast estimates a named current-period target before its official observation is available. It is different from the latest published value, a smoothed historical latent index, or a forecast of a future period. Start with Morris County **resident employment** or **unemployment rate**, and later distinct QCEW **workplace employment**. The first can be estimated using acquired monthly LAUS history and state context; it should be called a county labor conditions model. Four algebraically linked LAUS measures are not four independent pieces of evidence for a broad economic factor.

Let `I_a` be information available by cutoff a, `s_t` a latent state and `H_(t,a)` the measurement operator including which observations were released:

$$
s_t=T s_{t-1}+B m_t+\eta_t,\quad
y_{t,a}=H_{t,a}s_t+\epsilon_{t,a},\quad
\eta_t\sim N(0,Q),\ \epsilon_{t,a}\sim N(0,R_{t,a}).
$$

Kalman prediction gives $s^-_t=Ts_{t-1\mid t-1}$, $P^-_t=TP_{t-1\mid t-1}T'+Q$; update uses $K_t=P^-_tH_t'(H_tP^-_tH_t'+R_t)^{-1}$, $s_{t\mid t}=s^-_t+K_t(y_t-H_ts^-_t)$. Missing observations remove measurement rows, not fill them with zero. Filtering uses information through the cutoff; smoothing uses subsequent observations and is not a historical nowcast.

For monthly latent workplace levels `e_m`, a quarterly average observation has $y_q=(e_{3q}+e_{3q-1}+e_{3q-2})/3+\epsilon_q$; quarterly flows instead sum. Log growth aggregation requires its own derived observation equation, not naive averaging of percentage changes. ACS five-year measurements cannot be dropped into this quarterly operator. [statsmodels DynamicFactorMQ](https://www.statsmodels.org/dev/generated/statsmodels.tsa.statespace.dynamic_factor_mq.DynamicFactorMQ.html) is a candidate for conventional mixed-frequency prototypes; the proposed spatial/hierarchical extension requires custom work and is not a built-in capability. The [New York Fed nowcast](https://www.newyorkfed.org/research/policy/nowcast/) demonstrates the release-flow concept, not validation of a local GDP model.

MIDAS alternative: $y_q=\alpha+\beta\sum_{k=0}^K w(k;\theta)x_{3q-k}+\epsilon_q$, with normalized low-dimensional beta/exponential-Almon weights and only released x. Compare to a bridge regression and a Bayesian dynamic linear model with time-varying level/slope. Every additional high-frequency input must improve a target forecast or materially reduce uncertainty in held-out data.

The current display should name **Morris County unemployment rate**, the estimate in percent, the nominal interval level, observation cutoff and experimental projection status. Changes in unemployment rate are percentage points. For a future employment-level target, an illustrative display is "Morris County resident employment: estimated year-over-year change X%, 80% predictive interval [L,U], as of DATE." Compute percent change from draws of levels, $100(E_t/E_{t-12}-1)$, so denominator uncertainty propagates. This document does not invent a numerical result; actual estimates belong to their versioned output bundle. For a latent index display "momentum +X index points," never "the local economy grew X%." County annual BEA GDP does not identify monthly township or corridor GDP.

Produce a release-news decomposition: difference between pre/post-release nowcast, attributed using forecast errors and Kalman update weights while separating parameter refits, revisions and new releases. An annual source may revise historical context without claiming a new monthly pulse. Report the contribution of common state signals versus locally observed signals and uncertainty when local data are absent.

Evaluation must distinguish three cases. Latest revised data with artificial release lags supports **pseudo-real-time** experiments. True archived values with historical public availability support **vintage** backtests. Archived predictions made by this system and evaluated after later releases support **prospective** evaluation. Do not advertise a vintage backtest simply because `as_of` exists in a newly created table. Choose whether the scored target is first release or later revised value and show both when possible.

## 8. Time-Series Forecasting

Forecast outputs with observable definitions: monthly county employed persons/unemployment rate; quarterly county workplace employment; audited monthly permit counts/area; annual sector establishments; verified vacancies/closures only after acquisition. Forecast horizons should match decisions and source cadence: 1/3/6 months for labor, 1/2/4 quarters for workplace jobs, annual for structural measures. Long horizons unsupported by the series remain unavailable.

| Model                    | Appropriate use / equation or restriction                                                    | Main risk / verdict                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Seasonal naive           | $\widehat y_{t+h}=y_{t+h-m}$ for seasonal period m; last-value benchmark otherwise           | Mandatory benchmark; model complexity must earn improvement                                              |
| ETS / local linear trend | $\ell_t=\ell_{t-1}+b_{t-1}+\eta_t$, $b_t=b_{t-1}+\zeta_t$, observation with seasonal term    | Strong small-series baseline; interval model must reflect trend and seasonal uncertainty                 |
| SARIMA / SARIMAX         | $\Phi(L^m)\phi(L)(1-L)^d(1-L^m)^Dy_t=\Theta(L^m)\theta(L)\epsilon_t+\text{regression terms}$ | Low orders, identified seasonality; no exhaustive model search across tiny holdouts                      |
| Dynamic regression       | $y_t=\beta'x_t+n_t$, n has state-space/ARIMA errors                                          | Forecasts require future x assumptions; publication delay and revisions can create leakage               |
| VAR                      | $y_t=c+\sum_{l=1}^p A_ly_{t-l}+\epsilon_t$                                                   | K variables require about K-squared p lag coefficients; short local panels cannot support broad VAR      |
| Bayesian VAR             | Same system with Minnesota/global-local shrinkage and prior sensitivity                      | Candidate only with enough history and independent series; priors do not create local variation          |
| Gaussian process         | $f\sim GP(m,k_{\mathrm{time}}+k_{\mathrm{season}})$, $y=f+\epsilon$                          | Useful smooth/seasonal comparator; long extrapolation governed by kernel, nonstationary breaks difficult |
| Count state-space        | $Y_t\sim\operatorname{NegBin}(\exp(\ell_t+\mathrm{season}_t+\beta'x_t),\kappa)$              | Preferred for sparse permits/openings; no negative count intervals                                       |
| Prophet                  | Trend/changepoints/seasonality regression with priors                                        | No priority here; cannot rescue weak history, endogenous changepoints or sparse annual data              |
| Hierarchical forecasting | Reconcile disjoint county/industry totals using a summing matrix S                           | Aggregate **levels** in compatible units; rates and overlapping geographies do not sum                   |

For base forecasts `yhat`, estimated forecast-error covariance `Omega`, coherent MinT-style reconciliation is

$$
\widetilde y=S(S'\Omega^{-1}S)^{-1}S'\Omega^{-1}\widehat y.
$$

Shrink `Omega` in limited samples; reconcile draws to propagate dependence and assess intervals. Nonnegative/count constraints may require constrained projection or a count model. Do not reconcile county LAUS residents with QCEW workplace jobs or state totals with a subset of counties while pretending it is complete. See [reconciled probabilistic forecasts](https://otexts.com/fpp3/rec-prob.html).

Use expanding/rolling origins and a final untouched chronological holdout, with nested tuning. Score each horizon in units and relative to naive: MAE, RMSE, MASE where scaling is defined, weighted interval score/CRPS and 50/80/95% coverage. Count deviance is useful for sparse events; MAPE is poor near zero. Cluster/block uncertainty estimates by time/area. Evaluate both a prespecified full history including major disruptions and a post-break window; do not remove difficult years because they harm accuracy.

An HMM uses latent `z_t` with $P(z_t=k\mid z_{t-1}=j)=p_{jk}$ and regime-specific emissions $y_t\sim N(\mu_k,\Sigma_k)$ or an appropriate count law. Five labels (expansion/stable/slowdown/contraction/recovery) are not five identifiable economic states in one short series. Start with two or three regimes only after a linear baseline fails systematically; test state persistence, initialization and label stability. Order means to address label switching where meaningful; distinguish filtered regime probability from hindsight smoothed labels. Bayesian change points or segmented trend models may be more interpretable. No regime is an official recession designation.

## 9. Causal Inference

Most dashboard comparisons are descriptive or predictive. A causal study needs a dated treatment, consistent measured outcome, plausible comparison, prespecified estimand and design-specific identification. Acquire outcome history before promising the study. A road-disruption or development event is a candidate to investigate, not a known natural experiment in Mount Olive.

For a two-period comparison, $ATT=E[Y_1-Y_0\mid D=1]-E[Y_1-Y_0\mid D=0]$ identifies the effect only under the appropriate parallel-trend and no-anticipation assumptions. In potential outcomes, the needed restriction is equality of untreated changes, not equality of starting levels. An event study can parameterize $Y_{gt}=\alpha_g+\delta_t+\sum_{k\ne-1}\tau_k\mathbf1(t-T_g=k)+X_{gt}\beta+\epsilon_{gt}$; conventional two-way-fixed-effects coefficients may mix inappropriate comparisons under staggered heterogeneous effects. Use group-time ATT methods with never/not-yet treated comparisons, such as the authors' [did implementation](https://bcallaway11.github.io/did/reference/att_gt.html).

| Candidate                   | Treatment                                                                                            | Outcome                                                                             | Control                                                                                   | Identification assumption                                                                               | Model                                                                                                    | Robustness checks                                                                                                                  | Failure modes / release decision                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Road disruption             | Verified closure extent/start/end; distance or travel-time exposure fixed before outcomes            | Stable sensor traffic/footfall or repeated commercial occupancy; not invented sales | Unaffected similar corridors with prehistory; buffer excludes diverted-traffic recipients | Parallel untreated trends; no outcome-driven timing; control not exposed; stable measurement            | Exposure-aware DiD/event study, correlated error inference                                               | Pretrend and anticipation plots; placebo dates; weather/season controls; alternate buffers; spillover ring outcomes; source uptime | Rerouting contaminates controls, emergency repair follows decline, sensor moved. No causal estimate if measurement or comparison fails |
| Completed development       | Actual opening/occupancy date; announcement and construction phases separately                       | Verified nearby operating establishments/occupancy or stable activity measure       | Matched areas with comparable prior trajectories and no competing project                 | No unobserved area-specific post shock; selection explained by prehistory; interference handled         | Event study or synthetic control for one treated area                                                    | Donor leave-one-out, pre-fit, placebo units/dates, anticipation, wider-area net effects                                            | Developer selected rising market; displaced activity counted as net gain; simultaneous road changes                                    |
| District/zoning policy      | Effective legal designation and exposure, not draft proposal                                         | Parcel applications, permits, later occupancy at correct lags                       | Comparable eligible untreated areas or not-yet treated cohorts                            | Conditional parallel trends; no sorting/anticipation that invalidates timing; no differential reporting | Group-time ATT, parcel/area aggregate study                                                              | Boundary sensitivity, composition stability, alternative donor sets, treatment-timing audit                                        | Endogenous designation, jurisdiction reporting changes, policy bundles; report association if unresolved                               |
| Eligibility threshold       | Actual administrative rule at cutoff c of predetermined score R                                      | Audited follow-up project or business outcome                                       | Units just below versus above c                                                           | Continuity of untreated potential outcomes; no precise manipulation; stable eligibility rule            | Local linear RD: $\tau=\lim_{r\downarrow c}E[Y\mid R=r]-\lim_{r\uparrow c}E[Y\mid R=r]$                  | Density/balance, bandwidth, donut, placebo cutoffs, robust bias-aware intervals                                                    | No actual cutoff, few observations, discretionary overrides; no RD invented for this project                                           |
| Infrastructure opening      | Verified service introduction with affected geography                                                | Accessibility first; later observed activity/employment outcomes                    | Convex weighted donor areas with long pretreatment outcomes                               | Treated counterfactual lies in donor support and no unique untreated post shock                         | $\min_{w\ge0,\mathbf1'w=1}\lVert Y_{\mathrm{pre},T}-Y_{\mathrm{pre},C}w\rVert_V^2$; post gap as estimate | Pretreatment fit, donor placebo/gap ratios, leave-one-out, spillover screening                                                     | Poor fit, common intervention among donors, one unusual treated site; stop rather than extrapolate a synthetic control                 |
| Hypothetical IV opportunity | Documented externally assigned infrastructure timing or eligibility instrument Z, only if discovered | Target treatment D and measured outcome Y                                           | Comparable variation in Z                                                                 | Relevance, exclusion, independence, and monotonicity for a LATE interpretation                          | $D=\pi Z+X\gamma+v$; $Y=\beta\widehat D+X\theta+u$                                                       | First-stage/weak-IV robust inference, institutional evidence, direct-path falsification                                            | Distance to highway or historical zoning is not automatically a valid instrument; default unavailable                                  |

Matching/propensity scores can improve covariate balance and overlap, but do not remove unmeasured confounding. Estimate $e(X)=P(D=1\mid X)$ on pretreatment features; inspect support and standardized differences; trim only with an estimand change disclosed. Do not match on post-treatment permits or income if estimating their treatment pathway. Doubly robust estimators still need identification and overlap.

Synthetic control follows the [Abadie-Diamond-Hainmueller design](https://www.nber.org/papers/t0335); a good-looking weighted line is insufficient without credible donor support. Causal forests are deferred until many independent treated/control units and honest sample splitting exist; forests are not suitable heterogeneous-effect machinery for a handful of corridors. Cluster at treatment-assignment level, not at individual sensor-day merely to enlarge n. With few clusters, use justified randomization/placebo or small-cluster inference and admit weak power.

Interference is likely in a local economy. Define outcomes $Y_g(D_g,\mathrm{exposure}_g(D_{\mathrm{neighbors}}))$, distinguish direct and spillover effects, and report area-wide totals to assess displacement. A null pretrend test does not prove parallel trends; inspect intervals against economically meaningful deviations and run sensitivity to plausible trend violations. Publish study-specific design and data before looking at treatment effects; no generic "causal policy engine" should bless arbitrary sliders.

## 10. Mathematical Economic Structure

### Diversification and Decomposition

With sector shares `p_s`, entropy $H=-\sum_s p_s\log p_s$, effective industry count `exp(H)`, concentration $HHI=\sum_s p_s^2$ and effective count `1/HHI` emphasize different parts of the distribution. Use $0\log0=0$, consistent sector universes, sensitivity to aggregation, and posterior/source-error draws. Theil $T=\sum_gw_g(y_g/\bar y)\log(y_g/\bar y)$ can decompose between/within geographic inequality for compatible positive extensive outcomes and weights; do not substitute medians into additive decompositions.

Shift-share decomposition for employment is an accounting identity:

$$
\Delta E_g=\sum_s E_{gs,0}r_N+
\sum_s E_{gs,0}(r_{Ns}-r_N)+
\sum_s E_{gs,0}(r_{gs}-r_{Ns}).
$$

These are national growth, industry mix and local residual components. The last is not a causal competitiveness effect. Compare industry and time aggregation; missing/suppressed sector cells preclude an exact public decomposition unless a legitimate coarser partition is used.

### Transitions and Dynamics

A genuine industry transition probability $P_{ij}=P(S_{t+1}=j\mid S_t=i)$ requires longitudinal entities with observed industry changes, such as properly defined worker job-to-job records or establishment classification histories. Two aggregate sector-share vectors do not identify flows. With transition counts `n_ij`, a Dirichlet row prior gives posterior mean $(n_{ij}+\alpha_{ij})/\sum_k(n_{ik}+\alpha_{ik})$; include entry/exit states and distinguish reclassification from economic transition. Stationary distribution $\pi'=\pi'P$ requires a time-homogeneous ergodic chain; structural change may invalidate it. LODES home-work flows are not worker industry transitions.

If only shares exist, optimal transport may solve $\min_T\sum_{ij}c_{ij}T_{ij}$ subject to row/column marginals matching shares. That produces a cost-minimizing **hypothetical allocation**, not identified industry flows. Report the nonidentification; do not label the solution measured `P(i -> j)`.

A linear activity system $x_{t+1}=Bx_t+u_t$ is locally stable if spectral radius $\rho(B)<1$; impulse response to a specified shock is `B^h u`. Stability and persistence eigenvalues are meaningful only for the fitted or assumed dynamical operator. A large adjacency eigenvalue alone does not establish economic fragility. Multiple shocks, parameter uncertainty and nonlinear capacity limits can invalidate linear extrapolation.

For graph Laplacian $L=D-A$, normalized Laplacian $L_n=I-D^{-1/2}AD^{-1/2}$, small nonzero eigenvalues describe weakly connected structure under the graph's edge definition. The Fiedler vector can suggest a partition. Bootstrap edge uncertainty and inspect eigengaps; an apparent geographic community may be a source-coverage boundary.

### Input-Output and Dependence

Let `A_ij` be input from industry i per unit output of j, and `d` final demand. Then $x=Ax+d$, $x=(I-A)^{-1}d$ when the system is productive/invertible. National BEA requirements are not a local supplier census. Define a local scenario matrix $A_{\mathrm{local},ij}=\ell_{ij}A_{\mathrm{national},ij}$ with leakage/local-purchase share $\ell_{ij}\in[0,1]$, crosswalk sectors, units and valuation, and explore uncertainty. [BEA input-output accounts](https://www.bea.gov/data/industries/input-output-accounts-data) supply national accounting structure, not local multipliers. Do not infer output coefficients from headcounts without a justified productivity bridge.

Mutual information $I(X;Y)=\sum_{x,y}p_{xy}\log[p_{xy}/(p_xp_y)]$ can test nonlinear dependence, but sparse bins bias estimates. Use permutation/block nulls and comparison to simpler correlations; transfer entropy is especially data-hungry and does not identify causation. Matrix factorization is justified where it imposes a testable low-rank structure, not where it decorates a heatmap.

Game theory is optional only for a specified strategic decision with plausible payoff evidence, such as coordinated investment with congestion or free-riding. No payoff matrix is presently observed. A cooperative benefit-allocation example may illustrate assumptions; it is not a calibrated model of local firms' behavior. Bayesian decision theory and value of information in section 13 offer more immediate mathematical value.

## 11. Anomaly Detection and Early Warning

Build warnings on the predictive distribution of a named observed target. A rare value, a deteriorating trend and a broken data source are different events. The first operational warnings can concern acquired county labor observations and forecast residuals. Restaurant-closure or corridor-vacancy warnings remain unavailable without those observations and their denominators.

Let $F_{g,t\mid t-1}$ be the one-step-ahead predictive CDF using only eligible information. For approximately Gaussian observations use $r_{gt}=(y_{gt}-\widehat y_{gt})/\sqrt{V_{gt}}$, where $V_{gt}$ is predictive variance, including observation uncertainty. For discrete counts use randomized PIT residuals:

$$
u_{gt}=F(y_{gt}-1)+v_{gt}\{F(y_{gt})-F(y_{gt}-1)\},\qquad
r_{gt}=\Phi^{-1}(u_{gt}),\quad v_{gt}\sim U(0,1).
$$

Fix/report the randomization seed for reproducibility; probability-of-tail and nonrandomized interval summaries should accompany alerts. A closure count divided by its historical standard deviation is unreliable when exposure is changing or expected counts are near zero. An extreme residual may reflect delayed reporting rather than business distress.

For a directional deterioration residual $d_t$ with positive values indicating adverse surprise, use one-sided CUSUM and EWMA:

$$
C_t=\max(0,C_{t-1}+d_t-k),\quad C_t>h\ \text{triggers a candidate};
\qquad Z_t=\lambda d_t+(1-\lambda)Z_{t-1}.
$$

Choose allowance $k$, threshold $h$ and smoothing $\lambda$ through prespecified simulations and held-out baseline behavior. Evaluate average run length under no change, false alerts per geography-year, delay under specified shifts, and sensitivity to correlated residuals. An iid control-chart threshold is not calibrated for autocorrelated economic observations. Bayesian change-point models estimate $P(r_t=0\mid y_{1:t})$ for run length $r_t$; the hazard prior must be tested because it sets how readily the system declares change.

Multivariate residual distance $D_t^2=e_t'\widehat\Sigma^{-1}e_t$ requires covariance shrinkage and calibration under dependence. A Gaussian process can provide local predictive surprise if its kernel extrapolation is credible. Isolation forests are optional diagnostics for many independent feature vectors, not a primary economic warning explanation in a short panel. Bayesian posterior predictive tail areas measure model surprise, not the posterior probability of a recession.

Apply data-quality gates first: source freshness, expected row count, schema/definition stability, denominator coverage, duplicate revisions, known announcements and missingness. Then apply a multiplicity policy across geographies/targets and repeated monitoring. A monthly Benjamini-Hochberg screen controls neither arbitrary dependence nor indefinite repeated testing by itself; use block-simulated thresholds for the chosen monitoring policy, or a justified online testing procedure. LISA false-discovery correction is a spatial screen and must not be reused as proof of a calibrated temporal alert system.

Require persistence or economically meaningful magnitude in addition to a tail threshold, with the tradeoff against detection delay documented. Candidate alerts enter review, link to contributing releases and show predicted versus observed values, exposure, intervals, revision sensitivity and threshold policy. Deduplicate continued episodes. An alert's status is "unusual county labor deterioration" or "reporting anomaly," not "businesses will fail." Evaluate prospectively; a manually labeled historical event set is useful but incomplete ground truth.

## 12. Economic Resilience and Shock Simulation

The current integration's conditional graph shock is an **assumption-based exposure exercise**. An industry-similarity graph does not observe supplier dependencies, and its simulated changes are not estimated lost jobs, revenue or GDP. Keep this useful exploratory implementation while exposing edge meaning, propagation rule, attenuation and scenario units.

For normalized nonnegative adjacency $W$ and direct shock vector $d$, define an illustrative propagation state

$$
z^{(0)}=d,\qquad z^{(h+1)}=d+\gamma Wz^{(h)},\qquad
z^{(\infty)}=(I-\gamma W)^{-1}d
$$

when $\rho(\gamma W)<1$. Choose $\gamma$ explicitly as a scenario parameter, not a fitted transmission elasticity. Define direction and normalization; a row-stochastic similarity graph mixes neighbors' exposure and does not conserve economic dollars. Show direct versus propagated score, horizon and attenuation sensitivity. A 20% sector activity assumption may be represented as $d_s=-0.20$ in dimensionless scenario units, but the propagated score is not automatically a percentage output loss. No propagation with $\gamma=0$ is a mandatory reference case.

A later input-output scenario may instead use

$$
\Delta x=(I-A_{\mathrm{local}})^{-1}\Delta d,\qquad
A_{\mathrm{local},ij}=\ell_{ij}A_{\mathrm{national},ij}.
$$

This is a **final-demand** shock under fixed coefficients. Loss of an employer or flood damage may be a **supply/capacity** shock and should not be inserted as final-demand loss without justification. For supply restrictions use explicit capacity bounds, substitution assumptions or a separate rationing/production model. Local purchasing/leakage $\ell_{ij}$ must be measured or scenario-varied. Household-induced effects require an additional defensible household sector; they do not appear automatically in the basic Leontief inverse.

Run Monte Carlo over uncertain baseline exposures, measured-edge errors and explicit scenario parameters. Draw from estimated distributions only where data support them; otherwise use an unweighted scenario grid/range. Reject unstable matrices and report the rejected fraction; do not quietly clip extreme runs into reassuring results. Report scenario envelopes as such, not confidence or credible intervals for an identified economic effect. Compare geography-first, industry-first and zero-propagation formulations to reveal model dependence.

Historical resilience can be measured without a supplier model: drawdown $D_g=\max_t(1-y_{gt}/p_{gt})$ relative to a defined prior peak/trend $p_{gt}$; recovery time is the first sustained return to a specified pre-shock level; cumulative shortfall is $\sum_t(y_{gt}^{\mathrm{reference}}-y_{gt})$. Those references and seasonal adjustments change interpretation. Recovery to a prior employment peak is not recovery to an unobserved no-shock counterfactual. Test historical associations of concentration, commuter dependence and diversity with these outcomes across many counties and multiple episodes.

Useful views show vulnerable concentrations, commuting dependence, scenario exposure maps, fan charts over assumptions, and tornado plots identifying which parameters drive the answer. A major-employer scenario must state whether employer/site employment is verified or hypothetical. A rent shock requires a rent/exposure/profit bridge not present in assessments; an extreme-weather scenario needs observed physical exposure and an explicit economic response assumption.

## 13. Optimization and Prescriptive Analysis

The integration's browser policy allocation uses hypothetical project inputs. It is a decision-support demonstration of a constrained allocation problem, not a calibrated causal policy recommendation. Binary project decisions make the problem a binary linear program, a special case of mixed-integer linear programming; a continuous LP relaxation can provide a bound but is not the same feasible decision set.

Let $x_k\in\{0,1\}$ select project k, $c_k$ be cost, $b_k$ a clearly defined benefit score, $a_{gk}$ the share of benefit assigned to geography g, and $B$ budget:

$$
\max_x\sum_k b_kx_k\quad\text{subject to}\quad
\sum_kc_kx_k\le B,\quad
\sum_ka_{gk}b_kx_k\ge L_g\ \forall g,\quad
\sum_{k\in\mathcal S_s}c_kx_k\le U_s.
$$

The geographic floor $L_g$ and sector cap $U_s$ are normative policy inputs. They must have consistent units, feasibility checks and a visible explanation when no solution exists. If benefits are hypothetical scores, report score maximization. Do not label $b_k$ "expected jobs created" without measured or identified treatment effects. Need/underperformance predicts neither treatment response nor the best intervention. Prefer Pareto comparisons for growth/equity/risk rather than hiding contested tradeoffs in a single weight.

Useful alternative formulations:

| Formulation                   | Mathematical core                                                                                                                                                                | Evidence / interpretation                                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Facility location             | Minimize $\sum_{i,k}d_i t_{ik}y_{ik}$, with $\sum_k y_{ik}=1$, $y_{ik}\le x_k$, capacity and budget constraints                                                                  | Demand weights and travel times must be measured or declared; report access gained, not automatically GDP                          |
| Robust allocation             | Maximize $\min_{\omega\in\Omega}\sum_k b_{k\omega}x_k$                                                                                                                           | Suitable for uncertain benefits without defensible scenario probabilities; compare nominal optimum and regret                      |
| Risk-constrained portfolio    | Constrain CVaR of scenario loss using $\zeta+\frac{1}{1-\alpha}\sum_\omega p_\omega u_\omega\le R$, $u_\omega\ge L_\omega(x)-\zeta$, $u_\omega\ge0$                              | Requires defensible probabilities for probabilistic risk claims; correlated project outcomes matter                                |
| Continuous service allocation | Choose $x_k\ge0$ with diminishing benefit $\sum_k f_k(x_k)$ and equity/budget bounds                                                                                             | Validate response functions; linear extrapolation of small pilots may be implausible                                               |
| Measurement placement         | Choose sensor/audit set S to reduce $\operatorname{tr}(P_{\mathrm{posterior}})$ or maximize $\log\det P_{\mathrm{prior}}-\log\det P_{\mathrm{posterior}}$ subject to cost/access | Immediately defensible when measurement noise and target support are specified; optimize information, not invented economic impact |

Value of information directly connects statistical uncertainty to spending:

$$
\mathrm{EVSI}=E_{Y_{\mathrm{new}}}\left[\max_a E\{U(a,\theta)\mid D,Y_{\mathrm{new}}\}\right]
-\max_a E\{U(a,\theta)\mid D\}.
$$

Acquire data if expected decision improvement exceeds collection cost, conditional on a meaningful utility and data-generating model. With no defensible utility, present parameter/ranking sensitivity and expected variance reduction instead of monetizing information.

Validate solver feasibility and optimality gap; enumerate all combinations for tiny fixture problems as an independent check. Test zero budget, infeasible equity floors, mutually exclusive projects, duplicate benefits and uncertain cost. For linear relaxations shadow prices describe the relaxed marginal constraint value; they are not universally meaningful marginal values in binary decisions. Export selected projects, rejected alternatives, assumptions, objective, binding constraints and sensitivity. Public publication of an optimizer result is not authority to allocate actual funds.

## 14. NLP and Unstructured Data

Text is most useful when it yields an auditable event variable absent from structured releases. The integration reports an evidence-span extraction path. That should produce document-linked facts with review status, not an unlabeled sentiment score or automatically accepted economic events.

Define a project-stage ontology: residential development, commercial development, infrastructure, zoning change and business expansion, each with proposed/submitted/approved/permitted/under-construction/occupied/withdrawn status. A meeting can discuss the same project repeatedly. Store one project with dated stage transitions and revisions rather than count every mention as a new project. Record publication date separately from meeting and asserted event dates.

An extraction record must contain document/version hash, URL, page, exact supporting span, application/parcel/entity ID, event class, decision/stage, amount/area/date with units, confidence, reviewer and supersession. Missing values remain null. Negation and modality matter: "approval postponed" is not approval; "up to 20,000 square feet proposed" is not occupied commercial area. Verify numeric units and planned/realized distinction before aggregation.

Start with deterministic identifiers/date/unit parsers and a TF-IDF logistic classifier. Use NER for parcel/application/address fields; entity linkage is separately evaluated. Embeddings can retrieve similar projects or support review; topics/BERTopic can discover a labeling taxonomy but do not establish an economic quantity. General sentiment is unsuitable as a vitality measure because public opposition, optimism and source mix confound it. A constrained LLM extraction schema is optional after a baseline shows where rules fail; retain evidence spans and human review of material facts.

For an uncertain event-class count, $\widehat N_{g,t}=\sum_i P(C_i=\mathrm{commercial},G_i=g,T_i=t\mid D_i)$ is an expected count conditional on the classification model, not a verified count. Variance includes covariance among repeated/similar documents. Use reviewed deduplicated counts for published official-looking statistics; an experimental probability-weighted series must carry model and coverage uncertainty.

Create a manually labeled sample stratified by municipality, year, document type, project stage and rare classes. A planning target of 200-500 labeled events/documents is for budgeting only; estimate precision/recall intervals and expand until important errors are measured. Split by project and time, never random pages from the same meeting/project. Measure span/entity/date/unit accuracy, class precision/recall/F1, calibration, duplicate detection and bias by document source. A small overall accuracy number can conceal poor recall of actual approvals.

Most importantly, test **downstream** value: does adding publication-available project events improve held-out permit/occupancy forecasts or reduce verified event-entry workload? Compare with a structured-permit-only model, rules-only extraction and a no-text baseline. Report analyst minutes per accepted event, API/OCR cost, corrections and missed events. A retrieval interface is useful on its own, but retrieval quality does not validate a numerical forecast. Keep untrusted document text separate from executable instructions and require constrained parsing of model outputs.

## 15. Dashboard Architecture

The existing React/Vite application now exposes 11 analysis routes and the in-app research reader. The module table below describes analytical capabilities, some grouped into those routes and some gated, rather than claiming 13 separate implemented routes. The reader imports these Markdown documents with `react-markdown`, `remark-math` and `rehype-katex`; formulas use inline and display dollar delimiters. Source links, model cards and limitations belong beside the corresponding result. The overview should keep named targets, coverage/release status and compact linked views prominent.

Shared interactions: persistent geography/industry/date/as-of filters in the URL; comparison basket; observed/derived/model/scenario state label; source and model version; downloadable displayed data and definitions; keyboard-operable filters; colorblind-accessible legends; numeric table alternative to every map. Display the latest observation period and last refresh separately. A stale annual context layer must not inherit a monthly nowcast timestamp.

| Module                    | Key outputs / underlying model                                                           | Visualization                                                 | User interaction                                           | Uncertainty displayed                                                          | Drill-down                                       |
| ------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------ |
| Local Economy Overview    | County labor conditions; observed structure and source freshness                         | Compact time chart, sector contributions, coverage map        | Select target/geography/as-of and comparison               | Prediction interval, source flags, geographic support                          | Measure -> release -> run/source                 |
| Economic Health / Context | Current tract household-context PCA, explicitly not health; future validated sub-indices | Loadings, score distribution, linked map                      | Raw input versus score; alternate components/baselines     | ACS MOEs, loading/rank sensitivity; no generic health confidence               | Tract -> input estimates -> methods              |
| Economic Nowcast          | Named county current-period target; future mixed-frequency factor                        | Observations plus distinct nowcast band, release-news bars    | Change cutoff, inspect latest release effects              | Predictive interval and validation mode                                        | Target -> model -> release contribution          |
| Forecasts                 | Actual county forecasts and baseline comparison; later permit forecasts                  | Fan charts and horizon-specific loss table                    | Horizon/origin/model selection                             | Empirical coverage and prediction intervals                                    | Fold -> prediction -> training/cutoff metadata   |
| Industry Structure        | Sector shares, RCA/LQ, HHI/entropy; experimental complexity                              | Ranked bars, heatmap, change decomposition                    | Employer/nonemployer universe, sector depth, benchmark     | Suppression/coverage and rank sensitivity                                      | Industry -> source count and classification      |
| Business Ecosystem        | Verified/sample establishments and event risk sets                                       | Cohort/risk-set table, age distribution when observed         | Switch sample/population view; evidence review             | Coverage and censoring, not fabricated precision                               | Establishment -> location spell -> source        |
| Spatial Economics         | Moran permutation/LISA FDR now; later exposure-adjusted spatial models                   | Linked residual/cluster map and scatterplot                   | Select weights, input/derived measure, significance policy | Corrected significance and effect intervals; MAUP sensitivity                  | Tract -> neighbors -> inputs -> null policy      |
| Economic Network          | Current county/industry similarity/RCA relationships; later commuting graph              | Matrix first, optional network and community map              | Choose layer/edge meaning/threshold, inspect node          | Rank/edge stability; observed versus inferred labels                           | Edge -> source components and normalization      |
| Openings / Closures       | Reviewed events; gated survival/DiD engines do not populate outcomes                     | Event ledger, cohort curves when eligible                     | Filter event certainty/type, compare cohorts               | Interval censoring, at-risk counts, survival bands                             | Event -> supporting evidence/review              |
| Commercial Hotspots       | Observed sample density versus future audited commercial intensity                       | KDE/exposure-adjusted map with coverage layer                 | Bandwidth, corridor support, time                          | Sensitivity and multiple-testing mask where relevant                           | Cell/corridor -> contributing observations       |
| Early Warning             | Forecast surprise and source-quality alerts                                              | Control chart, episode list, contribution details             | Review/dismiss with reason, inspect thresholds             | Tail probability/persistence policy, false-alert validation                    | Alert -> input revision -> forecast distribution |
| Economic Resilience       | Conditional graph shock now; later measured historical recovery/IO scenario              | Direct/propagated exposure, sensitivity fan/tornado           | Shock, attenuation, leakage, horizon sliders               | Scenario envelope distinguished from statistical intervals                     | Sector/geography -> edge and assumption          |
| Policy Lab                | Hypothetical binary project allocation; later credible causal study results              | Selected projects, budget/equity frontier, effect event study | Budget/equity/risk settings; compare feasible alternatives | Assumption sensitivity, solver gap; causal intervals only for identified study | Decision -> project inputs -> evidence/model     |

Household-context PCA may reveal a tract socioeconomic gradient. It is not evidence of business health, contemporaneous activity or the relative success of firms residing there. Network similarity can reveal peer structure, but a force-directed layout's distance has no inherent geographic or economic metric meaning. Scenario sliders must never overwrite observations or train the forecast.

## 16. Technical Stack and Model Lifecycle

The [implementation architecture](implementation-architecture.md) specifies the tables, observation contract, as-of queries, refresh behavior, public output contract, API options and verification requirements. Preserve React/Vite and the existing map/chart libraries. Use Python scheduled batch estimation, a local warehouse, versioned features and immutable output bundles. The integration reports SQLite warehouse work and ACS ingestion; DuckDB remains a justified optional analytical companion over Parquet, not a prerequisite that should disrupt the working SQLite path.

The concrete sequence is source acquisition -> immutable release archive -> SQLite observation/provenance tables (and optional DuckDB analytical views) -> as-of features -> baseline/statistical models -> diagnostics and held-out scores -> versioned public output snapshot -> existing React interface. Add FastAPI only for queries/jobs that cannot be served by safe aggregate snapshots. Add PostgreSQL/PostGIS only for concurrent multiuser writes, remote durable access/auth or substantial live spatial querying. Neither is required merely to make a small local research system look serious.

Recompute filtered estimates when an eligible source observation arrives; refit compact model parameters quarterly or after substantial audited revisions; refresh annual structural features after releases; version geographies and classifications. Build stable folds and challengers offline. Preserve the last good snapshot if validation or acquisition fails. Integration tests should verify data and UI status boundaries, not only numeric routines. Test suites for a reusable survival/DiD engine demonstrate code behavior; only acquired eligible data and a defensible study design authorize fitted economic claims.

Python tools: statsmodels for baseline state-space/forecasting, NumPy/SciPy/scikit-learn for transformations and baselines, GeoPandas/libpysal/esda/spreg for spatial analysis, NetworkX for graph calculations; optional PyMC/Stan for the signature model, lifelines for eligible survival, R `did` for study-specific heterogeneous-treatment DiD, and SciPy MILP/Pyomo for transparent allocation. Choose one implementation per principal model, pin tested versions and document numerical assumptions. Do not add a neural network, LLM, graph database or distributed stream simply to expand the stack list.

## 17. Statistical Validity

The [validity matrix and release gates](validation-and-release-gates.md) evaluates every major recommended family against sample size, dimension, overfitting/collinearity, spatial/temporal dependence, selection/survivorship, ecological error/confounding, uncertainty, calibration and robustness. It provides operational release criteria and failure actions. Sample targets in this design are budgeting heuristics to be tested with simulation and actual effective information; there is no universal sample threshold that licenses a model.

The acquired county series described in the integration update has a long monthly history, but repeated months are not independent and all counties share shocks. The acquired ACS tract cross-section adds geographic information but cannot provide a 26-year tract monthly panel. A tract PCA using household variables can be a useful descriptive compression when labeled accurately; it does not estimate a local health construct or an intervention effect.

For a simple AR(1)-like sequence, $T_{\mathrm{eff}}\approx T(1-\rho)/(1+\rho)$ illustrates why persistence reduces information; it is not an exact sample-size formula for a spatial panel. In a five-year moving-average illustration $A_t=\frac15\sum_{j=0}^4 X_{t-j}$ with independent annual $X$ of variance $\sigma^2$, $\operatorname{Cov}(A_t,A_{t-k})=(5-k)\sigma^2/25$ for $0\le k<5$. Actual ACS survey covariance is more complicated; this illustration explains overlap, not a valid plug-in ACS covariance estimator.

Use published 90% MOE to obtain an approximate marginal $SE=MOE/1.645$ when the source's normal approximation is appropriate. Rates/ratios need covariance between numerator and denominator; do not add squared MOEs indiscriminately for a subset proportion. Unknown covariance requires approved source formulas or an explicit sensitivity envelope. Overlapping windows, common survey inputs and derived variables further correlate measurement errors. Negative Census sentinels and suppressed cells are missingness states, not economic observations.

Regularization reduces variance at the cost of bias; partial pooling trades group-specific flexibility for shared information; Bayesian priors make assumptions explicit. None fixes a selected directory sample or a nonexistent treatment comparison. Bootstrap at the dependence-generating unit (time blocks, geographic clusters, establishments or projects); resampling rows of a dependent panel manufactures precision. Simulations with known data-generating parameters should assess recovery, bias, coverage and identifiability before the complex signature model is promoted.

The release standard is not "the model runs" or "p<0.05." It is a correctly defined target, observable support, reproducible information set, appropriate comparison model, calibrated uncertainty, stability to consequential assumptions and communication that does not exceed the evidence. Null/negative findings, failed gates and inadequate data coverage are first-class results.

## 18. Seven-Component Technical Roadmap

The [component roadmap](component-roadmap.md) gives the full requested rubric for each of seven complementary components: research question, equations, data, method, implementation steps, libraries, validation, visualization, user learning, difficulty, defensibility, product value and time relative to value. Data/provenance and release-aware validation are shared infrastructure, not extra decorative feature slots.

| Component                                              | Scope and current boundary                                                                                                | Delivery sequence                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| C1 County labor model -> spatial dynamic factor system | Actual county forecast/rolling validation reported in integration; mature hierarchical spatial signature remains proposed | First operational model; extend only when independent panel signals justify it            |
| C2 Spatial economic context and conditional risk       | Tract household PCA and Moran/LISA FDR now; exposure-adjusted spatial econometrics later                                  | Audit context/weights now; add annual workplace outcomes and suitable exposures next      |
| C3 Economic structure and measured networks            | County CBP RCA/similarity now; commuting and validated complexity next                                                    | Establish benchmark/coverage first; reject unstable complexity if simple measures win     |
| C4 Development evidence and count dynamics             | Warehouse/ACS and evidence-span work underway; local permit/history completeness still gated                              | Audit structured permits and documents, validate extraction, then count forecast          |
| C5 Establishment survival                              | Reusable tested engine reported; no fitted population survival claim without risk-set/event data                          | Acquire cohort history before estimating; horizon-specific eligibility                    |
| C6 One identified policy study                         | Reusable tested DiD engine reported; local treatment effect not yet established                                           | Design/acquisition study first; fit only if identification and power pass                 |
| C7 Conditional resilience and allocation               | Conditional graph shock and hypothetical binary project allocation now                                                    | Make assumptions explicit; measured transmission/causal benefits only with later evidence |

Work already implemented in parallel should be audited and integrated, not rebuilt to satisfy a proposed stack. The scope is seven deep analytical components with shared data/validation, not seven independent dashboards with incompatible definitions.

## 19. Find the Signature Model

The strongest **research-stage centerpiece** is a **hierarchical spatial dynamic factor state-space model of regional labor and commercial conditions**, anchored to observable outcomes, with explicit release timing and measurement error. It is conditional on acquiring a sufficiently rich actual panel. The current operational centerpiece can be the narrower county labor conditions forecast and its honest baseline/rolling validation. Do not call that operational system a full Local Economic Health Index.

### Aggressively Ranked Candidates

Scores use 1-5 for depth (D), defensibility once prerequisites exist (V), usefulness (U), originality (O), present feasibility (F) and product potential (P), equal-weight total /30. They are judgments rather than empirical results. The first is the long-term research choice; feasibility keeps the present release narrower. Ties favor defensibility then useful depth.

| Rank | Candidate                                                                | D   | V   | U   | O   | F   | P   | Total | Decision                                                                                           |
| ---- | ------------------------------------------------------------------------ | --- | --- | --- | --- | --- | --- | ----- | -------------------------------------------------------------------------------------------------- |
| 1    | Hierarchical spatial dynamic factor model with release-aware measurement | 5   | 5   | 5   | 5   | 2   | 5   | 27    | Signature after multivariate panel/identifiability gates; combine disciplines through one estimand |
| 2    | County labor state-space forecast with prospective revision/news ledger  | 4   | 5   | 5   | 3   | 5   | 4   | 26    | Strongest operational claim now; original execution can come from evaluation and transparency      |
| 3    | Spatial Bayesian commercial-intensity model with measured exposures      | 5   | 4   | 5   | 4   | 3   | 5   | 26    | Strong spatial research; local observation frame is essential                                      |
| 4    | Optimal economic measurement placement under posterior uncertainty       | 5   | 4   | 4   | 5   | 3   | 4   | 25    | Unusual and useful without invented intervention returns                                           |
| 5    | Document-to-project transition model and count forecast                  | 4   | 4   | 5   | 4   | 3   | 5   | 25    | Measurable NLP contribution; approval/occupancy labels and timing matter                           |
| 6    | Commuting-accessibility network with disruption exposure                 | 4   | 4   | 5   | 4   | 4   | 4   | 25    | Real edge interpretation; economic responses remain separate                                       |
| 7    | Calibrated sequential local deterioration detector                       | 4   | 4   | 5   | 4   | 4   | 4   | 25    | Valuable extension of C1; false alarms are part of the result                                      |
| 8    | Bayesian competing-risk establishment cohort model                       | 5   | 4   | 5   | 4   | 1   | 5   | 24    | Data-constrained, not algorithm-constrained; no directory surrogate                                |
| 9    | Spillover-aware road-disruption causal study                             | 5   | 4   | 5   | 4   | 1   | 5   | 24    | Publishable if assignment/controls/outcomes support it                                             |
| 10   | Probabilistic local complexity and related-industry emergence            | 5   | 3   | 4   | 5   | 2   | 5   | 24    | Interesting but must beat size/LQ/diversity and survive aggregation                                |
| 11   | Locally calibrated input-output stress and robust allocation             | 5   | 3   | 5   | 4   | 2   | 4   | 23    | Conditional tool now; calibrated output effects need much more evidence                            |
| 12   | Five-state local economic HMM                                            | 4   | 2   | 3   | 3   | 2   | 4   | 18    | Too many regimes likely; prefer simpler trends/two-state research                                  |
| 13   | Graph neural network business failure prediction from directory          | 5   | 1   | 2   | 2   | 1   | 4   | 15    | Reject: no representative outcomes, credible graph or sufficient events                            |

### Proposed Signature Specification

Use county monthly states first. For geography g, let $f_{gt}$ be local momentum and $F_t$ a regional/common factor. Indicator j may be observed monthly, quarterly or annually and on a different spatial support. Let $\mathcal H_{j,r}$ map latent geography-time states to the exact support and reference period of release r:

$$
y_{j,r}=\mathcal H_{j,r}\left[\alpha_j+\lambda_j f+\kappa_j F+X\beta_j\right]
+\epsilon_{j,r},\qquad
\epsilon_{j,r}\sim N(0,R_{j,r}).
$$

Here observations are transformed/standardized with training-only parameters appropriate to their measurement law. For count indicators replace the Gaussian observation with a Poisson/negative-binomial link and exposure, requiring approximate/non-Gaussian inference. Initially restrict the model to a small set of suitable continuous labor/activity indicators; do not add every source merely because it exists. Use fixed known aggregation operators for additive levels. Nonlinear ratios and log growth require derived observation equations.

With $f_t$ a vector across counties, a candidate state evolution is

$$
f_t=(\phi I+\psi W)f_{t-1}+bF_t+Z_t\Gamma+\eta_t,
\qquad F_t=aF_{t-1}+\xi_t,
\qquad \rho(\phi I+\psi W)<1.
$$

Fix W from prespecified adjacency or lagged commuting data; do not jointly learn a dense graph and latent states from a thin panel. A stationary momentum state is different from a nonstationary employment level: a local trend model can anchor levels separately. A spatial innovation alternative uses

$$
\eta_t\sim N(0,Q),\qquad
Q=\tau^2(D-\omega A+\varepsilon I)^{-1},
$$

with symmetric adjacency A, positive-definite precision under explicit bounds, island handling and scaling. Start with **either** spatial transition $\psi$ **or** spatial innovations, not both unrestrained; these and a common factor can explain similar dependence. A simpler BYM2-style structured/unstructured innovation is another candidate, with sum-to-zero constraints as needed. Compare each added structure by ablation and held-out calibration.

Partial pooling can permit $\lambda_{gj}=\lambda_j+u_{gj}$, $u_{gj}\sim N(0,\sigma_{\lambda j}^2)$, but initially set deviations to zero or strongly shrink them. Constrain factor sign/scale through a declared employment-growth anchor and innovation variance or loading normalization, constrain local deviations relative to the common factor, and handle multiple-factor rotation if ever expanded. Avoid two redundant routes for the common factor: start with $b=0$ in local-state dynamics and a separately identified common-factor measurement loading, or absorb common dynamics into local states and remove the redundant direct loading. Simulation recovery must establish the selected parameterization. An unrestricted loading matrix, spatial transition, time-varying loadings and free measurement covariance are not jointly plausible first-model parameters.

Example starting priors on standardized indicators are $\beta_j\sim N(0,0.5^2)$, $\sigma_{\lambda j}\sim\operatorname{HalfNormal}(0,0.25)$ and positive scale priors $\tau\sim\operatorname{HalfNormal}(0,0.5)$. These are tunable prior hypotheses, not inferred local facts; inspect prior predictive trajectories and repeat with wider/narrower scales. Constrain the transition directly to its stable region rather than independently drawing apparently harmless coefficients that yield an unstable joint operator. Do not fix unknown ACS cross-variable covariance to zero and subsequently describe the resulting posterior as full survey uncertainty.

Measurement covariance must recognize known sampling errors and shared sources. Do not put employment, unemployment, labor force and unemployment rate in a diagonal-error model as independent measurements: algebraic identities overcount information. LAUS and QCEW measure different labor concepts; their relationship is learned/predicted, not an accounting identity. ACS household context enters as slow covariates with error/period support, not as observed monthly business health. Tract annual workplace observations can eventually anchor a nested spatial layer; without repeated tract outcomes, a tract monthly score is largely prior/downscaling assumption and should remain unpublished.

The released quantity is a named target predictive distribution or latent **labor/activity momentum** distribution, with model version and cutoff. A candidate current-period target equation is

$$
g_{c,t}^{\mathrm{employment}}=\delta_c+\theta_c f_{ct}+\zeta_{ct},
\qquad p(g_{c,t}\mid\mathcal I_a)=\int p(g_{c,t}\mid f,\theta)\,p(f,\theta\mid\mathcal I_a)\,df\,d\theta.
$$

Only actual observed employment targets identify its scale. Factor uncertainty alone understates target predictive uncertainty; include $\zeta$, parameter uncertainty and relevant source uncertainty. A welfare/health interpretation would require a separate, justified measurement and validation argument.

### Estimation, Tests and Promotion

Prototype one/two-factor Gaussian dynamics with Kalman filtering and maximum likelihood/EM; benchmark against univariate trends, seasonal naive, SARIMA/dynamic regression and nonspatial pooled factors. Add hierarchical Bayesian estimation with shrinkage/weakly informative priors after simulation recovery and practical compute profiling. Check identifiability, posterior predictive distributions, effective sample sizes/convergence and priors; fitting speed or absence of a crash is not convergence.

Design target: about 20-50 coherent counties, 120-180 or more actual monthly periods, roughly 5-12 conceptually distinct available series, and at least 3 meaningful measurement domains for a broader activity construct. These are starting design ranges, not sufficient conditions. The already acquired long LAUS history strengthens the baseline but does not supply missing independent domains. A multi-county source-availability/missingness audit determines whether mixed-frequency indicators provide enough effective overlap. For an eventual tract layer, acquire multiple years of actual tract workplace/commercial outcomes and meaningful local high-frequency measures; cross-sectional ACS alone is inadequate.

Validate by chronological rolling origins with release masks, withheld counties/spatial blocks, source leave-one-out, spatial-weight alternatives, restricted/nonspatial models, measurement-error sensitivity and stress episodes. Keep a final chronological holdout untouched. Compare predictive density/interval scores, target error, calibration by geography/horizon and factor stability. If spatial pooling adds no robust predictive or measurement benefit, deploy the simpler model and report the negative result.

A defensible eventual research claim would be: "I developed a hierarchical spatial state-space model that combines asynchronously released regional indicators to estimate county labor/activity conditions and quantify how much local information improves prediction." This wording becomes appropriate only after fitting and validation. Today's claim should name the actual county forecasts, tract household context, observed structure and conditional tools, with no full LEHI or implemented hierarchical-signature claim.

## 20. Be Critical and Conclude

Real depth is defining the estimand, observing the population/support, distinguishing releases from revisions, modeling measurement error and dependence, testing identification and uncertainty, and rejecting complexity that does not improve inference. Technical decoration is renaming household PCA "health," treating a directory as a business census, interpreting similarity edges as suppliers, giving five regimes to a short series, optimizing invented returns as economic impact, or converting scenario sliders into causal predictions.

The immediate scientific risks are source incompatibility, retrospective leakage, geographic overclaiming and unobserved business events. Better data can unlock advanced methods; more libraries do not. The signature should grow out of the operational county model's measured failures and data opportunities. It should not be a requirement to publish a broad local health score before its construct is measured.

### The Ten Requested Conclusions

1. **Final architecture:** Existing React/Vite frontend and in-app research reader consume versioned public outputs from Python scheduled batches. A local SQLite observation/provenance warehouse supports current integration; Parquet/DuckDB can add analytical capacity. Preserve immutable raw releases, information cutoffs, model/validation registry and evidence spans. Add FastAPI and PostgreSQL/PostGIS only for demonstrated serving/concurrency needs.
2. **The seven components to build:** County labor/state-space inference; spatial context and exposure-adjusted modeling; industry structure and measured networks; audited development/NLP count dynamics; gated establishment survival; one gated identified policy study; conditional shock and constrained allocation. Warnings and forecast comparisons share the county model rather than becoming separate disconnected products.
3. **Single strongest centerpiece:** The proposed hierarchical spatial dynamic factor state-space model, after adequate actual multivariate panel acquisition and validation. The operational centerpiece now is the acquired-data county labor forecast with rolling baseline comparison; it is not a full LEHI.
4. **Acquire immediately:** Preserve and audit the acquired 2000-July 2026 county LAUS history, ACS 2024 tract panel and NJ county CBP. Next acquire comparable QCEW history, LODES and fixed-vintage geography/crosswalks, NES/BDS benchmarks, and audited DCA/Reporter permit history. Begin prospective release archiving and verified establishment/project observations immediately. Pursue a stable local occupancy/traffic measure and an establishment risk set including nonmembers/exits.
5. **Exact build order:** Freeze source/universe/status contracts -> validate acquired panel and archive releases -> verify county baseline/forecast uncertainty -> audit household PCA/spatial weights/FDR and county structure -> add QCEW/LODES and richer panel baselines -> validate permit/document events and count models -> prototype the spatial dynamic signature -> estimate survival only after cohort gate -> run one causal study only after identification gate -> replace hypothetical scenario/benefit inputs with measured evidence where possible. Explicit scenario tools may operate earlier with labels intact.
6. **Mathematics to learn:** Linear algebra/eigenvectors and identifiability; probability and likelihood; state-space/Kalman filtering; measurement-error models; Bayesian hierarchical inference; time-series validation and proper scoring; spatial weights/CAR/SAR impacts; graph/bipartite complexity; counting processes/survival; potential outcomes/DiD; constrained optimization, robust decision theory and value of information.
7. **Research-paper opportunities:** Incremental benefit of release-aware spatial pooling over strong county baselines; tract measurement-error/spatial-support sensitivity; whether local complexity beats ordinary structure measures; audited document signals' forecast value; a carefully identified disruption study. A documented failure of an attractive model can be a useful methods result. Software breadth alone is not a paper contribution.
8. **Useful policy insights:** Identify evidence-supported labor deterioration, access inequalities, concentration/commuter exposure, development bottlenecks and measurement gaps. Estimate a particular intervention's effect only with a valid study. Use allocation to expose budget/equity tradeoffs and uncertainty, not to conceal normative assumptions.
9. **What makes it unusual:** Every result has an observable support, period, release cutoff, provenance, uncertainty type and validation comparison; maps are paired with dependence/coverage analysis; text is converted into reviewable events; conditional scenarios and identified effects are visibly distinct; the system can decline to score an unsupported geography or model.
10. **Most ambitious defensible endpoint:** A regional multiresolution observatory with well-observed county dynamics, annual tract workplace structure, independently measured local commercial signals, longitudinal establishment/project cohorts and a release-aware hierarchical spatial measurement model. Its prospective forecasts, selected causal studies and uncertainty-aware decisions would be defensible because actual outcomes and assumptions are auditable, even if some requested neighborhood scores remain unavailable.
