export type Flags = number;

export const NoFlags = 0;
export const Placement = 1 << 1;
export const Update = 1 << 2;
export const ChildDeletion = 1 << 3;

export const MutationMask = Placement | Update | ChildDeletion;
