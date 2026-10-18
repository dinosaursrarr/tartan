import { useCallback, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import {
  createStarterModel,
  expandThread,
  findBlock,
  getEffectiveThread,
  getThreadMirrorRange,
  isColourUsed,
  parseTdf,
  serialiseTdf,
  type ExpandedBlock,
  type TartanModel,
  type ThreadName,
} from "../lib/tdf";
import {
  addPaletteColour,
  canShiftThreadBlock,
  createIndependentWeft,
  deletePaletteColour,
  insertThreadBlock,
  linkWeftToWarp,
  mirrorThreadBlocks,
  moveThreadBlock,
  recolourPaletteEntry,
  removeThreadBlocks,
  renamePaletteColour,
  resizeThreadBlock,
  setThreadBlockToken,
  shiftThreadBlock,
  updateThread,
} from "../lib/editorOperations";
import { commonLengthFactor, doubleModelLengths, normalisePattern, reduceModelToUnit } from "../lib/patternMath";
import { isContiguousSelection, rangeSelection } from "../lib/selection";
import { useTartanHistory } from "./useTartanHistory";

function getInitialState(): { model: TartanModel; code: string; error: string | null } {
  const query = new URLSearchParams(window.location.search).get("pattern");
  if (query !== null) {
    try {
      const model = parseTdf(query);
      return { model, code: query, error: null };
    } catch (error) {
      const model = createStarterModel();
      return { model, code: query, error: error instanceof Error ? error.message : "Invalid pattern URL." };
    }
  }
  const model = createStarterModel();
  return { model, code: serialiseTdf(model), error: null };
}

function modelFingerprint(model: TartanModel): string {
  return serialiseTdf(model);
}

export function useTartanEditor() {
  const initial = useMemo(() => getInitialState(), []);
  const history = useTartanHistory(initial.model);
  const model = history.present;
  const modelRef = useRef(model);
  modelRef.current = model;
  const sourceEditActive = useRef(false);

  const [code, setCode] = useState(initial.code);
  const [parseError, setParseError] = useState<string | null>(initial.error);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
  const [selectedThreadName, setSelectedThreadName] = useState<ThreadName>("warp");
  const [editing, setEditing] = useState<{ blockId: string; thread: ThreadName; reflected: boolean } | null>(null);
  const [tokenDraft, setTokenDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const serialisedModel = useMemo(() => serialiseTdf(model), [model]);
  const selectedBlocks = useMemo(() => {
    const thread = getEffectiveThread(model, selectedThreadName);
    const ids = new Set(selectedIds);
    return thread.blocks.filter((block) => ids.has(block.id));
  }, [model, selectedIds, selectedThreadName]);
  const colourMap = useMemo(() => new Map(model.colours.map((colour) => [colour.id, colour.hex])), [model.colours]);
  const threadForSelection = getEffectiveThread(model, selectedThreadName);
  const canMirrorSelection = isContiguousSelection(threadForSelection, selectedIds);
  const currentMirrorRange = getThreadMirrorRange(threadForSelection);
  const commonFactor = commonLengthFactor(model);

  const notify = useCallback((text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage((current) => current === text ? null : current), 2800);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setSelectionAnchor(null);
    setEditing(null);
    setTokenDraft("");
  }, []);

  const applyModel = useCallback((next: TartanModel, options: { recordHistory?: boolean; syncCode?: boolean } = {}) => {
    const current = modelRef.current;
    if (modelFingerprint(current) === modelFingerprint(next)) return;
    if (options.recordHistory === false) history.replace(next);
    else history.commit(next);
    modelRef.current = next;
    sourceEditActive.current = false;
    if (options.syncCode !== false) {
      setCode(serialiseTdf(next));
      setParseError(null);
    }
  }, [history.commit, history.replace]);

  const onCodeChange = useCallback((nextCode: string) => {
    setCode(nextCode);
    try {
      const parsed = parseTdf(nextCode);
      setParseError(null);
      if (modelFingerprint(parsed) !== modelFingerprint(modelRef.current)) {
        if (!sourceEditActive.current) history.commit(parsed);
        else history.replace(parsed);
        sourceEditActive.current = true;
        modelRef.current = parsed;
        if (selectedIds.length > 0 || editing !== null) clearSelection();
      }
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Invalid TDF code.");
    }
  }, [history.commit, history.replace, clearSelection, selectedIds.length, editing]);

  const onCodeBlur = useCallback(() => {
    sourceEditActive.current = false;
    if (!parseError) setCode(serialiseTdf(modelRef.current));
  }, [parseError]);

  const resetCode = useCallback(() => {
    setCode(serialiseTdf(modelRef.current));
    setParseError(null);
    sourceEditActive.current = false;
  }, []);

  const undo = useCallback(() => {
    const previous = history.undoValue;
    if (previous === undefined) return;
    history.undo();
    modelRef.current = previous;
    setCode(serialiseTdf(previous));
    sourceEditActive.current = false;
    clearSelection();
    setParseError(null);
  }, [history.undoValue, history.undo, clearSelection]);

  const redo = useCallback(() => {
    const next = history.redoValue;
    if (next === undefined) return;
    history.redo();
    modelRef.current = next;
    setCode(serialiseTdf(next));
    sourceEditActive.current = false;
    clearSelection();
    setParseError(null);
  }, [history.redoValue, history.redo, clearSelection]);

  const checkpointHistory = useCallback(() => history.checkpoint(), [history.checkpoint]);

  const selectBlock = useCallback((name: ThreadName, entry: ExpandedBlock, event: MouseEvent<HTMLButtonElement>) => {
    const effectiveName = name === "weft" && modelRef.current.weft === null ? "warp" : name;
    setSelectedThreadName(effectiveName);
    const thread = getEffectiveThread(modelRef.current, effectiveName);
    if (event.shiftKey) {
      // Shift-click is always a selection gesture, never a request to edit a token.
      // A prior anchor is only valid if it belongs to this thread.
      const anchorExistsInThread = Boolean(selectionAnchor && thread.blocks.some((block) => block.id === selectionAnchor));
      setSelectedIds(anchorExistsInThread
        ? rangeSelection(thread, selectionAnchor!, entry.block.id)
        : [entry.block.id]);
      if (!anchorExistsInThread) setSelectionAnchor(entry.block.id);
      setEditing(null);
      setTokenDraft("");
    } else if (event.ctrlKey || event.metaKey) {
      setSelectedIds((current) => selectedThreadName !== effectiveName || !current.includes(entry.block.id)
        ? (selectedThreadName !== effectiveName ? [entry.block.id] : [...current, entry.block.id])
        : current.filter((id) => id !== entry.block.id));
      setSelectionAnchor(entry.block.id);
      setEditing(null);
      setTokenDraft("");
    } else {
      setSelectedIds([entry.block.id]);
      setSelectionAnchor(entry.block.id);
      setEditing({ blockId: entry.block.id, thread: effectiveName, reflected: entry.reflected });
      setTokenDraft(`${entry.block.colourId}${entry.block.length}`);
    }
  }, [selectionAnchor, selectedThreadName]);

  const cancelTokenEdit = useCallback(() => {
    const block = editing ? findBlock(modelRef.current, editing.blockId) : null;
    setTokenDraft(block ? `${block.colourId}${block.length}` : "");
    setEditing(null);
  }, [editing]);

  const commitBlockToken = useCallback((name: ThreadName, blockId: string, token: string) => {
    try {
      const next = setThreadBlockToken(modelRef.current, name, blockId, token);
      applyModel(next);
      setTokenDraft(token);
      setEditing(null);
      return true;
    } catch (error) {
      const original = findBlock(modelRef.current, blockId);
      setTokenDraft(original ? `${original.colourId}${original.length}` : "");
      notify(error instanceof Error ? error.message : "Invalid block token.");
      return false;
    }
  }, [applyModel, notify]);

  const addBlock = useCallback((name: ThreadName, boundary: number) => {
    try {
      const next = insertThreadBlock(modelRef.current, name, boundary);
      const oldIds = new Set(getEffectiveThread(modelRef.current, name).blocks.map((block) => block.id));
      const nextThread = getEffectiveThread(next, name);
      const added = nextThread.blocks.find((block) => !oldIds.has(block.id));
      applyModel(next);
      if (added) {
        const effectiveName = name === "weft" && next.weft === null ? "warp" : name;
        setSelectedThreadName(effectiveName);
        setSelectedIds([added.id]);
        setSelectionAnchor(added.id);
        setEditing({ blockId: added.id, thread: effectiveName, reflected: false });
        setTokenDraft(`${added.colourId}${added.length}`);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to add a block.");
    }
  }, [applyModel, notify]);

  const moveBlock = useCallback((name: ThreadName, blockId: string, boundary: number) => {
    applyModel(moveThreadBlock(modelRef.current, name, blockId, boundary));
  }, [applyModel]);

  const resizeBlock = useCallback((name: ThreadName, blockId: string, delta: number) => {
    applyModel(resizeThreadBlock(modelRef.current, name, blockId, delta), { recordHistory: false });
  }, [applyModel]);

  const toggleSharedWeft = useCallback((shared: boolean) => {
    applyModel(shared ? linkWeftToWarp(modelRef.current) : createIndependentWeft(modelRef.current));
    clearSelection();
  }, [applyModel, clearSelection]);

  const deleteSelectedBlocks = useCallback(() => {
    if (!selectedIds.length) return;
    try {
      applyModel(removeThreadBlocks(modelRef.current, selectedThreadName, selectedIds));
      notify(`${selectedIds.length} block${selectedIds.length === 1 ? "" : "s"} deleted.`);
      clearSelection();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to delete selected blocks.");
    }
  }, [applyModel, clearSelection, notify, selectedIds, selectedThreadName]);

  const canMoveSelected = useCallback((direction: -1 | 1) => {
    return selectedIds.length === 1 && canShiftThreadBlock(modelRef.current, selectedThreadName, selectedIds[0], direction);
  }, [selectedIds, selectedThreadName]);

  const moveSelected = useCallback((direction: -1 | 1) => {
    if (!canMoveSelected(direction)) return;
    applyModel(shiftThreadBlock(modelRef.current, selectedThreadName, selectedIds[0], direction));
  }, [applyModel, canMoveSelected, selectedIds, selectedThreadName]);

  const applyMirrorSelection = useCallback(() => {
    try {
      applyModel(mirrorThreadBlocks(modelRef.current, selectedThreadName, selectedIds));
      notify("Mirrored section updated.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Choose a contiguous range of blocks.");
    }
  }, [applyModel, notify, selectedIds, selectedThreadName]);

  const removeMirror = useCallback(() => {
    applyModel(updateThread(modelRef.current, selectedThreadName, (thread) => ({ ...thread, mirrorIds: null })));
  }, [applyModel, selectedThreadName]);

  const updateColour = useCallback((id: string, hex: string) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    applyModel(recolourPaletteEntry(modelRef.current, id, hex));
  }, [applyModel]);
  const renameColour = useCallback((oldId: string, newId: string) => {
    try { applyModel(renamePaletteColour(modelRef.current, oldId, newId)); }
    catch (error) { notify(error instanceof Error ? error.message : "Invalid colour ID."); }
  }, [applyModel, notify]);
  const addColour = useCallback(() => {
    try { applyModel(addPaletteColour(modelRef.current)); }
    catch (error) { notify(error instanceof Error ? error.message : "Unable to add colour."); }
  }, [applyModel, notify]);
  const deleteColour = useCallback((id: string) => {
    try { applyModel(deletePaletteColour(modelRef.current, id)); }
    catch (error) { notify(error instanceof Error ? error.message : "Unable to delete colour."); }
  }, [applyModel, notify]);

  const reduceToUnit = useCallback(() => {
    applyModel(reduceModelToUnit(modelRef.current));
    notify("Pattern reduced to its smallest shared unit.");
  }, [applyModel, notify]);
  const doubleAll = useCallback(() => applyModel(doubleModelLengths(modelRef.current)), [applyModel]);

  const loadPattern = useCallback((pattern: string) => {
    try {
      const normalized = normalisePattern(pattern);
      applyModel(parseTdf(normalized));
      clearSelection();
      setParseError(null);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "This catalogue pattern is invalid.");
      return false;
    }
  }, [applyModel, clearSelection, notify]);

  const isCurrentColourUsed = useCallback((id: string) => isColourUsed(modelRef.current, id), []);
  const currentExpandedThread = useCallback((name: ThreadName) => expandThread(getEffectiveThread(modelRef.current, name)), []);

  return {
    model, code, parseError, serialisedModel, colourMap, commonFactor,
    canUndo: history.canUndo, canRedo: history.canRedo,
    selectedIds, selectedBlocks, selectedThreadName, editing, tokenDraft, message,
    canMirrorSelection, currentMirrorRange,
    setTokenDraft, setEditing, notify, applyModel, onCodeChange, onCodeBlur, resetCode, cancelTokenEdit,
    undo, redo, checkpointHistory, selectBlock, clearSelection, commitBlockToken,
    addBlock, moveBlock, resizeBlock, toggleSharedWeft, deleteSelectedBlocks,
    moveSelected, canMoveSelected, applyMirrorSelection, removeMirror, updateColour, renameColour,
    addColour, deleteColour, reduceToUnit, doubleAll, loadPattern, isCurrentColourUsed,
    currentExpandedThread,
  };
}
