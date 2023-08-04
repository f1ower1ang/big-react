import { FiberNode } from "react-reconciler/src/fiber";
import { HostText } from "react-reconciler/src/workTags";
import { Props } from "share/ReactTypes";

export interface Container {
  rootId: number;
  children: (Instance | TextInstance)[];
}
export interface Instance {
  id: number;
  type: string;
  children: (Instance | TextInstance)[];
  parent: number;
  props: Props;
}
export interface TextInstance {
  id: number;
  text: string;
  parent: number;
}

let instanceCounter = 0;

export const createInstance = (type: string, props: any): Instance => {
  const instance = {
    id: instanceCounter++,
    type,
    children: [],
    parent: -1,
    props,
  };
  return instance;
};

export const createTextInstance = (content: string) => {
  const instance = {
    text: content,
    id: instanceCounter++,
    parent: -1,
  };
  return instance;
};

export const appendInitialChild = (
  parent: Instance | Container,
  child: Instance
) => {
  const prevParentId = child.parent;
  const parentId = "rootId" in parent ? parent.rootId : parent.id;

  if (prevParentId !== -1 && prevParentId !== parentId) {
    throw new Error("不能重复挂载child");
  }
  child.parent = parentId;
  parent.children.push(child);
};

export const appendChildToContainer = (parent: Container, child: Instance) => {
  const prevParentId = child.parent;
  const parentId = parent.rootId;

  if (prevParentId !== -1 && prevParentId !== parentId) {
    throw new Error("不能重复挂载child");
  }
  child.parent = parentId;
  parent.children.push(child);
};

export function removeChild(
  child: Instance | TextInstance,
  container: Container
) {
  const index = container.children.indexOf(child);

  if (index === -1) {
    throw new Error("child 不存在");
  }
  container.children.splice(index, 1);
}

export function insertChildToContainer(
  container: Container,
  child: Instance,
  before: Instance
) {
  const beforeIndex = container.children.indexOf(before);
  if (beforeIndex === -1) {
    throw new Error("before 不存在");
  }
  const index = container.children.indexOf(child);
  if (index !== -1) {
    container.children.splice(index, 1);
  }
  container.children.splice(beforeIndex, 0, child);
}

export function commitUpdate(fiber: FiberNode) {
  switch (fiber.tag) {
    case HostText:
      const text = fiber.memorizedProps.content;
      return commitTextUpdate(fiber.stateNode as TextInstance, text);
    default:
      if (__DEV__) {
        console.warn("未实现的Update类型", fiber);
      }
      break;
  }
}

export function commitTextUpdate(textInstance: TextInstance, content: string) {
  textInstance.text = content;
}

export const scheduleMicrotask =
  typeof queueMicrotask === "function"
    ? queueMicrotask
    : typeof Promise === "function"
    ? (callback: (...args: any) => void) => Promise.resolve(null).then(callback)
    : setTimeout;
