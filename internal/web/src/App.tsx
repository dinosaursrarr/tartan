import { useMemo, useState } from "react";
import tartanCatalogue from "@catalogue/tartans.json";
import { CataloguePicker } from "./components/CataloguePicker";
import { ColourPalette } from "./components/ColourPalette";
import { ExportPanel } from "./components/ExportPanel";
import { Icon } from "./components/Icon";
import { PreviewPanel } from "./components/PreviewPanel";
import { SiteFooter } from "./components/SiteFooter";
import { TdfSourceEditor } from "./components/TdfSourceEditor";
import { ThreadTrack } from "./components/ThreadTrack";
import { usePatternUrl } from "./hooks/usePatternUrl";
import { useTartanEditor } from "./hooks/useTartanEditor";
import { useTartanBackground, useWeavePreview } from "./hooks/useWeavePreview";
import { prepareCatalogue } from "./lib/catalogue";
import { getEffectiveThread, type ThreadName } from "./lib/tdf";
import type { PreparedCatalogueEntry } from "./types/catalogue";
import "./app.css";

function App() {
  const editor = useTartanEditor();
  const backgroundUrl = useTartanBackground();
  const preview = useWeavePreview(editor.serialisedModel, !editor.parseError);
  usePatternUrl(editor.code, !editor.parseError);
  const catalogue = useMemo(() => prepareCatalogue(tartanCatalogue), []);
  const [catalogueName, setCatalogueName] = useState(() => catalogue.find((entry) => entry.normalizedPattern === editor.serialisedModel)?.name ?? "");
  const valid = !editor.parseError;
  const mirrorExists = Boolean(getEffectiveThread(editor.model, editor.selectedThreadName).mirrorIds?.length);
  const canMoveSelectedLeft = editor.canMoveSelected(-1);
  const canMoveSelectedRight = editor.canMoveSelected(1);

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      editor.notify(`${label} copied to clipboard.`);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      editor.notify(copied ? `${label} copied to clipboard.` : "Copy was blocked by the browser. Select and copy the text manually.");
    }
  };

  const chooseCatalogue = (entry: PreparedCatalogueEntry) => {
    if (editor.loadPattern(entry.normalizedPattern)) setCatalogueName(entry.name);
  };

  const clearCatalogueName = () => {
    if (catalogueName) setCatalogueName("");
  };

  const updateColourHex = (id: string, hex: string) => { clearCatalogueName(); editor.updateColour(id, hex); };
  const updateColourId = (oldId: string, newId: string) => { clearCatalogueName(); editor.renameColour(oldId, newId); };

  const blockSelect = (name: ThreadName) => (entry: Parameters<typeof editor.selectBlock>[1], event: Parameters<typeof editor.selectBlock>[2]) => {
    editor.selectBlock(name, entry, event);
  };

  return <div className="app-root">
    <div className="background-art" style={backgroundUrl ? { backgroundImage: `url("${backgroundUrl}")` } : undefined} aria-hidden="true" />
    <div className="background-wash" aria-hidden="true" />
    <div className="site-shell">
      <header className="site-header">
        <h1>Sett: Tartan-as-a-Service</h1>
      </header>

      <main className="editor-panel panel">
        <section className="preview-first-section">
          <PreviewPanel imageUrl={preview.url} error={preview.error} width={preview.width} height={preview.height} valid={valid} />
        </section>

        <div className="panel-topline editor-topline">
          <div><h2>Pattern editor</h2><p>Choose a tartan, then make it your own.</p></div>
          <div className="panel-topline-actions">
            <div className="history-controls">
              <button type="button" className="button button-quiet button-small" onClick={editor.undo} disabled={!editor.canUndo} title="Undo (history)"><Icon name="undo" /> Undo</button>
              <button type="button" className="button button-quiet button-small" onClick={editor.redo} disabled={!editor.canRedo} title="Redo (history)"><Icon name="redo" /> Redo</button>
            </div>
            <span className={`state-pill ${valid ? "" : "state-warning"}`}><span className="state-dot" />{valid ? "Valid TDF" : "Source has errors"}</span>
          </div>
        </div>

        <CataloguePicker entries={catalogue} selectedName={catalogueName} onSelect={chooseCatalogue} />

        <ColourPalette
          colours={editor.model.colours}
          isUsed={editor.isCurrentColourUsed}
          onHexChange={updateColourHex}
          onIdCommit={updateColourId}
          onDelete={(id) => { clearCatalogueName(); editor.deleteColour(id); }}
          onAdd={() => { clearCatalogueName(); editor.addColour(); }}
        />

        <section className="threads-section">
          <div className="section-heading">
            <div><h3>Warp &amp; weft</h3><p>Select a block to edit its letter and length. Shift-click selects a range.</p></div>
            <div className="thread-heading-actions">
              <button type="button" className="button button-quiet button-small" onClick={() => { clearCatalogueName(); editor.reduceToUnit(); }} disabled={editor.commonFactor <= 1} title={editor.commonFactor > 1 ? `Divide all lengths by ${editor.commonFactor}` : "No common factor greater than 1"}>Reduce to unit{editor.commonFactor > 1 ? ` ÷${editor.commonFactor}` : ""}</button>
              <button type="button" className="button button-quiet button-small" onClick={() => { clearCatalogueName(); editor.doubleAll(); }} title="Double every block length">Double all ×2</button>
              <label className="same-thread-toggle"><input type="checkbox" checked={editor.model.weft === null} onChange={(event) => { clearCatalogueName(); editor.toggleSharedWeft(event.target.checked); }} /><span className="toggle-indicator" /><span>Same warp &amp; weft</span></label>
            </div>
          </div>
          <div className="thread-canvas">
            <ThreadTrack
              name="warp" thread={editor.model.warp} colours={editor.colourMap}
              selectedIds={editor.selectedIds} editing={editor.editing} tokenDraft={editor.tokenDraft}
              onTokenDraftChange={editor.setTokenDraft} onCommitToken={editor.commitBlockToken} onCancelToken={editor.cancelTokenEdit}
              onSelect={(name, entry, event) =>
                blockSelect(name)(entry, event)
              } onInsert={editor.addBlock} onMove={editor.moveBlock} onResize={editor.resizeBlock} onResizeStart={editor.checkpointHistory}
            />
            {editor.model.weft ? <>
              <div className="thread-divider" aria-hidden="true"><span /><span className="thread-divider-label">warp × weft</span><span /></div>
              <ThreadTrack
                name="weft" thread={editor.model.weft} colours={editor.colourMap}
                selectedIds={editor.selectedIds} editing={editor.editing} tokenDraft={editor.tokenDraft}
                onTokenDraftChange={editor.setTokenDraft} onCommitToken={editor.commitBlockToken} onCancelToken={editor.cancelTokenEdit}
                onSelect={(name, entry, event) =>
                  blockSelect(name)(entry, event)
                } onInsert={editor.addBlock} onMove={editor.moveBlock} onResize={editor.resizeBlock} onResizeStart={editor.checkpointHistory}
              />
            </> : <p className="linked-thread-note"><Icon name="link" /> The weft follows the warp, so only one thread is editable.</p>}
          </div>
          {(editor.selectedIds.length > 0 || mirrorExists) && <div className="thread-actions-bar">
            {editor.selectedIds.length > 0 && <div className="selected-block-actions selected-block-actions-multi">
              <div className="selected-token-list" aria-label="Selected blocks">
                {editor.selectedBlocks.map((block) => <span className="selected-token" key={block.id}>{block.colourId}{block.length}</span>)}
              </div>
              {editor.selectedIds.length === 1 && <div className="mobile-move-controls">
                <button type="button" className="button button-secondary button-small" onClick={() => { clearCatalogueName(); editor.moveSelected(-1); }} disabled={!canMoveSelectedLeft} aria-label="Move selected block left"><Icon name="arrow-left" /> Move left</button>
                <button type="button" className="button button-secondary button-small" onClick={() => { clearCatalogueName(); editor.moveSelected(1); }} disabled={!canMoveSelectedRight} aria-label="Move selected block right"><Icon name="arrow-right" /> Move right</button>
              </div>}
              <button type="button" className="button button-danger button-small" onClick={() => { clearCatalogueName(); editor.deleteSelectedBlocks(); }}><Icon name="trash" /> Delete selected ({editor.selectedIds.length})</button>
              <button type="button" className="button button-quiet button-small" onClick={editor.clearSelection}>Done</button>
            </div>}
            <div className="mirror-controls">
              <div className="mirror-control-copy"><strong>Mirrored section</strong><span>{editor.selectedIds.length ? `${editor.selectedIds.length} block${editor.selectedIds.length === 1 ? "" : "s"} selected` : "Select a contiguous range of blocks"}</span></div>
              <button type="button" className="button button-secondary button-small" disabled={!editor.canMirrorSelection || editor.selectedIds.length === 0} onClick={() => { clearCatalogueName(); editor.applyMirrorSelection(); }}><Icon name="scissors" /> Mirror selected range</button>
              {mirrorExists && <button type="button" className="button button-quiet button-small" onClick={() => { clearCatalogueName(); editor.removeMirror(); }}>Remove mirror</button>}
            </div>
          </div>}
        </section>

        <TdfSourceEditor value={editor.code} error={editor.parseError} onChange={(value) => { clearCatalogueName(); editor.onCodeChange(value); }} onBlur={editor.onCodeBlur} onCopy={() => void copyText(editor.code, "TDF code")} onReset={editor.resetCode} />
        <ExportPanel pattern={editor.serialisedModel} valid={valid} onCopy={(text, label) => void copyText(text, label)} />
      </main>
      <SiteFooter />
    </div>
    {editor.message && <div className="toast" role="status"><Icon name="check" /> {editor.message}</div>}
  </div>;
}

export default App;
