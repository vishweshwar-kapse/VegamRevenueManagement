/**
 * useSiteForm — Custom Hook (Single Responsibility)
 *
 * Owns ALL form-level concerns for the site drawer:
 *   - Ant Design Form instance
 *   - Field population on open / mode change
 *   - Server mutation (create or update)
 *   - Error messaging
 *
 * The drawer component itself stays a pure orchestrator with no business logic.
 */

import { useEffect } from 'react';
import { Form, message } from 'antd';
import type { FormInstance } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ValidateErrorEntity } from 'rc-field-form/lib/interface';
import { customerPlantsApi, CreatePlantPayload } from '@/api/customerPlants';
import { CustomerPlant } from '@/types';

// ─── Contract ─────────────────────────────────────────────────────────────────

export interface UseSiteFormProps {
  open: boolean;
  customerId: string;
  plant: CustomerPlant | null;  // null = create mode
  onSuccess: () => void;
}

export interface UseSiteFormReturn {
  form: FormInstance<CreatePlantPayload>;
  isEdit: boolean;
  isPending: boolean;
  /** Call from Form onFinish */
  handleSubmit: (values: CreatePlantPayload) => void;
  /** Call from Form onFinishFailed to scroll to the first broken field */
  handleSubmitFailed: (errorInfo: ValidateErrorEntity) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSiteForm({
  open,
  customerId,
  plant,
  onSuccess,
}: UseSiteFormProps): UseSiteFormReturn {
  const [form] = Form.useForm<CreatePlantPayload>();
  const qc = useQueryClient();
  const isEdit = !!plant;

  // Populate fields whenever the drawer opens or the target record changes
  useEffect(() => {
    if (!open) return;

    if (plant) {
      form.setFieldsValue({
        plantCode:       plant.plantCode,
        plantName:       plant.plantName,
        isDefault:       plant.isDefault,
        country:         plant.country,
        city:            plant.city,
        state:           plant.state,
        region:          plant.region,
        timezone:        plant.timezone,
        billingAddress:  plant.billingAddress,
        shippingAddress: plant.shippingAddress,
        gstin:           plant.gstin,
        vatNumber:       plant.vatNumber,
        taxId:           plant.taxId,
        currency:        plant.currency,
        creditPeriodDays: plant.creditPeriodDays,
        contacts:        plant.contacts || [],
        notes:           plant.notes,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ contacts: [], isDefault: false });
    }
  }, [open, plant, form]);

  const mutation = useMutation({
    mutationFn: (values: CreatePlantPayload) =>
      isEdit
        ? customerPlantsApi.update(plant!._id, values)
        : customerPlantsApi.create({ ...values, customerId }),
    onSuccess: () => {
      message.success(isEdit ? 'Site updated' : 'Site created successfully');
      qc.invalidateQueries({ queryKey: ['plants', customerId] });
      onSuccess();
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      message.error(data?.message || data?.errors?.[0]?.msg || 'Something went wrong');
    },
  });

  const handleSubmit = (values: CreatePlantPayload) => mutation.mutate(values);

  /**
   * Scroll smoothly to the first field that failed validation.
   * Ant Design's form emits the failing field names in order so the first
   * entry in errorFields[0].name is the one closest to the top of the form.
   */
  const handleSubmitFailed = ({ errorFields }: ValidateErrorEntity) => {
    if (errorFields.length > 0) {
      form.scrollToField(errorFields[0].name, {
        behavior: 'smooth',
        block: 'center',
        scrollMode: 'if-needed',
      });
    }
  };

  return {
    form,
    isEdit,
    isPending: mutation.isPending,
    handleSubmit,
    handleSubmitFailed,
  };
}
