# Thermal Invoice Template Editor - Implementation Plan

## Context
The user wants to enable non-technical users to customize their thermal invoice print templates without code changes. Currently, thermal templates are hardcoded Blade files on the backend. We need to:
1. Allow users to create/edit custom thermal templates via UI
2. Store templates per company in database
3. Use custom templates when printing, fallback to default
4. Do maximum work on frontend (template preview, live editing)
5. Keep existing code intact - this is a new feature, not a replacement

## Requirements
- **New Database Table**: `thermal_templates` to store custom templates per company
- **Backend API**: CRUD endpoints for thermal templates
- **Frontend Page**: Thermal Template Editor with live preview
- **Frontend Updates**: SalesInvoices page to use custom template if available
- **No Modifications**: Keep existing thermal.blade.php and InvoiceTemplateRegistry unchanged

## Architecture Overview

### Backend Changes (New Code Only)

#### 1. Migration: `create_thermal_templates_table.php`
```
Schema:
- id (UUID primary)
- company_id (FK to companies)
- name (string, 255) - e.g., "My Custom Thermal Template"
- html_content (longtext) - Custom HTML template for thermal printer
- paper_size (enum: '2inch', '3inch')
- is_default (boolean) - Whether to use this as default for company
- created_by (UUID, FK to users)
- updated_by (UUID, FK to users, nullable)
- created_at, updated_at timestamps
- sync_status, device_id, synced_at, updated_at_local (for offline sync)

Indices:
- company_id, is_default (for quick lookup)
```

#### 2. Model: `ThermalTemplate.php`
- Traits: `HasUuid`, `HasSyncColumns`, `BelongsToCompany`, `SoftDeletes`
- Relationships: `company()`, `creator()`, `updater()`
- Methods: `getRenderedHtml($invoice, $company)` - Renders with variable substitution

#### 3. Controller: `ThermalTemplateController.php`
Routes:
- `GET /thermal-templates` - List all templates for company
- `GET /thermal-templates/{id}` - Get single template
- `POST /thermal-templates` - Create new template
- `PUT /thermal-templates/{id}` - Update template
- `DELETE /thermal-templates/{id}` - Delete template
- `PATCH /thermal-templates/{id}/set-default` - Set as default

#### 4. Service: `ThermalTemplateRenderer.php`
- `render(ThermalTemplate $template, SalesInvoice $invoice, Company $company): string`
- Use string replacement for variables like `{{invoice_number}}`, `{{customer_name}}`, etc.

#### 5. Update: `SalesInvoiceController.php` (html method only)
- If `template` param is 'thermal-custom', fetch custom template from database
- Fall back to built-in thermal.blade.php if no custom template

### Frontend Changes (New Code Only)

#### 1. New Page: `ThermalTemplateEditor.tsx`
Features:
- **List Section**: Show all custom thermal templates, allow delete
- **Edit/Create Form**:
  - Template name input
  - Paper size selector (2inch, 3inch)
  - HTML editor with code highlighting
  - Preview pane showing rendered output in real-time
  - Save/Cancel buttons

- **Live Preview**:
  - Use sample SalesInvoice + Company data
  - Update preview as user types (debounced)
  - Show both 2inch and 3inch widths

#### 2. API Service: `thermalTemplates.ts`
```typescript
export const thermalTemplatesApi = {
  list: (params?: Record<string, string>) => api.get('/thermal-templates', { params }),
  get: (id: string) => api.get(`/thermal-templates/${id}`),
  create: (data: Record<string, unknown>) => api.post('/thermal-templates', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/thermal-templates/${id}`, data),
  delete: (id: string) => api.delete(`/thermal-templates/${id}`),
  setDefault: (id: string) => api.patch(`/thermal-templates/${id}/set-default`, {}),
};
```

#### 3. Types: Add to `types/index.ts`
```typescript
interface ThermalTemplate extends SyncColumns {
  id: string
  company_id: string
  name: string
  html_content: string
  paper_size: '2inch' | '3inch'
  is_default: boolean
  created_by: string
  updated_by?: string
}
```

#### 4. Update: `SalesInvoices.tsx`
- When printing thermal, use custom template if available
- Pass `template: 'thermal-custom'` param to API if custom template exists

## Critical Files to Create/Modify

### Backend (New)
- `api/database/migrations/2026_XX_XX_create_thermal_templates_table.php`
- `api/app/Models/ThermalTemplate.php`
- `api/app/Http/Controllers/Api/V1/ThermalTemplateController.php`
- `api/app/Services/ThermalTemplateRenderer.php`
- `api/app/Policies/ThermalTemplatePolicy.php`

### Backend (Modify)
- `api/routes/api.php` - Add routes
- `api/app/Http/Controllers/Api/V1/SalesInvoiceController.php` - html method

### Frontend (New)
- `fe/src/pages/settings/ThermalTemplateEditor.tsx`
- `fe/src/api/thermalTemplates.ts`

### Frontend (Modify)
- `fe/src/types/index.ts` - Add ThermalTemplate interface
- `fe/src/pages/sales/SalesInvoices.tsx` - Use custom template
