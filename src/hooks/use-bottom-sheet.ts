"use client";

import { useState, useCallback, useRef, useEffect } from "react";

type SheetState = "hidden" | "peek" | "half" | "full";

interface BottomSheetOptions {
  initialState?: SheetState;
  peekHeight?: number;
  snapPoints?: { peek: number; half: number };
}

export function useBottomSheet(options: BottomSheetOptions = {}) {
  const {
    initialState = "peek",
    peekHeight = 120,
    snapPoints = { peek: 0.3, half: 0.65 },
  } = options;

  const [state, setState] = useState<SheetState>(initialState);
  const startY = useRef(0);
  const currentY = useRef(0);

  const expand = useCallback(() => setState("half"), []);
  const expandFull = useCallback(() => setState("full"), []);
  const collapse = useCallback(() => setState("peek"), []);
  const hide = useCallback(() => setState("hidden"), []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0]!.clientY;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      currentY.current = e.touches[0]!.clientY;
    },
    [],
  );

  const handleTouchEnd = useCallback(() => {
    const diff = startY.current - currentY.current;
    if (diff > 50) setState((s) => (s === "peek" ? "half" : "full"));
    else if (diff < -50) setState((s) => (s === "full" ? "half" : "peek"));
  }, []);

  return {
    state,
    setState,
    expand,
    expandFull,
    collapse,
    hide,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    translateY:
      state === "hidden"
        ? "100%"
        : state === "peek"
          ? `calc(100% - ${peekHeight}px)`
          : state === "half"
            ? `calc(100% - ${snapPoints.half * 100}vh)`
            : "0",
  };
}
