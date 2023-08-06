import { Container } from "hostConfig";
import { HostRoot } from "./workTags";
import { FiberNode, FiberRootNode } from "./fiber";
import {
  UpdateQueue,
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
} from "./updateQueue";
import { ReactElementType } from "share/ReactTypes";
import { scheduleUpdateOnFiber } from "./workLoop";
import { requestUpdateLane } from "./fiberLanes";
import {
  unstable_ImmediatePriority,
  unstable_runWithPriority,
} from "scheduler";

// 对应于 ReactDom.createRoot，生成 FiberRootNode
export function createContainer(container: Container) {
  const hostRootFiber = new FiberNode(HostRoot, {}, null);
  const root = new FiberRootNode(container, hostRootFiber);
  hostRootFiber.updateQueue = createUpdateQueue();
  return root;
}

// 对应于 ReactDOM.render
export function updateContainer(
  element: ReactElementType | null,
  root: FiberRootNode
) {
  unstable_runWithPriority(unstable_ImmediatePriority, () => {
    const hostRootFiber = root.current;
    const lane = requestUpdateLane();
    const update = createUpdate<ReactElementType | null>(element, lane);
    enqueueUpdate(
      hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
      update
    );
    scheduleUpdateOnFiber(hostRootFiber, lane);
  });
  return element;
}
