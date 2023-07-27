import {
  Container,
  appendChildToContainer,
  commitUpdate,
  removeChild,
} from "hostConfig";
import { FiberNode, FiberRootNode } from "./fiber";
import {
  ChildDeletion,
  MutationMask,
  NoFlags,
  Placement,
  Update,
} from "./fiberFlags";
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from "./workTags";

let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (finishedWork: FiberNode) => {
  nextEffect = finishedWork;

  while (nextEffect !== null) {
    // 向下遍历
    const child: FiberNode | null = nextEffect.child;

    if (
      (nextEffect.subtreeFlags & MutationMask) !== NoFlags &&
      child !== null
    ) {
      nextEffect = child;
    } else {
      // 向右遍历
      up: while (nextEffect !== null) {
        commitMutationEffectsOnFiber(nextEffect);
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

const commitMutationEffectsOnFiber = (finishedWork: FiberNode) => {
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
        commitDeletion(deletions[i]);
      }
    }
  }
};

function commitDeletion(childToDelete: FiberNode) {
  let rootHostNode: FiberNode | null = null;

  // 递归子树
  commitNestedComponent(childToDelete, (unMountFiber) => {
    switch (unMountFiber.tag) {
      case HostComponent:
        if (rootHostNode === null) {
          rootHostNode = unMountFiber;
        }
        // TODO 解绑ref
        return;
      case HostText:
        if (rootHostNode === null) {
          rootHostNode = unMountFiber;
        }
        return;
      case FunctionComponent:
        // TODO useEffect unmount
        return;
      default:
        if (__DEV__) {
          console.warn("未处理的unmount类型", unMountFiber);
        }
        break;
    }
  });

  // 移除rootHostComponent的DOM
  if (rootHostNode !== null) {
    const hostParent = getHostParent(childToDelete);
    if (hostParent !== null)
      removeChild((rootHostNode as FiberNode).stateNode, hostParent);
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
  // finishedWork DOM append to parent DOM
  if (hostParent !== null)
    appendPlacementNodeIntoContainer(finishedWork, hostParent);
};

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

function appendPlacementNodeIntoContainer(
  finishedWork: FiberNode,
  hostParent: Container
) {
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    appendChildToContainer(hostParent, finishedWork.stateNode);
    return;
  }
  const child = finishedWork.child;
  if (child !== null) {
    appendPlacementNodeIntoContainer(child, hostParent);
    let sibling = child.sibling;

    while (sibling !== null) {
      appendPlacementNodeIntoContainer(sibling, hostParent);
      sibling = sibling.sibling;
    }
  }
}
