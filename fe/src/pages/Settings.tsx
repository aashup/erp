import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import api from '@/lib/axios';
import { invoiceTemplatesApi, companySettingsApi } from '@/api/settings';
import type { User } from '@/types';
import { Pencil, Sun, Moon, FileText, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const INDIAN_STATES = [
  { value: '01', label: 'Jammu & Kashmir (01)' },
  { value: '02', label: 'Himachal Pradesh (02)' },
  { value: '03', label: 'Punjab (03)' },
  { value: '05', label: 'Uttarakhand (05)' },
  { value: '06', label: 'Haryana (06)' },
  { value: '07', label: 'Delhi (07)' },
  { value: '08', label: 'Rajasthan (08)' },
  { value: '09', label: 'Uttar Pradesh (09)' },
  { value: '10', label: 'Bihar (10)' },
  { value: '18', label: 'Assam (18)' },
  { value: '19', label: 'West Bengal (19)' },
  { value: '21', label: 'Odisha (21)' },
  { value: '23', label: 'Madhya Pradesh (23)' },
  { value: '24', label: 'Gujarat (24)' },
  { value: '27', label: 'Maharashtra (27)' },
  { value: '29', label: 'Karnataka (29)' },
  { value: '32', label: 'Kerala (32)' },
  { value: '33', label: 'Tamil Nadu (33)' },
  { value: '36', label: 'Telangana (36)' },
  { value: '37', label: 'Andhra Pradesh (37)' },
];

const companySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  state_code: z.string().optional(),
  pincode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
});

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
});

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  password: z.string().min(8, 'Min 8 characters'),
  password_confirmation: z.string().min(1, 'Confirm your password'),
}).refine((d) => d.password === d.password_confirmation, {
  message: 'Passwords do not match',
  path: ['password_confirmation'],
});

type CompanyForm = z.infer<typeof companySchema>;
type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function Settings() {
  const { user, updateUser } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Invoice template queries
  const { data: templatesData } = useQuery({
    queryKey: ['invoice-templates'],
    queryFn: () => invoiceTemplatesApi.list(),
    select: (res) => res.data.data,
  });

  const { data: companySettings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => companySettingsApi.get(),
    select: (res) => res.data.data,
  });

  const templateMutation = useMutation({
    mutationFn: (slug: string) => companySettingsApi.update({ default_invoice_template: slug }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      toast.success('Default invoice template updated');
    },
  });

  const currentTemplate = companySettings?.default_invoice_template ?? 'pharma-distributor';

  // Company form
  const companyForm = useForm<CompanyForm>({ resolver: zodResolver(companySchema) });
  const companyMutation = useMutation({
    mutationFn: (data: CompanyForm) => api.put(`/companies/${user?.company?.id}`, data),
    onSuccess: (res) => {
      if (user) {
        updateUser({ ...user, company: res.data.data ?? res.data } as User);
      }
      setShowCompanyModal(false);
      setSuccessMsg('Company updated successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
  });

  // Profile form
  const profileForm = useForm<ProfileForm>({ resolver: zodResolver(profileSchema) });
  const profileMutation = useMutation({
    mutationFn: (data: ProfileForm) => api.put('/auth/profile', data),
    onSuccess: (res) => {
      if (user) {
        const updated = res.data.data ?? res.data;
        updateUser({ ...user, ...updated } as User);
      }
      setShowProfileModal(false);
      setSuccessMsg('Profile updated successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
  });

  // Password form
  const passwordForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });
  const passwordMutation = useMutation({
    mutationFn: (data: PasswordForm) => api.put('/auth/password', data),
    onSuccess: () => {
      setShowPasswordModal(false);
      passwordForm.reset();
      setSuccessMsg('Password changed successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
  });

  const openCompanyEdit = () => {
    companyForm.reset({
      name: user?.company?.name ?? '',
      gstin: user?.company?.gstin ?? '',
      pan: user?.company?.pan ?? '',
      address: user?.company?.address ?? '',
      city: user?.company?.city ?? '',
      state: user?.company?.state ?? '',
      state_code: user?.company?.state_code ?? '',
      pincode: user?.company?.pincode ?? '',
      phone: user?.company?.phone ?? '',
      email: user?.company?.email ?? '',
    });
    setShowCompanyModal(true);
  };

  const openProfileEdit = () => {
    profileForm.reset({
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
    });
    setShowProfileModal(true);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>

      {successMsg && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">{successMsg}</div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Company Info</h3>
              <button onClick={openCompanyEdit} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
                <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {[
                ['Company', user?.company?.name],
                ['GSTIN', user?.company?.gstin],
                ['PAN', user?.company?.pan],
                ['State', user?.company?.state],
                ['State Code', user?.company?.state_code],
                ['City', user?.company?.city],
                ['Address', user?.company?.address],
                ['Phone', user?.company?.phone],
                ['Email', user?.company?.email],
              ].map(([label, val]) => (
                <div key={label as string} className="flex justify-between">
                  <dt className="text-sm text-gray-500">{label}</dt>
                  <dd className="text-sm font-medium">{(val as string) || '—'}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Profile */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Your Profile</h3>
              <button onClick={openProfileEdit} className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
                <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </CardHeader>
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
                <dt className="text-sm text-gray-500">Phone</dt>
                <dd className="text-sm font-medium">{user?.phone ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Role</dt>
                <dd><Badge variant="info">{user?.role}</Badge></dd>
              </div>
            </dl>
            <div className="mt-4 pt-4 border-t">
              <Button variant="secondary" size="sm" onClick={() => { passwordForm.reset(); setShowPasswordModal(true); }}>
                Change Password
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Appearance</h3>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Choose how the app looks for you</p>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setTheme('light')}
                className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-4 transition-all ${
                  theme === 'light'
                    ? 'border-primary-600 bg-primary-50 dark:border-primary-500 dark:bg-primary-900/20'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                }`}
              >
                <Sun className="h-6 w-6 text-yellow-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Light</span>
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-4 transition-all ${
                  theme === 'dark'
                    ? 'border-primary-600 bg-primary-50 dark:border-primary-500 dark:bg-primary-900/20'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                }`}
              >
                <Moon className="h-6 w-6 text-primary-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dark</span>
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 p-4 transition-all ${
                  theme === 'system'
                    ? 'border-primary-600 bg-primary-50 dark:border-primary-500 dark:bg-primary-900/20'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 00-1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-2.572 1.065 1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572-1.065 1.724 1.724 0 00-1.066-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.065-2.572c-1.543-.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">System</span>
              </button>
            </div>
            <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
              Theme saved automatically
            </p>
          </CardContent>
        </Card>

        {/* Invoice Settings */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Invoice Settings</h3>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Choose default invoice template for printing</p>
            <div className="space-y-3">
              {(templatesData ?? []).map((tpl) => (
                <button
                  key={tpl.slug}
                  onClick={() => templateMutation.mutate(tpl.slug)}
                  disabled={templateMutation.isPending}
                  className={`flex w-full items-start gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                    currentTemplate === tpl.slug
                      ? 'border-primary-600 bg-primary-50 dark:border-primary-500 dark:bg-primary-900/20'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                  }`}
                >
                  <FileText className={`mt-0.5 h-5 w-5 flex-shrink-0 ${currentTemplate === tpl.slug ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{tpl.name}</span>
                      {currentTemplate === tpl.slug && (
                        <Check className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{tpl.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
       

      {/* Company Edit Modal */}
      <Modal open={showCompanyModal} onClose={() => setShowCompanyModal(false)} title="Edit Company" size="lg">
        <form onSubmit={companyForm.handleSubmit((d) => companyMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input id="name" label="Company Name" error={companyForm.formState.errors.name?.message} {...companyForm.register('name')} />
            <Input id="gstin" label="GSTIN" {...companyForm.register('gstin')} />
            <Input id="pan" label="PAN" {...companyForm.register('pan')} />
            <Select id="state_code" label="State" options={INDIAN_STATES} {...companyForm.register('state_code')} />
            <Input id="city" label="City" {...companyForm.register('city')} />
            <Input id="pincode" label="Pincode" {...companyForm.register('pincode')} />
            <Input id="phone" label="Phone" {...companyForm.register('phone')} />
            <Input id="email" label="Email" type="email" error={companyForm.formState.errors.email?.message} {...companyForm.register('email')} />
          </div>
          <Input id="address" label="Address" {...companyForm.register('address')} />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setShowCompanyModal(false)}>Cancel</Button>
            <Button type="submit" loading={companyMutation.isPending}>Save</Button>
          </div>
        </form>
      </Modal>

      {/* Profile Edit Modal */}
      <Modal open={showProfileModal} onClose={() => setShowProfileModal(false)} title="Edit Profile">
        <form onSubmit={profileForm.handleSubmit((d) => profileMutation.mutate(d))} className="space-y-4">
          <Input id="name" label="Name" error={profileForm.formState.errors.name?.message} {...profileForm.register('name')} />
          <Input id="email" label="Email" type="email" error={profileForm.formState.errors.email?.message} {...profileForm.register('email')} />
          <Input id="phone" label="Phone" {...profileForm.register('phone')} />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setShowProfileModal(false)}>Cancel</Button>
            <Button type="submit" loading={profileMutation.isPending}>Save</Button>
          </div>
        </form>
      </Modal>

      {/* Password Modal */}
      <Modal open={showPasswordModal} onClose={() => setShowPasswordModal(false)} title="Change Password">
        <form onSubmit={passwordForm.handleSubmit((d) => passwordMutation.mutate(d))} className="space-y-4">
          <Input id="current_password" label="Current Password" type="password" error={passwordForm.formState.errors.current_password?.message} {...passwordForm.register('current_password')} />
          <Input id="password" label="New Password" type="password" error={passwordForm.formState.errors.password?.message} {...passwordForm.register('password')} />
          <Input id="password_confirmation" label="Confirm Password" type="password" error={passwordForm.formState.errors.password_confirmation?.message} {...passwordForm.register('password_confirmation')} />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="secondary" onClick={() => setShowPasswordModal(false)}>Cancel</Button>
            <Button type="submit" loading={passwordMutation.isPending}>Change Password</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
