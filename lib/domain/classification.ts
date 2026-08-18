/** A single provider value with its source provenance. */
export type Observed<T> = {
  kind: 'observed';
  value: T;
  source: 'apollo' | 'semrush';
  observedAt: string;
  database?: string;
  rawRef?: string;
};

/** A deterministic result and the evidence references it was calculated from. */
export type Calculated<T> = {
  kind: 'calculated';
  value: T;
  inputs: string[];
  calculatedAt: string;
};

/** An agent-produced interpretation that is explicitly separate from provider facts. */
export type Inferred<T> = {
  kind: 'inferred';
  value: T;
  evidenceRefs: string[];
  confidence: 'high' | 'medium' | 'low';
};

/** A classified object group with one direct-field payload and provenance metadata. */
export type ObservedGroup<T extends object> = T & {
  classification: 'observed';
  source: 'apollo' | 'semrush';
  observedAt: string;
  database?: string;
  rawRef?: string;
};

export type CalculatedGroup<T extends object> = T & {
  classification: 'calculated';
  inputs: string[];
  calculatedAt: string;
};

export type InferredGroup<T extends object> = T & {
  classification: 'inferred';
  evidenceRefs: string[];
  confidence: 'high' | 'medium' | 'low';
};
