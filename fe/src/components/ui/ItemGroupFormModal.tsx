import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemGroupsApi } from '@/api/inventory';
import type { ItemGroup } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';

interface ItemGroupFormModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (group: ItemGroup) => void;
}

export function ItemGroupFormModal({ open, onClose, onCreated }: ItemGroupFormModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setName(''); setParentId(null); }
  }, [open]);

  const { data: allGroups = [] } = useQuery({
    queryKey: ['item-groups'],
    queryFn: () => itemGroupsApi.list({ per_page: '500' }),
    select: (res) => {
      const d = res.data;
      return (Array.isArray(d) ? d : d.data || []) as ItemGroup[];
    },
  });

  const mutation = useMutation({
    mutationFn: (data: { name: string; parent_id: string | null }) => itemGroupsApi.create(data),
    onSuccess: (res) => {
      const group = res.data.data as ItemGroup;
      queryClient.invalidateQueries({ queryKey: ['item-groups'] });
      toast.success('Item group created');
      onCreated?.(group);
      onClose();
    },
    onError: () => toast.error('Failed to create item group'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ name, parent_id: parentId });
  };

  return (
    <Modal open={open} onClose={onClose} title="New Item Group">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Medicine, Grocery"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Parent Group
          </label>
          <select
            value={parentId ?? ''}
            onChange={(e) => setParentId(e.target.value || null)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">None (Root level)</option>
            {allGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending} disabled={!name}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}
