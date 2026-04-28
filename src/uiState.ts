export type BucketId = 'L3' | 'L2' | 'L1' | 'CTR' | 'R1' | 'R2' | 'R3';

export type BucketConfig = {
  id: BucketId;
  points: number;
};

export type LandingEntry = {
  id: BucketId;
  points: number;
  stamp: string;
};

export type TerminalState = {
  active: boolean;
  score: number;
  elapsedSeconds: number;
  landings: LandingEntry[];
  distribution: Record<BucketId, number>;
  stats: {
    left: number;
    center: number;
    right: number;
  };
  flashBucket?: BucketId;
};

export const buckets: BucketConfig[] = [
  { id: 'L3', points: 100 },
  { id: 'L2', points: 200 },
  { id: 'L1', points: 500 },
  { id: 'CTR', points: 1000 },
  { id: 'R1', points: 500 },
  { id: 'R2', points: 200 },
  { id: 'R3', points: 100 }
];

export function createInitialState(): TerminalState {
  return {
    active: false,
    score: 0,
    elapsedSeconds: 0,
    landings: [],
    distribution: Object.fromEntries(buckets.map((bucket) => [bucket.id, 0])) as Record<BucketId, number>,
    stats: {
      left: 0,
      center: 0,
      right: 0
    }
  };
}
