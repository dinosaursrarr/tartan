import { Icon } from "./Icon";

export function TdfSourceEditor({
  value, error, onChange, onBlur, onCopy, onReset,
}: {
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onBlur: () => void;
  onCopy: () => void;
  onReset: () => void;
}) {
  return <section className="code-section">
    <div className="section-heading compact-heading">
      <div><h3><Icon name="code" /> TDF source</h3><p>Changes here update the visual editor.</p></div>
      <button type="button" className="button button-quiet button-small" onClick={onCopy}><Icon name="copy" /> Copy code</button>
    </div>
    <textarea className={`tdf-editor ${error ? "has-error" : ""}`} value={value} spellCheck={false} rows={2} aria-label="TDF source code" onChange={(event) => onChange(event.target.value)} onBlur={onBlur} />
    {error ? <div className="validation-message error-message"><span>!</span><div><strong>Invalid TDF</strong><p>{error}</p><small>Preview stays on the last valid pattern.</small></div><button type="button" className="button button-quiet button-small" onClick={onReset}>Reset</button></div>
      : <div className="validation-message success-message"><Icon name="check" /><span>Valid TDF · URL updates as you edit</span></div>}
  </section>;
}
