export type Requirement = { name: string; met: boolean; detail: string };
export type Model<T> = {
  id: string;
  title: string;
  status: "ready" | "experimental" | "blocked";
  evidenceType: "observed" | "modeled" | "conditional" | "readiness";
  method: {
    name: string;
    library: string;
    formula: string;
    description: string;
  };
  sourceIds: string[];
  requirements: Requirement[];
  limitations: string[];
  result: T | null;
};
export type Prediction = {
  date: string;
  value: number;
  lower: number;
  upper: number;
};
export type Validation = {
  model: string;
  mae: number;
  rmse: number;
  coverage: number;
  meanIntervalWidth: number;
  n: number;
};
export type Forecast = {
  target: string;
  unit: string;
  frequency: string;
  seasonalAdjustment: string;
  trainingStart: string;
  observedThrough: string;
  selectedModel: string;
  intervalLevel: number;
  history: { date: string; value: number | null }[];
  predictions: Prediction[];
  validation: {
    design: string;
    vintagePolicy: string;
    folds: number;
    metrics: Validation[];
    holdoutMetrics: Validation[];
    predictions: ({
      origin: string;
      actual: number;
      model: string;
    } & Prediction)[];
  };
  diagnostics: unknown;
};
export type Nowcast = {
  target: string;
  unit: string;
  asOfMonth: string;
  observedThrough: string;
  informationSet: string;
  monthsBeyondObservation: number;
  intervalLevel: number;
  estimate: Prediction;
  path: Prediction[];
  stateSpaceModel: string;
};
export type Tract = {
  geoid: string;
  name: string;
  value: number;
  marginOfError: number | null;
  latitude: number;
  longitude: number;
  standardizedValue: number;
  spatialLag: number;
  localI: number;
  pValue: number;
  qValue: number;
  cluster: string;
};
export type Spatial = {
  variable: string;
  unit: string;
  period: string;
  n: number;
  permutations: number;
  weightDefinition: string;
  global: { statistic: number; expected: number; pValue: number };
  sensitivity: { k: number; statistic: number; pValue: number }[];
  tracts: Tract[];
  measurementError: unknown;
};
export type Health = {
  indexName: string;
  interpretation: string;
  overallEconomicHealthScore: null;
  orientationGatePassed: boolean;
  variables: { id: string; label: string; direction: number }[];
  explainedVarianceRatio: number;
  loadings: { variable: string; weight: number }[];
  sampleSize: number;
  conditionNumber: number;
  stability: { medianLoadingCosine: number; p10LoadingCosine: number };
  tracts: {
    geoid: string;
    name: string;
    score: number;
    componentScore: number;
    latitude: number;
    longitude: number;
  }[];
  validation: unknown;
};
export type NetworkNode = {
  id: string;
  label: string;
  establishments: number;
  employment: number | null;
  share: number;
  rca: number;
  degree: number;
  weightedDegree: number;
  betweenness: number;
  community: number;
  x: number;
  y: number;
};
export type Network = {
  year: number;
  measure: string;
  referenceGeography: string;
  nGeographies: number;
  nodes: NetworkNode[];
  edges: { source: string; target: string; weight: number }[];
  counties: {
    fips: string;
    name: string;
    establishments: number;
    diversity: number;
    entropy: number;
  }[];
  concentration: {
    hhi: number;
    effectiveSectors: number;
    normalizedEntropy: number;
  };
  sectorCoverage: {
    included: string[];
    excluded: string[];
    includedMorrisEstablishments: number;
    excludedMorrisEstablishments: number;
    totalMorrisEstablishments: number;
    exclusionReason: string;
    morrisEstablishmentShare: number;
  };
  edgeMeaning: string;
  complexityReadiness: string;
  annualTotals: {
    year: number;
    establishments: number;
    employment: number;
    payrollThousands: number;
  }[];
  directoryNetwork: {
    nodes: {
      id: string;
      label: string;
      industry: string;
      latitude: number;
      longitude: number;
      x: number;
      y: number;
      degree: number;
      betweenness: number;
      community: number;
    }[];
    edges: {
      source: string;
      target: string;
      relation: string;
      distanceKm: number;
    }[];
    relationTypes: string[];
    coverageNote: string;
  };
};
export type Anomaly = {
  date: string;
  value: number;
  expected: number;
  residual: number;
  score: number;
  pValue: number;
  qValue: number;
  flagged: boolean;
};
export type Anomalies = {
  target: string;
  unit: string;
  threshold: number;
  calibrationCount: number;
  observations: Anomaly[];
  alerts: Anomaly[];
  falseDiscoveryRate: number;
  interpretation: string;
};
export type Resilience = {
  basis: string;
  sectorId: string;
  sectorLabel: string;
  shockFraction: number;
  directExposureShare: number;
  directExposureEquivalentEstablishments: number;
  assumptions: string[];
  scenarios: {
    coupling: number;
    aggregateExposureShare: number;
    sectors: {
      id: string;
      label: string;
      directShock: number;
      totalShock: number;
      weightedExposure: number;
    }[];
  }[];
  sensitivity: {
    shockFraction: number;
    coupling: number;
    aggregateExposureShare: number;
  }[];
};
export type EconomicSource = {
  id: string;
  name: string;
  url: string;
  retrievedAt: string | null;
  observationStart: string | null;
  observationEnd: string | null;
  geography: string;
  frequency: string;
  variables: string[];
  sha256: string;
  cachePath: string;
  notes: string[];
};
export type EconomyResults = {
  schemaVersion: string;
  generatedAt: string;
  asOfDate: string;
  sources: EconomicSource[];
  coverage: {
    geography: { name: string; fips: string; scopeNote: string };
    observedDataOnly: boolean;
    vintagePolicy: string;
    warnings: string[];
    acquisitionErrors: string[];
  };
  health: Model<Health>;
  forecast: Model<Forecast>;
  nowcast: Model<Nowcast>;
  spatial: Model<Spatial>;
  network: Model<Network>;
  anomalies: Model<Anomalies>;
  resilience: Model<Resilience>;
  policy: Model<unknown>;
  survival: Model<unknown>;
  causal: Model<unknown>;
};
export type EconomicView =
  | "demand"
  | "pulse"
  | "overview"
  | "health"
  | "labor"
  | "industry"
  | "spatial"
  | "network"
  | "dynamics"
  | "resilience"
  | "policy"
  | "evidence"
  | "research";
