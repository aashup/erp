import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { partiesApi } from "@/api/parties";
import type { Party } from "@/types";
import { INDIAN_STATES } from "@/lib/constants";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SlideSelect } from "@/components/ui/SlideSelect";
import toast from "react-hot-toast";

const schema = z.object({
  type: z.enum(["customer", "vendor", "both"]),
  name: z.string().min(1, "Name is required"),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  state_code: z.string().optional(),
  pincode: z.string().optional(),
});

type PartyFormData = z.infer<typeof schema>;

interface PartyFormModalProps {
  open: boolean;
  onClose: () => void;
  defaultType?: "customer" | "vendor" | "both";
  onCreated?: (party: Party) => void;
}

const DEFAULT_VALUES: Partial<PartyFormData> = { state_code: "09" };

export function PartyFormModal({
  open,
  onClose,
  defaultType = "customer",
  onCreated,
}: PartyFormModalProps) {
  const queryClient = useQueryClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PartyFormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: { type: defaultType, name: "", ...DEFAULT_VALUES },
  });

  const mutation = useMutation({
    mutationFn: (data: PartyFormData) => partiesApi.create(data),
    onSuccess: (res) => {
      const party = res.data.data as Party;
      queryClient.invalidateQueries({ queryKey: ["parties"] });
      queryClient.invalidateQueries({ queryKey: ["ledgers"] });
      queryClient.invalidateQueries({ queryKey: ["parties-customers"] });
      queryClient.invalidateQueries({ queryKey: ["parties-vendors"] });
      toast.success("Party created");
      reset({ type: defaultType, name: "", ...DEFAULT_VALUES });
      onCreated?.(party);
      onClose();
    },
    onError: () => toast.error("Failed to create party"),
  });

  const handleClose = () => {
    reset({ type: defaultType, name: "", ...DEFAULT_VALUES });
    onClose();
  };

  const onSubmit = (data: PartyFormData) => mutation.mutate(data);

  return (
    <Modal open={open} onClose={handleClose} title="New Party" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <SlideSelect
            name="type"
            label="Type"
            placeholder="Select type"
            panelTitle="Select Type"
            options={[
              { value: "customer", label: "Customer" },
              { value: "vendor", label: "Vendor" },
              { value: "both", label: "Both" },
            ]}
            value={watch("type")}
            onChange={(val) =>
              setValue("type", val as "customer" | "vendor" | "both", {
                shouldValidate: true,
              })
            }
            error={errors.type?.message}
          />
          <Input
            id="name"
            label="Name"
            error={errors.name?.message}
            {...register("name")}
          />
          <Input id="phone" label="Phone" {...register("phone")} />
          <Input id="email" label="Email" {...register("email")} />
          <Input id="gstin" label="GSTIN" {...register("gstin")} />
          <Input id="pan" label="PAN" {...register("pan")} />
          <Input id="address" label="Address" {...register("address")} />
          <Input id="city" label="City" {...register("city")} />
          <SlideSelect
            name="state_code"
            label="State"
            placeholder="Select state"
            panelTitle="Select State"
            options={INDIAN_STATES}
            value={watch("state_code")}
            onChange={(val) =>
              setValue("state_code", val, { shouldValidate: true })
            }
          />
          <Input id="pincode" label="Pincode" {...register("pincode")} />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}
