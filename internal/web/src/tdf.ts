export type ColourDefinition = {
  id: string;
  hex: string;
};

export type ThreadBlock = {
  id: string;
  colourId: string;
  length: number;
};

/**
 * `blocks` is the sequence written in TDF, before the parser expands a mirror.
 * `mirrorIds` identifies the single contiguous parenthesised source section.
 * The reflected copy is derived and is never stored as independent blocks.
 */
export type ThreadModel = {
  blocks: ThreadBlock[];
  mirrorIds: string[] | null;
};

export type TartanModel = {
  colours: ColourDefinition[];
  warp: ThreadModel;
  /** null means that TDF omits `]` and the weft reuses the warp. */
  weft: ThreadModel | null;
};

export type ExpandedBlock = {
  block: ThreadBlock;
  canonicalIndex: number;
  reflected: boolean;
  inMirror: boolean;
};

export type ThreadName = "warp" | "weft";
export type ThreadSection = "before" | "mirror" | "after" | "plain";

let nextBlockId = 1;

export function makeBlock(colourId: string, length = 4): ThreadBlock {
  return { id: `block-${nextBlockId++}`, colourId, length };
}

function newBlockId(): string {
  return `block-${nextBlockId++}`;
}

function makeThread(blocks: ThreadBlock[], mirrorBlockIds: string[] | null = null): ThreadModel {
  return { blocks, mirrorIds: mirrorBlockIds?.length ? mirrorBlockIds : null };
}

export const STARTER_TDF =
  "a#243D35b#C7A75Ec#E0D7C3d#7D2A3C[a8(b3c2)d7a4]b4c2a5d3";

export function createStarterModel(): TartanModel {
  return parseTdf(STARTER_TDF);
}

function tokeniseBlocks(text: string): Array<{ colourId: string; length: number }> {
  const matches = text.match(/[a-z][1-9][0-9]*/g) ?? [];
  if (matches.join("") !== text || matches.length === 0) {
    throw new Error(`Invalid thread sequence: “${text}”. Use colour letters followed by positive integers.`);
  }

  return matches.map((token) => {
    const length = Number(token.slice(1));
    if (!Number.isSafeInteger(length) || length < 1) {
      throw new Error(`Block length “${token.slice(1)}” is too large or invalid.`);
    }
    return { colourId: token[0], length };
  });
}

function parseThread(text: string): ThreadModel {
  const openCount = [...text].filter((char) => char === "(").length;
  const closeCount = [...text].filter((char) => char === ")").length;
  if (openCount !== closeCount || openCount > 1) {
    throw new Error("A thread may contain at most one matched pair of parentheses.");
  }

  const toBlocks = (items: Array<{ colourId: string; length: number }>) =>
    items.map((item) => ({ ...item, id: newBlockId() }));

  if (openCount === 0) {
    return makeThread(toBlocks(tokeniseBlocks(text)));
  }

  const start = text.indexOf("(");
  const end = text.indexOf(")");
  if (end < start || text.slice(start + 1, end).includes("(")) {
    throw new Error("Invalid mirrored section.");
  }

  const beforeText = text.slice(0, start);
  const afterText = text.slice(end + 1);
  const beforeBlocks = toBlocks(beforeText ? tokeniseBlocks(beforeText) : []);
  const mirroredBlocks = toBlocks(tokeniseBlocks(text.slice(start + 1, end)));
  const afterBlocks = toBlocks(afterText ? tokeniseBlocks(afterText) : []);

  return makeThread(
    [...beforeBlocks, ...mirroredBlocks, ...afterBlocks],
    mirroredBlocks.map((block) => block.id),
  );
}

/** Parse the same compact TDF grammar accepted by the Go parser. */
export function parseTdf(pattern: string): TartanModel {
  const separator = pattern.indexOf("[");
  if (separator < 0) throw new Error("Missing thread delimiter ‘[’.");

  const colourText = pattern.slice(0, separator);
  const threadText = pattern.slice(separator + 1);
  if (!colourText) throw new Error("At least one colour definition is required before ‘[’.");

  const definitions = colourText.match(/[a-z]#[a-fA-F0-9]{6}/g) ?? [];
  if (definitions.join("") !== colourText) {
    throw new Error("Invalid colour definitions. Use one lowercase letter followed by a six-digit hex colour.");
  }

  const colours: ColourDefinition[] = [];
  const seen = new Set<string>();
  for (const definition of definitions) {
    const id = definition[0];
    if (seen.has(id)) throw new Error(`Colour ID “${id}” is defined more than once.`);
    seen.add(id);
    colours.push({ id, hex: `#${definition.slice(2).toUpperCase()}` });
  }

  const threadParts = threadText.split("]");
  if (threadParts.length > 2) throw new Error("Only one ‘]’ separator is allowed.");
  if (!threadParts[0]) throw new Error("The warp thread cannot be empty.");
  const warp = parseThread(threadParts[0]);
  const weft = threadParts.length === 2 ? parseThread(threadParts[1]) : null;

  const colourIds = new Set(colours.map((colour) => colour.id));
  for (const block of [...warp.blocks, ...(weft?.blocks ?? [])]) {
    if (!colourIds.has(block.colourId)) {
      throw new Error(`Thread block refers to undefined colour “${block.colourId}”.`);
    }
  }

  return { colours, warp, weft };
}

function getMirrorRange(thread: ThreadModel): { start: number; end: number } | null {
  if (!thread.mirrorIds?.length) return null;
  const mirrorSet = new Set(thread.mirrorIds);
  const indices = thread.blocks
    .map((block, index) => (mirrorSet.has(block.id) ? index : -1))
    .filter((index) => index >= 0);
  if (indices.length === 0) return null;
  const start = Math.min(...indices);
  const end = Math.max(...indices);
  // All edits in this app preserve contiguity. This fallback makes the serializer
  // defensive if the model is ever changed from outside the editor.
  if (end - start + 1 !== indices.length) {
    throw new Error("Mirrored source blocks must remain contiguous.");
  }
  return { start, end };
}

export function getThreadMirrorRange(thread: ThreadModel) {
  return getMirrorRange(thread);
}

export function expandThread(thread: ThreadModel): ExpandedBlock[] {
  const range = getMirrorRange(thread);
  const source = thread.blocks.map((block, canonicalIndex) => ({
    block,
    canonicalIndex,
    reflected: false,
    inMirror: range ? canonicalIndex >= range.start && canonicalIndex <= range.end : false,
  }));
  if (!range) return source;

  const reflected = thread.blocks
    .slice(range.start, range.end + 1)
    .map((block) => ({
      block,
      canonicalIndex: thread.blocks.findIndex((candidate) => candidate.id === block.id),
      reflected: true,
      inMirror: true,
    }))
    .reverse();

  return [...source, ...reflected];
}

export function serialiseThread(thread: ThreadModel): string {
  const range = getMirrorRange(thread);
  return thread.blocks
    .map((block, index) => {
      const left = range?.start === index ? "(" : "";
      const right = range?.end === index ? ")" : "";
      return `${left}${block.colourId}${block.length}${right}`;
    })
    .join("");
}

export function serialiseTdf(model: TartanModel): string {
  const colours = model.colours.map(({ id, hex }) => `${id}${hex.toUpperCase()}`).join("");
  return `${colours}[${serialiseThread(model.warp)}${model.weft ? `]${serialiseThread(model.weft)}` : ""}`;
}

export function cloneThread(thread: ThreadModel): ThreadModel {
  const idMap = new Map<string, string>();
  const blocks = thread.blocks.map((block) => {
    const id = newBlockId();
    idMap.set(block.id, id);
    return { ...block, id };
  });
  return {
    blocks,
    mirrorIds: thread.mirrorIds?.map((id) => idMap.get(id)!).filter(Boolean) ?? null,
  };
}

export function getEffectiveThread(model: TartanModel, name: ThreadName): ThreadModel {
  if (name === "warp" || model.weft === null) return model.warp;
  return model.weft;
}

export function isColourUsed(model: TartanModel, colourId: string): boolean {
  return [...model.warp.blocks, ...(model.weft?.blocks ?? [])].some(
    (block) => block.colourId === colourId,
  );
}

export function findBlock(model: TartanModel, blockId: string): ThreadBlock | null {
  return (
    [...model.warp.blocks, ...(model.weft?.blocks ?? [])].find((block) => block.id === blockId) ?? null
  );
}

export function replaceBlockInThread(
  thread: ThreadModel,
  blockId: string,
  update: (block: ThreadBlock) => ThreadBlock,
): ThreadModel {
  return {
    ...thread,
    blocks: thread.blocks.map((block) => (block.id === blockId ? update(block) : block)),
  };
}

function getBoundaryLocation(
  thread: ThreadModel,
  displayBoundary: number,
): { index: number; section: ThreadSection } {
  const range = getMirrorRange(thread);
  const count = thread.blocks.length;
  if (!range) return { index: Math.max(0, Math.min(count, displayBoundary)), section: "plain" };

  if (displayBoundary < count) {
    const index = Math.max(0, displayBoundary);
    if (index <= range.start) return { index, section: "before" };
    if (index <= range.end) return { index, section: "mirror" };
    return { index, section: "after" };
  }

  if (displayBoundary === count) return { index: count, section: "after" };

  const mirroredCount = range.end - range.start + 1;
  const offsetIntoReflection = Math.min(mirroredCount, displayBoundary - count);
  return {
    index: range.end + 1 - offsetIntoReflection,
    // A boundary in the reflected copy edits the source mirrored section.
    section: "mirror",
  };
}

export function insertBlockAtDisplayBoundary(
  thread: ThreadModel,
  displayBoundary: number,
  colourId: string,
  length = 4,
): ThreadModel {
  const location = getBoundaryLocation(thread, displayBoundary);
  const block = makeBlock(colourId, length);
  const blocks = [...thread.blocks];
  blocks.splice(location.index, 0, block);

  let mirrorIds = thread.mirrorIds ? [...thread.mirrorIds] : null;
  if (location.section === "mirror") {
    mirrorIds = [...(mirrorIds ?? []), block.id];
  }
  return { blocks, mirrorIds: mirrorIds?.length ? mirrorIds : null };
}

export function moveBlockToDisplayBoundary(
  thread: ThreadModel,
  blockId: string,
  displayBoundary: number,
): ThreadModel {
  const sourceIndex = thread.blocks.findIndex((block) => block.id === blockId);
  if (sourceIndex < 0) return thread;
  const location = getBoundaryLocation(thread, displayBoundary);
  const currentlyMirrored = Boolean(thread.mirrorIds?.includes(blockId));
  const willBeMirrored = location.section === "mirror";
  if ((sourceIndex === location.index || sourceIndex + 1 === location.index) && currentlyMirrored === willBeMirrored) return thread;

  const movingBlock = thread.blocks[sourceIndex];
  const blocks = [...thread.blocks];
  blocks.splice(sourceIndex, 1);
  const insertionIndex = Math.max(0, Math.min(blocks.length, location.index - (sourceIndex < location.index ? 1 : 0)));
  blocks.splice(insertionIndex, 0, movingBlock);

  let mirrorIds = thread.mirrorIds ? [...thread.mirrorIds] : null;
  const isCurrentlyMirrored = Boolean(mirrorIds?.includes(blockId));
  if (location.section === "mirror" && !isCurrentlyMirrored) {
    mirrorIds = [...(mirrorIds ?? []), blockId];
  } else if (location.section !== "mirror" && isCurrentlyMirrored) {
    mirrorIds = mirrorIds!.filter((id) => id !== blockId);
  }
  if (!mirrorIds?.length) mirrorIds = null;

  return { blocks, mirrorIds };
}

export function removeBlock(thread: ThreadModel, blockId: string): ThreadModel {
  if (thread.blocks.length <= 1) throw new Error("A thread must contain at least one block.");
  const blocks = thread.blocks.filter((block) => block.id !== blockId);
  const mirrorIds = thread.mirrorIds?.filter((id) => id !== blockId) ?? null;
  return { blocks, mirrorIds: mirrorIds?.length ? mirrorIds : null };
}

export function setMirroredBlockIds(thread: ThreadModel, blockIds: string[]): ThreadModel {
  const selected = new Set(blockIds);
  if (!selected.size) return { ...thread, mirrorIds: null };
  const indices = thread.blocks
    .map((block, index) => (selected.has(block.id) ? index : -1))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);
  if (!indices.length) return { ...thread, mirrorIds: null };
  if (indices[indices.length - 1] - indices[0] + 1 !== indices.length) {
    throw new Error("The mirrored section must be a contiguous range of blocks.");
  }
  return {
    ...thread,
    mirrorIds: thread.blocks.slice(indices[0], indices[indices.length - 1] + 1).map((block) => block.id),
  };
}

export function updateColourHex(model: TartanModel, colourId: string, hex: string): TartanModel {
  return {
    ...model,
    colours: model.colours.map((colour) =>
      colour.id === colourId ? { ...colour, hex: hex.toUpperCase() } : colour,
    ),
  };
}

export function updateColourId(model: TartanModel, oldId: string, newId: string): TartanModel {
  if (!/^[a-z]$/.test(newId)) throw new Error("Colour IDs must be a single lowercase letter from a to z.");
  if (model.colours.some((colour) => colour.id === newId && colour.id !== oldId)) {
    throw new Error(`Colour ID “${newId}” is already in use.`);
  }
  const renameThread = (thread: ThreadModel): ThreadModel => ({
    ...thread,
    blocks: thread.blocks.map((block) =>
      block.colourId === oldId ? { ...block, colourId: newId } : block,
    ),
  });
  return {
    colours: model.colours.map((colour) => (colour.id === oldId ? { ...colour, id: newId } : colour)),
    warp: renameThread(model.warp),
    weft: model.weft ? renameThread(model.weft) : null,
  };
}

export function addColour(model: TartanModel): TartanModel {
  if (model.colours.length >= 26) throw new Error("All 26 lowercase colour IDs are in use.");
  const used = new Set(model.colours.map((colour) => colour.id));
  const id = "abcdefghijklmnopqrstuvwxyz".split("").find((letter) => !used.has(letter));
  if (!id) throw new Error("All 26 lowercase colour IDs are in use.");
  return { ...model, colours: [...model.colours, { id, hex: "#64748B" }] };
}

export function removeColour(model: TartanModel, colourId: string): TartanModel {
  if (model.colours.length <= 1) throw new Error("At least one colour definition is required.");
  if (isColourUsed(model, colourId)) throw new Error(`Colour “${colourId}” is used by one or more thread blocks.`);
  return { ...model, colours: model.colours.filter((colour) => colour.id !== colourId) };
}
