import { useState } from "react";
import type { ColourDefinition } from "../lib/tdf";
import { Icon } from "./Icon";

function ColourCard({
  colour, used, onHexChange, onIdCommit, onDelete,
}: {
  colour: ColourDefinition;
  used: boolean;
  onHexChange: (id: string, hex: string) => void;
  onIdCommit: (oldId: string, newId: string) => void;
  onDelete: (id: string) => void;
}) {
  const [idDraft, setIdDraft] = useState({ source: colour.id, value: colour.id });
  const [hexDraft, setHexDraft] = useState({ source: colour.hex, value: colour.hex });
  const shownId = idDraft.source === colour.id ? idDraft.value : colour.id;
  const shownHex = hexDraft.source === colour.hex ? hexDraft.value : colour.hex;
  const commitId = () => {
    const next = shownId.trim();
    if (next !== colour.id) onIdCommit(colour.id, next);
    setIdDraft({ source: colour.id, value: colour.id });
  };
  const commitHex = () => {
    if (/^#[0-9a-fA-F]{6}$/.test(shownHex)) onHexChange(colour.id, shownHex.toUpperCase());
    setHexDraft({ source: colour.hex, value: colour.hex });
  };
  return <div className="colour-card">
    <label className="colour-picker" style={{ backgroundColor: colour.hex }} title={`Choose ${colour.id}`}>
      <span className="colour-picker-symbol">{colour.id}</span>
      <input aria-label={`Colour ${colour.id} value`} type="color" value={colour.hex} onChange={(event) => onHexChange(colour.id, event.target.value.toUpperCase())} />
    </label>
    <div className="colour-fields">
      <label className="colour-id-label">ID<input value={shownId} maxLength={1} onChange={(event) => setIdDraft({ source: colour.id, value: event.target.value.toLowerCase() })} onBlur={commitId} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} aria-label={`Colour ID ${colour.id}`} /></label>
      <label>Hex<input value={shownHex} maxLength={7} onChange={(event) => setHexDraft({ source: colour.hex, value: event.target.value })} onBlur={commitHex} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} aria-label={`Hex value for ${colour.id}`} /></label>
    </div>
    <button type="button" className="icon-button colour-delete" disabled={used} title={used ? "This colour is used by a thread block" : "Delete colour"} aria-label={`Delete colour ${colour.id}`} onClick={() => onDelete(colour.id)}><Icon name="x" size={14} /></button>
  </div>;
}

export function ColourPalette({
  colours, isUsed, onHexChange, onIdCommit, onDelete, onAdd,
}: {
  colours: ColourDefinition[];
  isUsed: (id: string) => boolean;
  onHexChange: (id: string, hex: string) => void;
  onIdCommit: (oldId: string, newId: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return <section className="palette-section">
    <div className="section-heading">
      <div><h3><Icon name="palette" /> Colour palette</h3><p>One lowercase letter per colour; edits update every matching block.</p></div>
      <button type="button" className="button button-secondary button-small" disabled={colours.length >= 26} onClick={onAdd}><Icon name="plus" /> Add colour</button>
    </div>
    <div className="palette-grid">
      {colours.map((colour) => <ColourCard key={colour.id} colour={colour} used={isUsed(colour.id)} onHexChange={onHexChange} onIdCommit={onIdCommit} onDelete={onDelete} />)}
    </div>
  </section>;
}
