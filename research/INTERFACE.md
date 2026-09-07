# Economic model output contract, version 1.0.0

Build: `python -m research.build`. Output: `public/economy/model-results.json`.
All dates use ISO format. Missing values are `null`; JSON never contains NaN.
Units are explicit. Source dates are observation periods, not retrieval dates.

Top level: `{schemaVersion, generatedAt, asOfDate, sources, coverage, health,
forecast, nowcast, spatial, network, anomalies, resilience, policy, survival, causal}`.
`coverage.geography`: `{name, fips, scopeNote}`. County models concern Morris County;
tract results concern all available Morris County tracts, not just Mount Olive.
`sources[]`: `{id, name, url, retrievedAt, observationStart, observationEnd,
geography, frequency, variables, sha256, cachePath, notes}`.
`coverage`: `{geography, observedDataOnly, vintagePolicy, warnings, acquisitionErrors}`.

Every model: `{id, title, status, evidenceType, method, sourceIds, requirements,
limitations, result}`. `status` is `ready | experimental | blocked`.
`evidenceType` is `observed | modeled | conditional | readiness`.
`method`: `{name, library, formula, description}`.
`requirements[]`: `{name, met, detail}`. `limitations` is a string array.
Blocked models have `result: null`. Do not replace this with zero or a score.

## Result fields by model key

- `health`: `{indexName, interpretation, overallEconomicHealthScore:null,
  variables:[{id,label,direction}], explainedVarianceRatio, loadings:[{variable,weight}],
  sampleSize, conditionNumber, stability:{medianLoadingCosine,p10LoadingCosine},
  tracts:[{geoid,name,score,componentScore,latitude,longitude}], validation}`.
  This is exploratory cross-sectional household socioeconomic context, not an
  operational local economic health index or a time-series momentum measure.
- `forecast`: `{target,unit,frequency,seasonalAdjustment,trainingStart,
  observedThrough,selectedModel,intervalLevel,history:[{date,value}],
  predictions:[{date,value,lower,upper}],validation:{design,vintagePolicy,
  folds,metrics:[{model,mae,rmse,coverage,meanIntervalWidth,n}],
  holdoutMetrics:[{model,mae,rmse,coverage,meanIntervalWidth,n}],
  predictions:[{origin,date,actual,model,value,lower,upper}]},diagnostics}`.
- `nowcast`: `{target,unit,asOfMonth,observedThrough,informationSet,
  monthsBeyondObservation,intervalLevel,estimate:{date,value,lower,upper},
  path:[{date,value,lower,upper}],stateSpaceModel}`.
  This is a model projection to the current month using lagged official data;
  no unobserved high-frequency signals or local GDP growth are implied.
- `spatial`: `{variable,unit,period,n,permutations,weightDefinition,
  global:{statistic,expected,pValue},sensitivity:[{k,statistic,pValue}],
  tracts:[{geoid,name,value,marginOfError,latitude,longitude,
  standardizedValue,spatialLag,localI,pValue,qValue,cluster}],measurementError}`.
  `cluster`: `high-high | low-low | high-low | low-high | not-significant`.
- `network`: `{year,measure,referenceGeography,nGeographies,
  nodes:[{id,label,establishments,employment,share,rca,degree,weightedDegree,
  betweenness,community,x,y}],edges:[{source,target,weight}],
  counties:[{fips,name,establishments,diversity,entropy}],
  concentration:{hhi,effectiveSectors,normalizedEntropy},edgeMeaning,
  complexityReadiness,annualTotals:[{year,establishments,employment,payrollThousands}],
  directoryNetwork:{nodes:[{id,label,industry,latitude,longitude,x,y,degree,
  betweenness,community}],edges:[{source,target,relation,distanceKm}],
  relationTypes,coverageNote}}`.
  Edges are similarity in observed county specialization, never transactions.
- `anomalies`: `{target,unit,threshold,calibrationCount,
  observations:[{date,value,expected,residual,score,pValue,qValue,flagged}],
  alerts:[same shape],falseDiscoveryRate,interpretation}`.
- `resilience`: `{basis,sectorId,sectorLabel,shockFraction,
  directExposureShare,directExposureEquivalentEstablishments,
  assumptions,scenarios:[{coupling,aggregateExposureShare,
  sectors:[{id,label,directShock,totalShock,weightedExposure}]}],
  sensitivity:[{shockFraction,coupling,aggregateExposureShare}]}`.
  Exposure units are scenario-weighted establishment shares, not lost businesses,
  jobs, output or dollars. Coupling is an explicit assumption.
- `policy`: `{assumptionSource,budget,unit,objective,
  allocation:[{id,label,units,cost,assumedBenefit}],totalCost,totalAssumedBenefit,
  constraints,frontier:[{budget,feasible,objective}],solver}`.
  Reserved result shape; the Python artifact emits `status: blocked, result: null`.
  Main's browser policy lab owns live user assumptions and the optimization solver.
  Python does not emit proposal costs, benefits or an independently fitted policy effect.
- `survival`, `causal`: blocked readiness envelopes with requirements and method;
  reusable estimators are tested only against synthetic fixtures.

The main application may read selected display fields; extra fields can be added
compatibly. Changing field meanings requires a new schema version.

## Display and validation additions

`coverage.tractBoundaryUrl` is `/economy/tracts.geojson`. Both `GEOID` and `geoid`
properties contain the full `14000US...` value matching analytical tract rows;
`fips` contains the eleven-digit numeric FIPS string. Excluded analytical tracts
remain in the boundary file and must display missing values, not zero scores.

`health.result.orientationGatePassed` is false in the observed snapshot because
PC1 has a negative employment/population loading. This forbids interpreting a
higher component score as uniformly healthier; overallEconomicHealthScore is null.

`forecast.result.diagnostics.holdoutAssessment` reports selectedModelMae,
seasonalNaiveMae, selectedModelBeatsSeasonalNaive, observedIntervalCoverage and note.
The selected model is retained after holdout even when it loses to the baseline.

`network.result.sectorCoverage` contains included/excluded sector arrays,
includedMorrisEstablishments, excludedMorrisEstablishments,
totalMorrisEstablishments, morrisEstablishmentShare and exclusionReason.
The current complete-sector matrix includes 16 sectors and 21 actual NJ counties,
covering 16,343 of 16,518 Morris establishments (98.94%). Missing source rows are
not interpreted as zero. Directory centrality is distinct from county industry RCA.
