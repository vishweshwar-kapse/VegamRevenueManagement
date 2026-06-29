import { useEffect } from 'react';
import {
  Drawer, Form, Input, Select, InputNumber, Button, Divider,
  Typography, message,
} from 'antd';
import { useMutation } from '@tanstack/react-query';
import { customersApi, CreateCustomerPayload } from '@/api/customers';
import { Customer } from '@/types';
import { INDUSTRIES, COUNTRIES, CURRENCY_OPTIONS } from '@/constants/masterData';

const { Text } = Typography;

interface Props {
  open: boolean;
  customer: Customer | null;  // null = create mode
  onClose: () => void;
  onSuccess: (customer: Customer) => void;
}

export default function CustomerFormDrawer({ open, customer, onClose, onSuccess }: Props) {
  const [form] = Form.useForm<CreateCustomerPayload>();
  const isEdit = !!customer;

  useEffect(() => {
    if (open) {
      if (customer) {
        form.setFieldsValue({
          code: customer.code,
          name: customer.name,
          displayName: customer.displayName,
          industry: customer.industry,
          parentGroup: customer.parentGroup,
          website: customer.website,
          pan: customer.pan,
          defaultCurrency: customer.defaultCurrency,
          defaultCreditPeriodDays: customer.defaultCreditPeriodDays,
          hqCountry: customer.hqCountry,
          hqCity: customer.hqCity,
          notes: customer.notes,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ defaultCurrency: 'USD', defaultCreditPeriodDays: 30 });
      }
    }
  }, [open, customer, form]);

  const mutation = useMutation({
    mutationFn: (values: CreateCustomerPayload) =>
      isEdit
        ? customersApi.update(customer!._id, values)
        : customersApi.create(values),
    onSuccess: (res) => {
      const saved = res.data?.data as Customer;
      message.success(isEdit ? 'Customer updated' : 'Customer created successfully');
      onSuccess(saved);
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      const fieldMessages: Record<string, string> = {
        code: 'Invalid Customer Code',
        name: 'Customer name is required',
        defaultCurrency: 'Please select a valid currency',
        defaultCreditPeriodDays: 'Credit period must be a non-negative number',
      };
      const firstErrorPath: string | undefined = data?.errors?.[0]?.path;
      const msg =
        (firstErrorPath && fieldMessages[firstErrorPath])
        ?? data?.message
        ?? 'Something went wrong';
      message.error(msg);
    },
  });

  const handleSubmit = (values: CreateCustomerPayload) => {
    mutation.mutate(values);
  };

  return (
    <Drawer
      title={isEdit ? `Edit: ${customer?.name}` : 'New Customer'}
      open={open}
      onClose={onClose}
      maskClosable={false}
      width={520}
      destroyOnClose
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            loading={mutation.isPending}
            onClick={() => form.submit()}
          >
            {isEdit ? 'Save Changes' : 'Create Customer'}
          </Button>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        requiredMark="optional"
        size="middle"
      >
        {/* ── Basic Information ─────────────────────────────────────── */}
        <Text strong style={{ fontSize: 12, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Basic Information
        </Text>
        <Divider style={{ marginTop: 8, marginBottom: 16 }} />

        <Form.Item
          name="code"
          label="Customer Code"
          normalize={(v: string) => v?.toUpperCase()}
          rules={[
            { required: true, message: 'Code is required' },
            { pattern: /^[A-Z0-9_-]{2,20}$/, message: '2–20 characters: letters, numbers, dash, underscore' },
          ]}
          extra={isEdit ? 'Code cannot be changed after creation' : 'Short unique identifier e.g. TATA, ACC-IN'}
        >
          <Input
            placeholder="e.g. TATA001"
            disabled={isEdit}
            maxLength={20}
          />
        </Form.Item>

        <Form.Item
          name="name"
          label="Legal Entity Name"
          rules={[{ required: true, message: 'Customer name is required' }]}
        >
          <Input placeholder="e.g. Tata Steel Limited" maxLength={100} />
        </Form.Item>

        <Form.Item
          name="displayName"
          label="Display Name"
          extra="Short friendly name used in lists and reports"
        >
          <Input placeholder="e.g. Tata Steel" maxLength={60} />
        </Form.Item>

        <Form.Item name="industry" label="Industry">
          <Select
            showSearch
            placeholder="Select industry"
            options={INDUSTRIES.map((i) => ({ value: i, label: i }))}
            allowClear
          />
        </Form.Item>

        <Form.Item name="parentGroup" label="Parent Group / Conglomerate">
          <Input placeholder="e.g. Tata Group" maxLength={80} />
        </Form.Item>

        <Form.Item
          name="website"
          label="Website"
          rules={[{ type: 'url', message: 'Enter a valid URL' }]}
        >
          <Input placeholder="https://www.example.com" />
        </Form.Item>

        <Form.Item
          name="pan"
          label="PAN Number"
          extra="Indian Permanent Account Number (company level)"
          rules={[
            {
              pattern: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
              message: 'PAN format: AAAAA9999A',
            },
          ]}
        >
          <Input placeholder="e.g. AABCT1234A" maxLength={10} style={{ textTransform: 'uppercase' }} />
        </Form.Item>

        {/* ── Headquarters ──────────────────────────────────────────── */}
        <Text strong style={{ fontSize: 12, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Headquarters
        </Text>
        <Divider style={{ marginTop: 8, marginBottom: 16 }} />

        <Form.Item name="hqCountry" label="Country">
          <Select
            showSearch
            placeholder="Select country"
            options={COUNTRIES.map((c) => ({ value: c.name, label: c.name }))}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
            allowClear
          />
        </Form.Item>

        <Form.Item name="hqCity" label="City">
          <Input placeholder="e.g. Mumbai" maxLength={60} />
        </Form.Item>

        {/* ── Commercial Defaults ───────────────────────────────────── */}
        <Text strong style={{ fontSize: 12, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Commercial Defaults
        </Text>
        <Divider style={{ marginTop: 8, marginBottom: 4 }} />
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
          Applied to all sites unless overridden at the site level.
        </Text>

        <Form.Item
          name="defaultCurrency"
          label="Default Currency"
          rules={[{ required: true, message: 'Currency is required' }]}
        >
          <Select options={CURRENCY_OPTIONS} />
        </Form.Item>

        <Form.Item
          name="defaultCreditPeriodDays"
          label="Default Credit Period"
          rules={[{ required: true, message: 'Credit period is required' }]}
        >
          <InputNumber
            min={0}
            max={365}
            addonAfter="days"
            style={{ width: '100%' }}
            placeholder="30"
          />
        </Form.Item>

        {/* ── Notes ─────────────────────────────────────────────────── */}
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={3} placeholder="Any additional notes about this customer…" maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
