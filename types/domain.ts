// App-side shapes. All money is integer centavos; all timestamps are ISO strings.

/** Someone in a group, as other members see them. */
export type Member = {
  id: string;
  displayName: string;
};

/** The signed-in user's own profile. Wallet numbers are never visible to anyone else. */
export type Profile = Member & {
  gcashNumber: string | null;
  mayaNumber: string | null;
};

export type Group = {
  id: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
  members: Member[];
};

export type SplitMethod = 'equal' | 'exact';

export type Expense = {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  createdBy: string | null;
  splitMethod: SplitMethod;
  createdAt: string;
  splits: { userId: string; amount: number }[];
};

export type Settlement = {
  id: string;
  groupId: string;
  from: string;
  to: string;
  amount: number;
  createdBy: string | null;
  createdAt: string;
};

/** Everything the signed-in user can see: their groups and those groups' money records. */
export type Ledger = {
  groups: Group[];
  expenses: Expense[];
  settlements: Settlement[];
};
