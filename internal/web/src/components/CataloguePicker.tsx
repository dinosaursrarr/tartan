import { useMemo, useState } from "react";
import type { PreparedCatalogueEntry } from "../types/catalogue";
import { Icon } from "./Icon";

export function CataloguePicker({
  entries, selectedName, onSelect,
}: {
  entries: PreparedCatalogueEntry[];
  selectedName: string;
  onSelect: (entry: PreparedCatalogueEntry) => void;
}) {
  const [query, setQuery] = useState(selectedName);
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const matches = needle ? entries.filter((entry) => entry.name.toLocaleLowerCase().includes(needle)) : entries;
    return matches.slice(0, 80);
  }, [entries, query]);

  return <section className="catalogue-section">
    <div className="section-heading">
      <div><h3>Known tartans</h3><p>Search the catalogue, or keep editing your own.</p></div>
      <span className="catalogue-count">{entries.length.toLocaleString()} patterns</span>
    </div>
    <div className="catalogue-combobox">
      <div className="catalogue-input-wrap"><Icon name="search" /><input
        type="text"
        role="combobox"
        aria-label="Search catalogue"
        aria-expanded={open}
        aria-controls="catalogue-options"
        placeholder="Search tartan names…"
        value={open ? query : selectedName}
        onFocus={() => { setQuery(selectedName); setOpen(true); }}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); if (event.key === "ArrowDown") setOpen(true); }}
      /><button type="button" className="icon-button" aria-label={open ? "Close catalogue" : "Open catalogue"} onClick={() => setOpen((value) => !value)}><Icon name="chevron" /></button></div>
      {open && <div className="catalogue-menu" id="catalogue-options" role="listbox">
        <div className="catalogue-menu-top"><span>{filtered.length} matching patterns</span><span>Choose to load into editor</span></div>
        {filtered.map((entry) => <button type="button" role="option" aria-selected={entry.name === selectedName} className="catalogue-option" key={`${entry.index}-${entry.name}`} onClick={() => { onSelect(entry); setQuery(entry.name); setOpen(false); }}>
          <img className="catalogue-swatch" src={entry.previewSrc} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} />
          <span className="catalogue-option-details"><span className="catalogue-option-name">{entry.name}</span><span className="catalogue-option-pattern">{entry.normalizedPattern}</span></span>
        </button>)}
        {!filtered.length && <p className="catalogue-empty">No matching tartans.</p>}
        {entries.length > 80 && filtered.length === 80 && <p className="catalogue-limit">Showing the first 80 matches. Refine your search to find more.</p>}
      </div>}
    </div>
    {selectedName && <p className="catalogue-selection">Loaded from catalogue: <strong>{selectedName}</strong></p>}
  </section>;
}
