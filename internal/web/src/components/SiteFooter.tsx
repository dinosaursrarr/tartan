import { useState } from "react";
import { Icon } from "./Icon";

export function SiteFooter() {
  const [aboutOpen, setAboutOpen] = useState(true);
  const [apiOpen, setApiOpen] = useState(false);
  return <footer className="site-footer">
    <div className="footer-topline">
      <p className="footer-project-name">A tool for describing and rendering tartan patterns.</p>
      <a className="github-link" href="https://github.com/dinosaursrarr/tartan" target="_blank" rel="noreferrer"><Icon name="github" /> GitHub repository <Icon name="external" /></a>
    </div>
    <div className="footer-columns">
      <section className="footer-copy">
        <button type="button" className="footer-disclosure" onClick={() => setAboutOpen((open) => !open)} aria-expanded={aboutOpen}><span>About the project</span><Icon name="chevron" /></button>
        {aboutOpen && <div className="footer-prose"><p>You don't need me to explain the value of repeatable units of pattern for decorating, graphic design, or fashion. Every crofter learned it at their granny's knee. But despite the marvels of our technological age, it's never as easy to get hold as you'd like. And even harder to experiment with new patterns, new designs, and changes.</p>
          <p>Sett is a small workshop for describing, editing and rendering tartan patterns. It offers a fixed URL to get a repeatable unit of a given tartan. And it provides an interactive way to design, edit and export those tartans.</p>
          <p>Each pattern is expressed as compact Tartan Definition File (TDF) code: colour definitions followed by warp and, optionally, weft thread runs. The result is a tile you can use on the web or take into another project.</p></div>}
      </section>
      <section className="footer-copy">
        <button type="button" className="footer-disclosure" onClick={() => setApiOpen((open) => !open)} aria-expanded={apiOpen}><span>API quick reference</span><Icon name="chevron" /></button>
        {apiOpen && <div className="footer-prose api-reference"><p><code>GET /weave?pattern=…&amp;format=png</code></p><p>Render a supplied TDF pattern.</p><p><code>GET /random?format=webp</code></p><p>Return a random catalogue pattern as an image tile.</p><p>The <code>format</code> parameter accepts <code>png</code>, <code>webp</code> or <code>gif</code>; it defaults to PNG.</p></div>}
      </section>
    </div>
    <div className="footer-bottom"><span>Made for the love of pattern.</span><span>Colour, structure, repeat.</span></div>
  </footer>;
}
