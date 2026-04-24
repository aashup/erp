import api from '@/lib/axios';
import type {
  ApiResponse,
  PaginatedResponse,
  Department,
  Designation,
  Employee,
  SalaryComponentDefinition,
  SalaryStructure,
  PayrollRun,
} from '@/types';

export const departmentsApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Department>>('/departments', { params }),
  get: (id: string) => api.get<ApiResponse<Department>>(`/departments/${id}`),
  create: (data: Partial<Department>) => api.post<ApiResponse<Department>>('/departments', data),
  update: (id: string, data: Partial<Department>) => api.put<ApiResponse<Department>>(`/departments/${id}`, data),
  delete: (id: string) => api.delete(`/departments/${id}`),
};

export const designationsApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Designation>>('/designations', { params }),
  get: (id: string) => api.get<ApiResponse<Designation>>(`/designations/${id}`),
  create: (data: Partial<Designation>) => api.post<ApiResponse<Designation>>('/designations', data),
  update: (id: string, data: Partial<Designation>) => api.put<ApiResponse<Designation>>(`/designations/${id}`, data),
  delete: (id: string) => api.delete(`/designations/${id}`),
};

export const employeesApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Employee>>('/employees', { params }),
  get: (id: string) => api.get<ApiResponse<Employee>>(`/employees/${id}`),
  create: (data: Partial<Employee>) => api.post<ApiResponse<Employee>>('/employees', data),
  update: (id: string, data: Partial<Employee>) => api.put<ApiResponse<Employee>>(`/employees/${id}`, data),
  delete: (id: string) => api.delete(`/employees/${id}`),
  getSalaryStructure: (employeeId: string) =>
    api.get<ApiResponse<SalaryStructure | null>>(`/employees/${employeeId}/salary-structure`),
  createSalaryStructure: (employeeId: string, data: Partial<SalaryStructure>) =>
    api.post<ApiResponse<SalaryStructure>>(`/employees/${employeeId}/salary-structure`, data),
};

export const salaryComponentDefinitionsApi = {
  list: (params?: Record<string, string>) =>
    api.get<ApiResponse<SalaryComponentDefinition[]>>('/salary-component-definitions', { params }),
  create: (data: { name: string; type: 'earning' | 'deduction' }) =>
    api.post<ApiResponse<SalaryComponentDefinition>>('/salary-component-definitions', data),
  update: (id: string, data: Partial<Pick<SalaryComponentDefinition, 'name' | 'type' | 'is_active'>>) =>
    api.put<ApiResponse<SalaryComponentDefinition>>(`/salary-component-definitions/${id}`, data),
  delete: (id: string) => api.delete(`/salary-component-definitions/${id}`),
};

export const payrollApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<PayrollRun>>('/payroll-runs', { params }),
  get: (id: string) => api.get<ApiResponse<PayrollRun>>(`/payroll-runs/${id}`),
  generate: (data: { month: number; year: number; working_days?: number; notes?: string }) =>
    api.post<ApiResponse<PayrollRun>>('/payroll-runs/generate', data),
  updateEntry: (runId: string, entryId: string, present_days: number) =>
    api.patch<ApiResponse<PayrollRun>>(`/payroll-runs/${runId}/entries/${entryId}`, { present_days }),
  approve: (id: string) => api.patch<ApiResponse<PayrollRun>>(`/payroll-runs/${id}/approve`),
  markPaid: (id: string) => api.patch<ApiResponse<PayrollRun>>(`/payroll-runs/${id}/mark-paid`),
  delete: (id: string) => api.delete(`/payroll-runs/${id}`),
  payslipUrl: (runId: string, employeeId: string) =>
    `/api/v1/payroll-runs/${runId}/payslip/${employeeId}`,
};
