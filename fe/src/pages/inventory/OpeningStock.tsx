import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { stockLedgerApi, godownsApi, itemsApi } from '@/api/inventory';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Plus, X } from 'lucide-react';

interface OpeningRow {
  item_id: string;
  godown_id: string;
  quantity: string;
  rate: string;
}

const emptyRow = (): OpeningRow => ({ item_id: '', godown_id: '', quantity: '', rate: '' });

export default function OpeningStock() {
  usePageTitle('Opening Stock');
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('inventory.create');
  const [rows, setRows] = useState<OpeningRow[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);

  const { data: itemsData } = useQuery({
    queryKey: ['items-all'],
    queryFn: () => itemsApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const { data: godownsData } = useQuery({
    queryKey: ['godowns-all'],
    queryFn: () => godownsApi.list({ per_page: '500' }),
    select: (res) => res.data,
  });

  const mutation = useMutation({
    mutationFn: (data: { item_id: string; godown_id: string; quantity: number; rate: number }) =>
      stockLedgerApi.createOpening(data),
  });

  const updateRow = (index: number, field: keyof OpeningRow, value: string) => {
    setRows((prev) => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));

  const handleSaveAll = async () => {
    const validRows = rows.filter((r) => r.item_id && r.godown_id && Number(r.quantity) > 0 && Number(r.rate) >= 0);
    if (validRows.length === 0) {
      toast.error('Add at least one valid row');
      return;
    }

    setSaving(true);
    let successCount = 0;

    for (const row of validRows) {
      try {
        await mutation.mutateAsync({
          item_id: row.item_id,
          godown_id: row.godown_id,
          quantity: Number(row.quantity),
          rate: Number(row.rate),
        });
        successCount++;
      } catch {
        toast.error(`Failed for row: ${itemsData?.data?.find((i) => i.id === row.item_id)?.name ?? row.item_id}`);
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} opening stock entries saved`);
      queryClient.invalidateQueries({ queryKey: ['stock-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      setRows([emptyRow()]);
    }
    setSaving(false);
  };

  const selectClass = "w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none";
  const inputClass = "w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 py-2 px-3 text-sm focus:border-primary-500 focus:outline-none";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Opening Stock</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Enter Opening Stock</h2>
            {canCreate && (
              <Button variant="secondary" size="sm" onClick={addRow}>
                <Plus className="mr-1 h-3 w-3" /> Add Row
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 px-1">
              <div className="col-span-4">Item</div>
              <div className="col-span-3">Godown</div>
              <div className="col-span-2">Quantity</div>
              <div className="col-span-2">Rate (₹)</div>
              <div className="col-span-1"></div>
            </div>
            {rows.map((row, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-4">
                  <select className={selectClass} value={row.item_id} onChange={(e) => updateRow(index, 'item_id', e.target.value)}>
                    <option value="">Select item</option>
                    {(itemsData?.data ?? []).map((i) => <option key={i.id} value={i.id}>{i.name} ({i.sku ?? ''})</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  <select className={selectClass} value={row.godown_id} onChange={(e) => updateRow(index, 'godown_id', e.target.value)}>
                    <option value="">Select godown</option>
                    {(godownsData?.data ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <input type="number" min="0" step="0.001" className={inputClass} placeholder="0" value={row.quantity} onChange={(e) => updateRow(index, 'quantity', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <input type="number" min="0" step="0.01" className={inputClass} placeholder="0.00" value={row.rate} onChange={(e) => updateRow(index, 'rate', e.target.value)} />
                </div>
                <div className="col-span-1 flex items-center justify-center">
                  {rows.length > 1 && (
                    <button type="button" onClick={() => removeRow(index)} className="rounded p-1 hover:bg-red-50 dark:hover:bg-red-900/30">
                      <X className="h-4 w-4 text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {canCreate && (
            <div className="flex justify-end pt-4 mt-4 border-t dark:border-gray-700">
              <Button onClick={handleSaveAll} loading={saving}>Save All</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
