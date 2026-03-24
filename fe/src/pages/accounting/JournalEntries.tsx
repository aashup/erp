import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { journalEntriesApi } from '@/api/accounting';
import type { JournalEntry } from '@/types';
import { formatDate } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Search } from 'lucide-react';

export default function JournalEntries() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['journal-entries', page, search],
    queryFn: () => journalEntriesApi.list({ page: String(page), search }),
    select: (res) => res.data,
  });

  const columns: ColumnDef<JournalEntry, unknown>[] = [
    { accessorKey: 'voucher_number', header: 'Voucher #' },
    { accessorKey: 'voucher_date', header: 'Date', cell: ({ getValue }) => formatDate(getValue() as string) },
    { accessorKey: 'voucher_type', header: 'Type', cell: ({ getValue }) => <Badge>{getValue() as string}</Badge> },
    { accessorKey: 'narration', header: 'Narration', cell: ({ getValue }) => <span className="truncate max-w-[200px] block">{(getValue() as string) ?? '—'}</span> },
    { accessorKey: 'source', header: 'Source', cell: ({ getValue }) => (getValue() as string) ?? '—' },
    { accessorKey: 'is_posted', header: 'Status', cell: ({ getValue }) => <Badge variant={getValue() ? 'success' : 'warning'}>{getValue() ? 'Posted' : 'Draft'}</Badge> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Journal Entries</h1>
        <Button><Plus className="mr-2 h-4 w-4" /> New Entry</Button>
      </div>
      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none" placeholder="Search voucher..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </CardHeader>
        <DataTable columns={columns} data={data?.data ?? []} loading={isLoading} />
        {data && <Pagination currentPage={data.current_page} lastPage={data.last_page} total={data.total} onPageChange={setPage} />}
      </Card>
    </div>
  );
}
