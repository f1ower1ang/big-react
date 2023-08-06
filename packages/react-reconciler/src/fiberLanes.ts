import { FiberRootNode } from "./fiber";
import {
  unstable_getCurrentPriorityLevel,
  unstable_ImmediatePriority,
  unstable_UserBlockingPriority,
  unstable_NormalPriority,
  unstable_IdlePriority,
} from "scheduler";

export type Lane = number;
export type Lanes = number;

export const NoLanes: Lane = 0;
export const NoLane: Lane = 0;
export const SyncLane: Lane = 1;
export const InputContinuousLane: Lane = 1 << 1;
export const DefaultLane: Lane = 1 << 2;
export const TransitionLane: Lane = 1 << 3;
export const IdleLane: Lane = 1 << 4;

export function mergeLanes(a: Lane, b: Lane): Lane {
  return a | b;
}

export function requestUpdateLane(): Lane {
  // 从上下文中获取当前的scheduler优先级
  const currentSchedulerPriority = unstable_getCurrentPriorityLevel();
  const lane = schedulerPriorityToLane(currentSchedulerPriority);
  return lane;
}

export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes;
}

export function isSubsetOfLanes(set: Lanes, subset: Lane): boolean {
  return (set & subset) === subset;
}

export function markRootFinished(root: FiberRootNode, lane: Lane) {
  root.pendingLanes &= ~lane;
}

export function lanesToSchedulerPriority(lanes: Lanes) {
  const lane = getHighestPriorityLane(lanes);
  if (lane === SyncLane) {
    return unstable_ImmediatePriority;
  }
  if (lane === InputContinuousLane) {
    return unstable_UserBlockingPriority;
  }
  if (lane === DefaultLane) {
    return unstable_NormalPriority;
  }
  return unstable_IdlePriority;
}

export function schedulerPriorityToLane(schedulerPriority: number): Lane {
  if (schedulerPriority === unstable_ImmediatePriority) {
    return SyncLane;
  }
  if (schedulerPriority === unstable_UserBlockingPriority) {
    return InputContinuousLane;
  }
  if (schedulerPriority === unstable_NormalPriority) {
    return DefaultLane;
  }
  return NoLane;
}
