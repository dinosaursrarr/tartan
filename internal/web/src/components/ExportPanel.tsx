import { useMemo, useState } from "react";
import { makeImageUrl, type OutputFormat } from "../services/weaveApi";
import { Icon } from "./Icon";

export function ExportPanel({ pattern, valid, onCopy }: { pattern: string; valid: boolean; onCopy: (text: string, label: string) => void }) {
  const [format, setFormat] = useState<OutputFormat>("png");
  const imageUrl = useMemo(() => makeImageUrl(pattern, format), [pattern, format]);
  const editorUrl = useMemo(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("pattern", pattern);
    return url.toString();
  }, [pattern]);
  const cssSnippet = useMemo(() => `.tartan-background {\n  background-image: url("${imageUrl}");\n  background-repeat: repeat;\n}`, [imageUrl]);
  return <section className="export-section">
    <div className="section-heading">
      <div><h3>Export &amp; share</h3><p>Download the tile, share the pattern, or use it in CSS.</p></div>
      <div className="format-picker"><label htmlFor="output-format">Image format</label><select id="output-format" value={format} onChange={(event) => setFormat(event.target.value as OutputFormat)}>{(["png", "webp", "gif"] as const).map((item) => <option value={item} key={item}>{item.toUpperCase()}</option>)}</select></div>
    </div>
    <div className="export-grid">
      <div className="export-card"><span className="export-icon"><Icon name="download" /></span><div className="export-card-content"><h4>Download tile</h4><p>Save the rendered unit as {format.toUpperCase()}.</p></div><a className={`button button-primary button-small ${!valid ? "disabled-link" : ""}`} aria-disabled={!valid} href={valid ? imageUrl : undefined} download={`sett-tartan.${format}`} onClick={(event) => { if (!valid) event.preventDefault(); }}><Icon name="download" /> Download</a></div>
      <div className="export-card"><span className="export-icon"><Icon name="image" /></span><div className="export-card-content"><h4>Direct image URL</h4><p>Use the tile in an image or CSS background.</p></div><button type="button" className="button button-secondary button-small" disabled={!valid} onClick={() => onCopy(imageUrl, "Image URL")}><Icon name="copy" /> Copy URL</button></div>
      <div className="export-card"><span className="export-icon"><Icon name="link" /></span><div className="export-card-content"><h4>Editor URL</h4><p>Reopen this exact pattern in Sett.</p></div><button type="button" className="button button-secondary button-small" disabled={!valid} onClick={() => onCopy(editorUrl, "Editor URL")}><Icon name="copy" /> Copy URL</button></div>
      <div className="export-card"><span className="export-icon"><Icon name="code" /></span><div className="export-card-content"><h4>Repeating CSS</h4><p>Copy a ready-to-use background rule.</p></div><button type="button" className="button button-secondary button-small" disabled={!valid} onClick={() => onCopy(cssSnippet, "CSS snippet")}><Icon name="copy" /> Copy CSS</button></div>
    </div>
    <div className="export-code-preview"><code>{cssSnippet}</code><button type="button" className="icon-button" aria-label="Copy CSS snippet" onClick={() => onCopy(cssSnippet, "CSS snippet")} disabled={!valid}><Icon name="copy" /></button></div>
  </section>;
}
