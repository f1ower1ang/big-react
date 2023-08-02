import { scheduleMicrotask } from "hostConfig";
import { beginWork } from "./beginWork";
import {
  commitHookEffectListCreate,
  commitHookEffectListDestroy,
  commitHookEffectListUnmount,
  commitMutationEffects,
} from "./commitWork";
import { completeWork } from "./completeWork";
import {
  FiberNode,
  FiberRootNode,
  PendingPassiveEffects,
  createWorkInProgress,
} from "./fiber";
import { MutationMask, NoFlags, PassiveMask } from "./fiberFlags";
import {
  Lane,
  NoLane,
  SyncLane,
  getHighestPriorityLane,
  markRootFinished,
  mergeLanes,
} from "./fiberLanes";
import { flushSyncCallbacks, scheduleSyncCallback } from "./syncTaskQueue";
import { HostRoot } from "./workTags";
import {
  unstable_scheduleCallback as scheduleCallback,
  unstable_NormalPriority as NormalPriority,
} from "scheduler";
import { HookHasEffect, Passive } from "./hookEffectTags";

// workInProgress 为当前正在工作的 fiberNode
let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;
let rootDoesHavePassiveEffects = false;

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  workInProgress = createWorkInProgress(root.current, null);
  wipRootRenderLane = lane;
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  // 调度功能
  const root = markUpdateFromFiberToRoot(fiber);
  markRootUpdated(root, lane);
  ensureRootIsScheduled(root);
}

function ensureRootIsScheduled(root: FiberRootNode) {
  const updateLane = getHighestPriorityLane(root.pendingLanes);
  if (updateLane === NoFlags) return;
  if (updateLane === SyncLane) {
    // 同步优先级 用微任务调度
    if (__DEV__) {
      console.log("在微任务中调度，优先级：", updateLane);
    }
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
    scheduleMicrotask(flushSyncCallbacks);
  } else {
    // 其他优先级 用宏任务调度
    if (__DEV__) {
      console.log("在宏任务中调度，优先级：", updateLane);
    }
  }
}

function markRootUpdated(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

// 从 fiberNode 开始，一直向上寻找，直到找到 HostRoot
function markUpdateFromFiberToRoot(fiber: FiberNode) {
  let node = fiber;
  let parent = node.return;
  while (parent !== null) {
    node = parent;
    parent = node.return;
  }
  if (node.tag === HostRoot) {
    return node.stateNode;
  }
  return null;
}

function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
  const nextLane = getHighestPriorityLane(root.pendingLanes);

  if (nextLane !== SyncLane) {
    // 其他比SyncLane低的优先级
    // NoLane
    ensureRootIsScheduled(root);
    return;
  }

  if (__DEV__) {
    console.warn("render阶段开始");
  }

  // 初始化
  prepareFreshStack(root, lane);

  do {
    try {
      workLoop();
      break;
    } catch (e) {
      if (__DEV__) {
        console.warn("workLoop error occur", e);
      }
      workInProgress = null;
    }
  } while (true);

  const finishedWork = root.current.alternate;
  root.finishedWork = finishedWork;
  root.finishedLane = lane;
  wipRootRenderLane = NoLane;

  commitRoot(root);
}

function commitRoot(root: FiberRootNode) {
  const finishedWork = root.finishedWork;

  if (finishedWork === null) return;

  if (__DEV__) {
    console.warn("commit阶段开始", finishedWork);
  }

  const lane = root.finishedLane;

  if (lane === NoLane && __DEV__) {
    console.error("commit阶段finishedLane不应该为NoLane");
  }

  // 重置
  root.finishedWork = null;
  root.finishedLane = NoLane;

  markRootFinished(root, lane);

  if (
    (finishedWork.subtreeFlags & PassiveMask) !== NoFlags ||
    (finishedWork.flags & PassiveMask) !== NoFlags
  ) {
    if (!rootDoesHavePassiveEffects) {
      rootDoesHavePassiveEffects = true;
      // 调度副作用
      scheduleCallback(NormalPriority, () => {
        // 执行副作用
        flushPassiveEffects(root.pendingPassiveEffects);
        return;
      });
    }
  }

  // 判断是否存在3个子阶段需要执行的操作
  // root subtreeFlags root flags
  const subtreeHasEffect =
    (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;
  if (subtreeHasEffect || rootHasEffect) {
    // 1. before mutation
    // 2. mutation Placement
    commitMutationEffects(finishedWork, root);
    root.current = finishedWork;
    // 3. layout
  } else {
    root.current = finishedWork;
  }
  rootDoesHavePassiveEffects = false;
  ensureRootIsScheduled(root);
}

function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
  pendingPassiveEffects.unmount.forEach((effect) => {
    commitHookEffectListUnmount(Passive, effect);
  });
  pendingPassiveEffects.unmount = [];

  pendingPassiveEffects.update.forEach((effect) => {
    commitHookEffectListDestroy(Passive | HookHasEffect, effect);
  });
  pendingPassiveEffects.update.forEach((effect) => {
    commitHookEffectListCreate(Passive | HookHasEffect, effect);
  });
  pendingPassiveEffects.update = [];
  // useEffect回调中可能会调用setState，所以需要清空syncQueue
  flushSyncCallbacks();
}

function workLoop() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(wip: FiberNode) {
  const next = beginWork(wip, wipRootRenderLane);
  wip.memorizedProps = wip.pendingProps;

  if (next === null) {
    completeUnitOfWork(wip);
  } else {
    workInProgress = next;
  }
}

function completeUnitOfWork(wip: FiberNode) {
  let node: FiberNode | null = wip;

  do {
    completeWork(node);
    const sibling = node.sibling;

    if (sibling !== null) {
      workInProgress = sibling;
      return;
    }
    node = node.return;
    workInProgress = node;
  } while (node !== null);
}
