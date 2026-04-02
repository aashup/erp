import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { companySettingsApi } from '@/api/settings';
import type { UnitOption } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

type UnitRow = UnitOption & { id: string };

const makeUnitRow = (unit?: Partial<UnitOption>): UnitRow => ({
  id: Math.random().toString(36).slice(2, 10),
  value: unit?.value ?? '',
  label: unit?.label ?? '',
});

export default function Units() {
  const queryClient = useQueryClient();
  const [unitRows, setUnitRows] = useState<UnitRow[]>([]);
  const [unitError, setUnitError] = useState('');

  const { data: companySettings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => companySettingsApi.get(),
    select: (res) => res.data.data,
  });

  useEffect(() => {
    const nextRows = (companySettings?.item_units ?? []).map((unit) => makeUnitRow(unit));
    setUnitRows(nextRows.length > 0 ? nextRows : [makeUnitRow()]);
  }, [companySettings]);

  const unitsMutation = useMutation({
    mutationFn: (units: UnitOption[]) => companySettingsApi.update({ item_units: units }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      setUnitError('');
      toast.success('Item units updated');
    },
  });

  const updateUnitRow = (id: string, field: 'value' | 'label', value: string) => {
    setUnitError('');
    setUnitRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const addUnitRow = () => {
    setUnitError('');
    setUnitRows((current) => [...current, makeUnitRow()]);
  };

  const removeUnitRow = (id: string) => {
    setUnitError('');
    setUnitRows((current) => {
      if (current.length === 1) {
        return [makeUnitRow()];
      }
      return current.filter((row) => row.id !== id);
    });
  };

  const saveUnits = () => {
    const normalizedUnits = unitRows
      .map((row) => ({
        value: row.value.trim().toUpperCase(),
        label: row.label.trim() || row.value.trim(),
      }))
      .filter((row) => row.value !== '');

    if (normalizedUnits.length === 0) {
      setUnitError('Add at least one unit before saving.');
      return;
    }

    const uniqueValues = new Set(normalizedUnits.map((row) => row.value));
    if (uniqueValues.size !== normalizedUnits.length) {
      setUnitError('Each unit code must be unique.');
      return;
    }

    unitsMutation.mutate(normalizedUnits);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Units</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Item Units</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Manage the unit list used in item create and edit forms.
              </p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addUnitRow}>
              <Plus className="mr-2 h-4 w-4" /> Add Unit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {unitRows.map((unit, index) => (
              <div key={unit.id} className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
                <Input
                  id={`unit-value-${unit.id}`}
                  label={index === 0 ? 'Code' : undefined}
                  placeholder="PCS"
                  value={unit.value}
                  onChange={(event) => updateUnitRow(unit.id, 'value', event.target.value)}
                />
                <Input
                  id={`unit-label-${unit.id}`}
                  label={index === 0 ? 'Label' : undefined}
                  placeholder="Pieces"
                  value={unit.label}
                  onChange={(event) => updateUnitRow(unit.id, 'label', event.target.value)}
                />
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                    onClick={() => removeUnitRow(unit.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {unitError && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{unitError}</p>
          )}

          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              onClick={saveUnits}
              loading={unitsMutation.isPending}
            >
              Save Units
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
