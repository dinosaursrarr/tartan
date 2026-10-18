import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CataloguePicker } from "../src/components/CataloguePicker";
import { TdfSourceEditor } from "../src/components/TdfSourceEditor";
import { prepareCatalogue } from "../src/lib/catalogue";

describe("CataloguePicker", () => {
  it("shows visual swatches and calls the selection callback", () => {
    const items = prepareCatalogue([
      { name: "MacKenzie", pattern: "a#FFFFFF[a1" },
      { name: "Hunting", pattern: "a#FFFFFFb#000000[a2b2" },
    ], "https://sett.test");
    const onSelect = vi.fn();
    render(<CataloguePicker entries={items} selectedName="" onSelect={onSelect} />);
    fireEvent.focus(screen.getByRole("combobox", { name: /search catalogue/i }));
    expect(document.querySelectorAll(".catalogue-swatch")).toHaveLength(2);
    fireEvent.click(screen.getByRole("option", { name: /mackenzie/i }));
    expect(onSelect).toHaveBeenCalledWith(items[0]);
  });
});

describe("TdfSourceEditor", () => {
  it("renders source errors and forwards source edits", () => {
    const onChange = vi.fn();
    render(<TdfSourceEditor value="a#FFFFFF[a1" error="Invalid block" onChange={onChange} onBlur={vi.fn()} onCopy={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByText("Invalid block")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: /tdf source code/i }), { target: { value: "a#FFFFFF[a2" } });
    expect(onChange).toHaveBeenCalledWith("a#FFFFFF[a2");
  });
});

import { ColourPalette } from "../src/components/ColourPalette";
import { ThreadTrack } from "../src/components/ThreadTrack";
import { PreviewPanel } from "../src/components/PreviewPanel";
import { ExportPanel } from "../src/components/ExportPanel";
import { SiteFooter } from "../src/components/SiteFooter";
import { parseTdf } from "../src/lib/tdf";

describe("ColourPalette", () => {
  it("protects colours that are currently used and commits hex values on blur", () => {
    const onHexChange = vi.fn();
    render(<ColourPalette
      colours={[{ id: "a", hex: "#FFFFFF" }, { id: "b", hex: "#000000" }]}
      isUsed={(id) => id === "a"}
      onHexChange={onHexChange} onIdCommit={vi.fn()} onDelete={vi.fn()} onAdd={vi.fn()}
    />);
    expect(screen.getByRole("button", { name: /delete colour a/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /delete colour b/i })).toBeEnabled();
    const hexInput = screen.getByRole("textbox", { name: /hex value for b/i });
    fireEvent.change(hexInput, { target: { value: "#112233" } });
    fireEvent.blur(hexInput);
    expect(onHexChange).toHaveBeenCalledWith("b", "#112233");
  });
});

describe("ThreadTrack", () => {
  it("renders thread blocks and reports selection/insertion actions", () => {
    const model = parseTdf("a#FFFFFFb#000000[a2b3");
    const onSelect = vi.fn();
    const onInsert = vi.fn();
    render(<ThreadTrack
      name="warp" thread={model.warp} colours={new Map([["a", "#FFFFFF"], ["b", "#000000"]])}
      selectedIds={[]} editing={null} tokenDraft="" onTokenDraftChange={vi.fn()} onCommitToken={vi.fn(() => true)} onCancelToken={vi.fn()}
      onSelect={onSelect} onInsert={onInsert} onMove={vi.fn()} onResize={vi.fn()} onResizeStart={vi.fn()}
    />);
    fireEvent.click(screen.getByRole("button", { name: /a2, warp block 1/i }));
    expect(onSelect).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /add at start of warp/i }));
    expect(onInsert).toHaveBeenCalledWith("warp", 0);
  });
});

describe("Preview and export", () => {
  it("renders the repeat surface from the returned tile URL", () => {
    const { container } = render(<PreviewPanel imageUrl="https://sett.test/tile.webp" error={null} width={32} height={24} valid />);
    expect(container.querySelector(".repeat-preview")).toHaveStyle({ backgroundImage: 'url("https://sett.test/tile.webp")' });
    expect(screen.getByText(/tile 32 × 24 px/i)).toBeInTheDocument();
  });
  it("offers output format selection and a GitHub link", () => {
    const { rerender } = render(<ExportPanel pattern="a#FFFFFF[a1" valid onCopy={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: /image format/i })).toHaveValue("png");
    fireEvent.change(screen.getByRole("combobox", { name: /image format/i }), { target: { value: "gif" } });
    expect(screen.getByText(/save the rendered unit as GIF/i)).toBeInTheDocument();
    rerender(<SiteFooter />);
    expect(screen.getByRole("link", { name: /github repository/i })).toHaveAttribute("href", "https://github.com/dinosaursrarr/tartan");
  });
});
