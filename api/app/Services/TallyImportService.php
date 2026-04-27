<?php

namespace App\Services;

use App\Models\AccountingGroup;
use App\Models\CompanySetting;
use App\Models\FinancialYear;
use App\Models\Item;
use App\Models\ItemGroup;
use App\Models\Ledger;
use App\Models\Party;
use App\Models\Unit;
use App\Models\Voucher;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use SimpleXMLElement;

class TallyImportService
{
    // ─── Connection & Fetch ─────────────────────────────────────────────────

    public function testConnection(string $url): array
    {
        try {
            // Use Day Book — works on Tally Prime and ERP 9; also reveals company name
            $xml = $this->buildXmlRequest('Day Book');
            $response = Http::timeout(5)
                ->withHeaders(['Content-Type' => 'text/xml'])
                ->send('POST', $url, ['body' => $xml]);

            if ($response->successful()) {
                $body = $response->body();
                // Extract company name from Tally Prime response header
                $company = null;
                if (preg_match('/<SVCURRENTCOMPANY>([^<]+)<\/SVCURRENTCOMPANY>/', $body, $m)) {
                    $company = trim($m[1]);
                }
                return [
                    'connected' => true,
                    'url'       => $url,
                    'message'   => 'Connected to Tally successfully',
                    'company'   => $company,
                    'dev'       => ['response_snippet' => substr($body, 0, 200)],
                ];
            }

            return ['connected' => false, 'url' => $url, 'message' => 'Tally returned HTTP ' . $response->status()];
        } catch (\Exception $e) {
            return ['connected' => false, 'url' => $url, 'message' => $e->getMessage()];
        }
    }

    public function fetchGroups(string $url): array
    {
        $xml  = $this->buildXmlRequest('List of Accounts');
        $body = $this->postToTally($url, $xml);

        return $this->parseGroupsXml($body);
    }

    public function fetchLedgers(string $url): array
    {
        // Tally Prime uses "List of Accounts"; ERP 9 used "List of Ledgers"
        $xml = $this->buildXmlRequest('List of Accounts');
        $body = $this->postToTally($url, $xml);

        return $this->parseLedgersXml($body);
    }

    public function fetchStockItems(string $url): array
    {
        // Tally Prime does not expose stock items via HTTP XML export.
        // Use ODBC mode or file upload instead.
        throw new \RuntimeException(
            'Stock item export via XML is not supported in Tally Prime. ' .
            'Use ODBC connection mode or export XML from Tally manually and use File Upload.'
        );
    }

    public function fetchVouchers(string $url, string $dateFrom, string $dateTo): array
    {
        $from = str_replace('-', '', $dateFrom);
        $to = str_replace('-', '', $dateTo);

        $xml = $this->buildXmlRequest('Day Book', [
            'SVFROMDATE' => $from,
            'SVTODATE'   => $to,
        ]);
        $body = $this->postToTally($url, $xml);

        return $this->parseVouchersXml($body);
    }

    // ─── XML Builders ────────────────────────────────────────────────────────

    private function buildXmlRequest(string $reportName, array $staticVars = []): string
    {
        $vars = '<SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>';
        foreach ($staticVars as $tag => $val) {
            $vars .= "<{$tag}>{$val}</{$tag}>";
        }

        return <<<XML
<ENVELOPE>
  <HEADER><TALLYREQUEST>Export Data</TALLYREQUEST></HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>{$reportName}</REPORTNAME>
        <STATICVARIABLES>{$vars}</STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>
XML;
    }

    private function postToTally(string $url, string $xml): string
    {
        $response = Http::timeout(30)
            ->withHeaders(['Content-Type' => 'text/xml'])
            ->send('POST', $url, ['body' => $xml]);

        if (! $response->successful()) {
            throw new \RuntimeException('Tally returned HTTP ' . $response->status());
        }

        return $response->body();
    }

    // ─── ODBC Connection & Fetch ─────────────────────────────────────────────

    /**
     * Parse host and port from a URL like "http://localhost:9000".
     * Returns ['host' => 'localhost', 'port' => 9000].
     */
    private function parseHostPort(string $url): array
    {
        $parts = parse_url($url);
        return [
            'host' => $parts['host'] ?? 'localhost',
            'port' => $parts['port'] ?? 9000,
        ];
    }

    /**
     * Open an ODBC connection to Tally's ODBC server.
     * Requires the Tally ODBC driver to be installed on the PHP host machine.
     * On Windows: Driver={Tally ODBC Driver} or {Tally Prime ODBC Driver}
     * On Linux (unixODBC + FreeTDS bridge): uses a configured DSN.
     */
    private function connectOdbc(string $host, int $port): mixed
    {
        if (! function_exists('odbc_connect')) {
            throw new \RuntimeException('PHP ODBC extension is not available on this server. Install php-odbc and the Tally ODBC driver.');
        }

        // Try Tally Prime driver first, fall back to Tally ERP 9 driver
        $drivers = [
            '{Tally ODBC Driver}',
            '{Tally Prime ODBC Driver}',
        ];

        foreach ($drivers as $driver) {
            $dsn = "Driver={$driver};Server={$host};Port={$port};";
            $conn = @odbc_connect($dsn, '', '', SQL_CUR_USE_ODBC);
            if ($conn !== false) {
                return $conn;
            }
        }

        throw new \RuntimeException('Could not connect to Tally via ODBC. Ensure Tally is running and the ODBC driver is installed.');
    }

    public function testOdbcConnection(string $url): array
    {
        ['host' => $host, 'port' => $port] = $this->parseHostPort($url);
        try {
            $conn = $this->connectOdbc($host, $port);
            // Run a simple query to confirm it works
            $result = @odbc_exec($conn, 'SELECT Name FROM Company');
            odbc_close($conn);
            if ($result !== false) {
                return ['connected' => true, 'url' => $url, 'message' => 'ODBC connection to Tally successful'];
            }

            return ['connected' => false, 'url' => $url, 'message' => 'ODBC connected but query failed'];
        } catch (\Exception $e) {
            return ['connected' => false, 'url' => $url, 'message' => $e->getMessage()];
        }
    }

    public function fetchLedgersOdbc(string $url): array
    {
        ['host' => $host, 'port' => $port] = $this->parseHostPort($url);
        $conn = $this->connectOdbc($host, $port);

        try {
            $sql = 'SELECT Name, Parent, OpeningBalance, GSTRegistrationNumber, LedMobile, Email FROM Ledger';
            $result = odbc_exec($conn, $sql);
            if ($result === false) {
                throw new \RuntimeException('ODBC query failed for Ledger: ' . odbc_errormsg($conn));
            }

            $ledgers = [];
            while ($row = odbc_fetch_array($result)) {
                $ledgers[] = $this->mapOdbcLedgerRow($row);
            }

            return $ledgers;
        } finally {
            odbc_close($conn);
        }
    }

    public function fetchStockItemsOdbc(string $url): array
    {
        ['host' => $host, 'port' => $port] = $this->parseHostPort($url);
        $conn = $this->connectOdbc($host, $port);

        try {
            $sql = 'SELECT Name, Parent, BaseUnits, HSNCode, GSTRate FROM StockItem';
            $result = odbc_exec($conn, $sql);
            if ($result === false) {
                throw new \RuntimeException('ODBC query failed for StockItem: ' . odbc_errormsg($conn));
            }

            $items = [];
            while ($row = odbc_fetch_array($result)) {
                $items[] = $this->mapOdbcStockItemRow($row);
            }

            return $items;
        } finally {
            odbc_close($conn);
        }
    }

    public function fetchVouchersOdbc(string $url, string $dateFrom, string $dateTo): array
    {
        ['host' => $host, 'port' => $port] = $this->parseHostPort($url);
        $conn = $this->connectOdbc($host, $port);

        // Tally ODBC date format: YYYYMMDD
        $from = str_replace('-', '', $dateFrom);
        $to   = str_replace('-', '', $dateTo);

        try {
            $sql = "SELECT Date, VoucherType, VoucherNumber, Narration, LedgerName, Amount
                    FROM DayBook
                    WHERE Date >= '{$from}' AND Date <= '{$to}'
                    ORDER BY Date, VoucherNumber";

            $result = odbc_exec($conn, $sql);
            if ($result === false) {
                throw new \RuntimeException('ODBC query failed for DayBook: ' . odbc_errormsg($conn));
            }

            return $this->groupOdbcVoucherRows($result);
        } finally {
            odbc_close($conn);
        }
    }

    // ─── ODBC Row Mappers ─────────────────────────────────────────────────────

    private function mapOdbcLedgerRow(array $row): array
    {
        $name = trim($row['Name'] ?? $row['NAME'] ?? '');
        $parent = trim($row['Parent'] ?? $row['PARENT'] ?? '');

        // Opening balance: Tally ODBC may return a signed number (negative = credit)
        $rawBalance = $row['OpeningBalance'] ?? $row['OPENINGBALANCE'] ?? '0';
        $rawBalance = str_replace(',', '', (string) $rawBalance);
        $openingBalance = (float) $rawBalance;
        $balanceType = $openingBalance >= 0 ? 'dr' : 'cr';
        $openingBalance = abs($openingBalance);

        $partyType = null;
        if (stripos($parent, 'Sundry Debtor') !== false) {
            $partyType = 'customer';
        } elseif (stripos($parent, 'Sundry Creditor') !== false) {
            $partyType = 'vendor';
        }

        $gstin = trim($row['GSTRegistrationNumber'] ?? $row['GSTREGISTRATIONNUMBER'] ?? $row['GSTIN'] ?? '');
        $phone = trim($row['LedMobile'] ?? $row['LEDMOBILE'] ?? $row['Phone'] ?? '');
        $email = trim($row['Email'] ?? $row['EMAIL'] ?? '');

        return [
            'name'            => $name,
            'parent'          => $parent,
            'gstin'           => $gstin ?: null,
            'phone'           => $phone ?: null,
            'email'           => $email ?: null,
            'opening_balance' => $openingBalance,
            'balance_type'    => $balanceType,
            'party_type'      => $partyType,
        ];
    }

    private function mapOdbcStockItemRow(array $row): array
    {
        $igst = (float) ($row['GSTRate'] ?? $row['GSTRATE'] ?? 0);

        return [
            'name'     => trim($row['Name'] ?? $row['NAME'] ?? ''),
            'parent'   => trim($row['Parent'] ?? $row['PARENT'] ?? '') ?: 'General',
            'unit'     => strtoupper(trim($row['BaseUnits'] ?? $row['BASEUNITS'] ?? 'PCS')),
            'hsn_code' => trim($row['HSNCode'] ?? $row['HSNCODE'] ?? '') ?: null,
            'igst'     => $igst,
            'cgst'     => round($igst / 2, 2),
            'sgst'     => round($igst / 2, 2),
        ];
    }

    /**
     * Group flat DayBook ODBC rows (one row per ledger entry) into vouchers.
     * Each unique VoucherNumber+Date combination becomes one voucher with multiple lines.
     */
    private function groupOdbcVoucherRows(mixed $result): array
    {
        $typeMap = [
            'sales'       => 'sales',
            'purchase'    => 'purchase',
            'payment'     => 'payment',
            'receipt'     => 'receipt',
            'journal'     => 'journal',
            'contra'      => 'contra',
            'debit note'  => 'journal',
            'credit note' => 'journal',
        ];

        $grouped = [];
        while ($row = odbc_fetch_array($result)) {
            $dateRaw = trim($row['Date'] ?? $row['DATE'] ?? '');
            // Handle both YYYYMMDD and DD/MM/YYYY formats
            if (strlen($dateRaw) === 8 && ctype_digit($dateRaw)) {
                $date = substr($dateRaw, 0, 4) . '-' . substr($dateRaw, 4, 2) . '-' . substr($dateRaw, 6, 2);
            } elseif (preg_match('#^(\d{2})/(\d{2})/(\d{4})$#', $dateRaw, $m)) {
                $date = "{$m[3]}-{$m[2]}-{$m[1]}";
            } else {
                $date = $dateRaw;
            }

            $vchType  = strtolower(trim($row['VoucherType'] ?? $row['VOUCHERTYPE'] ?? 'journal'));
            $number   = trim($row['VoucherNumber'] ?? $row['VOUCHERNUMBER'] ?? '');
            $key      = $date . '||' . $number;

            if (! isset($grouped[$key])) {
                $grouped[$key] = [
                    'vch_type'  => $typeMap[$vchType] ?? 'journal',
                    'date'      => $date,
                    'number'    => $number,
                    'narration' => trim($row['Narration'] ?? $row['NARRATION'] ?? ''),
                    'lines'     => [],
                ];
            }

            $ledgerName = trim($row['LedgerName'] ?? $row['LEDGERNAME'] ?? '');
            $amount     = (float) str_replace(',', '', (string) ($row['Amount'] ?? $row['AMOUNT'] ?? 0));

            if ($ledgerName !== '') {
                $grouped[$key]['lines'][] = [
                    'ledger_name' => $ledgerName,
                    'debit'       => $amount > 0 ? round($amount, 2) : 0,
                    'credit'      => $amount < 0 ? round(abs($amount), 2) : 0,
                ];
            }
        }

        // Filter out vouchers with fewer than 2 lines
        return array_values(array_filter($grouped, fn ($v) => count($v['lines']) >= 2));
    }

    // ─── XML Parsers ─────────────────────────────────────────────────────────

    /**
     * Tally XML contains &#N; references to control characters (e.g. &#4;)
     * which are invalid in XML 1.0. Strip them before parsing.
     */
    private function sanitizeXml(string $xml): string
    {
        // Replace &#N; where N is a control char (< 32) except tab(9), LF(10), CR(13)
        return preg_replace_callback('/&#(\d+);/', function ($m) {
            $code = (int) $m[1];
            return ($code < 32 && ! in_array($code, [9, 10, 13])) ? '' : $m[0];
        }, $xml);
    }

    public function parseGroupsXml(string $xmlString): array
    {
        libxml_use_internal_errors(true);
        $xml = simplexml_load_string($this->sanitizeXml($xmlString), 'SimpleXMLElement', LIBXML_NOCDATA);

        if ($xml === false) {
            throw new \RuntimeException('Invalid XML received from Tally');
        }

        $groupNodes = [];

        // Tally Prime: BODY > IMPORTDATA > REQUESTDATA > TALLYMESSAGE (one GROUP per message)
        $messages = $xml->BODY->IMPORTDATA->REQUESTDATA->TALLYMESSAGE ?? null;
        if ($messages && count($messages) > 0) {
            foreach ($messages as $msg) {
                foreach ($msg->GROUP as $g) {
                    $groupNodes[] = $g;
                }
            }
        }

        // ERP 9 fallback
        if (empty($groupNodes)) {
            foreach ($xml->BODY->DATA->TALLYMESSAGE->GROUP ?? [] as $g) {
                $groupNodes[] = $g;
            }
        }

        $groups = [];
        foreach ($groupNodes as $group) {
            $name = trim((string) ($group['NAME'] ?? ''));
            if ($name === '') {
                continue;
            }

            $parent = trim((string) ($group->PARENT ?? '')) ?: null;

            $groups[] = [
                'name'   => html_entity_decode($name,   ENT_XML1 | ENT_QUOTES, 'UTF-8'),
                'parent' => $parent ? html_entity_decode($parent, ENT_XML1 | ENT_QUOTES, 'UTF-8') : null,
            ];
        }

        // Build tree: attach children to parents
        $map = [];
        foreach ($groups as &$g) {
            $map[$g['name']] = &$g;
            $g['children']   = [];
        }
        unset($g);

        $roots = [];
        foreach ($groups as &$g) {
            if ($g['parent'] !== null && isset($map[$g['parent']])) {
                $map[$g['parent']]['children'][] = &$g;
            } else {
                $roots[] = &$g;
            }
        }
        unset($g);

        return $roots;
    }

    public function parseLedgersXml(string $xmlString): array
    {
        libxml_use_internal_errors(true);
        $xml = simplexml_load_string($this->sanitizeXml($xmlString), 'SimpleXMLElement', LIBXML_NOCDATA);

        if ($xml === false) {
            throw new \RuntimeException('Invalid XML received from Tally');
        }

        $ledgerNodes = [];

        // Tally Prime: BODY > IMPORTDATA > REQUESTDATA > TALLYMESSAGE (one LEDGER per message)
        $messages = $xml->BODY->IMPORTDATA->REQUESTDATA->TALLYMESSAGE ?? null;
        if ($messages && count($messages) > 0) {
            foreach ($messages as $msg) {
                foreach ($msg->LEDGER as $l) {
                    $ledgerNodes[] = $l;
                }
            }
        }

        // Tally ERP 9 fallback: BODY > DATA > TALLYMESSAGE > LEDGER (all in one message)
        if (empty($ledgerNodes)) {
            $nodes = $xml->BODY->DATA->TALLYMESSAGE->LEDGER ?? [];
            foreach ($nodes as $l) {
                $ledgerNodes[] = $l;
            }
        }
        if (empty($ledgerNodes)) {
            $nodes = $xml->BODY->DATA->COLLECTION->LEDGER ?? [];
            foreach ($nodes as $l) {
                $ledgerNodes[] = $l;
            }
        }

        $ledgers = [];
        foreach ($ledgerNodes as $ledger) {
            $name = trim((string) ($ledger['NAME'] ?? ''));
            if ($name === '') {
                continue;
            }

            $parent     = trim((string) ($ledger->PARENT ?? ''));
            $openingRaw = trim((string) ($ledger->OPENINGBALANCE ?? ''));

            $openingBalance = 0.0;
            $balanceType    = 'dr';
            if (preg_match('/^(-?[\d.,]+)\s*(Dr|Cr)?/i', str_replace(',', '', $openingRaw), $m)) {
                $openingBalance = abs((float) $m[1]);
                $balanceType    = strtolower($m[2] ?? 'dr') ?: 'dr';
                if ((float) $m[1] < 0) {
                    $balanceType = 'cr';
                }
            }

            $partyType = null;
            if (stripos($parent, 'Sundry Debtor') !== false) {
                $partyType = 'customer';
            } elseif (stripos($parent, 'Sundry Creditor') !== false) {
                $partyType = 'vendor';
            }

            // Tally Prime uses LEDGSTIN; ERP 9 uses PARTYGSTIN / GSTREGISTRATIONNUMBER
            $gstin = trim((string) ($ledger->LEDGSTIN ?? $ledger->PARTYGSTIN ?? $ledger->GSTREGISTRATIONNUMBER ?? ''));
            // Tally Prime uses LEDGERMOBILE; ERP 9 uses LEDMOBILE / PHONENUMBER
            $phone = trim((string) ($ledger->LEDGERMOBILE ?? $ledger->LEDMOBILE ?? $ledger->PHONENUMBER ?? ''));
            $email = trim((string) ($ledger->EMAIL ?? $ledger->EMAILID ?? ''));

            $ledgers[] = [
                'name'            => $name,
                'parent'          => $parent,
                'gstin'           => $gstin ?: null,
                'phone'           => $phone ?: null,
                'email'           => $email ?: null,
                'opening_balance' => $openingBalance,
                'balance_type'    => $balanceType,
                'party_type'      => $partyType,
            ];
        }

        return $ledgers;
    }

    public function parseStockItemsXml(string $xmlString): array
    {
        libxml_use_internal_errors(true);
        $xml = simplexml_load_string($this->sanitizeXml($xmlString), 'SimpleXMLElement', LIBXML_NOCDATA);

        if ($xml === false) {
            throw new \RuntimeException('Invalid XML received from Tally');
        }

        $itemNodes = [];

        // Tally Prime: multiple TALLYMESSAGE, one STOCKITEM per message
        $messages = $xml->BODY->IMPORTDATA->REQUESTDATA->TALLYMESSAGE ?? null;
        if ($messages && count($messages) > 0) {
            foreach ($messages as $msg) {
                foreach ($msg->STOCKITEM as $i) {
                    $itemNodes[] = $i;
                }
            }
        }

        // ERP 9 fallback: single TALLYMESSAGE or COLLECTION with multiple STOCKITEMs
        if (empty($itemNodes)) {
            $nodes = $xml->BODY->DATA->TALLYMESSAGE->STOCKITEM ?? [];
            foreach ($nodes as $i) { $itemNodes[] = $i; }
        }
        if (empty($itemNodes)) {
            $nodes = $xml->BODY->DATA->COLLECTION->STOCKITEM ?? [];
            foreach ($nodes as $i) { $itemNodes[] = $i; }
        }

        $items = [];
        foreach ($itemNodes as $item) {
            $name = trim((string) ($item['NAME'] ?? ''));
            if ($name === '') {
                continue;
            }

            $parent = trim((string) ($item->PARENT ?? '')) ?: 'General';
            $baseUnit = strtoupper(trim((string) ($item->BASEUNITS ?? ''))) ?: 'PCS';
            $hsn = trim((string) ($item->HSNCODE ?? $item->HSNDETAILS->HSNDETAIL->HSNCODE ?? '')) ?: null;

            $igst = 0.0;
            $gstDetails = $item->{'GSTDETAILS.LIST'} ?? null;
            if ($gstDetails) {
                $classfn = (string) ($gstDetails->CLASSIFICATIONOFGOODS ?? $gstDetails->GSTCLASSIFICATION ?? '');
                if (preg_match('/GST\s*(\d+)/i', $classfn, $m)) {
                    $igst = (float) $m[1];
                }
                // Also check GSTRATE directly
                if ($igst === 0.0) {
                    $rate = trim((string) ($gstDetails->GSTRATE ?? ''));
                    if ($rate !== '' && is_numeric($rate)) {
                        $igst = (float) $rate;
                    }
                }
            }

            $items[] = [
                'name'     => $name,
                'parent'   => $parent,
                'unit'     => $baseUnit,
                'hsn_code' => $hsn,
                'igst'     => $igst,
                'cgst'     => round($igst / 2, 2),
                'sgst'     => round($igst / 2, 2),
            ];
        }

        return $items;
    }

    public function parseVouchersXml(string $xmlString): array
    {
        libxml_use_internal_errors(true);
        $xml = simplexml_load_string($this->sanitizeXml($xmlString), 'SimpleXMLElement', LIBXML_NOCDATA);

        if ($xml === false) {
            throw new \RuntimeException('Invalid XML received from Tally');
        }

        $typeMap = [
            'sales'       => 'sales',
            'purchase'    => 'purchase',
            'payment'     => 'payment',
            'receipt'     => 'receipt',
            'journal'     => 'journal',
            'contra'      => 'contra',
            'debit note'  => 'journal',
            'credit note' => 'journal',
        ];

        $voucherNodes = [];

        // Tally Prime: BODY > IMPORTDATA > REQUESTDATA > TALLYMESSAGE (one VOUCHER per message)
        $messages = $xml->BODY->IMPORTDATA->REQUESTDATA->TALLYMESSAGE ?? null;
        if ($messages && count($messages) > 0) {
            foreach ($messages as $msg) {
                foreach ($msg->VOUCHER as $v) {
                    $voucherNodes[] = $v;
                }
            }
        }

        // ERP 9 fallback
        if (empty($voucherNodes)) {
            $nodes = $xml->BODY->DATA->TALLYMESSAGE->VOUCHER ?? [];
            foreach ($nodes as $v) { $voucherNodes[] = $v; }
        }
        if (empty($voucherNodes)) {
            $nodes = $xml->BODY->DATA->COLLECTION->VOUCHER ?? [];
            foreach ($nodes as $v) { $voucherNodes[] = $v; }
        }

        $vouchers = [];
        foreach ($voucherNodes as $v) {
            $vchType = strtolower(trim((string) ($v['VCHTYPE'] ?? '')));
            $erpType = $typeMap[$vchType] ?? 'journal';

            $dateRaw = trim((string) ($v->DATE ?? ''));
            $date = strlen($dateRaw) === 8
                ? substr($dateRaw, 0, 4) . '-' . substr($dateRaw, 4, 2) . '-' . substr($dateRaw, 6, 2)
                : $dateRaw;

            $number    = trim((string) ($v->VOUCHERNUMBER ?? ''));
            $narration = trim((string) ($v->NARRATION ?? ''));

            $lines      = [];
            $entryNodes = $v->{'ALLLEDGERENTRIES.LIST'} ?? [];
            if (empty((array) $entryNodes)) {
                $entryNodes = $v->{'LEDGERENTRIES.LIST'} ?? [];
            }

            foreach ($entryNodes as $entry) {
                $ledgerName = trim((string) ($entry->LEDGERNAME ?? ''));
                if ($ledgerName === '') {
                    continue;
                }
                $amount = (float) str_replace(',', '', (string) ($entry->AMOUNT ?? 0));
                // Tally Prime sign convention: negative amount = Debit, positive amount = Credit
                $lines[] = [
                    'ledger_name' => $ledgerName,
                    'debit'       => $amount < 0 ? round(abs($amount), 2) : 0,
                    'credit'      => $amount > 0 ? round($amount, 2) : 0,
                ];
            }

            if (count($lines) < 2) {
                continue;
            }

            $vouchers[] = [
                'vch_type'  => $erpType,
                'date'      => $date,
                'number'    => $number,
                'narration' => $narration,
                'lines'     => $lines,
            ];
        }

        return $vouchers;
    }

    // ─── Import Methods ──────────────────────────────────────────────────────

    public function importLedgers(string $companyId, string $userId, array $ledgers): array
    {
        $result = ['created' => 0, 'skipped' => 0, 'failed' => 0, 'errors' => [], 'created_names' => []];

        // Pre-load existing names for duplicate detection
        $existingParties = Party::where('company_id', $companyId)
            ->pluck('name')
            ->map(fn ($n) => mb_strtolower($n))
            ->flip()
            ->toArray();

        $existingLedgers = Ledger::where('company_id', $companyId)
            ->pluck('name')
            ->map(fn ($n) => mb_strtolower($n))
            ->flip()
            ->toArray();

        foreach ($ledgers as $ledger) {
            $nameKey = mb_strtolower($ledger['name']);

            if ($ledger['party_type'] !== null) {
                // Party (customer or vendor)
                if (isset($existingParties[$nameKey])) {
                    $result['skipped']++;
                    continue;
                }

                DB::beginTransaction();
                try {
                    $gstin = $ledger['gstin'];
                    if ($gstin && strlen($gstin) !== 15) {
                        $gstin = null;
                    }

                    $phone = $ledger['phone'] ? substr(preg_replace('/[^0-9+]/', '', $ledger['phone']), 0, 15) : null;
                    $email = ($ledger['email'] && filter_var($ledger['email'], FILTER_VALIDATE_EMAIL))
                        ? $ledger['email']
                        : null;

                    Party::create([
                        'company_id'      => $companyId,
                        'type'            => $ledger['party_type'],
                        'name'            => $ledger['name'],
                        'gstin'           => $gstin,
                        'phone'           => $phone,
                        'email'           => $email,
                        'opening_balance' => $ledger['opening_balance'],
                        'balance_type'    => $ledger['balance_type'],
                        'is_active'       => true,
                    ]);

                    DB::commit();
                    $result['created']++;
                    $result['created_names'][] = $ledger['name'];
                    $existingParties[$nameKey] = true;
                } catch (\Exception $e) {
                    DB::rollBack();
                    $result['failed']++;
                    $result['errors'][] = ['entity' => 'Party', 'name' => $ledger['name'], 'reason' => $e->getMessage()];
                }
            } else {
                // Pure accounting ledger
                if (isset($existingLedgers[$nameKey])) {
                    $result['skipped']++;
                    continue;
                }

                DB::beginTransaction();
                try {
                    $group = AccountingGroup::where('company_id', $companyId)
                        ->whereRaw('LOWER(name) = ?', [mb_strtolower($ledger['parent'])])
                        ->first();

                    if (! $group) {
                        $result['failed']++;
                        $result['errors'][] = [
                            'entity' => 'Ledger',
                            'name'   => $ledger['name'],
                            'reason' => "Parent group '{$ledger['parent']}' not found. Load default account groups first.",
                        ];
                        DB::rollBack();
                        continue;
                    }

                    Ledger::create([
                        'company_id'         => $companyId,
                        'name'               => $ledger['name'],
                        'group_id'           => $group->id,
                        'opening_balance'    => $ledger['opening_balance'],
                        'opening_type'       => $ledger['balance_type'],
                        'is_system'          => false,
                        'allow_manual_entry' => true,
                        'created_by'         => $userId,
                        'updated_by'         => $userId,
                    ]);

                    DB::commit();
                    $result['created']++;
                    $result['created_names'][] = $ledger['name'];
                    $existingLedgers[$nameKey] = true;
                } catch (\Exception $e) {
                    DB::rollBack();
                    $result['failed']++;
                    $result['errors'][] = ['entity' => 'Ledger', 'name' => $ledger['name'], 'reason' => $e->getMessage()];
                }
            }
        }

        $result['created_names'] = array_slice($result['created_names'], 0, 50);

        return $result;
    }

    public function importStockItems(string $companyId, string $userId, array $items): array
    {
        $result = ['created' => 0, 'skipped' => 0, 'failed' => 0, 'errors' => [], 'created_names' => []];

        $existingItems = Item::where('company_id', $companyId)
            ->pluck('name')
            ->map(fn ($n) => mb_strtolower($n))
            ->flip()
            ->toArray();

        $existingGroups = ItemGroup::where('company_id', $companyId)
            ->get()
            ->keyBy(fn ($g) => mb_strtolower($g->name));

        $existingUnits = Unit::where('company_id', $companyId)
            ->get()
            ->keyBy(fn ($u) => strtoupper($u->value));

        foreach ($items as $item) {
            $nameKey = mb_strtolower($item['name']);
            if (isset($existingItems[$nameKey])) {
                $result['skipped']++;
                continue;
            }

            DB::beginTransaction();
            try {
                // Ensure ItemGroup exists
                $groupKey = mb_strtolower($item['parent']);
                if (! isset($existingGroups[$groupKey])) {
                    $group = ItemGroup::create([
                        'company_id' => $companyId,
                        'name'       => $item['parent'],
                        'is_active'  => true,
                    ]);
                    $existingGroups[$groupKey] = $group;
                } else {
                    $group = $existingGroups[$groupKey];
                }

                // Ensure Unit exists
                $unitValue = strtoupper($item['unit']);
                if (! isset($existingUnits[$unitValue])) {
                    $unit = Unit::create([
                        'company_id' => $companyId,
                        'value'      => $unitValue,
                        'label'      => ucfirst(strtolower($unitValue)),
                        'status'     => 'active',
                    ]);
                    $existingUnits[$unitValue] = $unit;
                }

                Item::create([
                    'company_id'    => $companyId,
                    'item_group_id' => $group->id,
                    'name'          => $item['name'],
                    'unit'          => $unitValue,
                    'hsn_code'      => $item['hsn_code'],
                    'igst'          => $item['igst'],
                    'cgst'          => $item['cgst'],
                    'sgst'          => $item['sgst'],
                    'is_active'     => true,
                ]);

                DB::commit();
                $result['created']++;
                $result['created_names'][] = $item['name'];
                $existingItems[$nameKey] = true;
            } catch (\Exception $e) {
                DB::rollBack();
                $result['failed']++;
                $result['errors'][] = ['entity' => 'Item', 'name' => $item['name'], 'reason' => $e->getMessage()];
            }
        }

        $result['created_names'] = array_slice($result['created_names'], 0, 50);

        return $result;
    }

    public function importVouchers(string $companyId, string $userId, array $vouchers): array
    {
        $result = ['created' => 0, 'skipped' => 0, 'failed' => 0, 'errors' => [], 'created_names' => []];

        // Pre-load all ledgers for this company
        $ledgerMap = Ledger::where('company_id', $companyId)
            ->get()
            ->keyBy(fn ($l) => mb_strtolower($l->name));

        $currentFY = FinancialYear::where('company_id', $companyId)
            ->where('is_current', true)
            ->first();

        if (! $currentFY) {
            return array_merge($result, [
                'failed' => count($vouchers),
                'errors' => [['entity' => 'Voucher', 'name' => 'ALL', 'reason' => 'No current financial year configured.']],
            ]);
        }

        foreach ($vouchers as $vch) {
            DB::beginTransaction();
            try {
                $lines = [];
                $totalDebit = 0;
                $totalCredit = 0;
                $unresolved = [];

                foreach ($vch['lines'] as $line) {
                    $key = mb_strtolower($line['ledger_name']);
                    if (! isset($ledgerMap[$key])) {
                        $unresolved[] = $line['ledger_name'];
                        continue;
                    }
                    $lines[] = [
                        'ledger_id' => $ledgerMap[$key]->id,
                        'debit'     => $line['debit'],
                        'credit'    => $line['credit'],
                        'narration' => $vch['narration'] ?: null,
                    ];
                    $totalDebit += $line['debit'];
                    $totalCredit += $line['credit'];
                }

                if (! empty($unresolved)) {
                    throw new \RuntimeException('Unresolved ledgers: ' . implode(', ', array_unique($unresolved)) . '. Import Masters first.');
                }

                if (count($lines) < 2) {
                    throw new \RuntimeException('Voucher has fewer than 2 resolvable lines.');
                }

                if (abs($totalDebit - $totalCredit) > 0.02) {
                    throw new \RuntimeException("Does not balance: Dr={$totalDebit} Cr={$totalCredit}");
                }

                $voucherNumber = $this->generateVoucherNumber($companyId, $vch['vch_type']);

                $voucher = Voucher::create([
                    'company_id'        => $companyId,
                    'financial_year_id' => $currentFY->id,
                    'voucher_number'    => $voucherNumber,
                    'voucher_date'      => $vch['date'],
                    'voucher_type'      => $vch['vch_type'],
                    'narration'         => $vch['narration'] ?: null,
                    'source'            => 'tally_import',
                    'is_posted'         => true,
                    'created_by'        => $userId,
                ]);

                foreach ($lines as $line) {
                    $voucher->lines()->create($line);
                }

                DB::commit();
                $result['created']++;
                $result['created_names'][] = $vch['number'] ?: $voucherNumber;
            } catch (\Exception $e) {
                DB::rollBack();
                $result['failed']++;
                $result['errors'][] = [
                    'entity' => 'Voucher',
                    'name'   => $vch['number'] ?: ($vch['date'] ?? '?'),
                    'reason' => $e->getMessage(),
                ];
            }
        }

        $result['created_names'] = array_slice($result['created_names'], 0, 50);

        return $result;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function generateVoucherNumber(string $companyId, string $type): string
    {
        $next = CompanySetting::getAndIncrementVoucherIndex($companyId, $type);
        $prefix = Voucher::getTypePrefix($type);

        return $prefix . '-' . str_pad($next, 5, '0', STR_PAD_LEFT);
    }
}
