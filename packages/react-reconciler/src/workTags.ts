export type WorkTag =
  | typeof FunctionComponent
  | typeof HostRoot
  | typeof HostComponent
  | typeof HostText;

export const FunctionComponent = 0;
export const HostRoot = 3;
// div 等原始标签
export const HostComponent = 5;
// 标签内的文本内容
export const HostText = 6;
