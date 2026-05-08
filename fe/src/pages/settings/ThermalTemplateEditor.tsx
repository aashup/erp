import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { thermalTemplatesApi } from '@/api/thermalTemplates';
import { salesInvoicesApi } from '@/api/sales';
import type { ThermalTemplate } from '@/types';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { render } from '@/lib/thermalTemplateRenderer';
import { Trash2, Save, Plus, ArrowLeft, Eye, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDateStore } from '@/store/dateStore';

const DEFAULT_THERMAL_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Thermal Invoice</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: monospace;
            font-size: 10px;
            color: #000;
            line-height: 1.2;
            width: {{paper_width}};
            background: #fff;
            margin: 0 auto;
        }
        .receipt { padding: 8px; text-align: center; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 2px; text-align: left; font-size: 9px; }
        th { border-bottom: 1px dashed #000; font-weight: bold; text-align: center; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .header {
            text-align: center;
            margin-bottom: 8px;
            border-bottom: 2px solid #000;
            padding-bottom: 6px;
        }
        .company-name { font-weight: bold; font-size: 12px; }
        .invoice-title { font-weight: bold; margin: 6px 0 3px 0; padding-bottom: 3px; }
        .info-row { display: flex; justify-content: space-between; font-size: 8px; margin: 2px 0; }
        .label { font-weight: bold; flex-basis: 40%; }
        .value { flex-basis: 60%; text-align: right; }
        .totals-section { margin: 6px 0; border-top: 1px dashed #000; padding: 3px 0; }
        .total-row { display: flex; justify-content: space-between; font-size: 9px; margin: 2px 0; }
        .grand-total-row { border-top: 1px solid #000; padding-top: 3px; font-weight: bold; }
        .footer { margin-top: 8px; padding-top: 6px; border-top: 2px solid #000; text-align: center; font-size: 8px; }
    </style>
</head>
<body>
    <div class="receipt">
        <div class="header">
            <div class="company-name">{{company_name}}</div>
            <div>TAX INVOICE</div>
        </div>
        <div class="invoice-title">Invoice #{{invoice_number}}</div>
        <div class="info-row">
            <span class="label">Date:</span>
            <span class="value">{{invoice_date_formatted}}</span>
        </div>
        <div style="border-bottom: 1px dashed #000; margin: 4px 0; padding-bottom: 3px;">
            <div style="font-weight: bold; font-size: 9px;">{{customer_name}}</div>
            {{items_table}}
        </div>
        <div class="totals-section">
            <div class="total-row"><span>Subtotal:</span><span>{{subtotal}}</span></div>
            <div class="total-row"><span>CGST:</span><span>{{cgst_total}}</span></div>
            <div class="total-row"><span>SGST:</span><span>{{sgst_total}}</span></div>
            <div class="total-row grand-total-row"><span>TOTAL:</span><span>₹{{grand_total}}</span></div>
        </div>
        <div class="footer">
            <div>Thank you!</div>
        </div>
    </div>
</body>
</html>`;

interface EditorState {
  mode: 'list' | 'edit' | 'create';
  editingTemplate: ThermalTemplate | null;
  formData: {
    name: string;
    htmlContent: string;
    paperSize: '2inch' | '3inch';
    isDefault: boolean;
  };
}

export default function ThermalTemplateEditor() {
  usePageTitle('Thermal Invoice Templates');
  const queryClient = useQueryClient();
  const { selectedDate } = useDateStore();
  const [editorState, setEditorState] = useState<EditorState>({
    mode: 'list',
    editingTemplate: null,
    formData: {
      name: '',
      htmlContent: DEFAULT_THERMAL_TEMPLATE.replace('{{paper_width}}', '58mm'),
      paperSize: '2inch',
      isDefault: false,
    },
  });

  // Sample invoice for preview
  const { data: sampleInvoice } = useQuery({
    queryKey: ['sales-invoices-first'],
    queryFn: () => salesInvoicesApi.list({ per_page: '1' }).then(res => res.data.data?.[0]),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: templates, isLoading } = useQuery({
    queryKey: ['thermal-templates'],
    queryFn: () => thermalTemplatesApi.list({ per_page: '100' }),
    select: (res) => res.data.data ?? [],
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      html_content: string;
      paper_size: '2inch' | '3inch';
      is_default: boolean;
    }) => thermalTemplatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thermal-templates'] });
      toast.success('Thermal template created');
      setEditorState({ mode: 'list', editingTemplate: null, formData: { ...editorState.formData, name: '', htmlContent: DEFAULT_THERMAL_TEMPLATE.replace('{{paper_width}}', '58mm'), isDefault: false } });
    },
    onError: () => {
      toast.error('Failed to create template');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: {
      id: string;
      name: string;
      html_content: string;
      paper_size: '2inch' | '3inch';
      is_default: boolean;
    }) =>
      thermalTemplatesApi.update(data.id, {
        name: data.name,
        html_content: data.html_content,
        paper_size: data.paper_size,
        is_default: data.is_default,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thermal-templates'] });
      toast.success('Thermal template updated');
      setEditorState({ mode: 'list', editingTemplate: null, formData: { ...editorState.formData, name: '', htmlContent: DEFAULT_THERMAL_TEMPLATE.replace('{{paper_width}}', '58mm'), isDefault: false } });
    },
    onError: () => {
      toast.error('Failed to update template');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => thermalTemplatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['thermal-templates'] });
      toast.success('Thermal template deleted');
    },
    onError: () => {
      toast.error('Failed to delete template');
    },
  });

  const loadDefaultsMutation = useMutation({
    mutationFn: () => thermalTemplatesApi.loadDefaults(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['thermal-templates'] });
      const created = res.data.data?.created ?? [];
      toast.success(created.length
        ? `Default templates loaded: ${created.join(', ')}`
        : 'Default templates already exist for all paper sizes'
      );
    },
    onError: () => toast.error('Failed to load default templates'),
  });

  const handleCreate = () => {
    setEditorState({
      mode: 'create',
      editingTemplate: null,
      formData: {
        name: '',
        htmlContent: DEFAULT_THERMAL_TEMPLATE.replace('{{paper_width}}', '58mm'),
        paperSize: '2inch',
        isDefault: false,
      },
    });
  };

  const handleEdit = (template: ThermalTemplate) => {
    setEditorState({
      mode: 'edit',
      editingTemplate: template,
      formData: {
        name: template.name,
        htmlContent: template.html_content,
        paperSize: template.paper_size,
        isDefault: template.is_default,
      },
    });
  };

  const handleSave = () => {
    if (!editorState.formData.name.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    if (!editorState.formData.htmlContent.trim()) {
      toast.error('Please enter HTML content');
      return;
    }

    const data = {
      name: editorState.formData.name,
      html_content: editorState.formData.htmlContent,
      paper_size: editorState.formData.paperSize,
      is_default: editorState.formData.isDefault,
    };

    if (editorState.mode === 'create') {
      createMutation.mutate(data);
    } else if (editorState.editingTemplate) {
      updateMutation.mutate({
        ...data,
        id: editorState.editingTemplate.id,
      });
    }
  };

  const handleCancel = () => {
    setEditorState({
      mode: 'list',
      editingTemplate: null,
      formData: { ...editorState.formData, name: '', htmlContent: DEFAULT_THERMAL_TEMPLATE.replace('{{paper_width}}', '58mm'), isDefault: false },
    });
  };

  const user = useAuthStore((s) => s.user);

  const getPaperWidth = () => editorState.formData.paperSize === '3inch' ? '80mm' : '58mm';

  const getDefaultSampleInvoice = () => ({
    id: 'sample-001',
    company_id: 'company-001',
    financial_year_id: null,
    party_id: 'party-001',
    branch_id: null,
    sales_order_id: null,
    godown_id: null,
    invoice_number: 'INV-0001',
    invoice_date: selectedDate,
    due_date: null,
    is_inter_state: false,
    is_printed: false,
    status: 'confirmed' as const,
    total_amount: 10000,
    discount_amount: 0,
    taxable_amount: 10000,
    cgst_total: 900,
    sgst_total: 900,
    igst_total: 0,
    grand_total: 11800,
    amount_paid: 0,
    balance_due: 11800,
    notes: null,
    party: {
      id: 'party-001',
      company_id: 'company-001',
      type: 'customer' as const,
      name: 'ABC Trading Company',
      gstin: '27AABCT1234H1Z0',
      pan: null,
      address: '123 Main Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      state_code: '27',
      pincode: '400001',
      phone: '+91-9876543210',
      email: 'info@abctrading.com',
      contact_person: 'John Doe',
      credit_limit: 50000,
      opening_balance: null,
      balance_type: null,
      debtor_ledger_id: null,
      creditor_ledger_id: null,
      is_active: true,
      sync_status: 'synced' as const,
      device_id: null,
      synced_at: new Date().toISOString(),
      updated_at_local: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    lines: [
      {
        id: 'line-001',
        sales_invoice_id: 'sample-001',
        item_id: 'item-001',
        batch_id: null,
        quantity: 5,
        unit: 'PCS',
        conversion_factor: 1,
        rate: 1000,
        discount_percent: 0,
        taxable_amount: 5000,
        gst_rate: 18,
        cgst: 450,
        sgst: 450,
        igst: 0,
        line_total: 5900,
        item: {
          id: 'item-001',
          company_id: 'company-001',
          item_group_id: null,
          name: 'Product A',
          sku: 'SKU-001',
          hsn_code: '1234567890',
          unit: 'PCS',
          igst: 18,
          sgst: 9,
          cgst: 9,
          mrp: null,
          purchase_price: null,
          selling_price: 1000,
          reorder_level: null,
          is_batch_tracked: false,
          is_active: true,
          sync_status: 'synced' as const,
          device_id: null,
          synced_at: new Date().toISOString(),
          updated_at_local: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        sync_status: 'synced' as const,
        device_id: null,
        synced_at: new Date().toISOString(),
        updated_at_local: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'line-002',
        sales_invoice_id: 'sample-001',
        item_id: 'item-002',
        batch_id: null,
        quantity: 5,
        unit: 'PCS',
        conversion_factor: 1,
        rate: 1000,
        discount_percent: 0,
        taxable_amount: 5000,
        gst_rate: 18,
        cgst: 450,
        sgst: 450,
        igst: 0,
        line_total: 5900,
        item: {
          id: 'item-002',
          company_id: 'company-001',
          item_group_id: null,
          name: 'Product B',
          sku: 'SKU-002',
          hsn_code: '0987654321',
          unit: 'PCS',
          igst: 18,
          sgst: 9,
          cgst: 9,
          mrp: null,
          purchase_price: null,
          selling_price: 1000,
          reorder_level: null,
          is_batch_tracked: false,
          is_active: true,
          sync_status: 'synced' as const,
          device_id: null,
          synced_at: new Date().toISOString(),
          updated_at_local: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        sync_status: 'synced' as const,
        device_id: null,
        synced_at: new Date().toISOString(),
        updated_at_local: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    sync_status: 'synced' as const,
    device_id: null,
    synced_at: new Date().toISOString(),
    updated_at_local: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const getPreviewHtml = () => {
    const invoice = sampleInvoice || getDefaultSampleInvoice();
    if (!invoice) return '<p>Unable to load sample invoice...</p>';

    const company = user?.company ?? {
      id: 'sample', name: 'Your Company', gstin: '27AABCT1234H1Z0',
      address: '123 Sample Street', phone: '9876543210', email: 'info@company.com',
      pan: null, city: null, state: null, state_code: null, pincode: null,
      logo_path: null, sync_status: 'synced' as const, device_id: null,
      synced_at: null, updated_at_local: '', created_at: '', updated_at: '',
    };

    return render(
      editorState.formData.htmlContent,
      invoice,
      company,
      { paperSize: editorState.formData.paperSize },
    );
  };

  if (editorState.mode === 'list') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Thermal Invoice Templates</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => loadDefaultsMutation.mutate()}
              disabled={loadDefaultsMutation.isPending}
              title="Create built-in default templates for 2-inch and 3-inch paper if not already present"
            >
              <Download className="mr-2 h-4 w-4" />
              {loadDefaultsMutation.isPending ? 'Loading…' : 'Load Defaults'}
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" /> New Template
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center text-gray-500">Loading templates...</div>
        ) : !templates || templates.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-3 py-4">
                <p className="text-center text-gray-500">No thermal templates yet. Load the built-in defaults or create a custom template.</p>
                <Button
                  variant="secondary"
                  onClick={() => loadDefaultsMutation.mutate()}
                  disabled={loadDefaultsMutation.isPending}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {loadDefaultsMutation.isPending ? 'Loading…' : 'Load Default Templates (2" + 3")'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">{template.name}</h3>
                        <Badge variant={template.paper_size === '3inch' ? 'success' : 'default'}>
                          {template.paper_size === '3inch' ? '3" (80mm)' : '2" (58mm)'}
                        </Badge>
                        {template.is_default && (
                          <Badge variant="success">Default</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Created {formatDate(template.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(template)}
                        className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Edit"
                      >
                        <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this template?')) {
                            deleteMutation.mutate(template.id);
                          }
                        }}
                        className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Delete"
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          onClick={handleCancel}
          className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {editorState.mode === 'create' ? 'New Thermal Template' : 'Edit Thermal Template'}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Editor */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Template HTML</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Template Name
              </label>
              <input
                type="text"
                value={editorState.formData.name}
                onChange={(e) =>
                  setEditorState({
                    ...editorState,
                    formData: { ...editorState.formData, name: e.target.value },
                  })
                }
                placeholder="e.g., Custom Thermal Template"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Paper Size
              </label>
              <div className="flex gap-2">
                {(['2inch', '3inch'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() =>
                      setEditorState({
                        ...editorState,
                        formData: { ...editorState.formData, paperSize: size },
                      })
                    }
                    className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all ${
                      editorState.formData.paperSize === size
                        ? 'border-primary-600 bg-primary-50 text-primary-600 dark:border-primary-500 dark:bg-primary-900/20 dark:text-primary-400'
                        : 'border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    {size === '2inch' ? '2" (58mm)' : '3" (80mm)'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editorState.formData.isDefault}
                  onChange={(e) =>
                    setEditorState({
                      ...editorState,
                      formData: { ...editorState.formData, isDefault: e.target.checked },
                    })
                  }
                  className="rounded border-gray-300"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Set as default for {editorState.formData.paperSize === '2inch' ? '2 inch' : '3 inch'}
                </span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                HTML Content (Available variables: {`{{company_name}}, {{invoice_number}}, {{customer_name}}, {{items_table}}, {{grand_total}}, {{cgst_total}}, {{sgst_total}}, {{igst_total}}`})
              </label>
              <textarea
                value={editorState.formData.htmlContent}
                onChange={(e) =>
                  setEditorState({
                    ...editorState,
                    formData: { ...editorState.formData, htmlContent: e.target.value },
                  })
                }
                className="w-full h-96 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Character count: {editorState.formData.htmlContent.length} / 102400
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1"
              >
                <Save className="mr-2 h-4 w-4" />
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Template'}
              </Button>
              <Button onClick={handleCancel} variant="secondary" className="flex-1">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Live Preview</h3>
          </CardHeader>
          <CardContent>
            <div className="border border-gray-300 dark:border-gray-700 overflow-auto max-h-96 bg-white dark:bg-gray-950">
              <iframe
                title="Thermal Preview"
                srcDoc={getPreviewHtml()}
                style={{
                  width: getPaperWidth(),
                  height: '600px',
                  border: 'none',
                  display: 'block',
                  margin: '0 auto',
                }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Paper width: {getPaperWidth()} | Using sample invoice data for preview
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
