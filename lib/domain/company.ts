import type {CalculatedGroup, InferredGroup, ObservedGroup} from './classification';

/** Inputs used by persistence to resolve, or once assign, an immutable company ID. */
export type CompanyIdentityResolution = {
  canonicalDomain: string;
  apolloAccountId: string;
  apolloRecordId: string;
};

/** The stable shell shared by all curated company projections. */
export type ClassifiedCompany<
  ObservedData extends object,
  CalculatedData extends object = Record<never, never>,
  InferredData extends object = Record<never, never>,
> = {
  /** Undefined until the repository resolves or assigns the immutable ID. */
  companyId?: string;
  identity: CompanyIdentityResolution;
  observed: ObservedGroup<ObservedData>;
  calculated?: CalculatedGroup<CalculatedData>;
  inferred?: InferredGroup<InferredData>;
};
