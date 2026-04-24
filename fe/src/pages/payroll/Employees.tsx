import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { employeesApi, departmentsApi, designationsApi } from '@/api/payroll';
import type { Employee, Department, Designation } from '@/types';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { DepartmentFormModal } from '@/components/ui/DepartmentFormModal';
import { DesignationFormModal } from '@/components/ui/DesignationFormModal';
import { SalaryStructureModal } from './SalaryStructureModal';
import { Plus, Pencil, Trash2, IndianRupee } from 'lucide-react';
import { formatDate } from '@/lib/utils';

const schema = z.object({
  name:              z.string().min(1, 'Name is required'),
  gender:            z.enum(['male', 'female', 'other']).optional(),
  date_of_birth:     z.string().optional(),
  phone:             z.string().optional(),
  email:             z.string().email().optional().or(z.literal('')),
  address:           z.string().optional(),
  city:              z.string().optional(),
  state:             z.string().optional(),
  department_id:     z.string().optional(),
  designation_id:    z.string().optional(),
  joining_date:      z.string().min(1, 'Joining date is required'),
  employment_type:   z.enum(['permanent', 'contract', 'part_time']).optional(),
  bank_account_name: z.string().optional(),
  bank_account_no:   z.string().optional(),
  bank_ifsc:         z.string().optional(),
  bank_name:         z.string().optional(),
  pan:               z.string().optional(),
  pf_number:         z.string().optional(),
  esi_number:        z.string().optional(),
  is_pf_applicable:  z.boolean().optional(),
  is_esi_applicable: z.boolean().optional(),
  is_active:         z.boolean().optional(),
});
type EmployeeForm = z.infer<typeof schema>;

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];
const EMP_TYPE_OPTIONS = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'contract', label: 'Contract' },
  { value: 'part_time', label: 'Part Time' },
];

export default function Employees() {
  usePageTitle('Employees');
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('payroll.create');
  const canEdit   = hasPermission('payroll.edit');
  const canDelete = hasPermission('payroll.delete');

  const [showModal, setShowModal]       = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [salaryEmployee, setSalaryEmployee] = useState<Employee | null>(null);
  const [showAddDept, setShowAddDept]   = useState(false);
  const [showAddDesg, setShowAddDesg]   = useState(false);
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['employees', search, page],
    queryFn: () => employeesApi.list({ ...(search ? { search } : {}), page: String(page) }),
    select: (res) => res.data,
  });

  const { data: deptData } = useQuery({
    queryKey: ['departments', 'all'],
    queryFn: () => departmentsApi.list({ active_only: 'true', per_page: '200' }),
    select: (res) => res.data.data,
  });

  const { data: desgData } = useQuery({
    queryKey: ['designations', 'all'],
    queryFn: () => designationsApi.list({ active_only: 'true', per_page: '200' }),
    select: (res) => res.data.data,
  });

  const createMutation = useMutation({
    mutationFn: (d: EmployeeForm) => employeesApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); setShowModal(false); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EmployeeForm> }) => employeesApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['employees'] }); setShowModal(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => employeesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<EmployeeForm>({ resolver: zodResolver(schema) });

  const openCreate = () => {
    setEditEmployee(null);
    reset({ name: '', joining_date: new Date().toISOString().slice(0, 10), employment_type: 'permanent', is_pf_applicable: true, is_esi_applicable: true });
    setShowModal(true);
  };
  const openEdit = (e: Employee) => {
    setEditEmployee(e);
    reset({
      name: e.name,
      gender: e.gender ?? undefined,
      date_of_birth: e.date_of_birth ?? '',
      phone: e.phone ?? '',
      email: e.email ?? '',
      address: e.address ?? '',
      city: e.city ?? '',
      state: e.state ?? '',
      department_id: e.department_id ?? '',
      designation_id: e.designation_id ?? '',
      joining_date: e.joining_date,
      employment_type: e.employment_type,
      bank_account_name: e.bank_account_name ?? '',
      bank_account_no: e.bank_account_no ?? '',
      bank_ifsc: e.bank_ifsc ?? '',
      bank_name: e.bank_name ?? '',
      pan: e.pan ?? '',
      pf_number: e.pf_number ?? '',
      esi_number: e.esi_number ?? '',
      is_pf_applicable: e.is_pf_applicable,
      is_esi_applicable: e.is_esi_applicable,
      is_active: e.is_active,
    });
    setShowModal(true);
  };

  const onSubmit = (fd: EmployeeForm) => {
    if (editEmployee) updateMutation.mutate({ id: editEmployee.id, data: fd });
    else createMutation.mutate(fd);
  };

  const deptOptions = (deptData ?? []).map((d: Department) => ({ value: d.id, label: d.name }));
  const desgOptions = (desgData ?? []).map((d: Designation) => ({ value: d.id, label: d.name }));

  const columns: ColumnDef<Employee, unknown>[] = [
    { id: 'employee_code', accessorKey: 'employee_code', header: 'Code', cell: ({ getValue }) => getValue() || '—' },
    { id: 'name', accessorKey: 'name', header: 'Name' },
    {
      id: 'designation', header: 'Designation',
      cell: ({ row }) => row.original.designation?.name ?? '—',
    },
    {
      id: 'department', header: 'Department',
      cell: ({ row }) => row.original.department?.name ?? '—',
    },
    {
      id: 'joining_date', accessorKey: 'joining_date', header: 'Joining',
      cell: ({ getValue }) => formatDate(getValue() as string),
    },
    {
      id: 'pf_esi', header: 'PF/ESI',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Badge variant={row.original.is_pf_applicable ? 'info' : 'default'}>PF</Badge>
          <Badge variant={row.original.is_esi_applicable ? 'info' : 'default'}>ESI</Badge>
        </div>
      ),
    },
    {
      id: 'salary', header: 'Salary',
      cell: ({ row }) => {
        const s = row.original.salary_structure;
        return s ? `₹${Number(s.basic).toLocaleString('en-IN')}` : <span className="text-xs text-gray-400">Not set</span>;
      },
    },
    {
      id: 'is_active', accessorKey: 'is_active', header: 'Status',
      cell: ({ getValue }) => <Badge variant={getValue() ? 'success' : 'danger'}>{getValue() ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSalaryEmployee(row.original)}
            className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Salary Structure"
          >
            <IndianRupee className="h-4 w-4 text-green-600" />
          </button>
          {canEdit && (
            <button onClick={() => openEdit(row.original)} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>
          )}
          {canDelete && (
            <button onClick={() => { if (confirm('Delete employee?')) deleteMutation.mutate(row.original.id); }} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Trash2 className="h-4 w-4 text-red-500" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Employees</h1>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search name or code..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          {canCreate && <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Employee</Button>}
        </div>
      </div>

      <Card>
        <CardHeader><p className="text-sm text-gray-500 dark:text-gray-400">Manage employees and salary structures</p></CardHeader>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
      </Card>

      {/* Salary Structure Modal */}
      {salaryEmployee && (
        <SalaryStructureModal
          employee={salaryEmployee}
          open={!!salaryEmployee}
          onClose={() => setSalaryEmployee(null)}
        />
      )}

      {/* Employee Form Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editEmployee ? 'Edit Employee' : 'New Employee'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {editEmployee && (
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
              <span className="text-xs text-gray-500 dark:text-gray-400">Employee Code</span>
              <span className="ml-auto font-mono text-sm font-semibold text-gray-800 dark:text-gray-100">{editEmployee.employee_code}</span>
            </div>
          )}
          <div className={editEmployee ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 gap-4'}>
            <Input id="name" label="Name *" error={errors.name?.message} {...register('name')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SlideSelect name="gender" label="Gender" options={GENDER_OPTIONS}
              value={watch('gender') ?? ''} onChange={(v) => setValue('gender', v as 'male'|'female'|'other')} />
            <Input id="date_of_birth" label="Date of Birth" type="date" {...register('date_of_birth')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input id="phone" label="Phone" {...register('phone')} />
            <Input id="email" label="Email" type="email" error={errors.email?.message} {...register('email')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SlideSelect name="department_id" label="Department" options={deptOptions}
              value={watch('department_id') ?? ''} onChange={(v) => setValue('department_id', v)}
              onAddNew={() => setShowAddDept(true)} addNewLabel="Add New Department" />
            <SlideSelect name="designation_id" label="Designation" options={desgOptions}
              value={watch('designation_id') ?? ''} onChange={(v) => setValue('designation_id', v)}
              onAddNew={() => setShowAddDesg(true)} addNewLabel="Add New Designation" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input id="joining_date" label="Joining Date *" type="date" error={errors.joining_date?.message} {...register('joining_date')} />
            <SlideSelect name="employment_type" label="Employment Type" options={EMP_TYPE_OPTIONS}
              value={watch('employment_type') ?? 'permanent'} onChange={(v) => setValue('employment_type', v as 'permanent'|'contract'|'part_time')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input id="pan" label="PAN" {...register('pan')} />
            <Input id="city" label="City" {...register('city')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input id="pf_number" label="PF Number" {...register('pf_number')} />
            <Input id="esi_number" label="ESI Number" {...register('esi_number')} />
          </div>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_pf_applicable" {...register('is_pf_applicable')} className="rounded" />
              <label htmlFor="is_pf_applicable" className="text-sm text-gray-700 dark:text-gray-300">PF Applicable</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_esi_applicable" {...register('is_esi_applicable')} className="rounded" />
              <label htmlFor="is_esi_applicable" className="text-sm text-gray-700 dark:text-gray-300">ESI Applicable</label>
            </div>
            {editEmployee && (
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_active" {...register('is_active')} className="rounded" />
                <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">Active</label>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 border-t pt-4 dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editEmployee ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
      <DepartmentFormModal
        open={showAddDept}
        onClose={() => setShowAddDept(false)}
        onCreated={(dept) => {
          queryClient.invalidateQueries({ queryKey: ['departments', 'all'] });
          setValue('department_id', dept.id);
        }}
      />

      <DesignationFormModal
        open={showAddDesg}
        onClose={() => setShowAddDesg(false)}
        onCreated={(desg) => {
          queryClient.invalidateQueries({ queryKey: ['designations', 'all'] });
          setValue('designation_id', desg.id);
        }}
      />
    </div>
  );
}
