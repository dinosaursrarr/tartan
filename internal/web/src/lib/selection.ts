import type { ThreadBlock, ThreadModel } from "./tdf";

export function rangeSelection(thread: ThreadModel, anchorId: string, clickedId: string): string[] {
  const anchor = thread.blocks.findIndex((block) => block.id === anchorId);
  const clicked = thread.blocks.findIndex((block) => block.id === clickedId);
  if (anchor < 0 || clicked < 0) return [clickedId];
  const [start, end] = anchor < clicked ? [anchor, clicked] : [clicked, anchor];
  return thread.blocks.slice(start, end + 1).map((block: ThreadBlock) => block.id);
}

export function isContiguousSelection(thread: ThreadModel, ids: string[]): boolean {
  if (!ids.length) return false;
  const selected = new Set(ids);
  const indices = thread.blocks.map((block, index) => selected.has(block.id) ? index : -1).filter((index) => index >= 0);
  return indices.length === selected.size && indices[indices.length - 1] - indices[0] + 1 === indices.length;
}
