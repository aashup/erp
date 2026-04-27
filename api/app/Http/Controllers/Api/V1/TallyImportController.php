<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CompanySetting;
use App\Services\TallyImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TallyImportController extends Controller
{
    public function __construct(private TallyImportService $tallyService) {}

    public function testConnection(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $url = CompanySetting::getValue($companyId, 'tally_server_url', 'http://localhost:9000');

        return response()->json($this->tallyService->testConnection($url));
    }

    public function testOdbcConnection(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $url = CompanySetting::getValue($companyId, 'tally_server_url', 'http://localhost:9000');

        return response()->json($this->tallyService->testOdbcConnection($url));
    }

    public function fetchGroups(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $url = CompanySetting::getValue($companyId, 'tally_server_url', 'http://localhost:9000');

        try {
            $groups = $this->tallyService->fetchGroups($url);

            return response()->json(['data' => $groups, 'count' => count($groups)]);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function fetchLedgers(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $url    = CompanySetting::getValue($companyId, 'tally_server_url', 'http://localhost:9000');
        $method = $request->query('connection_method', 'xml'); // 'xml' or 'odbc'

        try {
            $ledgers = $method === 'odbc'
                ? $this->tallyService->fetchLedgersOdbc($url)
                : $this->tallyService->fetchLedgers($url);

            return response()->json(['data' => $ledgers, 'count' => count($ledgers)]);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function importLedgers(Request $request): JsonResponse
    {
        $request->validate([
            'mode'              => 'required|in:live,file',
            'xml_content'       => 'required_if:mode,file|string',
            'connection_method' => 'nullable|in:xml,odbc',
        ]);

        $companyId = $request->user()->company_id;
        $userId    = $request->user()->id;
        $method    = $request->input('connection_method', 'xml');

        try {
            if ($request->mode === 'file') {
                $ledgers = $this->tallyService->parseLedgersXml($request->xml_content);
            } else {
                $url     = CompanySetting::getValue($companyId, 'tally_server_url', 'http://localhost:9000');
                $ledgers = $method === 'odbc'
                    ? $this->tallyService->fetchLedgersOdbc($url)
                    : $this->tallyService->fetchLedgers($url);
            }

            $result = $this->tallyService->importLedgers($companyId, $userId, $ledgers);

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function fetchStockItems(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;
        $url    = CompanySetting::getValue($companyId, 'tally_server_url', 'http://localhost:9000');
        $method = $request->query('connection_method', 'xml');

        try {
            $items = $method === 'odbc'
                ? $this->tallyService->fetchStockItemsOdbc($url)
                : $this->tallyService->fetchStockItems($url);

            return response()->json(['data' => $items, 'count' => count($items)]);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function importStockItems(Request $request): JsonResponse
    {
        $request->validate([
            'mode'              => 'required|in:live,file',
            'xml_content'       => 'required_if:mode,file|string',
            'connection_method' => 'nullable|in:xml,odbc',
        ]);

        $companyId = $request->user()->company_id;
        $userId    = $request->user()->id;
        $method    = $request->input('connection_method', 'xml');

        try {
            if ($request->mode === 'file') {
                $items = $this->tallyService->parseStockItemsXml($request->xml_content);
            } else {
                $url   = CompanySetting::getValue($companyId, 'tally_server_url', 'http://localhost:9000');
                $items = $method === 'odbc'
                    ? $this->tallyService->fetchStockItemsOdbc($url)
                    : $this->tallyService->fetchStockItems($url);
            }

            $result = $this->tallyService->importStockItems($companyId, $userId, $items);

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function importVouchers(Request $request): JsonResponse
    {
        $request->validate([
            'mode'              => 'required|in:live,file',
            'xml_content'       => 'required_if:mode,file|string',
            'date_from'         => 'required_if:mode,live|date',
            'date_to'           => 'required_if:mode,live|date',
            'connection_method' => 'nullable|in:xml,odbc',
        ]);

        $companyId = $request->user()->company_id;
        $userId    = $request->user()->id;
        $method    = $request->input('connection_method', 'xml');

        try {
            if ($request->mode === 'file') {
                $vouchers = $this->tallyService->parseVouchersXml($request->xml_content);
            } else {
                $url      = CompanySetting::getValue($companyId, 'tally_server_url', 'http://localhost:9000');
                $vouchers = $method === 'odbc'
                    ? $this->tallyService->fetchVouchersOdbc($url, $request->date_from, $request->date_to)
                    : $this->tallyService->fetchVouchers($url, $request->date_from, $request->date_to);
            }

            $result = $this->tallyService->importVouchers($companyId, $userId, $vouchers);

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
}
