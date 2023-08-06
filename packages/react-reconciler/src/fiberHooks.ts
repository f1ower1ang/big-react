import internals from "share/internals";
import { FiberNode } from "./fiber";
import {
  Update,
  UpdateQueue,
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  processUpdateQueue,
} from "./updateQueue";
import { scheduleUpdateOnFiber } from "./workLoop";
import { Dispatch } from "react";
import { Action } from "share/ReactTypes";
import { Lane, NoLane, requestUpdateLane } from "./fiberLanes";
import { Flags, PassiveEffect } from "./fiberFlags";
import { HookHasEffect, Passive } from "./hookEffectTags";

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
let renderLane: Lane = NoLane;

const { currentDispatcher, currentBatchConfig } = internals;

interface Hook {
  memorizedState: any;
  updateQueue: unknown;
  next: Hook | null;
  baseState: any;
  baseQueue: Update<any> | null;
}

export interface Effect {
  tag: Flags;
  create: EffectCallback | void;
  destroy: EffectCallback | void;
  deps: EffectDeps;
  next: Effect | null;
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
  lastEffect: Effect | null;
}

type EffectCallback = () => void;
type EffectDeps = any[] | null;

export function renderWithHooks(wip: FiberNode, lane: Lane) {
  // 赋值操作
  currentlyRenderingFiber = wip;
  // 重置 hooks 链表
  wip.memorizedState = null;
  // 重置 effect 链表
  wip.updateQueue = null;
  renderLane = lane;

  const current = wip.alternate;

  if (current !== null) {
    // update
    currentDispatcher.current = HooksDispatcherOnUpdate;
  } else {
    // mount
    currentDispatcher.current = HooksDispatcherOnMount;
  }

  const Component = wip.type;
  const props = wip.pendingProps;
  const children = Component(props);

  // 重置操作
  currentlyRenderingFiber = null;
  workInProgressHook = null;
  currentHook = null;
  renderLane = NoLane;
  return children;
}

const HooksDispatcherOnMount = {
  useState: mountState,
  useEffect: mountEffect,
  useTransition: mountTransition,
};

const HooksDispatcherOnUpdate = {
  useState: updateState,
  useEffect: updateEffect,
  useTransition: updateTransition,
};

function mountState<State>(
  initialState: State | (() => State)
): [State, Dispatch<State>] {
  // 找到当前 useState 对应的 hook 数据
  const hook = mountWorkInProgressHook();

  let memorizedState;
  if (initialState instanceof Function) {
    memorizedState = initialState();
  } else {
    memorizedState = initialState;
  }
  const queue = createUpdateQueue<State>();
  hook.updateQueue = queue;
  hook.memorizedState = memorizedState;

  // @ts-ignore
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
  queue.dispatch = dispatch;

  return [memorizedState, dispatch];
}

function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  // 找到当前 useState 对应的 hook 数据
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;

  // effect hook 的memorizedState 为 effect环状链表，这样就不用每次都遍历整个hook链表
  hook.memorizedState = pushEffect(
    Passive | HookHasEffect,
    create,
    undefined,
    nextDeps
  );
}

function pushEffect(
  hookFlags: Flags,
  create: EffectCallback | void,
  destroy: EffectCallback | void,
  deps: EffectDeps
): Effect {
  const effect: Effect = {
    tag: hookFlags,
    create,
    destroy,
    deps,
    next: null,
  };
  const fiber = currentlyRenderingFiber as FiberNode;
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
  if (updateQueue === null) {
    const updateQueue = createFCUpdateQueue();
    fiber.updateQueue = updateQueue;
    effect.next = effect;
    updateQueue.lastEffect = effect;
  } else {
    // 插入 effect
    const lastEffect = updateQueue.lastEffect;
    if (lastEffect === null) {
      effect.next = effect;
      updateQueue.lastEffect = effect;
    } else {
      const firstEffect = lastEffect.next;
      lastEffect.next = effect;
      effect.next = firstEffect;
      updateQueue.lastEffect = effect;
    }
  }
  return effect;
}

function createFCUpdateQueue<State>(): FCUpdateQueue<State> {
  const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
  updateQueue.lastEffect = null;
  return updateQueue;
}

function updateState<State>(): [State, Dispatch<State>] {
  // 找到当前 useState 对应的 hook 数据
  const hook = updateWorkInProgressHook();

  // 计算新state的逻辑
  const queue = hook.updateQueue as UpdateQueue<State>;
  const baseState = hook.baseState;

  const pending = queue.shared.pending;
  const current = currentHook as Hook;
  let baseQueue = current.baseQueue;

  if (pending !== null) {
    if (baseQueue !== null) {
      const baseFirst = baseQueue.next;
      const pendingFirst = pending.next;

      baseQueue.next = pendingFirst;
      pending.next = baseFirst;
    }
    baseQueue = pending;
    // update保存在current中
    current.baseQueue = pending;
    queue.shared.pending = null;

    if (baseQueue !== null) {
      const {
        memorizedState,
        baseQueue: newBaseQueue,
        baseState: newBaseState,
      } = processUpdateQueue(baseState, baseQueue, renderLane);
      hook.memorizedState = memorizedState;
      hook.baseState = newBaseState;
      hook.baseQueue = newBaseQueue;
    }
  }

  return [hook.memorizedState, queue.dispatch as Dispatch<State>];
}

function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  // 找到当前 useState 对应的 hook 数据
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  let destroy: EffectCallback | void;

  if (currentHook !== null) {
    const prevEffect = currentHook.memorizedState as Effect;
    destroy = prevEffect.destroy;

    if (nextDeps !== null) {
      // 浅比较依赖
      const prevDeps = prevEffect.deps;
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        hook.memorizedState = pushEffect(Passive, create, destroy, nextDeps);
        return;
      }
    }
    // 浅比较 不相等
    (currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
    hook.memorizedState = pushEffect(
      Passive | HookHasEffect,
      create,
      destroy,
      nextDeps
    );
  }
}

function areHookInputsEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
  if (
    prevDeps === null ||
    nextDeps === null ||
    prevDeps.length !== nextDeps.length
  ) {
    return false;
  }
  for (let i = 0; i < prevDeps.length; i++) {
    if (Object.is(prevDeps[i], nextDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}

function dispatchSetState<State>(
  fiber: FiberNode,
  updateQueue: UpdateQueue<State>,
  action: Action<State>
) {
  const lane = requestUpdateLane();
  const update = createUpdate(action, lane);
  enqueueUpdate(updateQueue, update);
  scheduleUpdateOnFiber(fiber, lane);
}

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memorizedState: null,
    updateQueue: null,
    next: null,
    baseQueue: null,
    baseState: null,
  };
  // mount时，以链表的形式存储hook
  // 并将hook链表头保存到workInProgress.memoizedState
  if (workInProgressHook === null) {
    // mount时 第一个 hook
    if (currentlyRenderingFiber === null) {
      throw new Error("hook只能在函数组件中执行");
    } else {
      workInProgressHook = hook;
      currentlyRenderingFiber.memorizedState = workInProgressHook;
    }
  } else {
    // mount时 后续的hook
    workInProgressHook.next = hook;
    workInProgressHook = hook;
  }
  return workInProgressHook;
}

function updateWorkInProgressHook(): Hook {
  // TODO render阶段触发的更新
  let nextCurrentHook: Hook | null;

  if (currentHook === null) {
    // 这个是FC update时的第一个hook
    const current = currentlyRenderingFiber?.alternate;
    if (current !== null) {
      nextCurrentHook = current?.memorizedState;
    } else {
      nextCurrentHook = null;
    }
  } else {
    // 这个是FC update时的后续hook
    nextCurrentHook = currentHook.next;
  }

  if (nextCurrentHook === null) {
    throw new Error(`组件${currentlyRenderingFiber?.type}的hook数量不匹配`);
  }

  currentHook = nextCurrentHook as Hook;
  const newHook: Hook = {
    memorizedState: currentHook?.memorizedState,
    updateQueue: currentHook?.updateQueue,
    next: null,
    baseQueue: currentHook.baseQueue,
    baseState: currentHook.baseState,
  };
  if (workInProgressHook === null) {
    // update时 第一个 hook
    if (currentlyRenderingFiber === null) {
      throw new Error("hook只能在函数组件中执行");
    } else {
      workInProgressHook = newHook;
      currentlyRenderingFiber.memorizedState = workInProgressHook;
    }
  } else {
    // update时 后续的hook
    workInProgressHook.next = newHook;
    workInProgressHook = newHook;
  }
  return workInProgressHook;
}

function mountTransition(): [boolean, (callback: () => void) => void] {
  const [isPending, setIsPending] = mountState(false);
  const hook = mountWorkInProgressHook();
  const start = startTransition.bind(null, setIsPending);
  hook.memorizedState = start;
  return [isPending, start];
}

function updateTransition(): [boolean, (callback: () => void) => void] {
  const [isPending] = updateState();
  const hook = updateWorkInProgressHook();
  const start = hook.memorizedState;
  return [isPending as boolean, start];
}

function startTransition(
  setIsPending: Dispatch<boolean>,
  callback: () => void
) {
  setIsPending(true);
  const prevTransition = currentBatchConfig.transition;
  currentBatchConfig.transition = 1;

  callback();
  setIsPending(false);

  currentBatchConfig.transition = prevTransition;
}
