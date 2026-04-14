import api from '@/lib/axios';

export interface OcrExtractedItem {
  item_name: string;
  hsn_code: string | null;
  quantity: number;
  rate: number;
  discount_percent: number;
  gst_rate: number;
}

export interface OcrExtractedData {
  vendor_name: string | null;
  vendor_gstin: string | null;
  vendor_invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  is_inter_state: boolean;
  items: OcrExtractedItem[];
  total_amount: number | null;
  grand_total: number | null;
  notes: string | null;
  warnings: string[];
}

export interface OcrScanResponse {
  log_id: string;
  extracted_data: OcrExtractedData;
  status: 'success' | 'partial' | 'failed';
}

export const ocrApi = {
  scan: (imageFile: File) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    // Passing FormData makes axios automatically set Content-Type: multipart/form-data
    return api.post<OcrScanResponse>('/ocr/scan-invoice', formData);
  },
};
