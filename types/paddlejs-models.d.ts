declare module '@paddlejs-models/ocr' {
  export interface OCRResult {
    text: string;
    confidence: number;
    box: number[][];
  }

  export class OCR {
    constructor(options?: any);
    init(): Promise<void>;
    recognize(image: Blob | HTMLImageElement): Promise<OCRResult[]>;
  }
}