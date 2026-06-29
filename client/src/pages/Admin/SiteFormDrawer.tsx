/**
 * SiteFormDrawer — Composition Root
 *
 * Architecture:
 *   Custom Hook   useSiteForm        — all form logic (effects, mutation, validation callbacks)
 *   HOC           withFormSection    — decorates section components with heading + divider
 *   Composition   Section components — each owns one form section (Single Responsibility)
 *   Render Props  SiteContactsSection — exposes renderContactItem so callers control row rendering
 *   Prop Drilling form instance drills down; remove/add actions lift events back up
 *
 * This file defines section components privately (not exported) because they are
 * tightly coupled to this form and have no use elsewhere. If any section grows
 * complex enough to need its own tests or is reused, move it to its own file.
 */

import React from 'react';
import {
  Drawer, Form, Input, Select, InputNumber, Checkbox, Button, Divider,
  Tooltip, Typography,
} from 'antd';
import type { FormInstance } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { CustomerPlant } from '@/types';
import { COUNTRIES, TIMEZONES, CURRENCY_OPTIONS } from '@/constants/masterData';
import { useSiteForm } from './hooks/useSiteForm';
import { withFormSection } from './hoc/withFormSection';

const { Text } = Typography;

// ─── Shared prop shape drilled into every section ─────────────────────────────

interface SectionProps {
  form: FormInstance;
  isEdit: boolean;
}

const REGIONS = ['APAC', 'EMEA', 'Americas', 'India', 'Other'];

// ─── Section field components (no HOC wrapper yet) ───────────────────────────

function SiteIdentificationFields({ isEdit }: SectionProps) {
  return (
    <>
      <Form.Item
        name="plantCode"
        label="Plant Code"
        rules={[
          { required: true, message: 'Plant code is required' },
          {
            pattern: /^[A-Z0-9_-]{2,30}$/i,
            message: '2–30 characters: letters, numbers, dash, underscore',
          },
        ]}
        extra={
          isEdit
            ? 'Code cannot be changed after creation'
            : 'Globally unique — suggested format: CUSTCODE-CC-CITY e.g. TATA-IN-JSR'
        }
      >
        <Input
          placeholder="e.g. TATA-IN-JSR"
          style={{ textTransform: 'uppercase' }}
          disabled={isEdit}
          maxLength={30}
        />
      </Form.Item>

      <Form.Item
        name="plantName"
        label="Plant / Site Name"
        rules={[{ required: true, message: 'Plant name is required' }]}
      >
        <Input placeholder="e.g. Jamshedpur Manufacturing Plant" maxLength={100} />
      </Form.Item>

      <Form.Item name="isDefault" valuePropName="checked">
        <Checkbox>Set as the default site for this customer</Checkbox>
      </Form.Item>
    </>
  );
}

function LocationFields(_: SectionProps) {
  return (
    <>
      <Form.Item
        name="country"
        label="Country"
        rules={[{ required: true, message: 'Country is required' }]}
      >
        <Select
          showSearch
          placeholder="Select country"
          options={COUNTRIES.map((c) => ({ value: c.name, label: c.name }))}
          filterOption={(input, option) =>
            (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
          }
        />
      </Form.Item>

      <div style={{ display: 'flex', gap: 12 }}>
        <Form.Item name="city" label="City" style={{ flex: 1 }}>
          <Input placeholder="e.g. Jamshedpur" maxLength={60} />
        </Form.Item>
        <Form.Item name="state" label="State / Province" style={{ flex: 1 }}>
          <Input placeholder="e.g. Jharkhand" maxLength={60} />
        </Form.Item>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <Form.Item name="region" label="Region" style={{ flex: 1 }}>
          <Select
            placeholder="Select region"
            options={REGIONS.map((r) => ({ value: r, label: r }))}
            allowClear
          />
        </Form.Item>
        <Form.Item
          name="timezone"
          label="Timezone"
          rules={[{ required: true, message: 'Timezone is required' }]}
          style={{ flex: 2 }}
        >
          <Select
            showSearch
            placeholder="Select timezone"
            options={TIMEZONES.map((tz) => ({ value: tz.value, label: tz.label }))}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
      </div>
    </>
  );
}

function AddressFields(_: SectionProps) {
  return (
    <>
      <Form.Item name="billingAddress" label="Billing Address">
        <Input.TextArea
          rows={2}
          placeholder="Full billing address for invoices"
          maxLength={300}
        />
      </Form.Item>
      <Form.Item name="shippingAddress" label="Shipping Address">
        <Input.TextArea
          rows={2}
          placeholder="Leave blank if same as billing"
          maxLength={300}
        />
      </Form.Item>
    </>
  );
}

function TaxFields(_: SectionProps) {
  return (
    <>
      <div style={{ display: 'flex', gap: 12 }}>
        <Form.Item
          name="gstin"
          label="GSTIN"
          extra="Indian GST registration number"
          rules={[
            {
              pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/,
              message: 'Invalid GSTIN format',
            },
          ]}
          style={{ flex: 1 }}
        >
          <Input
            placeholder="e.g. 27AABCT1234A1Z1"
            maxLength={15}
            style={{ textTransform: 'uppercase' }}
          />
        </Form.Item>
        <Form.Item
          name="vatNumber"
          label="VAT Number"
          extra="EU/UK VAT registration"
          style={{ flex: 1 }}
        >
          <Input placeholder="e.g. GB123456789" maxLength={20} />
        </Form.Item>
      </div>
      <Form.Item name="taxId" label="Other Tax ID" extra="For other jurisdictions">
        <Input placeholder="Tax identification number" maxLength={30} />
      </Form.Item>
    </>
  );
}

function CommercialFields(_: SectionProps) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <Form.Item name="currency" label="Currency Override" style={{ flex: 1 }}>
        <Select
          placeholder="— Inherit from customer —"
          options={CURRENCY_OPTIONS}
          allowClear
        />
      </Form.Item>
      <Form.Item
        name="creditPeriodDays"
        label="Credit Period Override"
        style={{ flex: 1 }}
        rules={[{ type: 'number', min: 0, message: 'Must be ≥ 0' }]}
      >
        <InputNumber
          min={0}
          max={365}
          addonAfter="days"
          placeholder="Inherit"
          style={{ width: '100%' }}
        />
      </Form.Item>
    </div>
  );
}

// ─── HOC-enhanced section components ─────────────────────────────────────────
// Each section component is decorated once here. The HOC adds heading + divider;
// the fields component stays pure. Open/Closed: add new sections without touching
// the existing ones.

const SiteIdentificationSection = withFormSection(SiteIdentificationFields, {
  title: 'Site Identification',
});

const LocationSection = withFormSection(LocationFields, {
  title: 'Location',
});

const AddressSection = withFormSection(AddressFields, {
  title: 'Addresses',
});

const TaxSection = withFormSection(TaxFields, {
  title: 'Tax & Compliance',
});

const CommercialSection = withFormSection(CommercialFields, {
  title: 'Commercial Overrides',
  description: 'Leave blank to inherit from customer defaults.',
});

// ─── Contacts section — Render Props pattern ──────────────────────────────────
/**
 * SiteContactsSection uses the Render Props pattern for contact rows.
 *
 * The section owns the Form.List loop and passes each field + the remove callback
 * through the renderContactItem prop. The caller (or default) decides how to
 * render a single contact row, enabling customisation without modifying this component.
 *
 * Ant Design's Form.List itself is already a render-prop component —
 * `{(fields, { add, remove }) => ReactNode}` — so we compose on top of it.
 */

interface ContactItemRenderArgs {
  field: { key: number; name: number };
  index: number;
  remove: (index: number | number[]) => void;
}

interface SiteContactsSectionProps {
  renderContactItem?: (args: ContactItemRenderArgs) => React.ReactNode;
}

function DefaultContactItem({ field, index, remove }: ContactItemRenderArgs) {
  return (
    <div
      key={field.key}
      style={{
        background: '#fafafa',
        border: '1px solid #f0f0f0',
        borderRadius: 6,
        padding: '10px 12px',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: 500 }}>Contact {index + 1}</Text>
        <Tooltip title="Remove contact">
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => remove(field.name)}
          />
        </Tooltip>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Form.Item
          name={[field.name, 'name']}
          noStyle
          rules={[{ required: true, message: 'Name required' }]}
        >
          <Input placeholder="Full name *" maxLength={80} style={{ flex: 1 }} />
        </Form.Item>
        <Form.Item
          name={[field.name, 'email']}
          noStyle
          rules={[
            { required: true, message: 'Email required' },
            { type: 'email', message: 'Invalid email' },
          ]}
        >
          <Input placeholder="email@company.com *" style={{ flex: 1 }} />
        </Form.Item>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Form.Item name={[field.name, 'phone']} noStyle>
          <Input placeholder="Phone" style={{ flex: 1 }} />
        </Form.Item>
        <Form.Item name={[field.name, 'designation']} noStyle>
          <Input placeholder="Designation" maxLength={60} style={{ flex: 1 }} />
        </Form.Item>
        <Form.Item name={[field.name, 'isPrimary']} valuePropName="checked" noStyle>
          <Checkbox style={{ whiteSpace: 'nowrap' }}>Primary</Checkbox>
        </Form.Item>
      </div>
    </div>
  );
}

function SiteContactsFields({
  renderContactItem = (args) => <DefaultContactItem key={args.field.key} {...args} />,
}: SiteContactsSectionProps) {
  return (
    <Form.List name="contacts">
      {(fields, { add, remove }) => (
        <>
          {fields.map((field, index) =>
            renderContactItem({ field, index, remove })
          )}
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => add({ name: '', email: '', isPrimary: false })}
          >
            Add Contact
          </Button>
        </>
      )}
    </Form.List>
  );
}

const SiteContactsSection = withFormSection(SiteContactsFields, {
  title: 'Site Contacts',
  description: 'Local contacts at this site: plant manager, finance contact, etc.',
});

// ─── Drawer props ─────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  customerId: string;
  plant: CustomerPlant | null;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Drawer — composition root ────────────────────────────────────────────────
/**
 * The drawer itself owns nothing but orchestration:
 *   1. Delegates form logic to the custom hook
 *   2. Composes section components via the HOC-enhanced wrappers
 *   3. Passes the form instance down as a prop (Prop Drilling)
 *   4. Lifting State: the hook's handleSubmit is the single write surface
 *
 * Adding a new section = create a Fields component, wrap with withFormSection,
 * drop it in here. No existing code changes needed (Open/Closed).
 */
export default function SiteFormDrawer({
  open,
  customerId,
  plant,
  onClose,
  onSuccess,
}: Props) {
  const { form, isEdit, isPending, handleSubmit, handleSubmitFailed } = useSiteForm({
    open,
    customerId,
    plant,
    onSuccess,
  });

  const sectionProps: SectionProps = { form, isEdit };

  return (
    <Drawer
      title={isEdit ? `Edit: ${plant?.plantName}` : 'Add New Site'}
      open={open}
      onClose={onClose}
      maskClosable={false}
      width={620}
      destroyOnClose
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            loading={isPending}
            onClick={() => form.submit()}
          >
            {isEdit ? 'Save Changes' : 'Create Site'}
          </Button>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        onFinishFailed={handleSubmitFailed}
        requiredMark="optional"
        size="middle"
        scrollToFirstError={false}   // we handle this manually in handleSubmitFailed
      >
        <SiteIdentificationSection {...sectionProps} />
        <LocationSection {...sectionProps} />
        <AddressSection {...sectionProps} />
        <TaxSection {...sectionProps} />
        <CommercialSection {...sectionProps} />
        <SiteContactsSection />

        <Divider />
        <Form.Item name="notes" label="Notes">
          <Input.TextArea
            rows={2}
            placeholder="Any notes about this site…"
            maxLength={300}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
