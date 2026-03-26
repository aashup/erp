<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CompanySetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CompanySettingController extends Controller
{
    /**
     * Get all settings for the authenticated user's company.
     */
    public function index(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;

        $settings = CompanySetting::where('company_id', $companyId)
            ->get()
            ->pluck('value', 'key');

        return response()->json(['data' => $settings]);
    }

    /**
     * Update (upsert) settings for the authenticated user's company.
     * Accepts: { "settings": { "key1": "value1", "key2": "value2" } }
     */
    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'settings' => 'required|array',
            'settings.*' => 'nullable|string|max:1000',
        ]);

        $companyId = $request->user()->company_id;

        foreach ($request->input('settings') as $key => $value) {
            CompanySetting::setValue($companyId, $key, $value);
        }

        $settings = CompanySetting::where('company_id', $companyId)
            ->get()
            ->pluck('value', 'key');

        return response()->json([
            'message' => 'Settings updated successfully',
            'data' => $settings,
        ]);
    }
}
