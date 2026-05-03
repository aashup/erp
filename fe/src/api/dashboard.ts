import api from '@/lib/axios';

function localDate(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export interface DashboardStats {
  period: string;
  from: string;
  to: string;
  total_sales: number;
  sales_taxable: number;
  sales_cgst: number;
  sales_sgst: number;
  sales_igst: number;
  total_purchase: number;
  purchase_taxable: number;
  purchase_cgst: number;
  purchase_sgst: number;
  purchase_igst: number;
  pnl_income: number;
  pnl_expense: number;
  pnl: number;
  opening_stock: number;
  closing_stock: number;
  net_revenue: number;
  gst_output: number;
  gst_output_cgst: number;
  gst_output_sgst: number;
  gst_output_igst: number;
  gst_input_credit: number;
  gst_input_cgst: number;
  gst_input_sgst: number;
  gst_input_igst: number;
  payable_tax: number;
}

export interface DashboardChartData {
  labels: string[];
  sales: number[];
  purchase: number[];
  revenue: number[];
}

export interface CollectionStats {
  period: string;
  from: string;
  to: string;
  total: number;
  cash: number;
  account: number;
  need_to_collect: number;
}

export const dashboardApi = {
  stats: (params: { date_from: string; date_to: string }) =>
    api.get<{ data: DashboardStats }>('/dashboard/stats', { params }),
  chart: (months?: number) =>
    api.get<{ data: DashboardChartData }>('/dashboard/chart', { params: { months, local_date: localDate() } }),
  collection: (params: { date_from: string; date_to: string }) =>
    api.get<{ data: CollectionStats }>('/dashboard/collection', { params }),
};
