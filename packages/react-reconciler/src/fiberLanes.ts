import { FiberRootNode } from "./fiber";

export type Lane = number;
export type Lanes = number;

export const NoLanes: Lane = 0;
export const NoLane: Lane = 0;
export const SyncLane: Lane = 1;

export function mergeLanes(a: Lane, b: Lane): Lane {
  return a | b;
}

export function requestUpdateLane(): Lane {
  return SyncLane;
}

export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes;
}

export function markRootFinished(root: FiberRootNode, lane: Lane) {
  root.pendingLanes &= ~lane;
}
