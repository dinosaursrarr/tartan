import { useState } from "react";
import { Icon } from "./Icon";

const ZOOMS = [0.65, 1, 1.5] as const;

export function PreviewPanel({
  imageUrl, error, width, height, valid,
}: { imageUrl: string | null; error: string | null; width: number; height: number; valid: boolean }) {
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(1);
  const backgroundSize = width && height ? `${width * zoom}px ${height * zoom}px` : `${Math.round(100 * zoom)}px ${Math.round(100 * zoom)}px`;
  return <section className="preview-section preview-first">
    <div className="section-heading preview-heading">
      <div><h3>Repeat preview</h3><p>The tile repeats exactly as a CSS background would.</p></div>
      <div className="preview-tools" role="group" aria-label="Preview zoom">
        {ZOOMS.map((level) => <button type="button" key={level} className={`button button-quiet button-small ${zoom === level ? "is-active" : ""}`} onClick={() => setZoom(level)} aria-pressed={zoom === level}>{Math.round(level * 100)}%</button>)}
        <button type="button" className="icon-button" onClick={() => { if (imageUrl) window.open(imageUrl, "_blank", "noopener,noreferrer"); }} disabled={!imageUrl} aria-label="Open tile image in new tab" title="Open tile image"><Icon name="expand" size={15} /></button>
      </div>
    </div>
    <div className={`repeat-preview ${!valid ? "preview-invalid" : ""}`} style={{ backgroundImage: imageUrl ? `url("${imageUrl}")` : undefined, backgroundSize, backgroundRepeat: "repeat" }}>
      {!valid && <div className="preview-overlay-message">Fix the TDF source to render this pattern.</div>}
      {valid && !imageUrl && !error && <div className="preview-overlay-message">Rendering tartan…</div>}
      {valid && error && <div className="preview-overlay-message preview-error"><strong>Preview unavailable</strong><span>{error}</span></div>}
    </div>
    {imageUrl && width > 0 && height > 0 && <div className="preview-metadata"><span>Tile {width} × {height} px</span><span>WebP preview</span></div>}
  </section>;
}
