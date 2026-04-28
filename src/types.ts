import type * as CANNON from 'cannon-es';
import type * as THREE from 'three';

export type SlotResult = {
  index: number;
  label: string;
  multiplier: number;
};

export type SyncPair = {
  body: CANNON.Body;
  mesh: THREE.Object3D;
};
