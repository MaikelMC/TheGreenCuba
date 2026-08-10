"use client";

import { create } from "zustand";

interface WaitlistDialogState {
  open: boolean;
  openDialog: () => void;
  closeDialog: () => void;
}

export const useWaitlistDialog = create<WaitlistDialogState>((set) => ({
  open: false,
  openDialog: () => set({ open: true }),
  closeDialog: () => set({ open: false }),
}));
