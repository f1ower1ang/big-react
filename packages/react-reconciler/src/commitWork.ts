import {
  Container,
  Instance,
  appendChildToContainer,
  commitUpdate,
  insertChildToContainer,
  removeChild,
} from "hostConfig";
import { FiberNode, FiberRootNode, PendingPassiveEffects } from "./fiber";
import {
  ChildDeletion,
  Flags,
  MutationMask,
  NoFlags,
  PassiveEffect,
  PassiveMask,
  Placement,
  Update,
} from "./fiberFlags";
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from "./workTags";
import { Effect, FCUpdateQueue } from "./fiberHooks";
import { HookHasEffect } from "./hookEffectTags";

let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (
  finishedWork: FiberNode,
  root: FiberRootNode
) => {
  nextEffect = finishedWork;

  while (nextEffect !== null) {
    // 向下遍历
    const child: FiberNode | null = nextEffect.child;

    if (
      (nextEffect.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags &&
      child !== null
    ) {
      nextEffect = child;
    } else {
      // 向右遍历
      up: while (nextEffect !== null) {
        commitMutationEffectsOnFiber(nextEffect, root);
        const sibling: FiberNode | null = nextEffect.sibling;
        if (sibling !== null) {
          nextEffect = sibling;
          break up;
        }
        // 向上遍历
        nextEffect = nextEffect.return;
      }
    }
  }
};

const commitMutationEffectsOnFiber = (
  finishedWork: FiberNode,
  root: FiberRootNode
) => {
  const flags = finishedWork.flags;

  if ((flags & Placement) !== NoFlags) {
    commitPlacement(finishedWork);
    finishedWork.flags &= ~Placement;
  }
  if ((flags & Update) !== NoFlags) {
    commitUpdate(finishedWork);
    finishedWork.flags &= ~Update;
  }
  if ((flags & ChildDeletion) !== NoFlags) {
    const deletions = finishedWork.deletions;
    if (deletions !== null) {
      for (let i = 0; i < deletions.length; i++) {
        commitDeletion(deletions[i], root);
      }
    }
  }
  if ((flags & PassiveEffect) !== NoFlags) {
    // 收集回调
    commitPassiveEffect(finishedWork, root, "update");
    finishedWork.flags &= ~PassiveEffect;
  }
};

function commitPassiveEffect(
  fiber: FiberNode,
  root: FiberRootNode,
  type: keyof PendingPassiveEffects
) {
  // update
  if (
    fiber.tag !== FunctionComponent ||
    (type === "update" && (fiber.flags & PassiveEffect) === NoFlags)
  ) {
    return;
  }
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
  if (updateQueue !== null) {
    if (updateQueue.lastEffect === null) {
      if (__DEV__)
        console.error("当FC存在PassiveEffect flag时，不应该不存在effect");
    } else {
      root.pendingPassiveEffects[type].push(updateQueue.lastEffect);
    }
  }
}

function commitHookEffectList(
  flags: Flags,
  lastEffect: Effect,
  callback: (effect: Effect) => void
) {
  let effect = lastEffect.next as Effect;

  do {
    if ((effect.tag & flags) === flags) {
      callback(effect);
    }
    effect = effect.next as Effect;
  } while (effect !== lastEffect.next);
}

export function commitHookEffectListUnmount(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destroy = effect.destroy;
    if (typeof destroy === "function") {
      destroy();
    }
    effect.tag &= ~HookHasEffect;
  });
}

export function commitHookEffectListDestroy(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destroy = effect.destroy;
    if (typeof destroy === "function") {
      destroy();
    }
  });
}

export function commitHookEffectListCreate(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const create = effect.create;
    if (typeof create === "function") {
      effect.destroy = create();
    }
  });
}

function recordHostChildrenToDelete(
  childrenToDeleted: FiberNode[],
  unMountFiber: FiberNode
) {
  // 1. 找到第一个 root host节点
  const lastOne = childrenToDeleted.at(-1);

  // 处理 Fragment 的情况
  if (!lastOne) {
    childrenToDeleted.push(unMountFiber);
  } else {
    // 2. 每找到一个host节点，判断下这个节点是不是 1 找到那个节点的兄弟节点，如果是，就不用删除了
    let node = lastOne.sibling;
    while (node !== null) {
      if (unMountFiber === node) {
        childrenToDeleted.push(unMountFiber);
      }
      node = node.sibling;
    }
  }
}

function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
  const rootChildrenToDeleted: FiberNode[] = [];

  // 递归子树
  commitNestedComponent(childToDelete, (unMountFiber) => {
    switch (unMountFiber.tag) {
      case HostComponent:
        recordHostChildrenToDelete(rootChildrenToDeleted, unMountFiber);
        // TODO 解绑ref
        return;
      case HostText:
        recordHostChildrenToDelete(rootChildrenToDeleted, unMountFiber);
        return;
      case FunctionComponent:
        // TODO 解绑ref
        commitPassiveEffect(unMountFiber, root, "unmount");
        return;
      default:
        if (__DEV__) {
          console.warn("未处理的unmount类型", unMountFiber);
        }
        break;
    }
  });

  // 移除rootHostComponent的DOM
  if (rootChildrenToDeleted.length) {
    const hostParent = getHostParent(childToDelete);
    if (hostParent !== null) {
      rootChildrenToDeleted.forEach((node) => {
        removeChild(node.stateNode, hostParent);
      });
    }
  }
  childToDelete.return = null;
  childToDelete.child = null;
}

function commitNestedComponent(
  root: FiberNode,
  onCommitUnmount: (fiber: FiberNode) => void
) {
  let node = root;
  while (true) {
    onCommitUnmount(node);

    if (node.child !== null) {
      // 递归子树
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === root) {
      return;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === root) {
        return;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

const commitPlacement = (finishedWork: FiberNode) => {
  if (__DEV__) {
    console.warn("执行Placement操作", finishedWork);
  }
  // parent DOM
  const hostParent = getHostParent(finishedWork);

  // host sibling
  const sibling = getHostSibling(finishedWork);

  // finishedWork DOM append to parent DOM
  if (hostParent !== null)
    insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling);
};

function getHostSibling(fiber: FiberNode) {
  let node: FiberNode = fiber;
  findSibling: while (true) {
    while (node.sibling === null) {
      const parent = node.return;

      if (
        parent === null ||
        parent.tag === HostComponent ||
        parent.tag === HostRoot
      ) {
        return null;
      }
      node = parent;
    }
    node.sibling.return = node.return;
    node = node.sibling;

    while (node.tag !== HostText && node.tag !== HostComponent) {
      // 向下遍历
      if ((node.flags & Placement) !== NoFlags) {
        continue findSibling;
      }
      if (node.child === null) {
        continue findSibling;
      } else {
        node.child.return = node;
        node = node.child;
      }
    }

    if ((node.flags & Placement) === NoFlags) {
      return node.stateNode;
    }
  }
}

function getHostParent(fiber: FiberNode) {
  let parent = fiber.return;

  while (parent) {
    const parentTag = parent.tag;
    if (parentTag === HostComponent) {
      return parent.stateNode as Container;
    }
    if (parentTag === HostRoot) {
      return (parent.stateNode as FiberRootNode).container;
    }
    parent = parent.return;
  }
  if (__DEV__) {
    console.warn("未找到HostParent", fiber);
  }
  return null;
}

function insertOrAppendPlacementNodeIntoContainer(
  finishedWork: FiberNode,
  hostParent: Container,
  before?: Instance
) {
  // fiber host
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    if (before) {
      insertChildToContainer(hostParent, finishedWork.stateNode, before);
    } else {
      appendChildToContainer(hostParent, finishedWork.stateNode);
    }
    return;
  }
  const child = finishedWork.child;
  if (child !== null) {
    insertOrAppendPlacementNodeIntoContainer(child, hostParent);
    let sibling = child.sibling;

    while (sibling !== null) {
      insertOrAppendPlacementNodeIntoContainer(sibling, hostParent);
      sibling = sibling.sibling;
    }
  }
}
