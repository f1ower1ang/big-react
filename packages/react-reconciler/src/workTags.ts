export type WorkTag =
  | typeof FunctionComponent
  | typeof HostRoot
  | typeof HostComponent
  | typeof HostText
  | typeof Fragment;

export const FunctionComponent = 0;
export const HostRoot = 3;
// div 等原始标签
export const HostComponent = 5;
// 标签内的文本内容
export const HostText = 6;
export const Fragment = 7;
