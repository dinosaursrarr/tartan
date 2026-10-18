export type HistoryState<T> = { past: T[]; present: T; future: T[] };
export type HistoryAction<T> =
  | { type: "commit"; value: T }
  | { type: "replace"; value: T }
  | { type: "checkpoint" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; value: T };

export function createHistory<T>(present: T): HistoryState<T> {
  return { past: [], present, future: [] };
}

export function historyReducer<T>(state: HistoryState<T>, action: HistoryAction<T>): HistoryState<T> {
  switch (action.type) {
    case "commit":
      if (action.value === state.present) return state;
      return { past: [...state.past, state.present].slice(-100), present: action.value, future: [] };
    case "replace":
      return { ...state, present: action.value };
    case "checkpoint":
      return { ...state, past: [...state.past, state.present].slice(-100), future: [] };
    case "undo": {
      if (!state.past.length) return state;
      const previous = state.past[state.past.length - 1];
      return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] };
    }
    case "redo": {
      if (!state.future.length) return state;
      const [next, ...future] = state.future;
      return { past: [...state.past, state.present].slice(-100), present: next, future };
    }
    case "reset":
      return createHistory(action.value);
  }
}
