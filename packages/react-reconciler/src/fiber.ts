import { Key, Props, Ref } from "share/ReactTypes";
import { WorkTag } from "./workTags";
import { Flags, NoFlags } from "./fiberFlags";

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
  alternate: FiberNode | null;
  flags: Flags;

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    // React Element 实例
    this.tag = tag;
    this.key = key;
    this.stateNode = null;
    this.type = null;

    // 构建 fiberNode 树
    // 父 fiberNode
    this.return = null;
    // 兄弟
    this.sibling = null;
    // 子
    this.child = null;
    this.index = 0;

    this.ref = null;

    // 作为工作单元
    this.pendingProps = pendingProps;
    this.memorizedProps = null;

    this.alternate = null;
    // 副作用
    this.flags = NoFlags;
  }
}
