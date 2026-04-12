import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { rolesApi } from '@/api/roles';
import type { Role, Permission } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { Plus, Filter, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Role name is required'),
  permissions: z.array(z.string()).min(1, 'Select at least one permission'),
});

type RoleForm = z.infer<typeof schema>;

const SYSTEM_ROLES = ['admin', 'manager', 'accountant', 'salesman'];

export default function Groups() {
  usePageTitle('Groups');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { data: allPermissions } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => rolesApi.permissions(),
    select: (res) => res.data.data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['roles', page, search, sortBy, sortOrder],
    queryFn: () => rolesApi.list({
      page: String(page),
      search,
      sort_by: sortBy,
      sort_order: sortOrder,
    }),
    select: (res) => res.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: RoleForm) => rolesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setShowModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RoleForm> }) => rolesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setShowModal(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rolesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<RoleForm>({ resolver: zodResolver(schema) as any });

  const openCreate = () => {
    setEditRole(null);
    reset({ name: '', permissions: [] });
    setShowModal(true);
  };

  const openEdit = (r: Role) => {
    setEditRole(r);
    reset({
      name: r.name,
      permissions: r.permissions?.map(p => p.id) ?? [],
    });
    setShowModal(true);
  };

  const onSubmit = (formData: RoleForm) => {
    if (editRole) updateMutation.mutate({ id: editRole.id, data: formData });
    else createMutation.mutate(formData);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const renderSortIcon = (column: string) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const columns: ColumnDef<Role, unknown>[] = [
    {
      id: 'name',
      header: () => (
        <button
          onClick={() => handleSort('name')}
          className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400"
        >
          Role Name
          {renderSortIcon('name')}
        </button>
      ),
      accessorKey: 'name',
    },
    {
      id: 'permissions',
      header: 'Permissions',
      cell: ({ row }) => {
        const count = row.original.permissions?.length ?? 0;
        return <span className="text-sm text-gray-600 dark:text-gray-400">{count} permission{count !== 1 ? 's' : ''}</span>;
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const isSystem = SYSTEM_ROLES.includes(row.original.name);
        return (
          <div className="flex items-center gap-1">
            <button onClick={() => openEdit(row.original)} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>
            {!isSystem && (
              <button
                onClick={() => { if (confirm('Delete this role?')) deleteMutation.mutate(row.original.id); }}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  // API returns already-grouped object: { module: Permission[] }
  const groupedPermissions = useMemo(() => {
    if (!allPermissions) return {} as Record<string, Permission[]>;
    const groups: Record<string, Permission[]> = {};
    Object.entries(allPermissions).forEach(([module, perms]) => {
      groups[module] = Array.isArray(perms) ? perms : Object.values(perms as object);
    });
    return groups;
  }, [allPermissions]);

  const selectedPermissions = watch('permissions') ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Groups & Roles</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> Add Role</Button>
        </div>
      </div>

      <Card>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
        {data && <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total} onPageChange={setPage} />}
      </Card>

      {/* Filter Panel */}
      <FilterPanel open={showFilterPanel} onClose={() => setShowFilterPanel(false)}>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Search</label>
            {search && (
              <button onClick={() => { setSearch(''); setPage(1); }} className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400">
                Clear
              </button>
            )}
          </div>
          <input
            type="text"
            placeholder="Search by role name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <button
          onClick={() => { setSearch(''); setPage(1); }}
          className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Clear All Filters
        </button>
      </FilterPanel>

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editRole ? 'Edit Role' : 'New Role'} size="xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            id="name"
            label="Role Name"
            error={errors.name?.message}
            {...register('name')}
            disabled={!!(editRole && SYSTEM_ROLES.includes(editRole.name))}
          />

          {/* Permissions */}
          <div className="border-t pt-4 dark:border-gray-700">
            <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Permissions</h3>

            {Object.keys(groupedPermissions).length > 0 ? (
              <div className="space-y-4">
                {/* Select All / Deselect All */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allPerms = Object.values(groupedPermissions).flat().map(p => p.id);
                      setValue('permissions', allPerms, { shouldValidate: true });
                    }}
                    className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('permissions', [], { shouldValidate: true })}
                    className="rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                  >
                    Deselect All
                  </button>
                </div>

                {/* Permission Groups */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {Object.entries(groupedPermissions).map(([module, perms]) => (
                    <div key={module} className="rounded-lg border p-4 dark:border-gray-700">
                      <h4 className="mb-3 text-sm font-medium capitalize text-gray-900 dark:text-gray-100">{module}</h4>
                      <div className="space-y-2">
                        {perms.map((perm) => (
                          <label key={perm.id} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <input
                              type="checkbox"
                              checked={selectedPermissions.includes(perm.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setValue('permissions', [...selectedPermissions, perm.id], { shouldValidate: true });
                                } else {
                                  setValue('permissions', selectedPermissions.filter(id => id !== perm.id), { shouldValidate: true });
                                }
                              }}
                              className="rounded border-gray-300 dark:border-gray-600"
                            />
                            <span className="capitalize">{perm.name.split('.')[1]}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {errors.permissions && (
                  <p className="text-sm text-red-600 dark:text-red-400">{errors.permissions.message}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading permissions…</p>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t pt-4 dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editRole ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
