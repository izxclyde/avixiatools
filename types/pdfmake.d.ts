// Type declarations for pdfmake's untyped deep build imports.
declare module "pdfmake/build/pdfmake" {
  const pdfMake: {
    addVirtualFileSystem(vfs: Record<string, unknown>): void;
    createPdf(
      docDefinition: Record<string, unknown>,
      tableLayouts?: unknown,
      fonts?: unknown,
      vfs?: unknown
    ): {
      getBlob(callback: (blob: Blob) => void): void;
      download(filename?: string, callback?: () => void): void;
      getDataUrl(callback: (dataUrl: string) => void): void;
    };
  };
  export default pdfMake;
}

declare module "pdfmake/build/vfs_fonts" {
  const vfs: Record<string, unknown>;
  export default vfs;
}
