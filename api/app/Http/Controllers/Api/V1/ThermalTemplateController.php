<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ThermalTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ThermalTemplateController extends Controller
{
    /**
     * Get all thermal templates for the company.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', ThermalTemplate::class);

        $templates = ThermalTemplate::where('company_id', $request->user()->company_id)
            ->orderBy('paper_size')
            ->orderBy('is_default', 'desc')
            ->orderBy('created_at', 'desc')
            ->paginate($request->per_page ?? 25);

        return response()->json($templates);
    }

    /**
     * Get a single thermal template.
     */
    public function show(Request $request, ThermalTemplate $thermalTemplate): JsonResponse
    {
        $this->authorize('view', $thermalTemplate);

        return response()->json(['data' => $thermalTemplate]);
    }

    /**
     * Create a new thermal template.
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', ThermalTemplate::class);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'html_content' => 'required|string|max:102400', // 100KB limit
            'paper_size' => [
                'required',
                Rule::in(['2inch', '3inch']),
            ],
            'is_default' => 'boolean',
        ]);

        // If setting as default, unset other defaults for this paper size
        if ($validated['is_default'] ?? false) {
            ThermalTemplate::where('company_id', $request->user()->company_id)
                ->where('paper_size', $validated['paper_size'])
                ->where('is_default', true)
                ->update(['is_default' => false]);
        }

        $template = ThermalTemplate::create([
            'company_id' => $request->user()->company_id,
            'created_by' => $request->user()->id,
            ...$validated,
        ]);

        return response()->json(['data' => $template], 201);
    }

    /**
     * Update a thermal template.
     */
    public function update(Request $request, ThermalTemplate $thermalTemplate): JsonResponse
    {
        $this->authorize('update', $thermalTemplate);

        $validated = $request->validate([
            'name' => 'string|max:255',
            'html_content' => 'string|max:102400',
            'paper_size' => [
                Rule::in(['2inch', '3inch']),
            ],
            'is_default' => 'boolean',
        ]);

        // If setting as default, unset other defaults for this paper size
        if ($validated['is_default'] ?? false) {
            ThermalTemplate::where('company_id', $thermalTemplate->company_id)
                ->where('paper_size', $thermalTemplate->paper_size)
                ->where('id', '!=', $thermalTemplate->id)
                ->where('is_default', true)
                ->update(['is_default' => false]);
        }

        $thermalTemplate->update([
            'updated_by' => $request->user()->id,
            ...$validated,
        ]);

        $thermalTemplate->refresh();

        return response()->json(['data' => $thermalTemplate]);
    }

    /**
     * Delete a thermal template.
     */
    public function destroy(Request $request, ThermalTemplate $thermalTemplate): JsonResponse
    {
        $this->authorize('delete', $thermalTemplate);

        // Prevent deletion of last default template for a paper size
        $defaultCount = ThermalTemplate::where('company_id', $thermalTemplate->company_id)
            ->where('paper_size', $thermalTemplate->paper_size)
            ->where('is_default', true)
            ->count();

        if ($thermalTemplate->is_default && $defaultCount === 1) {
            return response()->json(
                ['message' => 'Cannot delete the only default template for this paper size.'],
                422
            );
        }

        $thermalTemplate->delete();

        return response()->json(['message' => 'Thermal template deleted']);
    }

    /**
     * Set a template as default for its paper size.
     */
    public function setDefault(Request $request, ThermalTemplate $thermalTemplate): JsonResponse
    {
        $this->authorize('update', $thermalTemplate);

        // Unset other defaults for this paper size
        ThermalTemplate::where('company_id', $thermalTemplate->company_id)
            ->where('paper_size', $thermalTemplate->paper_size)
            ->where('id', '!=', $thermalTemplate->id)
            ->update(['is_default' => false]);

        // Set this as default
        $thermalTemplate->update([
            'is_default' => true,
            'updated_by' => $request->user()->id,
        ]);

        $thermalTemplate->refresh();

        return response()->json(['data' => $thermalTemplate]);
    }
}
