import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePageTitle } from '@/hooks/usePageTitle';
import { accountingGroupsApi } from '@/api/accounting';
import type { AccountingGroup } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { SlideSelect } from '@/components/ui/SlideSelect';
import toast from 'react-hot-toast';
import {
  ChevronRight,
  ChevronDown,
  Filter,
  X,
  FolderOpen,
  FileText,
  Pencil,
  Trash2,
  Search,
  Plus,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expenses',
};

const TYPE_COLORS: Record<string, string> = {
  asset: 'text-blue-700 dark:text-blue-400',
  liability: 'text-purple-700 dark:text-purple-400',
  equity: 'text-green-700 dark:text-green-400',
  income: 'text-emerald-700 dark:text-emerald-400',
  expense: 'text-red-700 dark:text-red-400',
};

const TYPE_BG: Record<string, string> = {
  asset: 'bg-blue-50 dark:bg-blue-900/20',
  liability: 'bg-purple-50 dark:bg-purple-900/20',
  equity: 'bg-green-50 dark:bg-green-900/20',
  income: 'bg-emerald-50 dark:bg-emerald-900/20',
  expense: 'bg-red-50 dark:bg-red-900/20',
};

const TYPE_ORDER: string[] = ['asset', 'liability', 'equity', 'income', 'expense'];

const typeColor: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'default'> = {
  asset: 'info',
  liability: 'danger',
  equity: 'success',
  income: 'success',
  expense: 'warning',
};


// ---------------------------------------------------------------------------
// Tree node type
// ---------------------------------------------------------------------------

interface TreeNode {
  account: AccountingGroup;
  children: TreeNode[];
  childCount: number; // total descendant ledger (non-group) count
}

function buildTree(accounts: AccountingGroup[]): Map<string, TreeNode[]> {
  // Build adjacency: parent_id → children
  const childrenOf = new Map<string | 'root', AccountingGroup[]>();
  accounts.forEach((a) => {
    const key = a.parent_id ?? 'root';
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(a);
  });

  // Determine which accounts are groups (have children)
  const parentIds = new Set(accounts.filter((a) => a.parent_id).map((a) => a.parent_id!));

  function makeNode(account: AccountingGroup): TreeNode {
    const kids = (childrenOf.get(account.id) ?? []).map(makeNode);
    const isGroup = parentIds.has(account.id) || kids.length > 0;
    const childCount = isGroup
      ? kids.reduce((s, k) => s + k.childCount, 0)
      : 1; // leaf = 1 account
    return { account, children: kids, childCount };
  }

  // Group root nodes by type
  const roots = childrenOf.get('root') ?? [];
  const byType = new Map<string, TreeNode[]>();
  for (const a of roots) {
    const node = makeNode(a);
    if (!byType.has(a.type)) byType.set(a.type, []);
    byType.get(a.type)!.push(node);
  }
  return byType;
}

function matchesSearch(node: TreeNode, term: string): boolean {
  const lower = term.toLowerCase();
  if (
    node.account.name.toLowerCase().includes(lower) ||
    node.account.code.toLowerCase().includes(lower)
  )
    return true;
  return node.children.some((c) => matchesSearch(c, lower));
}

function hasActiveAccounts(node: TreeNode): boolean {
  if (node.account.is_active) return true;
  return node.children.some(hasActiveAccounts);
}

// Collect all group IDs in a tree
function collectGroupIds(nodes: TreeNode[], ids: Set<string>) {
  for (const n of nodes) {
    if (n.children.length > 0) {
      ids.add(n.account.id);
      collectGroupIds(n.children, ids);
    }
  }
}

// ---------------------------------------------------------------------------
// CollapsibleRow component
// ---------------------------------------------------------------------------

interface RowProps {
  node: TreeNode;
  depth: number;
  expandedSet: Set<string>;
  toggleExpand: (id: string) => void;
  hideInactive: boolean;
  searchTerm: string;
  onEdit: (account: AccountingGroup) => void;
  onDelete: (id: string) => void;
}

function CollapsibleRow({
  node,
  depth,
  expandedSet,
  toggleExpand,
  hideInactive,
  searchTerm,
  onEdit,
  onDelete,
}: RowProps) {
  const { account, children } = node;
  const isGroup = children.length > 0;
  const isExpanded = expandedSet.has(account.id);

  // Search filter
  if (searchTerm && !matchesSearch(node, searchTerm)) return null;

  // Hide inactive filter
  if (hideInactive && !account.is_active && !hasActiveAccounts(node)) return null;

  const paddingLeft = 16 + depth * 24;

  return (
    <>
      <tr
        className={`border-b border-gray-100 transition-colors dark:border-gray-700/50 ${
          isGroup
            ? 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
            : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/50'
        } ${depth === 0 ? 'bg-gray-50/50 dark:bg-gray-800/30' : ''}`}
        onClick={isGroup ? () => toggleExpand(account.id) : undefined}
        style={{ cursor: isGroup ? 'pointer' : 'default' }}
      >
        {/* Account name with indent & toggle */}
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
              <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-amber-500 dark:text-amber-400" />
            ) : (
              <FileText className="h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
            )}
            <span
              className={`truncate ${
                isGroup
                  ? 'font-semibold text-gray-900 dark:text-gray-100'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {account.name}
            </span>
            {/* <span className="ml-1 font-mono text-[10px] text-gray-400 dark:text-gray-500">{account.code}</span> */}
            {!account.is_active && (
              <Badge variant="default" className="ml-2 text-[10px]">Inactive</Badge>
            )}
            {account.is_system && (
              <span className="ml-1 text-[10px] font-medium text-gray-400 dark:text-gray-500">(System)</span>
            )}
          </div>
        </td>

        {/* Balance Type */}
        <td className="px-4 py-2.5 text-center">
          <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${
            account.balance_type === 'dr'
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
          }`}>
            {account.balance_type === 'dr' ? 'Debit' : 'Credit'}
          </span>
        </td>

        {/* Actions */}
        <td className="px-4 py-2.5 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(account); }}
              className="rounded p-1 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {!account.is_system && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${account.name}"?`)) onDelete(account.id);
                }}
                className="rounded p-1 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Children */}
      {isExpanded &&
        children.map((child) => (
          <CollapsibleRow
            key={child.account.id}
            node={child}
            depth={depth + 1}
            expandedSet={expandedSet}
            toggleExpand={toggleExpand}
            hideInactive={hideInactive}
            searchTerm={searchTerm}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Filter Panel (right slide-over)
// ---------------------------------------------------------------------------

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filterType: string;
  setFilterType: (v: string) => void;
  hideInactive: boolean;
  setHideInactive: (v: boolean) => void;
  onReset: () => void;
}

function FilterPanel({
  open,
  onClose,
  searchTerm,
  setSearchTerm,
  filterType,
  setFilterType,
  hideInactive,
  setHideInactive,
  onReset,
}: FilterPanelProps) {
  return (
    <>
      {/* Overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30 transition-opacity" onClick={onClose} />
      )}
      {/* Slide-over panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-80 transform border-l border-gray-200 bg-white shadow-xl transition-transform duration-300 ease-in-out dark:border-gray-700 dark:bg-gray-900 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            {/* Search */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name or code..."
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Account Type */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Account Type
              </label>
              <SlideSelect
                name="filterType"
                placeholder="All Types"
                panelTitle="Select Account Type"
                options={[
                  { value: '', label: 'All Types' },
                  { value: 'asset', label: 'Assets' },
                  { value: 'liability', label: 'Liabilities' },
                  { value: 'equity', label: 'Equity' },
                  { value: 'income', label: 'Income' },
                  { value: 'expense', label: 'Expenses' },
                ]}
                value={filterType}
                onChange={(val) => setFilterType(val)}
              />
            </div>

            {/* Visibility */}
            <div>
              <label className="mb-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Visibility
              </label>
              <div className="space-y-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={hideInactive}
                    onChange={(e) => setHideInactive(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Hide inactive accounts
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Hide accounts marked as inactive
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
            <button
              onClick={onReset}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Reset All
            </button>
            <button
              onClick={onClose}
              className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Edit Modal
// ---------------------------------------------------------------------------

interface EditModalProps {
  open: boolean;
  account: AccountingGroup | null;
  allAccounts: AccountingGroup[];
  onClose: () => void;
  onSave: (id: string, data: { name: string; balance_type: 'dr' | 'cr'; is_active: boolean }) => void;
  saving: boolean;
}

function EditModal({ open, account, allAccounts, onClose, onSave, saving }: EditModalProps) {
  const [name, setName] = useState('');
  const [balanceType, setBalanceType] = useState<'dr' | 'cr'>('dr');
  const [isActive, setIsActive] = useState(true);

  // Reset form when account changes
  useEffect(() => {
    if (account) {
      setName(account.name);
      setBalanceType(account.balance_type);
      setIsActive(account.is_active);
    }
  }, [account]);

  if (!account) return null;

  const parent = allAccounts.find((a) => a.id === account.parent_id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(account.id, {
      name,
      balance_type: balanceType,
      is_active: isActive,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Account">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Read-only info */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Code</dt>
              <dd className="font-mono font-medium text-gray-900 dark:text-gray-100">{account.code}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Type</dt>
              <dd><Badge variant={typeColor[account.type]}>{account.type}</Badge></dd>
            </div>
            {parent && (
              <div className="col-span-2">
                <dt className="text-gray-500 dark:text-gray-400">Parent Group</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">{parent.name}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Editable fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Account Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={account.is_system}
              className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 ${
                account.is_system ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : 'bg-white'
              }`}
            />
            {account.is_system && (
              <p className="mt-1 text-xs text-gray-400">System accounts cannot be renamed</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={account.is_system}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Active</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nature
            </label>
            <select
              value={balanceType}
              onChange={(e) => setBalanceType(e.target.value as 'dr' | 'cr')}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="dr">Debit (Dr)</option>
              <option value="cr">Credit (Cr)</option>
            </select>
          </div>
        </div>

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
            disabled={saving}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Create Modal
// ---------------------------------------------------------------------------

interface CreateModalProps {
  open: boolean;
  allAccounts: AccountingGroup[];
  onClose: () => void;
  onSave: (data: { name: string; code: string; type: string; parent_id: string | null; balance_type: 'dr' | 'cr' }) => void;
  saving: boolean;
}

function CreateModal({ open, allAccounts, onClose, onSave, saving }: CreateModalProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState('asset');
  const [parentId, setParentId] = useState<string | null>(null);
  const [balanceType, setBalanceType] = useState<'dr' | 'cr'>('dr');

  const resetForm = () => {
    setName('');
    setCode('');
    setType('asset');
    setParentId(null);
    setBalanceType('dr');
  };

  // Filter parent options by selected type
  const parentOptions = allAccounts.filter((a) => a.type === type);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, code, type, parent_id: parentId || null, balance_type: balanceType });
  };

  // Reset form when modal opens
  useEffect(() => {
    if (open) resetForm();
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Add Accounting Group">
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
            placeholder="e.g. Bank Accounts"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            maxLength={20}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            placeholder="e.g. BANK_ACC"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Type <span className="text-red-500">*</span>
          </label>
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setParentId(null); }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="asset">Asset</option>
            <option value="liability">Liability</option>
            <option value="equity">Equity</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Parent Group
          </label>
          <SlideSelect
            name="parentId"
            placeholder="None (Root level)"
            panelTitle="Select Parent Group"
            options={[{ value: '', label: 'None (Root level)' }, ...parentOptions.map((a) => ({ value: a.id, label: a.name }))]}
            value={parentId ?? ''}
            onChange={(val) => setParentId(val || null)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nature
          </label>
          <select
            value={balanceType}
            onChange={(e) => setBalanceType(e.target.value as 'dr' | 'cr')}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="dr">Debit (Dr)</option>
            <option value="cr">Credit (Cr)</option>
          </select>
        </div>

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
            disabled={saving || !name || !code}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AccountingGroups() {
  usePageTitle('Accounting Groups');
  const queryClient = useQueryClient();

  // Filter state
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [hideInactive, setHideInactive] = useState(false);

  // Expand/collapse state
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editAccount, setEditAccount] = useState<AccountingGroup | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback((nodesByType: Map<string, TreeNode[]>) => {
    const ids = new Set<string>();
    nodesByType.forEach((nodes) => collectGroupIds(nodes, ids));
    setExpandedSet(ids);
  }, []);

  const collapseAll = useCallback(() => setExpandedSet(new Set()), []);

  // Data fetching
  const { data, isLoading, error } = useQuery({
    queryKey: ['accounting-groups'],
    queryFn: () => accountingGroupsApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const allAccounts: AccountingGroup[] = useMemo(() => {
    if (!data) return [];
    return Array.isArray(data) ? data : data.data || [];
  }, [data]);

  // Build tree grouped by type
  const treeByType = useMemo(() => buildTree(allAccounts), [allAccounts]);

  // Types to show
  const visibleTypes = filterType ? [filterType] : TYPE_ORDER;

  // Mutations
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      accountingGroupsApi.update(id, data as Partial<AccountingGroup>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-groups'] });
      setEditAccount(null);
      toast.success('Account updated');
    },
    onError: () => toast.error('Failed to update account'),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<AccountingGroup>) => accountingGroupsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-groups'] });
      setShowCreateModal(false);
      toast.success('Group created');
    },
    onError: () => toast.error('Failed to create group'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountingGroupsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting-groups'] });
      toast.success('Account deleted');
    },
    onError: () => toast.error('Failed to delete account'),
  });

  const handleEdit = (account: AccountingGroup) => setEditAccount(account);
  const handleDelete = (id: string) => deleteMutation.mutate(id);
  const handleSave = (id: string, data: { name: string; balance_type: 'dr' | 'cr'; is_active: boolean }) => {
    updateMutation.mutate({ id, data });
  };

  // Check if any filters are active
  const hasActiveFilters = searchTerm || filterType || hideInactive;

  const handleReset = () => {
    setSearchTerm('');
    setFilterType('');
    setHideInactive(false);
  };

  // Compute stats
  const stats = useMemo(() => {
    let groups = 0;
    let ledgers = 0;
    function count(nodes: TreeNode[]) {
      for (const n of nodes) {
        if (n.children.length > 0) {
          groups++;
          count(n.children);
        } else {
          ledgers++;
        }
      }
    }
    treeByType.forEach((nodes) => count(nodes));
    return { groups, ledgers, total: allAccounts.length };
  }, [treeByType, allAccounts]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-600 dark:text-red-400">Error loading chart of accounts</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Accounting Groups</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {stats.total} accounts &middot; {stats.groups} groups &middot; {stats.ledgers} ledgers
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick search */}
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
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Group
          </button>
          <button
            onClick={() => expandAll(treeByType)}
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
          <button
            onClick={() => setFilterOpen(true)}
            className={`relative flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              hasActiveFilters
                ? 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {hasActiveFilters && (
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary-600 text-[9px] font-bold text-white">
                !
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {searchTerm && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              Search: &quot;{searchTerm}&quot;
              <button onClick={() => setSearchTerm('')} className="ml-0.5 hover:text-gray-900 dark:hover:text-gray-200">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filterType && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              Type: {TYPE_LABELS[filterType]}
              <button onClick={() => setFilterType('')} className="ml-0.5 hover:text-gray-900 dark:hover:text-gray-200">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {hideInactive && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              Hiding inactive
              <button onClick={() => setHideInactive(false)} className="ml-0.5 hover:text-gray-900 dark:hover:text-gray-200">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          <button
            onClick={handleReset}
            className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Main Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : allAccounts.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <p className="text-gray-500 dark:text-gray-400">
            No accounts found. Load defaults from Settings or create accounts manually.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    Account
                  </th>
                  <th className="w-28 px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-300">
                    Nature
                  </th>
                  <th className="w-24 px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleTypes.map((type) => {
                  const nodes = treeByType.get(type);
                  if (!nodes || nodes.length === 0) return null;

                  // Count accounts in this type
                  const typeCount = nodes.reduce((s, n) => s + n.childCount, 0);

                  return (
                    <Fragment key={type}>
                      {/* Type section header */}
                      <tr className={`border-b border-gray-200 dark:border-gray-700 ${TYPE_BG[type]}`}>
                        <td className="px-4 py-2.5" colSpan={2}>
                          <span className={`text-sm font-bold uppercase tracking-wide ${TYPE_COLORS[type]}`}>
                            {TYPE_LABELS[type]}
                          </span>
                          <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">
                            ({typeCount} {typeCount === 1 ? 'account' : 'accounts'})
                          </span>
                        </td>
                        <td className="px-4 py-2.5" colSpan={1} />
                      </tr>
                      {/* Tree rows */}
                      {nodes.map((node) => (
                        <CollapsibleRow
                          key={node.account.id}
                          node={node}
                          depth={0}
                          expandedSet={expandedSet}
                          toggleExpand={toggleExpand}
                          hideInactive={hideInactive}
                          searchTerm={searchTerm}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filter slide-over panel */}
      <FilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterType={filterType}
        setFilterType={setFilterType}
        hideInactive={hideInactive}
        setHideInactive={setHideInactive}
        onReset={handleReset}
      />

      {/* Create Modal */}
      <CreateModal
        open={showCreateModal}
        allAccounts={allAccounts}
        onClose={() => setShowCreateModal(false)}
        onSave={(data) => createMutation.mutate(data as Partial<AccountingGroup>)}
        saving={createMutation.isPending}
      />

      {/* Edit Modal */}
      <EditModal
        open={!!editAccount}
        account={editAccount}
        allAccounts={allAccounts}
        onClose={() => setEditAccount(null)}
        onSave={handleSave}
        saving={updateMutation.isPending}
      />
    </div>
  );
}
