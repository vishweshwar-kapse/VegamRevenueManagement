import { useEffect } from 'react';
import {
  Drawer, Form, Input, Select, Checkbox, Button, Divider,
  Typography, message,
} from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { entitiesApi, CreateEntityPayload } from '@/api/entities';
import { Entity } from '@/types';
import { COUNTRIES, CURRENCY_OPTIONS } from '@/constants/masterData';

const { Text } = Typography;

interface Props {
  open: boolean;
  entity: Entity | null;
  onClose: () => void;
  onSuccess: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Text strong style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {children}
      </Text>
      <Divider style={{ marginTop: 6, marginBottom: 14 }} />
    </>
  );
}

export default function EntityFormDrawer({ open, entity, onClose, onSuccess }: Props) {
  const qc = useQueryClient();
  const isEdit = !!entity;
  const [form] = Form.useForm<CreateEntityPayload>();

  useEffect(() => {
    if (!open) return;
    if (entity) {
      form.setFieldsValue({
        entityCode:      entity.entityCode,
        name:            entity.name,
        legalName:       entity.legalName,
        address:         entity.address,
        country:         entity.country,
        city:            entity.city,
        state:           entity.state,
        pinCode:         entity.pinCode,
        gstin:           entity.gstin,
        pan:             entity.pan,
        vatNumber:       entity.vatNumber,
        taxId:           entity.taxId,
        defaultCurrency: entity.defaultCurrency,
        email:           entity.email,
        phone:           entity.phone,
        website:         entity.website,
        isDefault:       entity.isDefault,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ defaultCurrency: 'INR', isDefault: false });
    }
  }, [open, entity, form]);

  const mutation = useMutation({
    mutationFn: (values: CreateEntityPayload) =>
      isEdit
        ? entitiesApi.update(entity!._id, values)
        : entitiesApi.create(values),
    onSuccess: () => {
      message.success(isEdit ? 'Entity updated' : 'Entity created');
      qc.invalidateQueries({ queryKey: ['entities'] });
      onSuccess();
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      message.error(data?.message || data?.errors?.[0]?.msg || 'Failed to save entity');
    },
  });

  return (
    <Drawer
      title={isEdit ? `Edit: ${entity?.name}` : 'Add Business Entity'}
      open={open}
      onClose={onClose}
      maskClosable={false}
      width={600}
      destroyOnClose
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={mutation.isPending} onClick={() => form.submit()}>
            {isEdit ? 'Save Changes' : 'Create Entity'}
          </Button>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(v) => mutation.mutate(v)}
        requiredMark="optional"
      >
        {/* ── Identity ────────────────────────────────────────────────────── */}
        <SectionLabel>Identity</SectionLabel>

        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item
            name="entityCode"
            label="Entity Code"
            rules={[
              { required: true, message: 'Entity code is required' },
              { pattern: /^[A-Z0-9_-]{2,20}$/i, message: '2–20 chars: letters, numbers, dash, underscore' },
            ]}
            extra={isEdit ? 'Code cannot be changed after creation' : 'Short unique identifier e.g. VEGAM-IN'}
            style={{ flex: 1 }}
          >
            <Input
              placeholder="e.g. VEGAM-IN"
              disabled={isEdit}
              maxLength={20}
              style={{ textTransform: 'uppercase' }}
            />
          </Form.Item>

          <Form.Item name="defaultCurrency" label="Default Currency" style={{ width: 160 }}
            rules={[{ required: true, message: 'Select a currency' }]}>
            <Select options={CURRENCY_OPTIONS} />
          </Form.Item>
        </div>

        <Form.Item
          name="name"
          label="Trading / Brand Name"
          rules={[{ required: true, message: 'Entity name is required' }]}
        >
          <Input placeholder="e.g. Vegam Solutions" maxLength={100} />
        </Form.Item>

        <Form.Item name="legalName" label="Full Legal Name">
          <Input placeholder="e.g. Vegam Solutions Private Limited" maxLength={150} />
        </Form.Item>

        <Form.Item name="isDefault" valuePropName="checked">
          <Checkbox>Set as the default entity for new forecasts</Checkbox>
        </Form.Item>

        {/* ── Address ─────────────────────────────────────────────────────── */}
        <SectionLabel>Address</SectionLabel>

        <Form.Item name="address" label="Full Address">
          <Input.TextArea
            rows={3}
            placeholder="Street address, building, area…"
            maxLength={500}
          />
        </Form.Item>

        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item name="country" label="Country" style={{ flex: 2 }}>
            <Select
              showSearch
              placeholder="Select country"
              allowClear
              options={COUNTRIES.map((c) => ({ value: c.name, label: c.name }))}
              filterOption={(input, option) =>
                String(option?.label).toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item name="state" label="State / Province" style={{ flex: 2 }}>
            <Input placeholder="e.g. Maharashtra" maxLength={60} />
          </Form.Item>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item name="city" label="City" style={{ flex: 2 }}>
            <Input placeholder="e.g. Pune" maxLength={60} />
          </Form.Item>
          <Form.Item name="pinCode" label="PIN / Postal Code" style={{ flex: 1 }}>
            <Input placeholder="e.g. 411001" maxLength={20} />
          </Form.Item>
        </div>

        {/* ── Tax & Compliance ─────────────────────────────────────────────── */}
        <SectionLabel>Tax & Compliance</SectionLabel>

        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item
            name="gstin"
            label="GSTIN"
            extra="Indian GST registration number"
            rules={[{
              pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/,
              message: 'Invalid GSTIN format',
            }]}
            style={{ flex: 1 }}
          >
            <Input placeholder="e.g. 27AABCV1234A1Z1" maxLength={15} style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item name="pan" label="PAN" extra="Company PAN" style={{ flex: 1 }}>
            <Input placeholder="e.g. AABCV1234A" maxLength={10} style={{ textTransform: 'uppercase' }} />
          </Form.Item>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item name="vatNumber" label="VAT Number" extra="EU/UK VAT" style={{ flex: 1 }}>
            <Input placeholder="e.g. GB123456789" maxLength={20} />
          </Form.Item>
          <Form.Item name="taxId" label="Other Tax ID" extra="Other jurisdictions" style={{ flex: 1 }}>
            <Input placeholder="Tax identification number" maxLength={30} />
          </Form.Item>
        </div>

        {/* ── Contact ──────────────────────────────────────────────────────── */}
        <SectionLabel>Contact</SectionLabel>

        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item
            name="email"
            label="Official Email"
            rules={[{ type: 'email', message: 'Invalid email address' }]}
            style={{ flex: 1 }}
          >
            <Input placeholder="e.g. accounts@vegam.co" maxLength={100} />
          </Form.Item>
          <Form.Item name="phone" label="Phone" style={{ flex: 1 }}>
            <Input placeholder="e.g. +91 20 1234 5678" maxLength={30} />
          </Form.Item>
        </div>

        <Form.Item
          name="website"
          label="Website"
          rules={[{ type: 'url', message: 'Enter a valid URL' }]}
        >
          <Input placeholder="https://www.vegam.co" maxLength={100} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
