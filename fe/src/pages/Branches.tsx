import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import api from '@/lib/axios';
import type { Branch, PaginatedResponse, ApiResponse } from '@/types';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  state_code: z.string().optional(),
});

type BranchForm = z.infer<typeof schema>;

export default function Branches() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get<PaginatedResponse<Branch>>('/branches'),
    select: (res) => res.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: BranchForm) => api.post<ApiResponse<Branch>>('/branches', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['branches'] }); setShowModal(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BranchForm> }) => api.put<ApiResponse<Branch>>(`/branches/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['branches'] }); setShowModal(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/branches/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['branches'] }),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BranchForm>({ resolver: zodResolver(schema) });

  const openCreate = () => { setEditBranch(null); reset({ name: '' }); setShowModal(true); };
  const openEdit = (b: Branch) => { setEditBranch(b); reset({ name: b.name, code: b.code ?? '', address: b.address ?? '', city: b.city ?? '', state: b.state ?? '', state_code: b.state_code ?? '' }); setShowModal(true); };

  const onSubmit = (formData: BranchForm) => {
    if (editBranch) updateMutation.mutate({ id: editBranch.id, data: formData });
    else createMutation.mutate(formData);
  };

  const columns: ColumnDef<Branch, unknown>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'code', header: 'Code' },
    { accessorKey: 'city', header: 'City' },
    { accessorKey: 'state', header: 'State' },
    { accessorKey: 'is_active', header: 'Status', cell: ({ getValue }) => <Badge variant={getValue() ? 'success' : 'danger'}>{getValue() ? 'Active' : 'Inactive'}</Badge> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(row.original)} className="rounded p-1 hover:bg-gray-100"><Pencil className="h-4 w-4 text-gray-500" /></button>
          <button onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(row.original.id); }} className="rounded p-1 hover:bg-gray-100"><Trash2 className="h-4 w-4 text-red-500" /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Branches</h1>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Branch</Button>
      </div>
      <Card>
        <CardHeader><p className="text-sm text-gray-500">Manage company branches</p></CardHeader>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
      </Card>
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editBranch ? 'Edit Branch' : 'New Branch'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input id="name" label="Name" error={errors.name?.message} {...register('name')} />
          <Input id="code" label="Code" {...register('code')} />
          <Input id="address" label="Address" {...register('address')} />
          <div className="grid grid-cols-2 gap-4">
            <Input id="city" label="City" {...register('city')} />
            <Input id="state" label="State" {...register('state')} />
          </div>
          <Input id="state_code" label="State Code" {...register('state_code')} />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>{editBranch ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
