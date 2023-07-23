import internals from "share/internals";
import { FiberNode } from "./fiber";
import {
  UpdateQueue,
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
} from "./updateQueue";
import { scheduleUpdateOnFiber } from "./workLoop";
import { Dispatch } from "react";
import { Action } from "share/ReactTypes";

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;

const { currentDispatcher } = internals;

interface Hook {
  memorizedState: any;
  updateQueue: unknown;
  next: Hook | null;
}

export function renderWithHooks(wip: FiberNode) {
  // 赋值操作
  currentlyRenderingFiber = wip;
  wip.memorizedState = null;

  const current = wip.alternate;

  if (current !== null) {
    // update
  } else {
    // mount
    currentDispatcher.current = HooksDispatcherOnMount;
  }

  const Component = wip.type;
  const props = wip.pendingProps;
  const children = Component(props);

  // 重置操作
  currentlyRenderingFiber = null;
  return children;
}

const HooksDispatcherOnMount = {
  useState: mountState,
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

  // @ts-ignore
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
  queue.dispatch = dispatch;

  return [memorizedState, dispatch];
}

function dispatchSetState<State>(
  fiber: FiberNode,
  updateQueue: UpdateQueue<State>,
  action: Action<State>
) {
  const update = createUpdate(action);
  enqueueUpdate(updateQueue, update);
  scheduleUpdateOnFiber(fiber);
}

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memorizedState: null,
    updateQueue: null,
    next: null,
  };
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
