import { useState, useEffect, useMemo } from 'react';
import {
  Drawer, Form, Input, Select, Button, Typography, Divider, Tag,
  InputNumber, Table, Space, message, Alert, Grid, DatePicker,
} from 'antd';
import { DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { invoicesApi, CreateInvoicePayload } from '@/api/invoices';
import { posApi } from '@/api/pos';
import { Invoice, PO, Customer, InvoiceLineItem } from '@/types';
import { useFormSelectors } from '@/hooks/useFormSelectors';
import SectionLabel from '@/components/Form/SectionLabel';
import { COLORS, FONT_SIZE } from '@/constants/theme';

const { Text } = Typography;
const { useBreakpoint } = Grid;

interface Props {
  open: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onSuccess: () => void;
}

/** A billable line: a PO plus the amount and description being invoiced. */
interface LineRow {
  poId: string;
  description: string;
  amount: number;
}

const remainingOf = (po: PO): number => {
  const remaining = po.remainingValue ?? ((po.effectivePOValue ?? po.poValue) - (po.invoicedValue || 0));
  return Math.max(remaining, 0);
};

export default function InvoiceFormDrawer({ open, invoice, onClose, onSuccess }: Props) {
  const qc = useQueryClient();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [form] = Form.useForm();
  const isEdit = !!invoice;

  const { customers, selectedCustomerId, setSelectedCustomerId, resetSelectors } = useFormSelectors({ open });

  const [lines, setLines] = useState<LineRow[]>([]);

  // POs available to invoice for the selected customer (open/partial with value left).
  const { data: posData } = useQuery({
    queryKey: ['pos-for-invoice', selectedCustomerId],
    queryFn: () => posApi.list({ customerId: selectedCustomerId, limit: 200 }),
    enabled: open && !!selectedCustomerId,
  });
  const customerPOs: PO[] = (posData?.data as any)?.data || [];
  const availablePOs = useMemo(
    () => customerPOs.filter((p) => p.status !== 'cancelled' && (isEdit || remainingOf(p) > 0)),
    [customerPOs, isEdit]
  );
  const poById = useMemo(() => {
    const m = new Map<string, PO>();
    customerPOs.forEach((p) => m.set(p._id, p));
    return m;
  }, [customerPOs]);

  // Currency is taken from the selected POs (the route enforces a single currency).
  const currency = useMemo(() => {
    const first = lines.length > 0 ? poById.get(lines[0].poId) : undefined;
    return first?.currency || customerPOs[0]?.currency || 'USD';
  }, [lines, poById, customerPOs]);

  // ── Populate on open / mode change ──────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    if (invoice) {
      const cId = typeof invoice.customerId === 'string' ? invoice.customerId : (invoice.customerId as Customer)._id;
      setSelectedCustomerId(cId);
      setLines(
        invoice.lineItems.map((l: InvoiceLineItem) => ({
          poId: typeof l.poId === 'string' ? l.poId : (l.poId as PO)._id,
          description: l.description,
          amount: l.amount,
        }))
      );
      form.setFieldsValue({
        customerId: cId,
        invoiceDate: invoice.invoiceDate ? dayjs(invoice.invoiceDate) : dayjs(),
        payByDate: invoice.payByDate ? dayjs(invoice.payByDate) : dayjs().add(30, 'day'),
        taxAmount: invoice.taxAmount || 0,
        taxDescription: invoice.taxDescription,
        description: invoice.description,
        notes: invoice.notes,
      });
    } else {
      form.resetFields();
      resetSelectors();
      setLines([]);
      form.setFieldsValue({
        invoiceDate: dayjs(),
        payByDate: dayjs().add(30, 'day'),
        taxAmount: 0,
        taxDescription: 'NA',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice]);

  // ── Line editing ─────────────────────────────────────────────────────────────

  const selectedPOIds = lines.map((l) => l.poId);

  const onSelectPOs = (ids: string[]) => {
    setLines((prev) => {
      const existing = new Map(prev.map((l) => [l.poId, l]));
      return ids.map((id) => {
        if (existing.has(id)) return existing.get(id)!;
        const po = poById.get(id);
        return {
          poId: id,
          description: po?.milestones || (po ? `PO ${po.poNumber}` : ''),
          amount: po ? remainingOf(po) : 0,
        };
      });
    });
  };

  const updateLine = (poId: string, field: 'amount' | 'description', value: number | string) =>
    setLines((prev) => prev.map((l) => (l.poId === poId ? { ...l, [field]: value } : l)));

  const removeLine = (poId: string) =>
    setLines((prev) => prev.filter((l) => l.poId !== poId));

  const subtotal = lines.reduce((s, l) => s + (l.amount || 0), 0);
  const taxAmount = Form.useWatch('taxAmount', form) ?? 0;
  const total = subtotal + Number(taxAmount || 0);

  // ── Mutation ─────────────────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: (payload: CreateInvoicePayload) =>
      isEdit ? invoicesApi.update(invoice!._id, payload) : invoicesApi.create(payload),
    onSuccess: () => {
      message.success(isEdit ? 'Invoice updated' : 'Invoice drafted');
      qc.invalidateQueries({ queryKey: ['invoices'] });
      onSuccess();
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      message.error(data?.message || data?.errors?.[0]?.msg || 'Failed to save invoice');
    },
  });

  const handleFinish = (values: any) => {
    const validLines = lines.filter((l) => l.amount > 0);
    if (validLines.length === 0) {
      message.error('Add at least one PO with a positive amount');
      return;
    }

    const payload: CreateInvoicePayload = {
      customerId: values.customerId,
      invoiceDate: values.invoiceDate.format('YYYY-MM-DD'),
      payByDate: values.payByDate.format('YYYY-MM-DD'),
      lineItems: validLines.map((l) => ({ poId: l.poId, description: l.description, amount: l.amount })),
      taxAmount: Number(values.taxAmount) || 0,
      taxDescription: values.taxDescription || 'NA',
      description: values.description,
      notes: values.notes,
    };
    mutation.mutate(payload);
  };

  // ── Line-item table ────────────────────────────────────────────────────────────

  const columns = [
    {
      title: 'PO',
      key: 'po',
      width: 130,
      render: (_: unknown, row: LineRow) => {
        const po = poById.get(row.poId);
        return <Text code style={{ fontSize: FONT_SIZE.sm }}>{po?.poNumber || '—'}</Text>;
      },
    },
    {
      title: 'Description',
      key: 'description',
      render: (_: unknown, row: LineRow) => (
        <Input
          value={row.description}
          placeholder="What is being billed"
          size="small"
          onChange={(e) => updateLine(row.poId, 'description', e.target.value)}
        />
      ),
    },
    {
      title: `Amount (${currency})`,
      key: 'amount',
      width: 150,
      render: (_: unknown, row: LineRow) => {
        const po = poById.get(row.poId);
        const remaining = po ? remainingOf(po) : 0;
        const exceeds = po ? row.amount > remaining : false;
        return (
          <div>
            <InputNumber
              value={row.amount}
              min={0}
              precision={2}
              size="small"
              status={exceeds ? 'warning' : undefined}
              style={{ width: '100%' }}
              onChange={(v) => updateLine(row.poId, 'amount', v ?? 0)}
            />
            {po && (
              <Text type="secondary" style={{ fontSize: FONT_SIZE.xs }}>
                remaining {currency} {remaining.toLocaleString()}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: '',
      key: 'del',
      width: 36,
      render: (_: unknown, row: LineRow) => (
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeLine(row.poId)} />
      ),
    },
  ];

  return (
    <Drawer
      title={isEdit ? `Edit Invoice: ${invoice?.invoiceNumber}` : 'New Invoice'}
      open={open}
      onClose={onClose}
      maskClosable={false}
      width={isMobile ? '100%' : 720}
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>
            Total: <strong>{currency} {total.toLocaleString()}</strong>
          </Text>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" loading={mutation.isPending} onClick={() => form.submit()}>
              {isEdit ? 'Save Changes' : 'Save Draft'}
            </Button>
          </Space>
        </div>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} requiredMark="optional">
        {/* ── Customer ─────────────────────────────────────────────────── */}
        <SectionLabel>Customer</SectionLabel>
        <Form.Item name="customerId" label="Customer" rules={[{ required: true, message: 'Select a customer' }]}>
          <Select
            showSearch
            placeholder="Select customer"
            disabled={isEdit}
            options={customers.map((c) => ({ value: c._id, label: c.displayName || c.name }))}
            filterOption={(input, option) =>
              String(option?.label).toLowerCase().includes(input.toLowerCase())
            }
            onChange={(id) => {
              setSelectedCustomerId(id);
              setLines([]);
            }}
          />
        </Form.Item>

        {/* ── Invoice details ─────────────────────────────────────────── */}
        <SectionLabel>Invoice Details</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <Form.Item name="invoiceDate" label="Invoice Date" rules={[{ required: true, message: 'Required' }]}>
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
          </Form.Item>
          <Form.Item name="payByDate" label="Pay By" rules={[{ required: true, message: 'Required' }]}>
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
          </Form.Item>
        </div>

        <Form.Item name="description" label="Summary (optional)">
          <Input placeholder="e.g. Q1 milestone billing" maxLength={200} />
        </Form.Item>

        {/* ── Purchase Orders ─────────────────────────────────────────── */}
        <SectionLabel>
          Purchase Orders
          <Tag style={{ marginLeft: 8, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            {lines.length}
          </Tag>
        </SectionLabel>
        <Text type="secondary" style={{ fontSize: FONT_SIZE.sm, display: 'block', marginBottom: 12 }}>
          Select one or more POs to bill together. Each line pre-fills with the PO's remaining value — adjust as needed.
        </Text>

        <Select
          mode="multiple"
          showSearch
          allowClear
          placeholder={selectedCustomerId ? 'Select POs to invoice' : 'Select a customer first'}
          disabled={!selectedCustomerId}
          style={{ width: '100%', marginBottom: 12 }}
          value={selectedPOIds}
          onChange={onSelectPOs}
          options={availablePOs.map((p) => ({
            value: p._id,
            searchLabel: `${p.poNumber}`.toLowerCase(),
            label: (
              <span>
                <Text code style={{ fontSize: FONT_SIZE.sm }}>{p.poNumber}</Text>
                <Text type="secondary" style={{ fontSize: FONT_SIZE.xs, marginLeft: 6 }}>
                  remaining {p.currency} {remainingOf(p).toLocaleString()}
                </Text>
              </span>
            ),
          }))}
          filterOption={(input, option: any) =>
            (option?.searchLabel ?? '').includes(input.toLowerCase())
          }
        />

        {lines.length > 0 && (
          <Table
            dataSource={lines.map((l) => ({ ...l, key: l.poId }))}
            columns={columns}
            pagination={false}
            size="small"
            style={{ marginBottom: 12 }}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={2}>
                  <Text strong style={{ fontSize: FONT_SIZE.sm }}>Subtotal</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2}>
                  <Text strong style={{ fontSize: FONT_SIZE.md, color: COLORS.primary }}>
                    {currency} {subtotal.toLocaleString()}
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} />
              </Table.Summary.Row>
            )}
          />
        )}

        {/* ── Tax ──────────────────────────────────────────────────────── */}
        <SectionLabel>Tax</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <Form.Item name="taxDescription" label="Tax Description">
            <Input placeholder="e.g. GST 18% / NA" maxLength={60} />
          </Form.Item>
          <Form.Item name="taxAmount" label="Tax Amount">
            <InputNumber min={0} precision={2} style={{ width: '100%' }} addonBefore={currency} />
          </Form.Item>
        </div>

        <Alert
          type="info"
          showIcon={false}
          style={{ marginBottom: 16, padding: '8px 12px' }}
          message={
            <Text style={{ fontSize: FONT_SIZE.sm }}>
              Invoice total: <strong>{currency} {total.toLocaleString()}</strong>
            </Text>
          }
        />

        {lines.some((l) => {
          const po = poById.get(l.poId);
          return po && l.amount > remainingOf(po);
        }) && (
          <Alert
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            style={{ marginBottom: 16 }}
            message="One or more lines exceed the PO's remaining value"
            description={<Text style={{ fontSize: FONT_SIZE.sm }}>You can still save, but the PO will be over-invoiced.</Text>}
          />
        )}

        <Divider style={{ margin: '4px 0 12px' }} />
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} placeholder="Internal notes (not printed on the PDF)…" maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
