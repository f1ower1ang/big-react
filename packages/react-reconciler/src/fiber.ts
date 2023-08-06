/* eslint-disable @typescript-eslint/no-explicit-any */
import { Key, Props, ReactElementType, Ref } from "share/ReactTypes";
import {
  FunctionComponent,
  HostComponent,
  WorkTag,
  Fragment,
} from "./workTags";
import { Flags, NoFlags } from "./fiberFlags";
import { Container } from "hostConfig";
import { Lane, Lanes, NoLane, NoLanes } from "./fiberLanes";
import { Effect } from "./fiberHooks";
import { CallbackNode } from "scheduler";

export interface PendingPassiveEffects {
  unmount: Effect[];
  update: Effect[];
}

export class FiberNode {
  type: any;
  tag: WorkTag;
  key: Key;
  stateNode: any;
  ref: Ref;

  return: FiberNode | null;
  sibling: FiberNode | null;
  child: FiberNode | null;
  index: number;

  pendingProps: Props | null;
  memorizedProps: Props | null;
  memorizedState: any;
  alternate: FiberNode | null;
  flags: Flags;
  subtreeFlags: Flags;
  updateQueue: unknown;
  deletions: FiberNode[] | null;

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    // React Element 实例
    this.tag = tag;
    this.key = key || null;
    // 对于 HostComponent，stateNode 为 DOM 节点；对于 FunctionComponent，stateNode 为 null; 对于 ClassComponent，stateNode 为实例
    this.stateNode = null;
    // 对于 FunctionComponent，type 为函数；对于 HostComponent，type 为 DOM 节点的类型（如 div）; 对于 ClassComponent，type 为类
    this.type = null;

    // 构建 fiberNode 树
    // 父 fiberNode
    this.return = null;
    // 兄弟
    this.sibling = null;
    // 子
    this.child = null;
    this.index = 0;

    // ref 为函数或者字符串
    this.ref = null;

    // 作为工作单元
    this.pendingProps = pendingProps;
    this.memorizedProps = null;
    this.memorizedState = null;
    this.updateQueue = null;

    // 双缓存机制
    this.alternate = null;
    // 副作用
    this.flags = NoFlags;
    this.subtreeFlags = NoFlags;
    this.deletions = null;
  }
}

/**
 * FiberRootNode
 * @param container DOM 节点
 * @param hostRootFiber FiberNode
 */
export class FiberRootNode {
  container: Container;
  current: FiberNode;
  // 双缓存机制
  finishedWork: FiberNode | null;
  pendingLanes: Lanes;
  finishedLane: Lane;
  pendingPassiveEffects: PendingPassiveEffects;

  callbackNode: CallbackNode | null;
  callbackPriority: Lane;

  constructor(container: Container, hostRootFiber: FiberNode) {
    this.container = container;
    this.current = hostRootFiber;
    hostRootFiber.stateNode = this;
    this.finishedWork = null;
    this.pendingLanes = NoLanes;
    this.finishedLane = NoLane;

    this.callbackNode = null;
    this.callbackPriority = NoLane;

    this.pendingPassiveEffects = {
      unmount: [],
      update: [],
    };
  }
}

export const createWorkInProgress = (
  current: FiberNode,
  pendingProps: Props
): FiberNode => {
  // 双缓存机制
  let wip = current.alternate;

  if (wip === null) {
    // mount
    wip = new FiberNode(current.tag, pendingProps, current.key);
    wip.stateNode = current.stateNode;

    wip.alternate = current;
    current.alternate = wip;
  } else {
    // update
    wip.pendingProps = pendingProps;
    wip.flags = NoFlags;
    wip.subtreeFlags = NoFlags;
    wip.deletions = null;
  }
  wip.type = current.type;
  wip.updateQueue = current.updateQueue;
  wip.child = current.child;
  wip.memorizedProps = current.memorizedProps;
  wip.memorizedState = current.memorizedState;
  wip.ref = current.ref;

  return wip;
};

export function createFiberFromElement(element: ReactElementType): FiberNode {
  const { type, key, props, ref } = element;
  let fiberTag: WorkTag = FunctionComponent;

  if (typeof type === "string") {
    // <div /> type: 'div'
    fiberTag = HostComponent;
  } else if (typeof type !== "function" && __DEV__) {
    console.warn("未定义的type类型", element);
  }
  const fiber = new FiberNode(fiberTag, props, key);
  fiber.type = type;
  fiber.ref = ref;
  return fiber;
}

export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
  const fiber = new FiberNode(Fragment, elements, key);
  return fiber;
}
