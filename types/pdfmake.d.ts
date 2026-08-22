// Type declarations for pdfmake's untyped deep build imports.
declare module "pdfmake/build/pdfmake.js" {
  const pdfMake: {
    addVirtualFileSystem(vfs: Record<string, unknown>): void;
    createPdf(
      docDefinition: Record<string, unknown>,
      tableLayouts?: unknown
    ): {
      // pdfmake 0.3 is promise-based; the legacy Node callback never fires
      getBlob(): Promise<Blob>;
      download(filename?: string): void;
    };
  };
  export default pdfMake;
}

declare module "pdfmake/build/vfs_fonts.js" {
  const vfs: Record<string, unknown>;
  export default vfs;
}
