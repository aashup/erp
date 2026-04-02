import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

const INDIAN_STATES = [
  { value: '01', label: 'Jammu & Kashmir' },
  { value: '02', label: 'Himachal Pradesh' },
  { value: '03', label: 'Punjab' },
  { value: '05', label: 'Uttarakhand' },
  { value: '06', label: 'Haryana' },
  { value: '07', label: 'Delhi' },
  { value: '08', label: 'Rajasthan' },
  { value: '09', label: 'Uttar Pradesh' },
  { value: '10', label: 'Bihar' },
  { value: '12', label: 'Arunachal Pradesh' },
  { value: '18', label: 'Assam' },
  { value: '19', label: 'West Bengal' },
  { value: '20', label: 'Jharkhand' },
  { value: '21', label: 'Odisha' },
  { value: '22', label: 'Chattisgarh' },
  { value: '23', label: 'Madhya Pradesh' },
  { value: '24', label: 'Gujarat' },
  { value: '27', label: 'Maharashtra' },
  { value: '29', label: 'Karnataka' },
  { value: '30', label: 'Goa' },
  { value: '32', label: 'Kerala' },
  { value: '33', label: 'Tamil Nadu' },
  { value: '36', label: 'Telangana' },
  { value: '37', label: 'Andhra Pradesh' },
];

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
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      const state = INDIAN_STATES.find((s) => s.value === data.state_code);
      const res = await authApi.register({
        ...data,
        state: state?.label ?? '',
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

          <Select
            id="state_code"
            label="State"
            options={INDIAN_STATES}
            placeholder="Select state"
            error={errors.state_code?.message}
            {...register('state_code')}
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
