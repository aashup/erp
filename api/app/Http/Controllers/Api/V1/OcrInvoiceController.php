<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CompanySetting;
use App\Models\OcrInvoiceLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class OcrInvoiceController extends Controller
{
    public function scan(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->hasPermissionTo('purchase.create')) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'image' => 'required|file|mimetypes:image/jpeg,image/png,image/webp|max:10240',
        ]);

        $companyId = $user->company_id;
        $apiKey    = CompanySetting::getValue($companyId, 'ocr_api_key');
        $model     = CompanySetting::getValue($companyId, 'ocr_model', 'gpt-4o');
        $provider  = CompanySetting::getValue($companyId, 'ocr_provider', 'openai');

        if (empty($apiKey)) {
            return response()->json([
                'message' => 'OCR API key not configured. Go to Settings → Base and add your OpenAI API key.',
            ], 422);
        }

        // Store the uploaded image
        $file      = $request->file('image');
        $extension = $file->getClientOriginalExtension() ?: 'jpg';
        $filename  = Str::uuid() . '.' . $extension;
        $path      = $file->storeAs('ocr', $filename, 'local');

        // Base64 encode for OpenAI Vision
        $imageData = base64_encode(file_get_contents(Storage::disk('local')->path($path)));
        $mimeType  = $file->getMimeType();

        // Create the log record (initially as failed; updated after API call)
        $log = OcrInvoiceLog::create([
            'image_path' => $path,
            'provider'   => $provider,
            'model'      => $model,
            'status'     => 'failed',
            'created_by' => $user->id,
        ]);

        try {
            $requestBody = [
                'model'      => $model,
                'max_tokens' => 2000,
                'messages'   => [
                    [
                        'role'    => 'user',
                        'content' => [
                            [
                                'type'      => 'image_url',
                                'image_url' => [
                                    'url'    => "data:{$mimeType};base64,{$imageData}",
                                    'detail' => 'high',
                                ],
                            ],
                            [
                                'type' => 'text',
                                'text' => self::buildPrompt(),
                            ],
                        ],
                    ],
                ],
            ];

            // json_object response_format is only supported on gpt-4o, not gpt-4-vision-preview
            if ($model === 'gpt-4o') {
                $requestBody['response_format'] = ['type' => 'json_object'];
            }

            $response = Http::withToken($apiKey)
                ->timeout(60)
                ->post('https://api.openai.com/v1/chat/completions', $requestBody);

            if (! $response->successful()) {
                $log->update([
                    'raw_response'  => $response->json(),
                    'status'        => 'failed',
                    'error_message' => 'OpenAI API returned HTTP ' . $response->status(),
                ]);

                return response()->json([
                    'message' => 'OCR service error. Please check your API key and try again.',
                ], 502);
            }

            $rawJson = $response->json();
            $content = $rawJson['choices'][0]['message']['content'] ?? null;

            // Strip markdown fences if present (can happen with gpt-4-vision-preview)
            if ($content) {
                $content = preg_replace('/^```(?:json)?\s*|\s*```$/s', '', trim($content));
            }

            $extracted = $content ? json_decode($content, true) : null;

            $status = 'failed';
            if ($extracted && is_array($extracted)) {
                $hasCritical = ! empty($extracted['invoice_date']) || ! empty($extracted['items']);
                $status      = $hasCritical ? 'success' : 'partial';
            }

            $log->update([
                'raw_response'   => $rawJson,
                'extracted_data' => $extracted,
                'status'         => $status,
            ]);

            return response()->json([
                'log_id'         => $log->id,
                'extracted_data' => $extracted,
                'status'         => $status,
            ]);

        } catch (\Exception $e) {
            $log->update([
                'status'        => 'failed',
                'error_message' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'OCR request failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    private static function buildPrompt(): string
    {
        return <<<'PROMPT'
You are a purchase invoice data extraction assistant. Extract all data from this invoice image and return it as a JSON object with this exact structure:

{
  "vendor_name": "string or null",
  "vendor_gstin": "string or null",
  "vendor_invoice_number": "string or null",
  "invoice_date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "is_inter_state": true or false,
  "items": [
    {
      "item_name": "string",
      "hsn_code": "string or null",
      "quantity": number,
      "rate": number,
      "discount_percent": number (0 if none),
      "gst_rate": number (total GST as percentage, e.g. 12 for 12%)
    }
  ],
  "total_amount": number or null,
  "grand_total": number or null,
  "notes": "string or null",
  "warnings": ["list any fields that were unclear, missing, or uncertain"]
}

Rules:
- All dates must be in YYYY-MM-DD format. If year is ambiguous, assume the most recent plausible year.
- Monetary values must be plain numbers (no currency symbols or commas).
- GST rate should be the total GST percentage. If CGST 6% + SGST 6% are shown, return gst_rate as 12.
- is_inter_state is true if IGST is charged, false if CGST+SGST are charged. Default to false if unclear.
- If a field cannot be found or is unclear, use null. Do not guess critical values.
- items array must contain at least one entry if any line items are visible in the invoice.
- Return only valid JSON with no markdown code fences or extra text.
PROMPT;
    }
}
