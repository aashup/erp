import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export default function Settings() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><h3 className="text-lg font-semibold">Company Info</h3></CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Company</dt>
                <dd className="text-sm font-medium">{user?.company?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">GSTIN</dt>
                <dd className="text-sm font-medium">{user?.company?.gstin ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">State</dt>
                <dd className="text-sm font-medium">{user?.company?.state ?? '—'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h3 className="text-lg font-semibold">Your Profile</h3></CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Name</dt>
                <dd className="text-sm font-medium">{user?.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Email</dt>
                <dd className="text-sm font-medium">{user?.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Role</dt>
                <dd><Badge variant="info">{user?.role}</Badge></dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
