import { Dispatch } from "react";
import { Action } from "share/ReactTypes";
import { Lane, NoLane, isSubsetOfLanes } from "./fiberLanes";

export interface Update<State> {
  action: Action<State>;
  lane: Lane;
  next: Update<State> | null;
}

export interface UpdateQueue<State> {
  shared: {
    pending: Update<State> | null;
  };
  dispatch: Dispatch<State> | null;
}

export const createUpdate = <State>(
  action: Action<State>,
  lane: Lane
): Update<State> => {
  return {
    action,
    lane,
    next: null,
  };
};

export const createUpdateQueue = <State>(): UpdateQueue<State> => {
  return {
    shared: {
      pending: null,
    },
    dispatch: null,
  } as UpdateQueue<State>;
};

export const enqueueUpdate = <State>(
  updateQueue: UpdateQueue<State>,
  update: Update<State>
) => {
  // 形成环状链表
  const pending = updateQueue.shared.pending;
  if (pending === null) {
    update.next = update;
  } else {
    update.next = pending.next;
    pending.next = update;
  }
  // pending指向链表最后一个（新插入的update）
  updateQueue.shared.pending = update;
};

/**
 *
 * @param baseState 初始状态
 * @param pendingUpdate 消费的 update
 * @returns
 */
export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null,
  renderLane: Lane
): {
  memorizedState: State;
  baseState: State;
  baseQueue: Update<State> | null;
} => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memorizedState: baseState,
    baseState,
    baseQueue: null,
  };

  if (pendingUpdate !== null) {
    // 第一个 update
    const first = pendingUpdate.next;
    let pending = pendingUpdate.next as Update<State>;

    let newBaseState = baseState;
    let newBaseQueueFirst: Update<State> | null = null;
    let newBaseQueueLast: Update<State> | null = null;
    let newState = baseState;

    do {
      const updateLane = pending.lane;
      if (isSubsetOfLanes(renderLane, updateLane)) {
        // 优先级足够
        if (newBaseQueueLast !== null) {
          const clone = createUpdate(pending.action, NoLane);
          newBaseQueueLast.next = clone;
          newBaseQueueLast = clone;
        }

        const action = pending.action;
        if (action instanceof Function) {
          newState = action(baseState);
        } else {
          newState = action;
        }
      } else {
        // 优先级不够，跳过
        const clone = createUpdate(pending.action, pending.lane);
        // 是不是第一个被跳过的
        if (newBaseQueueFirst === null) {
          newBaseQueueFirst = clone;
          newBaseQueueLast = clone;
          newBaseState = newState;
        } else {
          (newBaseQueueLast as Update<State>).next = clone;
          newBaseQueueLast = clone;
        }
      }
      pending = pending.next as Update<State>;
    } while (pending !== first);

    if (newBaseQueueLast === null) {
      // 本次计算没有update跳过
      newBaseState = newState;
    } else {
      // 合并为环状链表
      newBaseQueueLast.next = newBaseQueueFirst;
    }
    result.memorizedState = newState;
    result.baseState = newBaseState;
    result.baseQueue = newBaseQueueLast;
  }
  return result;
};
