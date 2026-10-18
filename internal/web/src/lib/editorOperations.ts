import {
  addColour,
  cloneThread,
  insertBlockAtDisplayBoundary,
  moveBlockToDisplayBoundary,
  removeColour,
  removeBlock,
  setMirroredBlockIds,
  updateColourHex,
  updateColourId,
  type TartanModel,
  type ThreadBlock,
  type ThreadModel,
  type ThreadName,
} from "./tdf";

export function updateThread(model: TartanModel, name: ThreadName, update: (thread: ThreadModel) => ThreadModel): TartanModel {
  if (name === "warp" || model.weft === null) return { ...model, warp: update(model.warp) };
  return { ...model, weft: update(model.weft) };
}

export function createIndependentWeft(model: TartanModel): TartanModel {
  if (model.weft) return model;
  return { ...model, weft: cloneThread(model.warp) };
}

export function linkWeftToWarp(model: TartanModel): TartanModel {
  return { ...model, weft: null };
}

export function insertThreadBlock(model: TartanModel, name: ThreadName, boundary: number, colourId?: string): TartanModel {
  const colour = colourId ?? model.colours[0]?.id;
  if (!colour) throw new Error("Add a colour before adding a block.");
  return updateThread(model, name, (thread) => insertBlockAtDisplayBoundary(thread, boundary, colour, 4));
}

export function moveThreadBlock(model: TartanModel, name: ThreadName, blockId: string, boundary: number): TartanModel {
  return updateThread(model, name, (thread) => moveBlockToDisplayBoundary(thread, blockId, boundary));
}

export function resizeThreadBlock(model: TartanModel, name: ThreadName, blockId: string, length: number): TartanModel {
  return updateThread(model, name, (thread) => ({
    ...thread,
    blocks: thread.blocks.map((block) => block.id === blockId
      ? { ...block, length: Math.max(1, Math.floor(length)) }
      : block),
  }));
}

export function setThreadBlockLength(model: TartanModel, name: ThreadName, blockId: string, length: number): TartanModel {
  return updateThread(model, name, (thread) => ({
    ...thread,
    blocks: thread.blocks.map((block) => block.id === blockId ? { ...block, length } : block),
  }));
}

export function setThreadBlockToken(model: TartanModel, name: ThreadName, blockId: string, token: string): TartanModel {
  const match = /^([a-z])([1-9][0-9]*)$/.exec(token);
  if (!match) throw new Error("Use one lowercase colour letter followed by a positive integer, e.g. a8.");
  const [, colourId, rawLength] = match;
  if (!model.colours.some((colour) => colour.id === colourId)) {
    throw new Error(`Colour “${colourId}” is not in the palette.`);
  }
  const length = Number(rawLength);
  if (!Number.isSafeInteger(length)) throw new Error("Block length must be a positive safe integer.");
  return updateThread(model, name, (thread) => ({
    ...thread,
    blocks: thread.blocks.map((block) => block.id === blockId ? { ...block, colourId, length } : block),
  }));
}

export function removeThreadBlocks(model: TartanModel, name: ThreadName, ids: string[]): TartanModel {
  const selected = new Set(ids);
  return updateThread(model, name, (thread) => {
    const remaining = thread.blocks.filter((block) => !selected.has(block.id));
    if (remaining.length === 0) throw new Error("A thread must contain at least one block. Leave one block in the thread.");
    const mirrorIds = thread.mirrorIds?.filter((id) => !selected.has(id)) ?? null;
    return { blocks: remaining, mirrorIds: mirrorIds?.length ? mirrorIds : null };
  });
}

export function addPaletteColour(model: TartanModel): TartanModel { return addColour(model); }
export function deletePaletteColour(model: TartanModel, id: string): TartanModel { return removeColour(model, id); }
export function renamePaletteColour(model: TartanModel, oldId: string, newId: string): TartanModel { return updateColourId(model, oldId, newId); }
export function recolourPaletteEntry(model: TartanModel, id: string, hex: string): TartanModel { return updateColourHex(model, id, hex); }
export function mirrorThreadBlocks(model: TartanModel, name: ThreadName, ids: string[]): TartanModel {
  return updateThread(model, name, (thread) => setMirroredBlockIds(thread, ids));
}

export function canShiftThreadBlock(model: TartanModel, name: ThreadName, blockId: string, direction: -1 | 1): boolean {
  const thread = name === "warp" || model.weft === null ? model.warp : model.weft;
  const index = thread.blocks.findIndex((block) => block.id === blockId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= thread.blocks.length) return false;
  const mirrorSet = new Set(thread.mirrorIds ?? []);
  // A single-step move may reorder within a region, but must not split the one
  // contiguous parenthesised mirror source supported by the parser.
  return mirrorSet.has(thread.blocks[index].id) === mirrorSet.has(thread.blocks[target].id);
}

export function shiftThreadBlock(model: TartanModel, name: ThreadName, blockId: string, direction: -1 | 1): TartanModel {
  if (!canShiftThreadBlock(model, name, blockId, direction)) return model;
  return updateThread(model, name, (thread) => {
    const index = thread.blocks.findIndex((block) => block.id === blockId);
    const target = index + direction;
    const blocks: ThreadBlock[] = [...thread.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    return { ...thread, blocks };
  });
}
