import { describe, expect, it } from "vitest";
import { createHistory, historyReducer } from "../src/stores/historyStore";

describe("undo/redo history", () => {
  it("commits, undoes, and redoes values", () => {
    let state = createHistory("a");
    state = historyReducer(state, { type: "commit", value: "b" });
    state = historyReducer(state, { type: "commit", value: "c" });
    expect(state.present).toBe("c");
    state = historyReducer(state, { type: "undo" });
    expect(state.present).toBe("b");
    state = historyReducer(state, { type: "redo" });
    expect(state.present).toBe("c");
  });
  it("checkpoints a gesture so repeated replacements form one undo step", () => {
    let state = createHistory(1);
    state = historyReducer(state, { type: "checkpoint" });
    state = historyReducer(state, { type: "replace", value: 2 });
    state = historyReducer(state, { type: "replace", value: 3 });
    state = historyReducer(state, { type: "undo" });
    expect(state.present).toBe(1);
  });
  it("clears redo history on new edits", () => {
    let state = createHistory(1);
    state = historyReducer(state, { type: "commit", value: 2 });
    state = historyReducer(state, { type: "undo" });
    state = historyReducer(state, { type: "commit", value: 3 });
    expect(state.future).toHaveLength(0);
  });
});
