import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { unitsApi } from "@/api/inventory";
import type { Unit } from "@/types";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";

const schema = z.object({
  value: z.string().min(1, "Code is required").max(20),
  label: z.string().min(1, "Label is required").max(255),
});
type FormData = z.infer<typeof schema>;

interface UnitFormModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (unit: Unit) => void;
}

export function UnitFormModal({ open, onClose, onCreated }: UnitFormModalProps) {
  const queryClient = useQueryClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { value: "", label: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => unitsApi.create({ ...data, status: "active" }),
    onSuccess: (res) => {
      const unit = res.data.data as Unit;
      queryClient.invalidateQueries({ queryKey: ["units"] });
      toast.success("Unit created");
      reset();
      onCreated?.(unit);
      onClose();
    },
    onError: (err: any) => // eslint-disable-line @typescript-eslint/no-explicit-any
      toast.error(err?.response?.data?.message || "Failed to create unit"),
  });

  const handleClose = () => { reset(); onClose(); };

  return (
    <Modal open={open} onClose={handleClose} title="New Unit">
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            id="value"
            label="Code"
            placeholder="e.g. PCS, KG, BOX"
            error={errors.value?.message}
            {...register("value")}
          />
          <Input
            id="label"
            label="Label"
            placeholder="e.g. Pieces, Kilogram, Box"
            error={errors.label?.message}
            {...register("label")}
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}
