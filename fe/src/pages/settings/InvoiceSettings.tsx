import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Check, Printer } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { invoiceTemplatesApi, companySettingsApi } from "@/api/settings";
import toast from "react-hot-toast";

export default function InvoiceSettings() {
  usePageTitle("Invoice Settings");
  const queryClient = useQueryClient();

  // Invoice template queries
  const { data: templatesData } = useQuery({
    queryKey: ["invoice-templates"],
    queryFn: () => invoiceTemplatesApi.list(),
    select: (res) => res.data.data,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: () => companySettingsApi.get(),
    select: (res) => res.data.data,
  });

  const templateMutation = useMutation({
    mutationFn: (slug: string) =>
      companySettingsApi.update({ default_invoice_template: slug }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success("Default invoice template updated");
    },
  });

  const currentTemplate =
    companySettings?.default_invoice_template ?? "pharma-distributor";
  const thermalPaperSize = companySettings?.thermal_printer_paper_size ?? "2inch";

  const thermalSizeMutation = useMutation({
    mutationFn: (size: "2inch" | "3inch") =>
      companySettingsApi.update({ thermal_printer_paper_size: size }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success("Thermal printer settings updated");
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Invoice Settings
      </h1>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Default Invoice Template</h3>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Choose default invoice template for printing
          </p>
          <div className="space-y-3">
            {(templatesData ?? []).map((tpl) => (
              <button
                key={tpl.slug}
                onClick={() => templateMutation.mutate(tpl.slug)}
                disabled={templateMutation.isPending}
                className={`flex w-full items-start gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                  currentTemplate === tpl.slug
                    ? "border-primary-600 bg-primary-50 dark:border-primary-500 dark:bg-primary-900/20"
                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                }`}
              >
                <FileText
                  className={`mt-0.5 h-5 w-5 flex-shrink-0 ${currentTemplate === tpl.slug ? "text-primary-600 dark:text-primary-400" : "text-gray-400"}`}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {tpl.name}
                    </span>
                    {currentTemplate === tpl.slug && (
                      <Check className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {tpl.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Thermal Printer Settings</h3>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Select paper width for thermal printer invoices
          </p>
          <div className="space-y-3">
            {[
              { size: "2inch", label: "2 Inch (58mm)", description: "Standard thermal receipt paper" },
              { size: "3inch", label: "3 Inch (80mm)", description: "Wider thermal receipt paper" },
            ].map((option) => (
              <button
                key={option.size}
                onClick={() => thermalSizeMutation.mutate(option.size as "2inch" | "3inch")}
                disabled={thermalSizeMutation.isPending}
                className={`flex w-full items-start gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                  thermalPaperSize === option.size
                    ? "border-primary-600 bg-primary-50 dark:border-primary-500 dark:bg-primary-900/20"
                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                }`}
              >
                <Printer
                  className={`mt-0.5 h-5 w-5 flex-shrink-0 ${thermalPaperSize === option.size ? "text-primary-600 dark:text-primary-400" : "text-gray-400"}`}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {option.label}
                    </span>
                    {thermalPaperSize === option.size && (
                      <Check className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {option.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
