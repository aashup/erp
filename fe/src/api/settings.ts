import api from '@/lib/axios';
import type { ApiResponse, InvoiceTemplate, CompanySettings } from '@/types';

export const invoiceTemplatesApi = {
  list: () => api.get<ApiResponse<InvoiceTemplate[]>>('/invoice-templates'),
};

export const companySettingsApi = {
  get: () => api.get<ApiResponse<CompanySettings>>('/company-settings'),
  update: (settings: Record<string, unknown>) =>
    api.put<ApiResponse<CompanySettings>>('/company-settings', { settings }),
};
