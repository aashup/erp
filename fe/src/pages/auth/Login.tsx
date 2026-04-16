import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { bootstrapAllData } from '@/lib/sync';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

export default function Login() {
  usePageTitle('Login');
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      const res = await authApi.login({
        ...data,
        device_name: navigator.userAgent,
      });
      // Merge permissions from response into user object
      const userWithPermissions = {
        ...res.data.data.user,
        permissions: res.data.data.permissions,
      };
      setAuth(userWithPermissions, res.data.data.token);

      // Bootstrap — download all company data into IndexedDB for offline use
      setIsSyncing(true);
      try {
        await bootstrapAllData();
      } catch {
        // Offline on first login or server error — sync will run automatically when online
      } finally {
        setIsSyncing(false);
      }

      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message ?? 'Login failed');
    }
  };

  const busy = isSubmitting || isSyncing;

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white text-center">Sign In</h2>

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-400">{error}</div>
          )}

          <Input
            id="email"
            label="Email"
            type="email"
            placeholder="you@company.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            id="password"
            label="Password"
            type="password"
            placeholder="Enter password"
            error={errors.password?.message}
            {...register('password')}
          />

          <Button type="submit" className="w-full" loading={busy}>
            {isSyncing ? 'Syncing your data…' : 'Sign In'}
          </Button>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium">
              Register
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
