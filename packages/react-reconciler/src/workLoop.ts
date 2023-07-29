import { beginWork } from "./beginWork";
import { commitMutationEffects } from "./commitWork";
import { completeWork } from "./completeWork";
import { FiberNode, FiberRootNode, createWorkInProgress } from "./fiber";
import { MutationMask, NoFlags } from "./fiberFlags";
import { HostRoot } from "./workTags";

// workInProgress 为当前正在工作的 fiberNode
let workInProgress: FiberNode | null = null;

function prepareFreshStack(root: FiberRootNode) {
  workInProgress = createWorkInProgress(root.current, null);
}

export function scheduleUpdateOnFiber(fiber: FiberNode) {
  // 调度功能
  const root = markUpdateFromFiberToRoot(fiber);
  renderRoot(root);
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

function renderRoot(root: FiberRootNode) {
  // 初始化
  prepareFreshStack(root);

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

  commitRoot(root);
}

function commitRoot(root: FiberRootNode) {
  const finishedWork = root.finishedWork;

  if (finishedWork === null) return;

  if (__DEV__) {
    console.warn("commit阶段开始", finishedWork);
  }

  // 重置
  root.finishedWork = null;

  // 判断是否存在3个子阶段需要执行的操作
  // root subtreeFlags root flags
  const subtreeHasEffect =
    (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;
  if (subtreeHasEffect || rootHasEffect) {
    // 1. before mutation
    // 2. mutation Placement
    commitMutationEffects(finishedWork);
    root.current = finishedWork;
    // 3. layout
  } else {
    root.current = finishedWork;
  }
}

function workLoop() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(wip: FiberNode) {
  const next = beginWork(wip);
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
