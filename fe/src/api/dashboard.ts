import api from '@/lib/axios';

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

export const dashboardApi = {
  stats: (period: string) =>
    api.get<{ data: DashboardStats }>('/dashboard/stats', { params: { period } }),
  chart: (months?: number) =>
    api.get<{ data: DashboardChartData }>('/dashboard/chart', { params: { months } }),
};
