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
  lanesToSchedulerPriority,
  markRootFinished,
  mergeLanes,
} from "./fiberLanes";
import { flushSyncCallbacks, scheduleSyncCallback } from "./syncTaskQueue";
import { HostRoot } from "./workTags";
import {
  unstable_scheduleCallback as scheduleCallback,
  unstable_NormalPriority as NormalPriority,
  unstable_shouldYield,
  unstable_cancelCallback,
} from "scheduler";
import { HookHasEffect, Passive } from "./hookEffectTags";

// workInProgress 为当前正在工作的 fiberNode
let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;
let rootDoesHavePassiveEffects = false;

type RootExitStatus = number;
const RootIncomplete = 1;
const RootCompleted = 2;
// TODO 执行过程中报错

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  root.finishedLane = NoLane;
  root.finishedWork = null;
  workInProgress = createWorkInProgress(root.current, null);
  wipRootRenderLane = lane;
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  // 调度功能
  const root = markUpdateFromFiberToRoot(fiber) as FiberRootNode;
  markRootUpdated(root, lane);
  ensureRootIsScheduled(root);
}

function ensureRootIsScheduled(root: FiberRootNode) {
  const updateLane = getHighestPriorityLane(root.pendingLanes);
  const existingCallbackNode = root.callbackNode;

  if (updateLane === NoLane) {
    if (existingCallbackNode !== null) {
      unstable_cancelCallback(existingCallbackNode);
    }
    root.callbackNode = null;
    root.callbackPriority = NoLane;
    return;
  }

  const curPriority = updateLane;
  const prevPriority = root.callbackPriority;

  if (curPriority === prevPriority) {
    return;
  }

  if (existingCallbackNode !== null) {
    unstable_cancelCallback(existingCallbackNode);
  }
  let newCallbackNode = null;

  if (updateLane === SyncLane) {
    // 同步优先级 用微任务调度
    if (__DEV__) {
      console.log("在微任务中调度，优先级：", updateLane);
    }
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
    scheduleMicrotask(flushSyncCallbacks);
  } else {
    // 其他优先级 用宏任务调度
    if (__DEV__) {
      console.log("在宏任务中调度，优先级：", updateLane);
    }
    const schedulerPriority = lanesToSchedulerPriority(updateLane);
    newCallbackNode = scheduleCallback(
      schedulerPriority,
      // @ts-ignore
      performConcurrentWorkOnRoot.bind(null, root)
    );
  }
  root.callbackNode = newCallbackNode;
  root.callbackPriority = curPriority;
}

function markRootUpdated(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

// 从 fiberNode 开始，一直向上寻找，直到找到 HostRoot
function markUpdateFromFiberToRoot(fiber: FiberNode): FiberRootNode | null {
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

function performConcurrentWorkOnRoot(
  root: FiberRootNode,
  didTimeout: boolean
): any {
  // 触发所有 useEffect 回调，因为其中可能存在更高优先级的更新
  const curCallback = root.callbackNode;
  const didFlushPassiveEffects = flushPassiveEffects(
    root.pendingPassiveEffects
  );
  if (didFlushPassiveEffects) {
    if (root.callbackNode !== curCallback) {
      return null;
    }
  }

  const lane = getHighestPriorityLane(root.pendingLanes);
  const curCallbackNode = root.callbackNode;
  if (lane === NoLane) return null;
  const needSync = lane === SyncLane || didTimeout;
  // render 阶段
  const exitStatus = renderRoot(root, lane, !needSync);

  ensureRootIsScheduled(root);

  if (exitStatus === RootIncomplete) {
    // 中断
    if (root.callbackNode !== curCallbackNode) {
      return null;
    }
    return performConcurrentWorkOnRoot.bind(null, root);
  }
  if (exitStatus === RootCompleted) {
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLane = lane;
    wipRootRenderLane = NoLane;

    commitRoot(root);
  } else if (__DEV__) {
    console.error("还未实现的同步更新结束状态");
  }
}

function performSyncWorkOnRoot(root: FiberRootNode) {
  const nextLane = getHighestPriorityLane(root.pendingLanes);

  if (nextLane !== SyncLane) {
    // 其他比SyncLane低的优先级
    // NoLane
    ensureRootIsScheduled(root);
    return;
  }

  const exitStatus = renderRoot(root, nextLane, false);
  if (exitStatus === RootCompleted) {
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLane = nextLane;
    wipRootRenderLane = NoLane;

    commitRoot(root);
  } else if (__DEV__) {
    console.error("还未实现的同步更新结束状态");
  }
}

function renderRoot(
  root: FiberRootNode,
  lane: Lane,
  shouldTimeSlice: boolean
): RootExitStatus {
  if (__DEV__) {
    console.log(`开始${shouldTimeSlice ? "并发" : "同步"}更新`, root);
  }

  if (wipRootRenderLane !== lane) {
    // 初始化
    prepareFreshStack(root, lane);
  }

  do {
    try {
      shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
      break;
    } catch (e) {
      if (__DEV__) {
        console.warn("workLoop error occur", e);
      }
      workInProgress = null;
    }
  } while (true);

  // 中断执行
  if (shouldTimeSlice && workInProgress !== null) {
    return RootIncomplete;
  }
  // render阶段执行完毕
  if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
    console.error("render阶段结束时wip不应该不是null");
  }
  // TODO 报错
  return RootCompleted;
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
  let didFlushPassiveEffects = false;

  pendingPassiveEffects.unmount.forEach((effect) => {
    didFlushPassiveEffects = true;
    commitHookEffectListUnmount(Passive, effect);
  });
  pendingPassiveEffects.unmount = [];

  pendingPassiveEffects.update.forEach((effect) => {
    didFlushPassiveEffects = true;
    commitHookEffectListDestroy(Passive | HookHasEffect, effect);
  });
  pendingPassiveEffects.update.forEach((effect) => {
    didFlushPassiveEffects = true;
    commitHookEffectListCreate(Passive | HookHasEffect, effect);
  });
  pendingPassiveEffects.update = [];
  // useEffect回调中可能会调用setState，所以需要清空syncQueue
  flushSyncCallbacks();
  return didFlushPassiveEffects;
}

function workLoopConcurrent() {
  while (workInProgress !== null && !unstable_shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}

function workLoopSync() {
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
