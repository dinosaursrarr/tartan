export type CatalogueEntry = {
  name: string;
  pattern: string;
  preview?: string;
};

export type PreparedCatalogueEntry = CatalogueEntry & {
  index: number;
  normalizedPattern: string;
  previewSrc: string;
};
