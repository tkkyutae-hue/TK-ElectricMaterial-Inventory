export type ItemRowError = {
  itemId?: string;
  quantity?: string;
};

export type ReelSnapshot = {
  id: number;
  reelId: string;
  lengthFt: number;
  status: string | null;
};

export type NewReel = {
  tempId: string;
  lengthFt: number;
  brand: string;
  reelId: string;
  locationId?: number | null;
  status?: string;
};

export type ItemRow = {
  rowId: string;
  itemId: number | null;
  quantity: number;
  errors: ItemRowError;
  reelSelections: Record<number, number>;
  reelSnapshots: Record<number, ReelSnapshot>;
  newReels?: NewReel[];
};
