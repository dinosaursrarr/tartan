import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import tartanCatalogue from "@catalogue/tartans.json";
import {
  addColour,
  cloneThread,
  createStarterModel,
  expandThread,
  findBlock,
  getEffectiveThread,
  getThreadMirrorRange,
  insertBlockAtDisplayBoundary,
  isColourUsed,
  moveBlockToDisplayBoundary,
  parseTdf,
  removeBlock,
  removeColour,
  serialiseTdf,
  setMirroredBlockIds,
  updateColourHex,
  updateColourId,
  type ExpandedBlock,
  type TartanModel,
  type ThreadBlock,
  type ThreadModel,
  type ThreadName,
} from "./tdf";
import "./app.css";

type CatalogueItem = { name: string; pattern: string };
const catalogueSource: unknown = tartanCatalogue;
const CATALOGUE_ITEMS: CatalogueItem[] = (Array.isArray(catalogueSource) ? catalogueSource : []).filter(
  (item: unknown): item is CatalogueItem =>
    Boolean(item) && typeof item === "object" &&
    typeof (item as CatalogueItem).name === "string" &&
    typeof (item as CatalogueItem).pattern === "string",
);
type OutputFormat = "png" | "webp" | "gif";

const FORMAT_OPTIONS: OutputFormat[] = ["png", "webp", "gif"];
const TILE_ZOOMS = [0.65, 1, 1.5] as const;

function getInitialState(): { code: string; model: TartanModel; error: string | null } {
  const query = new URLSearchParams(window.location.search).get("pattern");
  const starter = createStarterModel();
  if (query === null) {
    return { code: serialiseTdf(starter), model: starter, error: null };
  }
  try {
    return { code: query, model: parseTdf(query), error: null };
  } catch (error) {
    return {
      code: query,
      model: starter,
      error: error instanceof Error ? error.message : "The pattern in the URL is invalid.",
    };
  }
}

function makeEndpointUrl(path: string, pattern: string, format: OutputFormat): string {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("pattern", pattern);
  url.searchParams.set("format", format);
  return url.toString();
}

function modelWithThread(
  model: TartanModel,
  name: ThreadName,
  update: (thread: ThreadModel) => ThreadModel,
): TartanModel {
  if (name === "warp") return { ...model, warp: update(model.warp) };
  if (model.weft === null) return { ...model, warp: update(model.warp) };
  return { ...model, weft: update(model.weft) };
}

function contrastFor(hex: string): string {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "#FFFFFF";
  const channels = [0, 2, 4].map((index) => parseInt(normalized.slice(index, index + 2), 16) / 255);
  const linear = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.44 ? "#20211F" : "#FFFFFF";
}

function Icon({ name }: { name: "plus" | "copy" | "download" | "external" | "trash" | "grip" | "check" | "search" | "refresh" | "chevron" | "x" | "link" | "code" | "github" | "scissors" | "palette" | "image" }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const shapes: Record<string, ReactNode> = {
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    external: <><path d="M14 3h7v7" /><path d="M10 14 21 3" /><path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" /></>,
    trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m19 6-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></>,
    grip: <><circle cx="9" cy="5" r="1" fill="currentColor" /><circle cx="15" cy="5" r="1" fill="currentColor" /><circle cx="9" cy="12" r="1" fill="currentColor" /><circle cx="15" cy="12" r="1" fill="currentColor" /><circle cx="9" cy="19" r="1" fill="currentColor" /><circle cx="15" cy="19" r="1" fill="currentColor" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M4.8 9A7.5 7.5 0 0 1 18.2 6L20 12" /><path d="M4 17v-5h5" /><path d="M19.2 15A7.5 7.5 0 0 1 5.8 18L4 12" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    x: <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" /></>,
    code: <><path d="m8 8-4 4 4 4" /><path d="m16 8 4 4-4 4" /><path d="m14 5-4 14" /></>,
    github: <><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 6v-3.9a3.4 3.4 0 0 0-.9-2.6c3-.3 6.1-1.5 6.1-6.7A5.2 5.2 0 0 0 18.8 3a4.8 4.8 0 0 0-.1-3S17.5-.4 15 1.5a13.3 13.3 0 0 0-7 0C5.5-.4 4.3 0 4.3 0a4.8 4.8 0 0 0-.1 3A5.2 5.2 0 0 0 2.8 6.8c0 5.2 3.1 6.4 6.1 6.7A3.4 3.4 0 0 0 8 16.1V22" transform="translate(2 1) scale(.85)" /></>,
    scissors: <><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="m8 8 12 10M8 16 20 6" /></>,
    palette: <><path d="M12 3a9 9 0 1 0 0 18h1.2a2.2 2.2 0 0 0 1.4-3.9 1.8 1.8 0 0 1 1.1-3.2h1.8A3.5 3.5 0 0 0 21 10.4C21 6.3 17 3 12 3Z" /><circle cx="7.5" cy="10" r="1" fill="currentColor" /><circle cx="11" cy="7" r="1" fill="currentColor" /><circle cx="15.5" cy="8.5" r="1" fill="currentColor" /></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  };
  return <svg {...common}>{shapes[name] ?? null}</svg>;
}

function ThreadTrack({
  name,
  thread,
  colours,
  selectedBlockId,
  selectedBlockIds,
  blockTokenDraft,
  activeTrackName,
  activeBlockReflected,
  onBlockTokenDraftChange,
  onCommitBlockToken,
  onSelect,
  onInsert,
  onMove,
  onResize,
}: {
  name: ThreadName;
  thread: ThreadModel;
  colours: Map<string, string>;
  selectedBlockId: string | null;
  selectedBlockIds: string[];
  blockTokenDraft: string;
  activeTrackName: ThreadName | null;
  activeBlockReflected: boolean;
  onBlockTokenDraftChange: (value: string) => void;
  onCommitBlockToken: (name: ThreadName, blockId: string, token: string) => void;
  onSelect: (block: ExpandedBlock, event: MouseEvent<HTMLButtonElement>) => void;
  onInsert: (displayBoundary: number) => void;
  onMove: (blockId: string, displayBoundary: number) => void;
  onResize: (blockId: string, length: number, neighbourId?: string, neighbourLength?: number) => void;
}) {
  const displayBlocks = useMemo(() => expandThread(thread), [thread]);
  const dragId = useRef<string | null>(null);
  const range = getThreadMirrorRange(thread);

  const startResize = (event: ReactPointerEvent<HTMLSpanElement>, block: ThreadBlock, edge: "left" | "right", adjacent: ThreadBlock | null) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startLength = block.length;
    const pointerId = event.pointerId;
    const unitPixels = 10;
    // At an interior edge, transfer run units between the two adjacent blocks.
    // The thread's total length therefore stays constant while that shared edge moves.
    const neighbour = adjacent && adjacent.id !== block.id ? adjacent : null;
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const pointerDelta = Math.round((moveEvent.clientX - startX) / unitPixels);
      const requestedCurrentDelta = edge === "right" ? pointerDelta : -pointerDelta;
      if (neighbour) {
        const currentDelta = Math.max(1 - startLength, Math.min(neighbour.length - 1, requestedCurrentDelta));
        onResize(block.id, startLength + currentDelta, neighbour.id, neighbour.length - currentDelta);
      } else {
        onResize(block.id, Math.max(1, startLength + requestedCurrentDelta));
      }
    };
    const up = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return (
    <section className="thread-section">
      <div className="thread-heading">
        <div className="thread-heading-main">
          <span className={`thread-mark ${name}`} aria-hidden="true">{name === "warp" ? "W" : "F"}</span>
          <div>
            <h3>{name === "warp" ? "Warp" : "Weft"}</h3>
            <p>{name === "warp" ? "Lengthwise thread" : "Crosswise thread"}</p>
          </div>
        </div>
        {range && <span className="mirror-key"><span className="mirror-key-source" /> mirrored source <span className="mirror-key-reflected" /> reflected copy</span>}
      </div>
      <div className="thread-scroll" aria-label={`${name} thread blocks; horizontally scrollable`}>
        <div className="thread-track">
          <button
            type="button"
            className="insert-slot edge-slot"
            aria-label={`Add a block at the start of ${name}`}
            title="Add block at start"
            onClick={() => onInsert(0)}
            onDragOver={(event) => { event.preventDefault(); event.currentTarget.classList.add("drop-target"); }}
            onDragLeave={(event) => event.currentTarget.classList.remove("drop-target")}
            onDrop={(event) => { event.currentTarget.classList.remove("drop-target");
              event.preventDefault();
              const id = event.dataTransfer.getData("text/plain") || dragId.current;
              if (id) onMove(id, 0);
              dragId.current = null;
            }}
          ><Icon name="plus" /></button>
          {displayBlocks.map((entry, index) => {
            const hex = colours.get(entry.block.colourId) ?? "#7B7E80";
            const colourText = contrastFor(hex);
            const previousBlock = index > 0 ? displayBlocks[index - 1].block : null;
            const nextBlock = index < displayBlocks.length - 1 ? displayBlocks[index + 1].block : null;
            const editingThisOccurrence =
              selectedBlockId === entry.block.id &&
              activeTrackName === name &&
              activeBlockReflected === entry.reflected;
            const draftToken = editingThisOccurrence ? blockTokenDraft : `${entry.block.colourId}${entry.block.length}`;
            const blockWidth = Math.max(
              26,
              entry.block.length * 10 + 16,
              editingThisOccurrence ? draftToken.length * 12 + 22 : 0,
            );
            const classNames = [
              "thread-block",
              entry.block.length <= 3 ? "compact-block" : "",
              entry.inMirror && !entry.reflected ? "mirror-source" : "",
              entry.reflected ? "mirror-reflected" : "",
              selectedBlockId === entry.block.id ? "selected" : selectedBlockIds.includes(entry.block.id) ? "multi-selected" : "",
            ].filter(Boolean).join(" ");
            return (
              <div className="thread-block-group" key={`${entry.block.id}-${entry.reflected ? "r" : "s"}`}>
                {index > 0 && <button
                  type="button"
                  className="insert-slot"
                  aria-label={`Insert a block before block ${index + 1} in ${name}`}
                  title="Insert block here"
                  onClick={() => onInsert(index)}
                  onDragOver={(event) => { event.preventDefault(); event.currentTarget.classList.add("drop-target"); }}
                  onDragLeave={(event) => event.currentTarget.classList.remove("drop-target")}
                  onDrop={(event) => { event.currentTarget.classList.remove("drop-target");
                    event.preventDefault();
                    const id = event.dataTransfer.getData("text/plain") || dragId.current;
                    if (id) onMove(id, index);
                    dragId.current = null;
                  }}
                ><Icon name="plus" /></button>}
                <button
                  type="button"
                  className={classNames}
                  style={{ backgroundColor: hex, color: colourText, width: `${blockWidth}px` }}
                  onClick={(event) => onSelect(entry, event)}
                  draggable
                  onDragStart={(event) => {
                    dragId.current = entry.block.id;
                    event.dataTransfer.setData("text/plain", entry.block.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.currentTarget.classList.add("dragging");
                  }}
                  onDragEnd={(event) => {
                    event.currentTarget.classList.remove("dragging");
                    dragId.current = null;
                  }}
                  title={`${entry.block.colourId}${entry.block.length}${entry.reflected ? " · reflected copy; edits affect its source" : entry.inMirror ? " · mirrored source" : ""}`}
                >
                  <span className="drag-grip"><Icon name="grip" /></span>
                  <span className="block-colour-id">{entry.block.colourId}</span>
                  <span className="block-length">{entry.block.length}</span>
                  {entry.reflected && <span className="reflect-glyph" aria-label="Reflected">↶</span>}
                  <span className="resize-handle resize-left" aria-hidden="true" onPointerDown={(event) => startResize(event, entry.block, "left", previousBlock)} />
                  <span className="resize-handle resize-right" aria-hidden="true" onPointerDown={(event) => startResize(event, entry.block, "right", nextBlock)} />
                </button>
                {editingThisOccurrence && (
                  <input
                    className="block-inline-editor"
                    type="text"
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={`Edit block token, colour letter and length; current block ${entry.block.colourId}${entry.block.length}`}
                    title="Enter a colour letter and positive length, such as a8. Enter applies; Escape cancels."
                    value={blockTokenDraft}
                    style={{ backgroundColor: hex, color: colourText, width: `${blockWidth}px` }}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => onBlockTokenDraftChange(event.target.value)}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                    onBlur={(event) => onCommitBlockToken(name, entry.block.id, event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.currentTarget.blur();
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        const original = `${entry.block.colourId}${entry.block.length}`;
                        event.currentTarget.value = original;
                        onBlockTokenDraftChange(original);
                        event.currentTarget.blur();
                      }
                    }}
                  />
                )}
              </div>
            );
          })}
          <button
            type="button"
            className="insert-slot edge-slot"
            aria-label={`Add a block at the end of ${name}`}
            title="Add block at end"
            onClick={() => onInsert(displayBlocks.length)}
            onDragOver={(event) => { event.preventDefault(); event.currentTarget.classList.add("drop-target"); }}
            onDragLeave={(event) => event.currentTarget.classList.remove("drop-target")}
            onDrop={(event) => { event.currentTarget.classList.remove("drop-target");
              event.preventDefault();
              const id = event.dataTransfer.getData("text/plain") || dragId.current;
              if (id) onMove(id, displayBlocks.length);
              dragId.current = null;
            }}
          ><Icon name="plus" /></button>
        </div>
      </div>
      <div className="thread-footnote">
        <span>{displayBlocks.length} displayed blocks</span>
        <span>Drag blocks to reorder · drag an edge to resize · plus signs insert</span>
      </div>
    </section>
  );
}

function App() {
  const initial = useMemo(() => getInitialState(), []);
  const [model, setModel] = useState<TartanModel>(initial.model);
  const modelRef = useRef(model);
  const [code, setCode] = useState(initial.code);
  const [parseError, setParseError] = useState<string | null>(initial.error);
  const [endpointError, setEndpointError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [tileSize, setTileSize] = useState<{ width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState<(typeof TILE_ZOOMS)[number]>(1);
  const catalogue = CATALOGUE_ITEMS;
  const catalogueState = catalogue.length > 0 ? "ready" : "missing";
  const [catalogueQuery, setCatalogueQuery] = useState("");
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [format, setFormat] = useState<OutputFormat>("png");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
  const [blockTokenDraft, setBlockTokenDraft] = useState("");
  const [activeTrackName, setActiveTrackName] = useState<ThreadName | null>(null);
  const [activeBlockReflected, setActiveBlockReflected] = useState(false);
  const [colourDrafts, setColourDrafts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(true);
  const [apiOpen, setApiOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [catalogueName, setCatalogueName] = useState("");
  const codeRef = useRef<HTMLTextAreaElement | null>(null);
  const previewRequestRef = useRef<AbortController | null>(null);
  const previewPatternRef = useRef<string>("");

  const serialisedModel = useMemo(() => serialiseTdf(model), [model]);
  const colourMap = useMemo(() => new Map<string, string>(model.colours.map((colour) => [colour.id, colour.hex] as [string, string])), [model.colours]);
  const selectedBlock = selectedBlockId ? findBlock(model, selectedBlockId) : null;

  const applyModel = useCallback((nextModel: TartanModel) => {
    modelRef.current = nextModel;
    setModel(nextModel);
    const nextCode = serialiseTdf(nextModel);
    setCode(nextCode);
    setParseError(null);
    setColourDrafts({});
    setEndpointError(null);
    setCatalogueName("");
    setCatalogueQuery("");
  }, []);

  const notify = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => current === message ? null : current), 2600);
  }, []);

  const tryCopy = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      notify(`${label} copied to clipboard`);
    } catch {
      const temporary = document.createElement("textarea");
      temporary.value = text;
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.appendChild(temporary);
      temporary.select();
      const didCopy = document.execCommand("copy");
      temporary.remove();
      if (didCopy) {
        setCopied(label);
        notify(`${label} copied to clipboard`);
      } else {
        notify("Copy was blocked by the browser. Select and copy the text manually.");
      }
    }
  }, [notify]);

  useEffect(() => {
    let currentObjectUrl: string | null = null;
    const controller = new AbortController();
    fetch("/random?format=webp", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Background request returned ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        currentObjectUrl = URL.createObjectURL(blob);
        setBackgroundUrl(currentObjectUrl);
      })
      .catch(() => {
        // The stylesheet includes a subdued woven fallback if /random is unavailable.
      });
    return () => {
      controller.abort();
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    };
  }, []);



  useEffect(() => {
    if (parseError) return;
    const timer = window.setTimeout(() => {
      const next = new URL(window.location.href);
      next.searchParams.set("pattern", code);
      window.history.replaceState({}, "", `${next.pathname}${next.search}${next.hash}`);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [code, parseError]);

  useEffect(() => {
    const pattern = serialisedModel;
    if (pattern === previewPatternRef.current && previewUrl) return;

    const timer = window.setTimeout(() => {
      previewRequestRef.current?.abort();
      const controller = new AbortController();
      previewRequestRef.current = controller;
      const url = makeEndpointUrl("/weave", pattern, "webp");
      fetch(url, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`Renderer returned ${response.status}`);
          return response.blob();
        })
        .then((blob) => {
          if (controller.signal.aborted) return;
          const objectUrl = URL.createObjectURL(blob);
          setPreviewUrl((oldUrl) => {
            if (oldUrl) URL.revokeObjectURL(oldUrl);
            return objectUrl;
          });
          previewPatternRef.current = pattern;
          setEndpointError(null);
          const probe = new Image();
          probe.onload = () => setTileSize({ width: probe.naturalWidth, height: probe.naturalHeight });
          probe.src = objectUrl;
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setEndpointError(error instanceof Error ? error.message : "Unable to render this pattern.");
        });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [serialisedModel, parseError, previewNonce, previewUrl]);

  useEffect(() => () => {
    previewRequestRef.current?.abort();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);



  const handleThreadSelect = useCallback((name: ThreadName, entry: ExpandedBlock, event: MouseEvent<HTMLButtonElement>) => {
    const effectiveName: ThreadName = name === "weft" && modelRef.current.weft === null ? "warp" : name;
    if (event.shiftKey && selectionAnchor) {
      const thread = getEffectiveThread(modelRef.current, effectiveName);
      const anchorIndex = thread.blocks.findIndex((block) => block.id === selectionAnchor);
      const clickedIndex = thread.blocks.findIndex((block) => block.id === entry.block.id);
      if (anchorIndex >= 0 && clickedIndex >= 0) {
        const [start, end] = [anchorIndex, clickedIndex].sort((a, b) => a - b);
        setSelectedBlockIds(thread.blocks.slice(start, end + 1).map((block) => block.id));
      } else {
        setSelectedBlockIds([entry.block.id]);
      }
    } else if (event.ctrlKey || event.metaKey) {
      setSelectedBlockIds((current) => current.includes(entry.block.id)
        ? current.filter((id) => id !== entry.block.id)
        : [...current, entry.block.id]);
      setSelectionAnchor(entry.block.id);
    } else {
      setSelectedBlockIds([entry.block.id]);
      setSelectionAnchor(entry.block.id);
    }
    setSelectedBlockId(entry.block.id);
    setBlockTokenDraft(`${entry.block.colourId}${entry.block.length}`);
    setActiveTrackName(name);
    setActiveBlockReflected(entry.reflected);
  }, [selectionAnchor]);

  const addBlockAt = useCallback((name: ThreadName, boundary: number) => {
    const current = modelRef.current;
    const effectiveName: ThreadName = name === "weft" && current.weft === null ? "warp" : name;
    const thread = getEffectiveThread(current, effectiveName);
    const colourId = current.colours[0]?.id;
    if (!colourId) {
      notify("Add a colour before adding a thread block.");
      return;
    }
    const next = modelWithThread(current, effectiveName, (source) => insertBlockAtDisplayBoundary(source, boundary, colourId, 4));
    const updatedThread = getEffectiveThread(next, effectiveName);
    const range = expandThread(updatedThread);
    const newBlock = range.find((entry) => !thread.blocks.some((block) => block.id === entry.block.id));
    applyModel(next);
    if (newBlock) {
      setSelectedBlockId(newBlock.block.id);
      setBlockTokenDraft(`${newBlock.block.colourId}${newBlock.block.length}`);
      setActiveTrackName(name);
      setActiveBlockReflected(false);
      setSelectedBlockIds([newBlock.block.id]);
      setSelectionAnchor(newBlock.block.id);
    }
  }, [applyModel, notify]);

  const moveBlock = useCallback((name: ThreadName, blockId: string, boundary: number) => {
    const current = modelRef.current;
    const effectiveName: ThreadName = name === "weft" && current.weft === null ? "warp" : name;
    const next = modelWithThread(current, effectiveName, (source) => moveBlockToDisplayBoundary(source, blockId, boundary));
    applyModel(next);
  }, [applyModel]);

  const resizeBlock = useCallback((name: ThreadName, blockId: string, length: number, neighbourId?: string, neighbourLength?: number) => {
    const current = modelRef.current;
    const effectiveName: ThreadName = name === "weft" && current.weft === null ? "warp" : name;
    const next = modelWithThread(current, effectiveName, (thread) => ({
      ...thread,
      blocks: thread.blocks.map((block) => {
        if (block.id === blockId) return { ...block, length: Math.max(1, Math.floor(length)) };
        if (neighbourId && block.id === neighbourId && neighbourLength !== undefined) {
          return { ...block, length: Math.max(1, Math.floor(neighbourLength)) };
        }
        return block;
      }),
    }));
    if (serialiseTdf(next) !== serialiseTdf(current)) applyModel(next);
    if (selectedBlockId && (selectedBlockId === blockId || selectedBlockId === neighbourId)) {
      const updatedSelection = findBlock(next, selectedBlockId);
      if (updatedSelection) setBlockTokenDraft(`${updatedSelection.colourId}${updatedSelection.length}`);
    }
  }, [applyModel, selectedBlockId]);

  const commitBlockToken = useCallback((name: ThreadName, blockId: string, rawToken: string) => {
    const current = modelRef.current;
    const effectiveName: ThreadName = name === "weft" && current.weft === null ? "warp" : name;
    const sourceBlock = findBlock(current, blockId);
    if (!sourceBlock) return;

    const token = rawToken;
    const originalToken = `${sourceBlock.colourId}${sourceBlock.length}`;
    if (token === originalToken) {
      setBlockTokenDraft(originalToken);
      return;
    }

    const match = /^([a-z])([1-9][0-9]*)$/.exec(token);
    if (!match) {
      setBlockTokenDraft(originalToken);
      notify("Invalid block. Enter one lowercase colour letter followed by a positive integer, e.g. a8.");
      return;
    }

    const colourId = match[1];
    const length = Number(match[2]);
    if (!current.colours.some((colour) => colour.id === colourId)) {
      setBlockTokenDraft(originalToken);
      notify(`Colour “${colourId}” is not in the palette. Add it first or choose an existing colour letter.`);
      return;
    }
    if (!Number.isSafeInteger(length) || length < 1) {
      setBlockTokenDraft(originalToken);
      notify("Block length must be a positive safe integer.");
      return;
    }

    const next = modelWithThread(current, effectiveName, (thread) => ({
      ...thread,
      blocks: thread.blocks.map((block) => block.id === blockId ? { ...block, colourId, length } : block),
    }));
    applyModel(next);
    setBlockTokenDraft(token);
  }, [applyModel, notify]);

  const changeColour = useCallback((colourId: string, hex: string) => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
    applyModel(updateColourHex(modelRef.current, colourId, hex));
  }, [applyModel]);

  const handleCodeChange = (value: string) => {
    setCode(value);
    setColourDrafts({});
    setCatalogueName("");
    setCatalogueQuery("");
    try {
      const next = parseTdf(value);
      modelRef.current = next;
      setModel(next);
      setParseError(null);
      setEndpointError(null);
      setSelectedBlockId(null);
      setSelectedBlockIds([]);
      setSelectionAnchor(null);
      setBlockTokenDraft("");
      setActiveTrackName(null);
      setActiveBlockReflected(false);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Invalid TDF code.");
    }
  };

  const addPaletteColour = () => {
    try {
      applyModel(addColour(modelRef.current));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to add colour.");
    }
  };

  const deletePaletteColour = (colourId: string) => {
    try {
      applyModel(removeColour(modelRef.current, colourId));
      notify(`Colour ${colourId} removed`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to remove colour.");
    }
  };

  const handleColourId = (oldId: string, newId: string) => {
    if (newId === oldId) return;
    try {
      applyModel(updateColourId(modelRef.current, oldId, newId));
      notify(`Colour ID changed to ${newId}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to change colour ID.");
    }
  };

  const toggleSameWeft = () => {
    const current = modelRef.current;
    applyModel({ ...current, weft: current.weft === null ? cloneThread(current.warp) : null });
    setSelectedBlockId(null);
    setSelectedBlockIds([]);
    setSelectionAnchor(null);
    setBlockTokenDraft("");
    setActiveTrackName(null);
    setActiveBlockReflected(false);
  };

  const applyMirrorSelection = (name: ThreadName) => {
    const current = modelRef.current;
    const effectiveName: ThreadName = name === "weft" && current.weft === null ? "warp" : name;
    const thread = getEffectiveThread(current, effectiveName);
    const selected = selectedBlockIds.filter((id) => thread.blocks.some((block) => block.id === id));
    try {
      const updated = setMirroredBlockIds(thread, selected);
      applyModel(modelWithThread(current, effectiveName, () => updated));
      setSelectedBlockIds(selected);
      notify(selected.length ? "Mirrored section updated" : "Mirrored section cleared");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Choose a contiguous range of blocks.");
    }
  };

  const deleteSelectedBlock = (name: ThreadName) => {
    if (!selectedBlockId) return;
    const current = modelRef.current;
    const effectiveName: ThreadName = name === "weft" && current.weft === null ? "warp" : name;
    try {
      applyModel(modelWithThread(current, effectiveName, (thread) => removeBlock(thread, selectedBlockId)));
      setSelectedBlockId(null);
      setSelectedBlockIds([]);
      setSelectionAnchor(null);
      setBlockTokenDraft("");
      setActiveTrackName(null);
      setActiveBlockReflected(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to delete block.");
    }
  };

  const chooseCatalogueItem = (item: CatalogueItem) => {
    try {
      const nextModel = parseTdf(item.pattern);
      modelRef.current = nextModel;
      setModel(nextModel);
      setCode(item.pattern);
      setParseError(null);
      setEndpointError(null);
      setCatalogueQuery(item.name);
      setCatalogueName(item.name);
      setCatalogueOpen(false);
      setSelectedBlockId(null);
      setSelectedBlockIds([]);
      setSelectionAnchor(null);
      setBlockTokenDraft("");
      setActiveTrackName(null);
      setActiveBlockReflected(false);
      setColourDrafts({});
      notify(`Loaded ${item.name}`);
    } catch (error) {
      notify(`That catalogue entry could not be parsed: ${error instanceof Error ? error.message : "invalid TDF"}`);
    }
  };

  const filteredCatalogue = useMemo(() => {
    const needle = catalogueQuery.trim().toLowerCase();
    if (!needle) return catalogue.slice(0, 60);
    return catalogue.filter((item) => item.name.toLowerCase().includes(needle)).slice(0, 80);
  }, [catalogue, catalogueQuery]);

  const imageUrl = makeEndpointUrl("/weave", code, format);
  const editorUrl = new URL(window.location.href);
  if (!parseError) editorUrl.searchParams.set("pattern", code);
  const editorShareUrl = editorUrl.toString();
  const githubUrl = (import.meta.env.VITE_GITHUB_REPO || "").trim();
  const cssSnippet = `.tartan-background {\n  background-image: url("${imageUrl}");\n  background-repeat: repeat;\n}`;

  const downloadImage = () => {
    const url = makeEndpointUrl("/weave", code, format);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sett-tartan.${format}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    notify(`Downloading ${format.toUpperCase()} tile`);
  };

  const hasMirrorWarp = Boolean(getThreadMirrorRange(model.warp));
  const hasMirrorWeft = Boolean(model.weft && getThreadMirrorRange(model.weft));
  const selectedThreadName: ThreadName = activeTrackName === "weft" && model.weft !== null ? "weft" : "warp";
  const canUseSelectedRange = selectedBlockIds.length > 0;
  const backgroundStyle = backgroundUrl ? { backgroundImage: `url("${backgroundUrl}")` } : undefined;

  return (
    <div className="app-root">
      <div className="background-art" style={backgroundStyle} aria-hidden="true" />
      <div className="background-wash" aria-hidden="true" />
      <div className="site-shell">
        <header className="site-header">
          <div className="brand-mark" aria-hidden="true"><span>S</span></div>
          <p className="eyebrow">A SMALL TOOL FOR BIG PATTERNS</p>
          <h1>Sett: <span>Tartan-as-a-Service</span></h1>
          <p className="header-subtitle">Design a sett. Weave a tile. Take it anywhere.</p>
        </header>

        <main className="editor-panel panel">
          <div className="panel-topline">
            <div>
              <p className="eyebrow">THE WORKSHOP</p>
              <h2>Tartan editor</h2>
            </div>
            <span className={`state-pill ${parseError ? "state-warning" : "state-ready"}`}>
              <span className="state-dot" />{parseError ? "Code needs attention" : "Pattern in sync"}
            </span>
          </div>

          <section className="preview-section">
            <div className="section-heading preview-heading">
              <div>
                <p className="eyebrow">THE WEAVE</p>
                <h3>Repeat preview</h3>
                <p>Your rendered tile, repeated to show the full rhythm of the sett.</p>
              </div>
              <div className="preview-controls">
                <div className="zoom-control" aria-label="Preview zoom">
                  {TILE_ZOOMS.map((value) => <button type="button" key={value} className={zoom === value ? "selected" : ""} onClick={() => setZoom(value)}>{value === 0.65 ? "Small" : value === 1 ? "100%" : "Large"}</button>)}
                </div>
                <button type="button" className="button button-quiet button-small" onClick={() => { previewPatternRef.current = ""; setEndpointError(null); setPreviewUrl(null); setPreviewNonce((value) => value + 1); }}><Icon name="refresh" /> Refresh</button>
              </div>
            </div>
            <div className="preview-frame">
              <div
                className={`woven-preview ${previewUrl ? "has-image" : ""}`}
                style={{
                  backgroundImage: previewUrl ? `url("${previewUrl}")` : undefined,
                  backgroundSize: previewUrl && tileSize ? `${Math.max(1, tileSize.width * zoom)}px ${Math.max(1, tileSize.height * zoom)}px` : undefined,
                }}
                role="img"
                aria-label="Tartan tile repeated as a background preview"
              >
                {!previewUrl && <div className="preview-loading"><span className="spinner" /><strong>{endpointError ? "Preview unavailable" : "Rendering tartan…"}</strong><p>{endpointError ?? "Waiting for the weave endpoint."}</p></div>}
                {previewUrl && endpointError && <div className="preview-warning">Last successful preview shown · {endpointError}</div>}
              </div>
              <div className="preview-caption"><span><span className="live-dot" /> {previewUrl && !parseError && !endpointError ? "Live from /weave" : parseError ? "Showing last valid pattern" : "Waiting for renderer"}</span><span>{tileSize ? `${tileSize.width} × ${tileSize.height}px tile` : "Repeatable image tile"}</span></div>
            </div>
          </section>

          <section className="catalogue-section">
            <div className="section-heading compact-heading">
              <div>
                <h3>Start with a known tartan</h3>
                <p>Search the catalogue, then make it your own.</p>
              </div>
              <span className="catalogue-count">{catalogueState === "ready" ? `${catalogue.length.toLocaleString()} patterns` : "Catalogue empty"}</span>
            </div>
            <div className="catalogue-combobox">
              <Icon name="search" />
              <input
                value={catalogueQuery}
                onChange={(event) => { setCatalogueQuery(event.target.value); setCatalogueOpen(true); }}
                onFocus={() => setCatalogueOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setCatalogueOpen(false);
                  if (event.key === "Enter" && filteredCatalogue[0]) {
                    event.preventDefault();
                    chooseCatalogueItem(filteredCatalogue[0]);
                  }
                }}
                placeholder={catalogueState === "ready" ? "Find a tartan by name…" : "Add entries to @catalogue/tartans.json"}
                aria-label="Search tartan catalogue"
                disabled={catalogueState !== "ready"}
              />
              {catalogueQuery && <button type="button" className="icon-button combobox-clear" onClick={() => { setCatalogueQuery(""); setCatalogueName(""); setCatalogueOpen(true); }} aria-label="Clear catalogue search"><Icon name="x" /></button>}
              <button type="button" className="combobox-chevron" onClick={() => setCatalogueOpen((open) => !open)} aria-label="Toggle catalogue list"><Icon name="chevron" /></button>
              {catalogueOpen && catalogueState === "ready" && (
                <>
                  <button type="button" className="popover-scrim" aria-label="Close catalogue" onClick={() => setCatalogueOpen(false)} />
                  <div className="catalogue-menu">
                    <div className="catalogue-menu-top"><span>{catalogueQuery ? `${filteredCatalogue.length} matches shown` : "Popular starting points"}</span><span>↑↓ browse · Enter select</span></div>
                    {filteredCatalogue.length ? filteredCatalogue.map((item, index) => (
                      <button type="button" className="catalogue-option" key={`${item.name}-${index}`} onClick={() => chooseCatalogueItem(item)}>
                        <span className="catalogue-option-name">{item.name}</span>
                        <span className="catalogue-option-pattern">{item.pattern.slice(0, 35)}{item.pattern.length > 35 ? "…" : ""}</span>
                      </button>
                    )) : <div className="catalogue-empty">No matching tartans. Try a shorter search.</div>}
                    {catalogue.length > filteredCatalogue.length && <p className="catalogue-limit">Showing the first {filteredCatalogue.length} matches. Refine your search for more.</p>}
                  </div>
                </>
              )}
            </div>
            {catalogueName && <p className="catalogue-selection">Selected catalogue entry: <strong>{catalogueName}</strong></p>}
          </section>

          <section className="palette-section">
            <div className="section-heading">
              <div>
                <h3><Icon name="palette" /> Colour palette</h3>
                <p>Each colour gets one lowercase letter in TDF.</p>
              </div>
              <button className="button button-secondary button-small" type="button" onClick={addPaletteColour} disabled={model.colours.length >= 26}>
                <Icon name="plus" /> Add colour <span className="button-count">{model.colours.length}/26</span>
              </button>
            </div>
            <div className="palette-grid">
              {model.colours.map((colour) => {
                const used = isColourUsed(model, colour.id);
                return (
                  <div className="colour-card" key={colour.id}>
                    <label className="colour-picker" style={{ backgroundColor: colour.hex }} title={`Choose colour ${colour.id}`}>
                      <input
                        type="color"
                        value={colour.hex}
                        aria-label={`Choose colour ${colour.id}`}
                        onChange={(event) => changeColour(colour.id, event.target.value)}
                      />
                      <span className="colour-picker-symbol">↗</span>
                    </label>
                    <div className="colour-fields">
                      <label className="colour-id-label">ID
                        <input
                          value={colour.id}
                          maxLength={1}
                          pattern="[a-z]"
                          aria-label={`Colour ${colour.id} ID`}
                          onChange={(event) => {
                            const draft = event.target.value;
                            if (/^[a-z]$/.test(draft)) handleColourId(colour.id, draft);
                          }}
                        />
                      </label>
                      <label className="colour-hex-label">Hex
                        <input
                          value={colourDrafts[colour.id] ?? colour.hex}
                          spellCheck={false}
                          maxLength={7}
                          aria-label={`Colour ${colour.id} hex value`}
                          onChange={(event) => {
                            const value = event.target.value.toUpperCase();
                            setColourDrafts((current) => ({ ...current, [colour.id]: value }));
                            if (/^#[0-9A-F]{6}$/.test(value)) changeColour(colour.id, value);
                          }}
                          onBlur={() => setColourDrafts((current) => ({ ...current, [colour.id]: model.colours.find((entry) => entry.id === colour.id)?.hex ?? colour.hex }))}
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      className="icon-button colour-delete"
                      aria-label={`Delete colour ${colour.id}`}
                      title={used ? "This colour is used by a thread block" : model.colours.length <= 1 ? "At least one colour definition is required" : "Delete unused colour"}
                      disabled={used || model.colours.length <= 1}
                      onClick={() => deletePaletteColour(colour.id)}
                    ><Icon name="trash" /></button>
                  </div>
                );
              })}
              {model.colours.length === 0 && <p className="empty-note">Add a colour before adding thread blocks.</p>}
            </div>
          </section>

          <section className="threads-section">
            <div className="section-heading">
              <div>
                <h3>Thread layout</h3>
                <p>Blocks are proportional runs of colour in the thread.</p>
              </div>
              <button type="button" className={`button button-secondary button-small ${model.weft === null ? "is-active" : ""}`} onClick={toggleSameWeft}>
                <span className={`toggle-indicator ${model.weft === null ? "on" : ""}`} />
                Same warp &amp; weft
              </button>
            </div>
            <div className="thread-canvas">
              <ThreadTrack
                name="warp"
                thread={model.warp}
                colours={colourMap}
                selectedBlockId={selectedBlockId}
                selectedBlockIds={selectedBlockIds}
                blockTokenDraft={blockTokenDraft}
                activeTrackName={activeTrackName}
                activeBlockReflected={activeBlockReflected}
                onBlockTokenDraftChange={setBlockTokenDraft}
                onCommitBlockToken={commitBlockToken}
                onSelect={(entry, event) => handleThreadSelect("warp", entry, event)}
                onInsert={(boundary) => addBlockAt("warp", boundary)}
                onMove={(blockId, boundary) => moveBlock("warp", blockId, boundary)}
                onResize={(blockId, length) => resizeBlock("warp", blockId, length)}
              />
              <div className="thread-divider" aria-hidden="true"><span /> <span className="thread-divider-label">warp × weft</span> <span /></div>
              <ThreadTrack
                name="weft"
                thread={model.weft ?? model.warp}
                colours={colourMap}
                selectedBlockId={selectedBlockId}
                selectedBlockIds={selectedBlockIds}
                blockTokenDraft={blockTokenDraft}
                activeTrackName={activeTrackName}
                activeBlockReflected={activeBlockReflected}
                onBlockTokenDraftChange={setBlockTokenDraft}
                onCommitBlockToken={commitBlockToken}
                onSelect={(entry, event) => handleThreadSelect("weft", entry, event)}
                onInsert={(boundary) => addBlockAt("weft", boundary)}
                onMove={(blockId, boundary) => moveBlock("weft", blockId, boundary)}
                onResize={(blockId, length) => resizeBlock("weft", blockId, length)}
              />
              {model.weft === null && <p className="linked-thread-note"><Icon name="link" /> Weft mirrors the warp. Turn off “Same warp &amp; weft” to edit it independently.</p>}
            </div>

            <div className="thread-actions-bar">
              <div className="inline-edit-guidance">
                <strong>{selectedBlock ? `Selected block: ${selectedBlock.colourId}${selectedBlock.length}` : "Edit blocks directly"}</strong>
                <span>Click a block and type its token, e.g. <code>a8</code>. Enter applies; Escape cancels. Invalid tokens are rejected.</span>
              </div>
              {selectedBlock && (
                <div className="selected-block-actions">
                  <button type="button" className="button button-danger button-small" onClick={() => deleteSelectedBlock(selectedThreadName)}><Icon name="trash" /> Delete</button>
                  <button type="button" className="button button-quiet button-small" onClick={() => setSelectedBlockId(null)}>Done</button>
                </div>
              )}
              <div className="mirror-controls">
                <div className="mirror-control-copy">
                  <strong>Mirrored section</strong>
                  <span>{selectedBlockIds.length ? `${selectedBlockIds.length} source block${selectedBlockIds.length === 1 ? "" : "s"} selected` : "Shift-click a range of blocks to select it"}</span>
                </div>
                <button type="button" className="button button-secondary button-small" disabled={!canUseSelectedRange} onClick={() => applyMirrorSelection(selectedThreadName)}><Icon name="scissors" /> Mirror selected range</button>
                {(selectedThreadName === "warp" ? hasMirrorWarp : hasMirrorWeft) && (
                  <button type="button" className="button button-quiet button-small" onClick={() => {
                    const current = modelRef.current;
                    const name = selectedThreadName;
                    const next = modelWithThread(current, name, (thread) => ({ ...thread, mirrorIds: null }));
                    applyModel(next);
                    setSelectedBlockIds([]);
                    notify("Mirrored section removed");
                  }}>Remove mirror</button>
                )}
              </div>
            </div>
          </section>

          <section className="code-section">
            <div className="section-heading">
              <div>
                <h3><Icon name="code" /> TDF source</h3>
                <p>Edit the code directly, or use the visual controls above.</p>
              </div>
              <button type="button" className="button button-quiet button-small" onClick={() => tryCopy(code, "TDF code")}><Icon name="copy" /> Copy code</button>
            </div>
            <textarea
              ref={codeRef}
              className={`tdf-editor ${parseError ? "has-error" : ""}`}
              value={code}
              spellCheck={false}
              rows={3}
              aria-label="TDF source code"
              onChange={(event) => handleCodeChange(event.target.value)}
            />
            {parseError ? (
              <div className="validation-message error-message"><span>!</span><div><strong>Invalid TDF</strong><p>{parseError}</p><small>The preview stays on the last valid pattern until this code can be parsed.</small></div><button type="button" className="button button-quiet button-small" onClick={() => applyModel(modelRef.current)}>Reset code</button></div>
            ) : (
              <div className="validation-message success-message"><Icon name="check" /><span>Valid TDF · URL updates as you edit</span></div>
            )}
          </section>



          <section className="export-section">
            <div className="section-heading">
              <div><h3>Export &amp; share</h3><p>Use the tile elsewhere, or share an editable pattern.</p></div>
              <div className="format-picker"><label htmlFor="output-format">Image format</label><select id="output-format" value={format} onChange={(event) => setFormat(event.target.value as OutputFormat)}>{FORMAT_OPTIONS.map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select></div>
            </div>
            <div className="export-grid">
              <div className="export-card">
                <span className="export-icon"><Icon name="download" /></span>
                <div className="export-card-content"><h4>Download tile</h4><p>Save the rendered repeating unit as {format.toUpperCase()}.</p></div>
                <button type="button" className="button button-primary button-small" onClick={downloadImage} disabled={Boolean(parseError)}><Icon name="download" /> Download</button>
              </div>
              <div className="export-card">
                <span className="export-icon"><Icon name="image" /></span>
                <div className="export-card-content"><h4>Direct image URL</h4><p>A link to the rendered tile, ready for an image tag or CSS.</p></div>
                <button type="button" className="button button-secondary button-small" onClick={() => tryCopy(imageUrl, "Image URL")} disabled={Boolean(parseError)}><Icon name="copy" /> Copy URL</button>
              </div>
              <div className="export-card">
                <span className="export-icon"><Icon name="link" /></span>
                <div className="export-card-content"><h4>Editor URL</h4><p>Reopen Sett with this pattern loaded and ready to edit.</p></div>
                <button type="button" className="button button-secondary button-small" onClick={() => tryCopy(editorShareUrl, "Editor URL")} disabled={Boolean(parseError)}><Icon name="copy" /> Copy URL</button>
              </div>
              <div className="export-card">
                <span className="export-icon"><Icon name="code" /></span>
                <div className="export-card-content"><h4>Repeating CSS</h4><p>Copy a small CSS rule for a repeating page background.</p></div>
                <button type="button" className="button button-secondary button-small" onClick={() => tryCopy(cssSnippet, "CSS snippet")} disabled={Boolean(parseError)}><Icon name="copy" /> Copy CSS</button>
              </div>
            </div>
            <div className="export-code-preview"><code>{cssSnippet}</code><button type="button" className="icon-button" onClick={() => tryCopy(cssSnippet, "CSS snippet")} aria-label="Copy CSS snippet"><Icon name="copy" /></button></div>
          </section>
        </main>

        <footer className="site-footer">
          <div className="footer-topline">
            <div className="footer-brand"><span className="footer-brand-symbol">S</span><div><strong>Sett</strong><span>Tartan-as-a-Service</span></div></div>
            {githubUrl ? <a className="github-link" href={githubUrl} target="_blank" rel="noreferrer"><Icon name="github" /> GitHub repository <Icon name="external" /></a> : <span className="github-link github-link-pending" title="Set VITE_GITHUB_REPO to your repository URL"><Icon name="github" /> Add repository URL <Icon name="external" /></span>}
          </div>
          <div className="footer-columns">
            <section className="footer-copy">
              <button type="button" className="footer-disclosure" onClick={() => setAboutOpen((open) => !open)} aria-expanded={aboutOpen}><span>About the project</span><Icon name="chevron" /></button>
              {aboutOpen && <div className="footer-prose"><p>Sett is a small workshop for describing, editing and rendering tartan patterns. A pattern is expressed as compact TDF code: colour definitions followed by warp and, optionally, weft thread runs. The result is a repeatable tile you can use on the web or take into another project.</p><p>The idea behind the project and its historical context can be documented here. This copy is intentionally easy to replace with your own origin story and acknowledgements.</p></div>}
            </section>
            <section className="footer-copy">
              <button type="button" className="footer-disclosure" onClick={() => setApiOpen((open) => !open)} aria-expanded={apiOpen}><span>API quick reference</span><Icon name="chevron" /></button>
              {apiOpen && <div className="footer-prose api-reference"><p><code>GET /weave?pattern=…&amp;format=png</code></p><p>Render a supplied TDF pattern. The <code>format</code> parameter accepts <code>png</code>, <code>webp</code> or <code>gif</code>; it defaults to PNG.</p><p><code>GET /random?format=webp</code></p><p>Return a random catalogue pattern as an image tile. Both endpoints return image data.</p></div>}
            </section>
          </div>
          <div className="footer-bottom"><span>Made for the love of pattern.</span><span>Colour, structure, repeat.</span></div>
        </footer>
      </div>

      {notice && <div className="toast" role="status"><Icon name="check" /> {notice}</div>}
      {copied && <span className="sr-only" aria-live="polite">{copied} copied.</span>}
    </div>
  );
}

export default App;
