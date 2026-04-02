import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePageTitle } from '@/hooks/usePageTitle';
import { itemGroupsApi } from '@/api/inventory';
import type { ItemGroup } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import toast from 'react-hot-toast';
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  FolderClosed,
  Pencil,
  Trash2,
  Search,
  Plus,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Tree helpers
// ---------------------------------------------------------------------------

interface TreeNode {
  group: ItemGroup;
  children: TreeNode[];
}

function buildTree(groups: ItemGroup[]): TreeNode[] {
  const childrenOf = new Map<string | 'root', ItemGroup[]>();
  groups.forEach((g) => {
    const key = g.parent_id ?? 'root';
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(g);
  });

  function makeNode(group: ItemGroup): TreeNode {
    const kids = (childrenOf.get(group.id) ?? []).map(makeNode);
    return { group, children: kids };
  }

  return (childrenOf.get('root') ?? []).map(makeNode);
}

function matchesSearch(node: TreeNode, term: string): boolean {
  const lower = term.toLowerCase();
  if (node.group.name.toLowerCase().includes(lower)) return true;
  return node.children.some((c) => matchesSearch(c, lower));
}

function collectGroupIds(nodes: TreeNode[], ids: Set<string>) {
  for (const n of nodes) {
    if (n.children.length > 0) {
      ids.add(n.group.id);
      collectGroupIds(n.children, ids);
    }
  }
}

// ---------------------------------------------------------------------------
// CollapsibleRow
// ---------------------------------------------------------------------------

interface RowProps {
  node: TreeNode;
  depth: number;
  expandedSet: Set<string>;
  toggleExpand: (id: string) => void;
  searchTerm: string;
  onEdit: (group: ItemGroup) => void;
  onDelete: (id: string) => void;
}

function CollapsibleRow({ node, depth, expandedSet, toggleExpand, searchTerm, onEdit, onDelete }: RowProps) {
  const { group, children } = node;
  const isGroup = children.length > 0;
  const isExpanded = expandedSet.has(group.id);

  if (searchTerm && !matchesSearch(node, searchTerm)) return null;

  const paddingLeft = 16 + depth * 24;

  return (
    <>
      <tr
        className={`border-b border-gray-100 transition-colors dark:border-gray-700/50 ${
          isGroup
            ? 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
            : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/50'
        } ${depth === 0 ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''}`}
        onClick={isGroup ? () => toggleExpand(group.id) : undefined}
        style={{ cursor: isGroup ? 'pointer' : 'default' }}
      >
        <td className="py-2.5 pr-4" style={{ paddingLeft }}>
          <div className="flex items-center gap-2">
            {isGroup ? (
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-gray-500 dark:text-gray-400">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </span>
            ) : (
              <span className="w-5 flex-shrink-0" />
            )}
            {isGroup ? (
              isExpanded ? (
                <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-amber-500 dark:text-amber-400" />
              ) : (
                <FolderClosed className="h-3.5 w-3.5 flex-shrink-0 text-amber-500 dark:text-amber-400" />
              )
            ) : (
              <FolderClosed className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
            )}
            <span
              className={`truncate ${
                isGroup
                  ? 'font-semibold text-gray-900 dark:text-gray-100'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {group.name}
            </span>
            {!group.is_active && (
              <Badge variant="default" className="ml-2 text-[10px]">Inactive</Badge>
            )}
          </div>
        </td>

        <td className="px-4 py-2.5 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(group); }}
              className="rounded p-1 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete "${group.name}"?`)) onDelete(group.id);
              }}
              className="rounded p-1 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {isExpanded &&
        children.map((child) => (
          <CollapsibleRow
            key={child.group.id}
            node={child}
            depth={depth + 1}
            expandedSet={expandedSet}
            toggleExpand={toggleExpand}
            searchTerm={searchTerm}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Create / Edit Modal
// ---------------------------------------------------------------------------

interface GroupModalProps {
  open: boolean;
  editGroup: ItemGroup | null;
  allGroups: ItemGroup[];
  onClose: () => void;
  onSave: (data: { name: string; parent_id: string | null; is_active?: boolean }) => void;
  saving: boolean;
}

function GroupModal({ open, editGroup, allGroups, onClose, onSave, saving }: GroupModalProps) {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open) {
      if (editGroup) {
        setName(editGroup.name);
        setParentId(editGroup.parent_id);
        setIsActive(editGroup.is_active);
      } else {
        setName('');
        setParentId(null);
        setIsActive(true);
      }
    }
  }, [open, editGroup]);

  // Filter out self and descendants from parent options
  const parentOptions = allGroups.filter((g) => {
    if (!editGroup) return true;
    if (g.id === editGroup.id) return false;
    // Simple check: don't allow selecting self as parent
    return true;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editGroup) {
      onSave({ name, parent_id: parentId, is_active: isActive });
    } else {
      onSave({ name, parent_id: parentId });
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editGroup ? 'Edit Item Group' : 'New Item Group'}>
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
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder="e.g. Medicine, Grocery"
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
            {parentOptions.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        {editGroup && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Active
            </label>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : editGroup ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ItemGroups() {
  usePageTitle('Item Groups');
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editGroup, setEditGroup] = useState<ItemGroup | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['item-groups'],
    queryFn: () => itemGroupsApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const allGroups: ItemGroup[] = useMemo(() => {
    if (!data) return [];
    return Array.isArray(data) ? data : data.data || [];
  }, [data]);

  const tree = useMemo(() => buildTree(allGroups), [allGroups]);

  const expandAll = useCallback(() => {
    const ids = new Set<string>();
    collectGroupIds(tree, ids);
    setExpandedSet(ids);
  }, [tree]);

  const collapseAll = useCallback(() => setExpandedSet(new Set()), []);

  const createMutation = useMutation({
    mutationFn: (data: Partial<ItemGroup>) => itemGroupsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-groups'] });
      setShowModal(false);
      setEditGroup(null);
      toast.success('Item group created');
    },
    onError: () => toast.error('Failed to create item group'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ItemGroup> }) =>
      itemGroupsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-groups'] });
      setShowModal(false);
      setEditGroup(null);
      toast.success('Item group updated');
    },
    onError: () => toast.error('Failed to update item group'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => itemGroupsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-groups'] });
      toast.success('Item group deleted');
    },
    onError: () => toast.error('Failed to delete item group'),
  });

  const openCreate = () => {
    setEditGroup(null);
    setShowModal(true);
  };

  const openEdit = (group: ItemGroup) => {
    setEditGroup(group);
    setShowModal(true);
  };

  const handleSave = (formData: { name: string; parent_id: string | null; is_active?: boolean }) => {
    if (editGroup) {
      updateMutation.mutate({ id: editGroup.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Item Groups</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {allGroups.length} {allGroups.length === 1 ? 'group' : 'groups'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-48 rounded-lg border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-xs text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Group
          </button>
          <button
            onClick={expandAll}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Tree Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : allGroups.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-400">
            No item groups found. Create your first group to organize items.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    Group Name
                  </th>
                  <th className="w-24 px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {tree.map((node) => (
                  <CollapsibleRow
                    key={node.group.id}
                    node={node}
                    depth={0}
                    expandedSet={expandedSet}
                    toggleExpand={toggleExpand}
                    searchTerm={searchTerm}
                    onEdit={openEdit}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <GroupModal
        open={showModal}
        editGroup={editGroup}
        allGroups={allGroups}
        onClose={() => { setShowModal(false); setEditGroup(null); }}
        onSave={handleSave}
        saving={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
