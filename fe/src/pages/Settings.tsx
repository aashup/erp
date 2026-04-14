import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuthStore } from "@/store/authStore";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SlideSelect } from "@/components/ui/SlideSelect";
import { Modal } from "@/components/ui/Modal";
import api from "@/lib/axios";
import { INDIAN_STATES } from "@/lib/constants";
import { companySettingsApi } from "@/api/settings";
import type { User } from "@/types";
import {
  Pencil,
  Database,
  Lock,
  Bot,
} from "lucide-react";
import toast from "react-hot-toast";

const companySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  state_code: z.string().optional(),
  pincode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
});

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
});

const ocrSchema = z.object({
  ocr_provider: z.string().default("openai"),
  ocr_api_key: z.string().min(1, "API key is required"),
  ocr_model: z.string().default("gpt-4o"),
});

type OcrForm = z.infer<typeof ocrSchema>;

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    password: z.string().min(8, "Min 8 characters"),
    password_confirmation: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.password_confirmation, {
    message: "Passwords do not match",
    path: ["password_confirmation"],
  });

type CompanyForm = z.infer<typeof companySchema>;
type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function Settings() {
  usePageTitle("Settings");
  const { user, updateUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: () => companySettingsApi.get(),
    select: (res) => res.data.data,
  });

  const defaultGroupsLoaded = companySettings?.default_groups_loaded ?? null;

  const loadDefaultsMutation = useMutation({
    mutationFn: (preset: "tally" | "marg") =>
      api.post("/accounting-groups/load-defaults", { preset }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-groups"] });
      toast.success(res.data.message || "Default groups loaded successfully");
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.message || "Failed to load default groups",
      );
    },
  });

  // Company form
  const companyForm = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
  });
  const companyMutation = useMutation({
    mutationFn: (data: CompanyForm) =>
      api.put(`/companies/${user?.company?.id}`, data),
    onSuccess: (res) => {
      if (user) {
        updateUser({ ...user, company: res.data.data ?? res.data } as User);
      }
      setShowCompanyModal(false);
      setSuccessMsg("Company updated successfully");
      setTimeout(() => setSuccessMsg(""), 3000);
    },
  });

  // Profile form
  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
  });
  const profileMutation = useMutation({
    mutationFn: (data: ProfileForm) => api.put("/auth/profile", data),
    onSuccess: (res) => {
      if (user) {
        const updated = res.data.data ?? res.data;
        updateUser({ ...user, ...updated } as User);
      }
      setShowProfileModal(false);
      setSuccessMsg("Profile updated successfully");
      setTimeout(() => setSuccessMsg(""), 3000);
    },
  });

  // Password form
  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });
  const passwordMutation = useMutation({
    mutationFn: (data: PasswordForm) => api.put("/auth/password", data),
    onSuccess: () => {
      setShowPasswordModal(false);
      passwordForm.reset();
      setSuccessMsg("Password changed successfully");
      setTimeout(() => setSuccessMsg(""), 3000);
    },
  });

  // OCR / AI settings form
  const ocrForm = useForm<OcrForm>({
    resolver: zodResolver(ocrSchema),
  });
  const ocrMutation = useMutation({
    mutationFn: (data: OcrForm) =>
      companySettingsApi.update({
        ocr_provider: data.ocr_provider,
        ocr_api_key: data.ocr_api_key,
        ocr_model: data.ocr_model,
      }),
    onSuccess: (res) => {
      // Directly set the cache with the fresh response so the card
      // reflects the new values instantly (no extra network round-trip)
      queryClient.setQueryData(["company-settings"], res);
      setShowOcrModal(false);
      toast.success("AI / OCR settings saved");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to save OCR settings");
    },
  });

  const openOcrEdit = () => {
    ocrForm.reset({
      ocr_provider: (companySettings?.ocr_provider as string) ?? "openai",
      ocr_api_key: (companySettings?.ocr_api_key as string) ?? "",
      ocr_model: (companySettings?.ocr_model as string) ?? "gpt-4o",
    });
    setShowOcrModal(true);
  };

  const ocrApiKey = (companySettings?.ocr_api_key as string) ?? "";
  const ocrModel = (companySettings?.ocr_model as string) ?? "";

  const openCompanyEdit = () => {
    companyForm.reset({
      name: user?.company?.name ?? "",
      gstin: user?.company?.gstin ?? "",
      pan: user?.company?.pan ?? "",
      address: user?.company?.address ?? "",
      city: user?.company?.city ?? "",
      state: user?.company?.state ?? "",
      state_code: user?.company?.state_code ?? "",
      pincode: user?.company?.pincode ?? "",
      phone: user?.company?.phone ?? "",
      email: user?.company?.email ?? "",
    });
    setShowCompanyModal(true);
  };

  const openProfileEdit = () => {
    profileForm.reset({
      name: user?.name ?? "",
      email: user?.email ?? "",
      phone: user?.phone ?? "",
    });
    setShowProfileModal(true);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Settings
      </h1>

      {successMsg && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Company Info</h3>
              <button
                onClick={openCompanyEdit}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {[
                ["Company", user?.company?.name],
                ["GSTIN", user?.company?.gstin],
                ["PAN", user?.company?.pan],
                ["State", user?.company?.state],
                ["State Code", user?.company?.state_code],
                ["City", user?.company?.city],
                ["Address", user?.company?.address],
                ["Phone", user?.company?.phone],
                ["Email", user?.company?.email],
              ].map(([label, val]) => (
                <div key={label as string} className="flex justify-between">
                  <dt className="text-sm text-gray-500">{label}</dt>
                  <dd className="text-sm font-medium">
                    {(val as string) || "—"}
                  </dd>
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
              <button
                onClick={openProfileEdit}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
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
                <dd className="text-sm font-medium">{user?.phone ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Role</dt>
                <dd>
                  <Badge variant="info">{user?.role}</Badge>
                </dd>
              </div>
            </dl>
            <div className="mt-4 pt-4 border-t">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  passwordForm.reset();
                  setShowPasswordModal(true);
                }}
              >
                Change Password
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Default Account Groups */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Default Account Groups</h3>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Load a predefined chart of accounts group structure. This is a{" "}
              <strong>one-time</strong> operation — once loaded, it cannot be
              changed.
            </p>

            {defaultGroupsLoaded ? (
              <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">
                      {defaultGroupsLoaded === "tally"
                        ? "TallyPrime"
                        : "Marg ERP"}{" "}
                      groups loaded
                    </p>
                    <p className="mt-0.5 text-xs text-green-600 dark:text-green-400">
                      Default account groups have already been configured.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  onClick={() => {
                    if (
                      confirm(
                        "Load TallyPrime default groups? This action cannot be undone.",
                      )
                    ) {
                      loadDefaultsMutation.mutate("tally");
                    }
                  }}
                  disabled={loadDefaultsMutation.isPending}
                  className="flex flex-col items-center gap-3 rounded-lg border-2 border-gray-200 p-5 transition-all hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:hover:border-blue-500 dark:hover:bg-blue-900/20"
                >
                  <Database className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  <div className="text-center">
                    <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                      TallyPrime
                    </span>
                    <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                      26 groups with hierarchy
                    </span>
                  </div>
                  <Badge variant="info">Standard</Badge>
                </button>

                <button
                  onClick={() => {
                    if (
                      confirm(
                        "Load Marg ERP default groups? This action cannot be undone.",
                      )
                    ) {
                      loadDefaultsMutation.mutate("marg");
                    }
                  }}
                  disabled={loadDefaultsMutation.isPending}
                  className="flex flex-col items-center gap-3 rounded-lg border-2 border-gray-200 p-5 transition-all hover:border-orange-400 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:hover:border-orange-500 dark:hover:bg-orange-900/20"
                >
                  <Database className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                  <div className="text-center">
                    <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Marg ERP
                    </span>
                    <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                      13 groups · Pharma / FMCG
                    </span>
                  </div>
                  <Badge variant="warning">Trade-specific</Badge>
                </button>
              </div>
            )}

            {loadDefaultsMutation.isPending && (
              <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
                Loading groups…
              </p>
            )}
          </CardContent>
        </Card>

        {/* AI / OCR Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <h3 className="text-lg font-semibold">AI / OCR Settings</h3>
              </div>
              <button
                onClick={openOcrEdit}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Pencil className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Configure your AI provider API key to enable scanning purchase
              invoices from photos.
            </p>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Provider</dt>
                <dd>
                  <Badge variant="info">OpenAI</Badge>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">API Key</dt>
                <dd className="text-sm font-medium">
                  {ocrApiKey ? (
                    <span className="font-mono tracking-widest">••••••••</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">
                      Not configured
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500">Model</dt>
                <dd className="text-sm font-medium">
                  {ocrModel || <span className="text-gray-400">—</span>}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Company Edit Modal */}
      <Modal
        open={showCompanyModal}
        onClose={() => setShowCompanyModal(false)}
        title="Edit Company"
        size="lg"
      >
        <form
          onSubmit={companyForm.handleSubmit((d) => companyMutation.mutate(d))}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="name"
              label="Company Name"
              error={companyForm.formState.errors.name?.message}
              {...companyForm.register("name")}
            />
            <Input
              id="gstin"
              label="GSTIN"
              {...companyForm.register("gstin")}
            />
            <Input id="pan" label="PAN" {...companyForm.register("pan")} />
            <SlideSelect
              name="state_code"
              label="State"
              placeholder="Select state"
              panelTitle="Select State"
              options={INDIAN_STATES}
              value={companyForm.watch("state_code")}
              onChange={(val) =>
                companyForm.setValue("state_code", val, {
                  shouldValidate: true,
                })
              }
            />
            <Input id="city" label="City" {...companyForm.register("city")} />
            <Input
              id="pincode"
              label="Pincode"
              {...companyForm.register("pincode")}
            />
            <Input
              id="phone"
              label="Phone"
              {...companyForm.register("phone")}
            />
            <Input
              id="email"
              label="Email"
              type="email"
              error={companyForm.formState.errors.email?.message}
              {...companyForm.register("email")}
            />
          </div>
          <Input
            id="address"
            label="Address"
            {...companyForm.register("address")}
          />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCompanyModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={companyMutation.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      {/* Profile Edit Modal */}
      <Modal
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        title="Edit Profile"
      >
        <form
          onSubmit={profileForm.handleSubmit((d) => profileMutation.mutate(d))}
          className="space-y-4"
        >
          <Input
            id="name"
            label="Name"
            error={profileForm.formState.errors.name?.message}
            {...profileForm.register("name")}
          />
          <Input
            id="email"
            label="Email"
            type="email"
            error={profileForm.formState.errors.email?.message}
            {...profileForm.register("email")}
          />
          <Input id="phone" label="Phone" {...profileForm.register("phone")} />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowProfileModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={profileMutation.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      {/* AI / OCR Settings Modal */}
      <Modal
        open={showOcrModal}
        onClose={() => setShowOcrModal(false)}
        title="AI / OCR Settings"
      >
        <form
          onSubmit={ocrForm.handleSubmit((d) => ocrMutation.mutate(d))}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Provider
            </label>
            <select
              {...ocrForm.register("ocr_provider")}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <Input
              id="ocr_api_key"
              label="API Key"
              type="password"
              placeholder="sk-..."
              error={ocrForm.formState.errors.ocr_api_key?.message}
              {...ocrForm.register("ocr_api_key")}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Stored per-company and visible only to admins. Never exposed in API responses.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Model
            </label>
            <select
              {...ocrForm.register("ocr_model")}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="gpt-4o">gpt-4o (Recommended)</option>
              <option value="gpt-4-vision-preview">gpt-4-vision-preview</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowOcrModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={ocrMutation.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      {/* Password Modal */}
      <Modal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Change Password"
      >
        <form
          onSubmit={passwordForm.handleSubmit((d) =>
            passwordMutation.mutate(d),
          )}
          className="space-y-4"
        >
          <Input
            id="current_password"
            label="Current Password"
            type="password"
            error={passwordForm.formState.errors.current_password?.message}
            {...passwordForm.register("current_password")}
          />
          <Input
            id="password"
            label="New Password"
            type="password"
            error={passwordForm.formState.errors.password?.message}
            {...passwordForm.register("password")}
          />
          <Input
            id="password_confirmation"
            label="Confirm Password"
            type="password"
            error={passwordForm.formState.errors.password_confirmation?.message}
            {...passwordForm.register("password_confirmation")}
          />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowPasswordModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={passwordMutation.isPending}>
              Change Password
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
