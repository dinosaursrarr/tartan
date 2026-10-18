import { useCallback, useReducer } from "react";
import { createHistory, historyReducer } from "../stores/historyStore";

export function useTartanHistory<T>(initial: T) {
  const [history, dispatch] = useReducer(historyReducer<T>, initial, createHistory<T>);
  const commit = useCallback((value: T) => dispatch({ type: "commit", value }), []);
  const replace = useCallback((value: T) => dispatch({ type: "replace", value }), []);
  const checkpoint = useCallback(() => dispatch({ type: "checkpoint" }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  const reset = useCallback((value: T) => dispatch({ type: "reset", value }), []);
  return {
    present: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undoValue: history.past[history.past.length - 1],
    redoValue: history.future[0],
    commit,
    replace,
    checkpoint,
    undo,
    redo,
    reset,
  };
}
