import { useState, useEffect, useMemo } from 'react';
import {
  Drawer, Form, Input, Select, Button, Typography, Divider, Tag,
  InputNumber, Table, Space, message, Alert, Grid, Upload, DatePicker,
} from 'antd';
import {
  DeleteOutlined, UploadOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { posApi, CreatePOPayload } from '@/api/pos';
import { sowsApi } from '@/api/sows';
import { PO, SOW, Customer } from '@/types';
import { useFormSelectors } from '@/hooks/useFormSelectors';
import SectionLabel from '@/components/Form/SectionLabel';
import { COLORS, FONT_SIZE } from '@/constants/theme';

const { Text } = Typography;
const { useBreakpoint } = Grid;

interface Props {
  open: boolean;
  po: PO | null;
  onClose: () => void;
  onSuccess: () => void;
}

/** A row in the allocation editor: a SOW the PO is being applied to. */
interface AllocationRow {
  sowId: string;
  amount: number;
}

const pendingOf = (sow: SOW): number => Math.max((sow.totalValue || 0) - (sow.signedValue || 0), 0);

export default function POFormDrawer({ open, po, onClose, onSuccess }: Props) {
  const qc = useQueryClient();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [form] = Form.useForm();
  const isEdit = !!po;

  const {
    customers,
    plants,
    selectedCustomerId, setSelectedCustomerId,
    selectedPlantId, setSelectedPlantId,
    resetSelectors,
  } = useFormSelectors({ open });

  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);

  const poValue = Form.useWatch('poValue', form) ?? 0;

  // Currency follows the site, falling back to the customer default.
  const currency = useMemo(() => {
    const plant = plants.find((p) => p._id === selectedPlantId);
    const customer = customers.find((c) => c._id === selectedCustomerId);
    return plant?.currency || customer?.defaultCurrency || 'USD';
  }, [plants, customers, selectedPlantId, selectedCustomerId]);

  // SOWs available to link — only those of the selected customer.
  const { data: sowsData } = useQuery({
    queryKey: ['sows-for-po', selectedCustomerId],
    queryFn: () => sowsApi.list({ customerId: selectedCustomerId, limit: 200 }),
    enabled: open && !!selectedCustomerId,
  });
  const availableSOWs: SOW[] = (sowsData?.data as any)?.data || [];
  const sowById = useMemo(() => {
    const m = new Map<string, SOW>();
    availableSOWs.forEach((s) => m.set(s._id, s));
    return m;
  }, [availableSOWs]);

  // ── Populate on open / mode change ──────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    if (po) {
      const cId = typeof po.customerId === 'string' ? po.customerId : (po.customerId as Customer)._id;
      const pId = po.plantId
        ? (typeof po.plantId === 'string' ? po.plantId : (po.plantId as any)._id)
        : undefined;

      setSelectedCustomerId(cId);
      if (pId) setSelectedPlantId(pId);

      setAllocations(
        po.allocations.map((a) => ({
          sowId: typeof a.sowId === 'string' ? a.sowId : (a.sowId as SOW)._id,
          amount: a.amount,
        }))
      );
      setUploadFiles([]);

      form.setFieldsValue({
        customerId: cId,
        plantId: pId,
        poNumber: po.poNumber,
        poDate: po.poDate ? dayjs(po.poDate) : null,
        poValue: po.poValue,
        status: po.status,
        milestones: po.milestones,
        notes: po.notes,
      });
    } else {
      form.resetFields();
      resetSelectors();
      setAllocations([]);
      setUploadFiles([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, po]);

  // ── Allocation editing ──────────────────────────────────────────────────────

  const linkedSOWIds = allocations.map((a) => a.sowId);

  const onSelectSOWs = (ids: string[]) => {
    setAllocations((prev) => {
      const existing = new Map(prev.map((a) => [a.sowId, a]));
      return ids.map((id) => {
        if (existing.has(id)) return existing.get(id)!;
        // New row — pre-fill with the SOW's pending amount (editable).
        const sow = sowById.get(id);
        return { sowId: id, amount: sow ? pendingOf(sow) : 0 };
      });
    });
  };

  const updateAllocation = (sowId: string, amount: number) =>
    setAllocations((prev) => prev.map((a) => (a.sowId === sowId ? { ...a, amount } : a)));

  const removeAllocation = (sowId: string) =>
    setAllocations((prev) => prev.filter((a) => a.sowId !== sowId));

  const allocatedTotal = allocations.reduce((s, a) => s + (a.amount || 0), 0);
  const allocationMismatch = poValue > 0 && allocatedTotal !== poValue;

  // ── Mutation ────────────────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: async (payload: CreatePOPayload) => {
      const resp = isEdit
        ? await posApi.update(po!._id, payload)
        : await posApi.create(payload);

      const savedId = (resp.data as any)?.data?._id;
      const files = uploadFiles.map((f) => f.originFileObj).filter(Boolean) as File[];
      if (savedId && files.length > 0) {
        await posApi.uploadDocuments(savedId, files);
      }
      return resp;
    },
    onSuccess: () => {
      message.success(isEdit ? 'PO updated' : 'PO registered');
      qc.invalidateQueries({ queryKey: ['pos'] });
      qc.invalidateQueries({ queryKey: ['sows'] });
      qc.invalidateQueries({ queryKey: ['forecasts'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      onSuccess();
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      message.error(data?.message || data?.errors?.[0]?.msg || 'Failed to save PO');
    },
  });

  const handleFinish = (values: any) => {
    const validAllocations = allocations.filter((a) => a.amount > 0);
    if (validAllocations.length === 0) {
      message.error('Allocate a positive amount to at least one SOW');
      return;
    }

    const payload: CreatePOPayload = {
      poNumber: values.poNumber,
      customerId: values.customerId,
      plantId: values.plantId || undefined,
      poDate: values.poDate.format('YYYY-MM-DD'),
      poValue: Number(values.poValue),
      allocations: validAllocations,
      milestones: values.milestones,
      notes: values.notes,
    };

    mutation.mutate(payload);
  };

  // ── Allocation table ──────────────────────────────────────────────────────────

  const allocationColumns = [
    {
      title: 'SOW',
      key: 'sow',
      render: (_: unknown, row: AllocationRow) => {
        const sow = sowById.get(row.sowId);
        return (
          <div>
            <Text code style={{ fontSize: FONT_SIZE.sm }}>{sow?.sowId || '—'}</Text>
            <Text type="secondary" style={{ display: 'block', fontSize: FONT_SIZE.xs }} ellipsis>
              {sow?.title || ''}
            </Text>
          </div>
        );
      },
    },
    {
      title: 'Pending',
      key: 'pending',
      width: 120,
      align: 'right' as const,
      render: (_: unknown, row: AllocationRow) => {
        const sow = sowById.get(row.sowId);
        return (
          <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>
            {sow ? `${currency} ${pendingOf(sow).toLocaleString()}` : '—'}
          </Text>
        );
      },
    },
    {
      title: `Allocation (${currency})`,
      key: 'amount',
      width: 160,
      render: (_: unknown, row: AllocationRow) => {
        const sow = sowById.get(row.sowId);
        const exceeds = sow ? row.amount > pendingOf(sow) : false;
        return (
          <div>
            <InputNumber
              value={row.amount}
              min={0}
              precision={0}
              size="small"
              status={exceeds ? 'warning' : undefined}
              style={{ width: '100%' }}
              onChange={(v) => updateAllocation(row.sowId, v ?? 0)}
            />
            {exceeds && (
              <Text style={{ fontSize: FONT_SIZE.xs, color: COLORS.error }}>
                Exceeds pending by {(row.amount - pendingOf(sow!)).toLocaleString()}
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
      render: (_: unknown, row: AllocationRow) => (
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeAllocation(row.sowId)} />
      ),
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Drawer
      title={isEdit ? `Edit PO: ${po?.poNumber}` : 'Register Purchase Order'}
      open={open}
      onClose={onClose}
      width={isMobile ? '100%' : 720}
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>
            Allocated: <strong>{currency} {allocatedTotal.toLocaleString()}</strong>
            {poValue > 0 && <> / {currency} {Number(poValue).toLocaleString()}</>}
          </Text>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" loading={mutation.isPending} onClick={() => form.submit()}>
              {isEdit ? 'Save Changes' : 'Register PO'}
            </Button>
          </Space>
        </div>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} requiredMark="optional">
        {/* ── Customer & Site ─────────────────────────────────────────── */}
        <SectionLabel>Customer & Site</SectionLabel>

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
              setSelectedPlantId('');
              setAllocations([]);
              form.setFieldsValue({ plantId: undefined });
            }}
          />
        </Form.Item>

        <Form.Item name="plantId" label="Site" extra="Optional — the site that issued this PO">
          <Select
            showSearch
            allowClear
            placeholder="Select site (optional)"
            disabled={isEdit || !selectedCustomerId}
            options={plants.map((p) => ({ value: p._id, label: `${p.plantName} (${p.plantCode})` }))}
            filterOption={(input, option) =>
              String(option?.label).toLowerCase().includes(input.toLowerCase())
            }
            onChange={(id) => setSelectedPlantId(id || '')}
          />
        </Form.Item>

        {selectedCustomerId && (
          <Alert
            type="info"
            showIcon={false}
            style={{ marginBottom: 16, padding: '6px 12px' }}
            message={
              <Text style={{ fontSize: FONT_SIZE.sm }}>
                Currency for this PO: <Tag color="blue">{currency}</Tag>
              </Text>
            }
          />
        )}

        {/* ── PO Details ──────────────────────────────────────────────── */}
        <SectionLabel>PO Details</SectionLabel>

        <Form.Item name="poNumber" label="Customer PO Number" rules={[{ required: true, message: 'PO number is required' }]}>
          <Input placeholder="e.g. 4500012345" maxLength={100} />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <Form.Item name="poDate" label="PO Date" rules={[{ required: true, message: 'PO date is required' }]}>
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
          </Form.Item>

          <Form.Item
            name="poValue"
            label="Approved PO Value"
            rules={[{ required: true, message: 'Enter the approved amount' }]}
            extra="Amount approved by the customer on this PO"
          >
            <InputNumber
              min={0}
              precision={0}
              style={{ width: '100%' }}
              addonBefore={currency}
              placeholder="0"
            />
          </Form.Item>
        </div>

        {isEdit && (
          <Form.Item name="status" label="Status" style={{ maxWidth: 220 }}>
            <Select
              options={[
                { value: 'open',      label: 'Open' },
                { value: 'partial',   label: 'Partial' },
                { value: 'closed',    label: 'Closed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
          </Form.Item>
        )}

        {/* ── Documents ───────────────────────────────────────────────── */}
        <SectionLabel>Documents</SectionLabel>
        <Text type="secondary" style={{ fontSize: FONT_SIZE.sm, display: 'block', marginBottom: 12 }}>
          Attach the PO copy and any annexures (PDF or Word). You can select multiple files.
        </Text>

        <Upload
          accept=".pdf,.doc,.docx"
          multiple
          beforeUpload={() => false}
          fileList={uploadFiles}
          onChange={({ fileList }) => setUploadFiles(fileList)}
          onRemove={(file) => setUploadFiles((prev) => prev.filter((f) => f.uid !== file.uid))}
        >
          <Button icon={<UploadOutlined />}>Select Files (PDF / Word)</Button>
        </Upload>

        {/* ── SOW Allocation ──────────────────────────────────────────── */}
        <SectionLabel>
          Link to SOWs
          <Tag style={{ marginLeft: 8, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            {allocations.length}
          </Tag>
        </SectionLabel>
        <Text type="secondary" style={{ fontSize: FONT_SIZE.sm, display: 'block', marginBottom: 12 }}>
          Choose the SOWs this PO confirms. Each allocation pre-fills with the SOW's pending amount — adjust as needed.
        </Text>

        <Select
          mode="multiple"
          showSearch
          allowClear
          placeholder={selectedCustomerId ? 'Select SOWs to allocate' : 'Select a customer first'}
          disabled={!selectedCustomerId}
          style={{ width: '100%', marginBottom: 12 }}
          value={linkedSOWIds}
          onChange={onSelectSOWs}
          options={availableSOWs.map((s) => ({
            value: s._id,
            searchLabel: `${s.sowId} ${s.title}`.toLowerCase(),
            label: (
              <span>
                <Text code style={{ fontSize: FONT_SIZE.sm }}>{s.sowId}</Text>
                <span style={{ marginLeft: 6 }}>{s.title}</span>
                <Text type="secondary" style={{ fontSize: FONT_SIZE.xs, marginLeft: 6 }}>
                  pending {currency} {pendingOf(s).toLocaleString()}
                </Text>
              </span>
            ),
          }))}
          filterOption={(input, option: any) =>
            (option?.searchLabel ?? '').includes(input.toLowerCase())
          }
        />

        {allocations.length > 0 && (
          <Table
            dataSource={allocations.map((a) => ({ ...a, key: a.sowId }))}
            columns={allocationColumns}
            pagination={false}
            size="small"
            style={{ marginBottom: 12 }}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}>
                  <Text strong style={{ fontSize: FONT_SIZE.sm }}>Total Allocated</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <span />
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2}>
                  <Text strong style={{ fontSize: FONT_SIZE.md, color: COLORS.primary }}>
                    {currency} {allocatedTotal.toLocaleString()}
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} />
              </Table.Summary.Row>
            )}
          />
        )}

        {allocationMismatch && (
          <Alert
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            style={{ marginBottom: 16 }}
            message="Allocated total does not match the PO value"
            description={
              <Text style={{ fontSize: FONT_SIZE.sm }}>
                You allocated {currency} {allocatedTotal.toLocaleString()} of a {currency}{' '}
                {Number(poValue).toLocaleString()} PO
                {allocatedTotal > poValue
                  ? ` (${(allocatedTotal - poValue).toLocaleString()} over).`
                  : ` (${(poValue - allocatedTotal).toLocaleString()} unallocated).`}{' '}
                You can still save.
              </Text>
            }
          />
        )}

        {/* ── Notes ───────────────────────────────────────────────────── */}
        <Divider style={{ margin: '16px 0 12px' }} />
        <Form.Item name="milestones" label="Billing Milestones">
          <Input.TextArea rows={2} placeholder="Describe billing milestones (optional)…" maxLength={500} />
        </Form.Item>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} placeholder="Any additional context for this PO…" maxLength={500} showCount />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
