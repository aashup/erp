<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CompanySetting;
use App\Models\Item;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ItemController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Item::class);

        $items = Item::with(['batches', 'itemGroup'])
            ->when($request->search, fn ($q, $s) => $q->where('name', 'like', "%{$s}%")->orWhere('sku', 'like', "%{$s}%"))
            ->when($request->sku, fn ($q, $s) => $q->where('sku', 'like', "%{$s}%"))
            ->when($request->item_group_id, fn ($q, $g) => $q->where('item_group_id', $g))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->when($request->unit, fn ($q, $u) => $q->where('unit', $u))
            ->orderBy('name')
            ->paginate($request->per_page ?? 25);

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Item::class);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'sku' => 'nullable|string|max:100',
            'hsn_code' => 'nullable|string|max:10',
            'unit' => ['required', 'string', 'max:20', Rule::in(CompanySetting::getItemUnitValues($request->user()->company_id))],
            'item_group_id' => 'nullable|uuid|exists:item_groups,id',
            'gst_rate' => 'required|numeric|min:0',
            'mrp' => 'nullable|numeric|min:0',
            'purchase_price' => 'nullable|numeric|min:0',
            'selling_price' => 'nullable|numeric|min:0',
            'reorder_level' => 'nullable|integer|min:0',
            'is_batch_tracked' => 'boolean',
        ]);

        $item = Item::create($validated);

        return response()->json(['data' => $item], 201);
    }

    public function show(Item $item): JsonResponse
    {
        $this->authorize('view', $item);

        return response()->json(['data' => $item->load('batches')]);
    }

    public function update(Request $request, Item $item): JsonResponse
    {
        $this->authorize('update', $item);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'sku' => 'nullable|string|max:100',
            'hsn_code' => 'nullable|string|max:10',
            'unit' => ['sometimes', 'string', 'max:20', Rule::in(CompanySetting::getItemUnitValues($request->user()->company_id))],
            'item_group_id' => 'nullable|uuid|exists:item_groups,id',
            'gst_rate' => 'sometimes|numeric|min:0',
            'mrp' => 'nullable|numeric|min:0',
            'purchase_price' => 'nullable|numeric|min:0',
            'selling_price' => 'nullable|numeric|min:0',
            'reorder_level' => 'nullable|integer|min:0',
            'is_batch_tracked' => 'boolean',
            'is_active' => 'boolean',
        ]);

        $item->update($validated);

        return response()->json(['data' => $item]);
    }

    public function destroy(Item $item): JsonResponse
    {
        $this->authorize('delete', $item);

        $item->delete();

        return response()->json(['message' => 'Item deleted']);
    }
}
