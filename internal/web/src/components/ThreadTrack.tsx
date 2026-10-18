import { Fragment, useRef } from "react";
import type { DragEvent, MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { expandThread, getThreadMirrorRange, type ExpandedBlock, type ThreadModel, type ThreadName } from "../lib/tdf";
import { contrastFor } from "../lib/colour";
import { Icon } from "./Icon";

type EditingToken = { blockId: string; thread: ThreadName; reflected: boolean } | null;

type Props = {
  name: ThreadName;
  thread: ThreadModel;
  colours: Map<string, string>;
  selectedIds: string[];
  editing: EditingToken;
  tokenDraft: string;
  onTokenDraftChange: (token: string) => void;
  onCommitToken: (name: ThreadName, blockId: string, token: string) => boolean;
  onCancelToken: () => void;
  onSelect: (name: ThreadName, entry: ExpandedBlock, event: MouseEvent<HTMLButtonElement>) => void;
  onInsert: (name: ThreadName, displayBoundary: number) => void;
  onMove: (name: ThreadName, blockId: string, displayBoundary: number) => void;
  onResize: (name: ThreadName, blockId: string, nextLength: number) => void;
  onResizeStart: () => void;
};

export function ThreadTrack({
  name, thread, colours, selectedIds, editing, tokenDraft,
  onTokenDraftChange, onCommitToken, onCancelToken, onSelect,
  onInsert, onMove, onResize, onResizeStart,
}: Props) {
  const displayBlocks = expandThread(thread);
  const dragId = useRef<string | null>(null);
  const range = getThreadMirrorRange(thread);

  const startResize = (event: ReactPointerEvent<HTMLSpanElement>, blockId: string, startLength: number, edge: "left" | "right") => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const pointerId = event.pointerId;
    const pxPerUnit = 10;
    let checkpointed = false;
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const movement = Math.round((moveEvent.clientX - startX) / pxPerUnit) * (edge === "right" ? 1 : -1);
      if (movement === 0) return;
      const nextLength = Math.max(1, startLength + movement);
      if (nextLength === startLength) return;
      if (!checkpointed) { onResizeStart(); checkpointed = true; }
      onResize(name, blockId, nextLength);
    };
    const finish = (finishEvent: PointerEvent) => {
      if (finishEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement | HTMLButtonElement>, boundary: number) => {
    const id = event.dataTransfer.getData("text/plain") || dragId.current;
    if (!id) return;
    event.preventDefault();
    event.stopPropagation();
    onMove(name, id, boundary);
    dragId.current = null;
  };
  const slotEvents = (boundary: number) => ({
    onDragOver: (event: DragEvent<HTMLButtonElement>) => { if (dragId.current) event.preventDefault(); },
    onDrop: (event: DragEvent<HTMLButtonElement>) => handleDrop(event, boundary),
  });

  return (
    <section className="thread-section">
      <div className="thread-heading">
        <div className="thread-heading-main">
          <span className={`thread-mark ${name}`} aria-hidden="true">{name === "warp" ? "W" : "F"}</span>
          <div><h3>{name === "warp" ? "Warp" : "Weft"}</h3><p>{name === "warp" ? "Lengthwise thread" : "Crosswise thread"}</p></div>
        </div>
        {range && <span className="mirror-key"><span className="mirror-key-source" /> source <span className="mirror-key-reflected" /> reflected copy</span>}
      </div>
      <div className="thread-scroll" aria-label={`${name} thread blocks; horizontally scrollable`}>
        <div className="thread-track">
          <button type="button" className="insert-slot edge-slot" aria-label={`Add at start of ${name}`} title="Add block at start" onClick={() => onInsert(name, 0)} {...slotEvents(0)}><Icon name="plus" /></button>
          {displayBlocks.map((entry, index) => {
            const hex = colours.get(entry.block.colourId) ?? "#777777";
            const textColour = contrastFor(hex);
            const selected = selectedIds.includes(entry.block.id);
            const editingThis = editing?.blockId === entry.block.id && editing.thread === name && editing.reflected === entry.reflected;
            const blockWidth = Math.max(38, entry.block.length * 10 + 16);
            const classes = [
              "thread-block",
              entry.block.length <= 3 ? "compact-block" : "",
              entry.inMirror && !entry.reflected ? "mirror-source" : "",
              entry.reflected ? "mirror-reflected" : "",
              selected ? (selectedIds.length > 1 ? "multi-selected" : "selected") : "",
            ].filter(Boolean).join(" ");
            return <Fragment key={`${entry.block.id}-${entry.reflected ? "reflected" : "source"}`}>
              {index > 0 && <button type="button" className="insert-slot" aria-label={`Insert before block ${index + 1}`} title="Insert block" onClick={() => onInsert(name, index)} {...slotEvents(index)}><Icon name="plus" /></button>}
              <div
                className="thread-block-frame"
                style={{ width: `${blockWidth}px` }}
                onDragOver={(event) => { if (dragId.current && dragId.current !== entry.block.id) { event.preventDefault(); event.currentTarget.classList.add("drag-target"); } }}
                onDragLeave={(event) => event.currentTarget.classList.remove("drag-target")}
                onDrop={(event) => {
                  event.currentTarget.classList.remove("drag-target");
                  const rect = event.currentTarget.getBoundingClientRect();
                  handleDrop(event, index + (event.clientX >= rect.left + rect.width / 2 ? 1 : 0));
                }}
              >
                <button
                  type="button"
                  className={classes}
                  style={{ backgroundColor: hex, color: textColour, width: "100%" }}
                  aria-label={`${entry.block.colourId}${entry.block.length}, ${name} block ${index + 1}${entry.inMirror ? ", mirrored source" : ""}${entry.reflected ? ", reflected copy" : ""}`}
                  onClick={(event) => onSelect(name, entry, event)}
                  title="Select block; Shift-click for a range"
                >
                  <span className="block-colour-id">{entry.block.colourId}</span>
                  <span className="block-length">{entry.block.length}</span>
                  {entry.reflected && <span className="reflect-glyph" aria-hidden="true">↶</span>}
                  {!entry.reflected && <span
                    className="drag-grip"
                    tabIndex={-1}
                    draggable
                    aria-hidden="true"
                    onClick={(event) => event.stopPropagation()}
                    onDragStart={(event) => {
                      event.stopPropagation();
                      dragId.current = entry.block.id;
                      event.dataTransfer.setData("text/plain", entry.block.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => { dragId.current = null; }}
                  ><Icon name="grip" size={12} /></span>}
                  <span className="resize-handle resize-left" onPointerDown={(event) => startResize(event, entry.block.id, entry.block.length, "left")} aria-hidden="true" />
                  <span className="resize-handle resize-right" onPointerDown={(event) => startResize(event, entry.block.id, entry.block.length, "right")} aria-hidden="true" />
                </button>
                {editingThis && <input
                  className="block-token-input"
                  autoFocus
                  aria-label="Edit block token"
                  value={tokenDraft}
                  spellCheck={false}
                  onChange={(event) => onTokenDraftChange(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onBlur={() => { onCommitToken(name, entry.block.id, tokenDraft); }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
                    if (event.key === "Escape") { event.preventDefault(); onCancelToken(); }
                  }}
                />}
              </div>
            </Fragment>;
          })}
          <button type="button" className="insert-slot edge-slot" aria-label={`Add at end of ${name}`} title="Add block at end" onClick={() => onInsert(name, displayBlocks.length)} {...slotEvents(displayBlocks.length)}><Icon name="plus" /></button>
        </div>
      </div>
      <div className="thread-footnote"><span>{thread.blocks.length} source block{thread.blocks.length === 1 ? "" : "s"}</span><span>{displayBlocks.reduce((sum, entry) => sum + entry.block.length, 0)} displayed run units</span></div>
    </section>
  );
}
