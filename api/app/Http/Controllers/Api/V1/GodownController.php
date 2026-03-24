<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Godown;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GodownController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Godown::class);

        $godowns = Godown::with('branch')
            ->when($request->boolean('active_only'), fn ($q) => $q->where('is_active', true))
            ->orderBy('name')
            ->paginate($request->per_page ?? 25);

        return response()->json($godowns);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Godown::class);

        $validated = $request->validate([
            'branch_id' => 'nullable|uuid|exists:branches,id',
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:50',
            'address' => 'nullable|string',
            'is_default' => 'boolean',
        ]);

        $godown = Godown::create($validated);

        return response()->json(['data' => $godown], 201);
    }

    public function show(Godown $godown): JsonResponse
    {
        $this->authorize('view', $godown);

        return response()->json(['data' => $godown->load('branch')]);
    }

    public function update(Request $request, Godown $godown): JsonResponse
    {
        $this->authorize('update', $godown);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'code' => 'nullable|string|max:50',
            'address' => 'nullable|string',
            'is_default' => 'boolean',
            'is_active' => 'boolean',
        ]);

        $godown->update($validated);

        return response()->json(['data' => $godown]);
    }

    public function destroy(Godown $godown): JsonResponse
    {
        $this->authorize('delete', $godown);

        $godown->delete();

        return response()->json(['message' => 'Godown deleted']);
    }
}
