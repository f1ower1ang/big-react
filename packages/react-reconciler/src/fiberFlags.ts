export type Flags = number;

export const NoFlags = 0;
export const Placement = 1;
export const Update = 1 << 1;
export const ChildDeletion = 1 << 2;

export const PassiveEffect = 1 << 3;
export const Ref = 1 << 4;

export const MutationMask = Placement | Update | ChildDeletion | Ref;
export const LayoutMask = Ref;

export const PassiveMask = PassiveEffect | ChildDeletion;
