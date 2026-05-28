export class PdfPreviewService {
  getPreviewUrl(filePath: string) {
    return `/api/files/preview?path=${encodeURIComponent(filePath)}`;
  }
}
