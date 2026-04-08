import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/Input';
import { SlideSelect } from '@/components/ui/SlideSelect';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { INDIAN_STATES } from '@/lib/constants';

const schema = z
  .object({
    company_name: z.string().min(1, 'Company name is required'),
    gstin: z.string().length(15, 'GSTIN must be 15 characters').optional().or(z.literal('')),
    state_code: z.string().min(1, 'State is required'),
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    phone: z.string().optional(),
    password: z.string().min(8, 'Minimum 8 characters'),
    password_confirmation: z.string(),
  })
  .refine((d) => d.password === d.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
  });

type FormData = z.infer<typeof schema>;

export default function Register() {
  usePageTitle('Register');
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      const stateObj = INDIAN_STATES.find((s) => s.value === data.state_code);
      // Extract state name without the code (e.g., "Jammu & Kashmir (01)" -> "Jammu & Kashmir")
      const stateName = stateObj?.label?.replace(/\s*\(\d+\)\s*$/, '') ?? '';
      const res = await authApi.register({
        ...data,
        state: stateName,
        gstin: data.gstin || undefined,
      });
      setAuth(res.data.data.user, res.data.data.token);
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message ?? 'Registration failed');
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white text-center">Create Account</h2>

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-400">{error}</div>
          )}

          <Input
            id="company_name"
            label="Company Name"
            placeholder="Your Business Name"
            error={errors.company_name?.message}
            {...register('company_name')}
          />

          <Input
            id="gstin"
            label="GSTIN (Optional)"
            placeholder="22AAAAA0000A1Z5"
            error={errors.gstin?.message}
            {...register('gstin')}
          />

          <SlideSelect
            name="state_code"
            label="State"
            placeholder="Select state"
            panelTitle="Select State"
            options={INDIAN_STATES}
            value={watch('state_code')}
            onChange={(val) => setValue('state_code', val, { shouldValidate: true })}
            error={errors.state_code?.message}
          />

          <Input
            id="name"
            label="Your Name"
            placeholder="Full name"
            error={errors.name?.message}
            {...register('name')}
          />

          <Input
            id="email"
            label="Email"
            type="email"
            placeholder="you@company.com"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            id="phone"
            label="Phone (Optional)"
            placeholder="9876543210"
            error={errors.phone?.message}
            {...register('phone')}
          />

          <Input
            id="password"
            label="Password"
            type="password"
            placeholder="Min 8 characters"
            error={errors.password?.message}
            {...register('password')}
          />

          <Input
            id="password_confirmation"
            label="Confirm Password"
            type="password"
            placeholder="Re-enter password"
            error={errors.password_confirmation?.message}
            {...register('password_confirmation')}
          />

          <Button type="submit" className="w-full" loading={isSubmitting}>
            Register
          </Button>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium">
              Sign In
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
