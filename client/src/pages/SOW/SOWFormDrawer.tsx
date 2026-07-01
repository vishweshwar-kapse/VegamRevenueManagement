import { useState, useEffect } from 'react';
import {
  Drawer, Form, Input, Select, Button, Typography, Divider, Tag,
  InputNumber, Table, Space, message, Alert, Grid, Upload, DatePicker,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, UploadOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { sowsApi, CreateSOWPayload } from '@/api/sows';
import { forecastsApi } from '@/api/forecasts';
import { SOW, Entity, Customer, CustomerPlant, Forecast, ForecastDistribution } from '@/types';
import { useFormSelectors } from '@/hooks/useFormSelectors';
import SectionLabel from '@/components/Form/SectionLabel';
import { COLORS, FONT_SIZE } from '@/constants/theme';

const { Text } = Typography;
const { useBreakpoint } = Grid;

interface Props {
  open: boolean;
  sow: SOW | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface MilestoneRow {
  description: string;
  amount: number;
  deliveryDate: string; // ISO date (YYYY-MM-DD) or empty
}

// ── FY helpers (UTC-normalised to avoid midnight timezone shifts) ─────────────

function getFYFromDate(isoDate: string): string {
  const [year, month] = isoDate.split('-').map(Number);
  const fyStart = month >= 4 ? year : year - 1;
  return `FY${String(fyStart).slice(-2)}-${String(fyStart + 1).slice(-2)}`;
}

function getMilestoneFYTotals(milestones: MilestoneRow[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const m of milestones) {
    if (!m.deliveryDate || !m.amount) continue;
    const fy = getFYFromDate(m.deliveryDate);
    totals[fy] = (totals[fy] || 0) + m.amount;
  }
  return totals;
}

function getForecastFYTotals(distributions: ForecastDistribution[]): Record<string, number> {
  return distributions.reduce((acc, d) => {
    acc[d.fy] = d.total;
    return acc;
  }, {} as Record<string, number>);
}

function hasForecastMismatch(milestones: MilestoneRow[], distributions: ForecastDistribution[]): boolean {
  const mTotals = getMilestoneFYTotals(milestones);
  const fTotals = getForecastFYTotals(distributions);
  const allFYs = new Set([...Object.keys(mTotals), ...Object.keys(fTotals)]);
  for (const fy of allFYs) {
    if ((mTotals[fy] || 0) !== (fTotals[fy] || 0)) return true;
  }
  return false;
}

// ── Mobile card for a single milestone row ────────────────────────────────────

interface MilestoneCardProps {
  row: MilestoneRow;
  index: number;
  currency: string;
  update: (i: number, field: keyof MilestoneRow, value: string | number) => void;
  remove: (i: number) => void;
}

function MilestoneCard({ row, index, currency, update, remove }: MilestoneCardProps) {
  return (
    <div style={{
      background: COLORS.bgSubtle,
      border: `1px solid ${COLORS.borderLight}`,
      borderRadius: 8,
      padding: '10px 12px',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text strong style={{ fontSize: FONT_SIZE.sm }}>Milestone {index + 1}</Text>
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => remove(index)} />
      </div>
      <Input
        placeholder="Description"
        value={row.description}
        onChange={(e) => update(index, 'description', e.target.value)}
        style={{ marginBottom: 8 }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <Text type="secondary" style={{ fontSize: FONT_SIZE.xs, display: 'block', marginBottom: 3 }}>
            Amount ({currency})
          </Text>
          <InputNumber
            value={row.amount}
            min={0}
            precision={0}
            style={{ width: '100%' }}
            onChange={(v) => update(index, 'amount', v ?? 0)}
          />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: FONT_SIZE.xs, display: 'block', marginBottom: 3 }}>
            Delivery Date
          </Text>
          <DatePicker
            value={row.deliveryDate ? dayjs(row.deliveryDate) : null}
            style={{ width: '100%' }}
            onChange={(d: Dayjs | null) => update(index, 'deliveryDate', d ? d.format('YYYY-MM-DD') : '')}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function SOWFormDrawer({ open, sow, onClose, onSuccess }: Props) {
  const qc = useQueryClient();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isEdit = !!sow;

  const [form] = Form.useForm();
  const [milestones, setMilestones] = useState<MilestoneRow[]>([
    { description: '', amount: 0, deliveryDate: '' },
  ]);
  const [uploadFile, setUploadFile] = useState<UploadFile | null>(null);
  const [autoCreate, setAutoCreate] = useState(false);

  const {
    entities, defaultEntity,
    customers, plants,
    selectedCustomerId, setSelectedCustomerId,
    selectedPlantId, setSelectedPlantId,
    currency, setCurrency,
    resetSelectors,
  } = useFormSelectors({ open });

  // Forecasts available for the selected customer. A forecast can back multiple
  // SOWs, so every active forecast for the customer is selectable here.
  const { data: forecastsData } = useQuery({
    queryKey: ['forecasts-for-sow', selectedCustomerId],
    queryFn: () => forecastsApi.list({
      customerId: selectedCustomerId,
      limit: 200,
    }),
    enabled: open && !!selectedCustomerId,
  });
  const availableForecasts: Forecast[] = (forecastsData?.data as any)?.data || [];

  const watchedForecastId = Form.useWatch('forecastId', form);
  const selectedForecast = availableForecasts.find((f) => f._id === watchedForecastId) ?? null;
  const forecastMismatch = selectedForecast
    ? hasForecastMismatch(milestones, selectedForecast.distributions)
    : false;

  // ── Effects ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (open && !isEdit && defaultEntity && !form.getFieldValue('entityId')) {
      form.setFieldsValue({ entityId: defaultEntity._id });
    }
  }, [open, isEdit, defaultEntity, form]);

  useEffect(() => {
    if (open && sow) {
      const cId = typeof sow.customerId === 'string' ? sow.customerId : (sow.customerId as Customer)._id;
      const pId = sow.plantId
        ? (typeof sow.plantId === 'string' ? sow.plantId : (sow.plantId as CustomerPlant)._id)
        : '';
      const eId = sow.entityId
        ? (typeof sow.entityId === 'string' ? sow.entityId : (sow.entityId as Entity)._id)
        : undefined;
      const fId = sow.forecastId
        ? (typeof sow.forecastId === 'string' ? sow.forecastId : (sow.forecastId as Forecast)._id)
        : undefined;

      setSelectedCustomerId(cId);
      setSelectedPlantId(pId);
      if (sow.currency) setCurrency(sow.currency);
      setMilestones(
        sow.milestones?.length
          ? sow.milestones.map((m) => ({
              description: m.description,
              amount: m.amount,
              deliveryDate: m.deliveryDate ? dayjs(m.deliveryDate).format('YYYY-MM-DD') : '',
            }))
          : [{ description: '', amount: 0, deliveryDate: '' }]
      );
      setAutoCreate(false);
      setUploadFile(null);
      form.setFieldsValue({
        entityId: eId,
        customerId: cId,
        plantId: pId || undefined,
        title: sow.title,
        description: sow.description,
        status: sow.status,
        forecastId: fId,
        notes: sow.notes,
      });
    } else if (open && !sow) {
      form.resetFields();
      resetSelectors();
      setMilestones([{ description: '', amount: 0, deliveryDate: '' }]);
      setAutoCreate(false);
      setUploadFile(null);
    }
  }, [open, sow, form]);

  // ── Milestone helpers ─────────────────────────────────────────────────────────

  const updateMilestone = (index: number, field: keyof MilestoneRow, value: string | number) => {
    setMilestones((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addMilestone = () =>
    setMilestones((prev) => [...prev, { description: '', amount: 0, deliveryDate: '' }]);

  const removeMilestone = (index: number) => {
    if (milestones.length === 1) {
      message.warning('At least one milestone is required');
      return;
    }
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  };

  const milestoneTotal = milestones.reduce((s, m) => s + (m.amount || 0), 0);

  // ── Mutation ──────────────────────────────────────────────────────────────────

  const mutation = useMutation({
    mutationFn: async (payload: CreateSOWPayload) => {
      const resp = isEdit
        ? await sowsApi.update(sow!._id, payload)
        : await sowsApi.create(payload);

      const savedId = (resp.data as any)?.data?._id;
      if (savedId && uploadFile?.originFileObj) {
        await sowsApi.uploadDocument(savedId, uploadFile.originFileObj);
      }
      return resp;
    },
    onSuccess: () => {
      message.success(isEdit ? 'SOW updated' : 'SOW created');
      qc.invalidateQueries({ queryKey: ['sows'] });
      qc.invalidateQueries({ queryKey: ['forecasts'] });
      onSuccess();
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      message.error(data?.message || data?.errors?.[0]?.msg || 'Failed to save SOW');
    },
  });

  const handleFinish = (values: any) => {
    const incompleteMilestones = milestones.filter(
      (m) => !m.description.trim() || !m.deliveryDate
    );
    if (incompleteMilestones.length > 0) {
      message.error('All milestones must have a description and delivery date');
      return;
    }

    const hasLinkedForecast = !!values.forecastId;

    // On CREATE: require either a linked forecast or explicit autoCreate opt-in.
    // On EDIT: skip this check so users can save field changes without touching forecast mapping.
    if (!isEdit && !hasLinkedForecast && !autoCreate) {
      message.warning('Please link a forecast or choose to auto-create one before saving');
      return;
    }

    const payload: CreateSOWPayload = {
      entityId: values.entityId,
      customerId: values.customerId,
      plantId: values.plantId,
      title: values.title,
      description: values.description,
      status: values.status,
      milestones: milestones.map((m) => ({
        description: m.description,
        amount: m.amount,
        deliveryDate: m.deliveryDate,
      })),
      forecastId: values.forecastId,
      autoCreateForecast: autoCreate,
      notes: values.notes,
    };

    mutation.mutate(payload);
  };

  // ── Desktop table columns ─────────────────────────────────────────────────────

  const milestoneColumns = [
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (_: string, _row: MilestoneRow, index: number) => (
        <Input
          value={milestones[index].description}
          placeholder="Milestone description"
          size="small"
          onChange={(e) => updateMilestone(index, 'description', e.target.value)}
        />
      ),
    },
    {
      title: `Amount (${currency})`,
      dataIndex: 'amount',
      key: 'amount',
      width: 140,
      render: (_: number, _row: MilestoneRow, index: number) => (
        <InputNumber
          value={milestones[index].amount}
          min={0}
          precision={0}
          size="small"
          style={{ width: '100%' }}
          onChange={(v) => updateMilestone(index, 'amount', v ?? 0)}
        />
      ),
    },
    {
      title: 'Delivery Date',
      dataIndex: 'deliveryDate',
      key: 'deliveryDate',
      width: 145,
      render: (_: string, _row: MilestoneRow, index: number) => (
        <DatePicker
          value={milestones[index].deliveryDate ? dayjs(milestones[index].deliveryDate) : null}
          size="small"
          style={{ width: '100%' }}
          onChange={(d: Dayjs | null) =>
            updateMilestone(index, 'deliveryDate', d ? d.format('YYYY-MM-DD') : '')
          }
        />
      ),
    },
    {
      title: 'FY',
      key: 'fy',
      width: 80,
      render: (_: unknown, _row: MilestoneRow, index: number) => {
        const d = milestones[index].deliveryDate;
        return d
          ? <Tag style={{ fontSize: FONT_SIZE.xs }}>{getFYFromDate(d)}</Tag>
          : <Text type="secondary">—</Text>;
      },
    },
    {
      title: '',
      key: 'del',
      width: 36,
      render: (_: unknown, _row: MilestoneRow, index: number) => (
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeMilestone(index)} />
      ),
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Drawer
      title={isEdit ? `Edit SOW: ${sow?.sowId}` : 'New Statement of Work'}
      open={open}
      onClose={onClose}
      maskClosable={false}
      width={isMobile ? '100%' : 720}
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>
            Total: <strong>{currency} {milestoneTotal.toLocaleString()}</strong>
          </Text>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" loading={mutation.isPending} onClick={() => form.submit()}>
              {isEdit ? 'Save Changes' : 'Create SOW'}
            </Button>
          </Space>
        </div>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} requiredMark="optional">

        {/* ── Selling Entity ──────────────────────────────────────────── */}
        <SectionLabel>Selling Entity</SectionLabel>

        <Form.Item
          name="entityId"
          label="Business Entity"
          rules={[{ required: true, message: 'Select the entity raising this SOW' }]}
          extra="The legal entity in your organisation providing the service"
        >
          <Select
            placeholder={entities.length === 0 ? 'No entities configured — add one in Administration' : 'Select entity'}
            disabled={entities.length === 0}
            options={entities.map((e) => ({
              value: e._id,
              label: (
                <span>
                  {e.name}
                  <span style={{ color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, marginLeft: 6 }}>({e.entityCode})</span>
                </span>
              ),
            }))}
          />
        </Form.Item>

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
              form.setFieldsValue({ plantId: undefined, forecastId: undefined });
            }}
          />
        </Form.Item>

        <Form.Item name="plantId" label="Site" rules={[{ required: true, message: 'Select a site' }]}>
          <Select
            showSearch
            placeholder="Select site"
            disabled={isEdit || !selectedCustomerId}
            options={plants.map((p) => ({ value: p._id, label: `${p.plantName} (${p.plantCode})` }))}
            filterOption={(input, option) =>
              String(option?.label).toLowerCase().includes(input.toLowerCase())
            }
            onChange={(id) => setSelectedPlantId(id)}
          />
        </Form.Item>

        {selectedPlantId && (
          <Alert
            type="info"
            showIcon={false}
            style={{ marginBottom: 16, padding: '6px 12px' }}
            message={
              <Text style={{ fontSize: FONT_SIZE.sm }}>
                Currency for this SOW: <Tag color="blue">{currency}</Tag>
                <Text type="secondary" style={{ marginLeft: 4 }}>
                  {plants.find((p) => p._id === selectedPlantId)?.currency
                    ? '(from site configuration)'
                    : '(inherited from customer default)'}
                </Text>
              </Text>
            }
          />
        )}

        {/* ── SOW Details ─────────────────────────────────────────────── */}
        <SectionLabel>SOW Details</SectionLabel>

        <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title is required' }]}>
          <Input placeholder="e.g. SFS Phase 2 Implementation & Support" maxLength={200} />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <Input.TextArea
            rows={2}
            placeholder="Brief description of scope and deliverables…"
            maxLength={500}
          />
        </Form.Item>

        <Form.Item
          name="status"
          label="Status"
          initialValue="draft"
          style={{ maxWidth: 220 }}
          extra="Accepted / Partially Accepted are set automatically from linked POs"
        >
          <Select
            options={[
              { value: 'draft',     label: 'Draft' },
              { value: 'submitted', label: 'Submitted' },
              { value: 'linked',    label: 'Linked' },
              // System-driven by PO allocations — shown for context, not selectable.
              { value: 'partially_accepted', label: 'Partially Accepted', disabled: true },
              { value: 'accepted',           label: 'Accepted',           disabled: true },
              { value: 'closed',    label: 'Closed' },
              { value: 'archived',  label: 'Archived' },
            ]}
          />
        </Form.Item>

        {/* ── Document Upload ──────────────────────────────────────────── */}
        <SectionLabel>Document</SectionLabel>
        <Text type="secondary" style={{ fontSize: FONT_SIZE.sm, display: 'block', marginBottom: 12 }}>
          Attach a Word or PDF document. You can also upload a new version after saving.
        </Text>

        <Upload
          accept=".pdf,.doc,.docx"
          maxCount={1}
          beforeUpload={() => false}
          fileList={uploadFile ? [uploadFile] : []}
          onChange={({ fileList }) => setUploadFile(fileList.length > 0 ? fileList[fileList.length - 1] : null)}
          onRemove={() => setUploadFile(null)}
        >
          <Button icon={<UploadOutlined />}>Select File (PDF / Word)</Button>
        </Upload>

        {/* ── Milestones ───────────────────────────────────────────────── */}
        <SectionLabel>
          Milestones
          <Tag style={{ marginLeft: 8, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            {milestones.length}
          </Tag>
        </SectionLabel>
        <Text type="secondary" style={{ fontSize: FONT_SIZE.sm, display: 'block', marginBottom: 12 }}>
          Break the SOW delivery into milestones. Amounts in <Tag>{currency}</Tag>
          Total: <strong>{currency} {milestoneTotal.toLocaleString()}</strong>
        </Text>

        {isMobile ? (
          milestones.map((row, index) => (
            <MilestoneCard
              key={index}
              row={row}
              index={index}
              currency={currency}
              update={updateMilestone}
              remove={removeMilestone}
            />
          ))
        ) : (
          <Table
            dataSource={milestones.map((m, i) => ({ ...m, key: i }))}
            columns={milestoneColumns}
            pagination={false}
            size="small"
            style={{ marginBottom: 8 }}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}>
                  <Text strong style={{ fontSize: FONT_SIZE.sm }}>Total</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1}>
                  <Text strong style={{ fontSize: FONT_SIZE.md, color: COLORS.primary }}>
                    {currency} {milestoneTotal.toLocaleString()}
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} colSpan={3} />
              </Table.Summary.Row>
            )}
          />
        )}

        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={addMilestone}
          size="small"
          style={{ marginBottom: 16, width: isMobile ? '100%' : 'auto' }}
        >
          Add Milestone
        </Button>

        {/* ── Forecast Mapping ─────────────────────────────────────────── */}
        <SectionLabel>Forecast Mapping</SectionLabel>

        <Form.Item
          name="forecastId"
          label="Link to Forecast"
          extra={selectedCustomerId ? undefined : 'Select a customer first to see available forecasts'}
        >
          <Select
            showSearch
            allowClear
            placeholder="Select an existing forecast (optional)"
            disabled={!selectedCustomerId}
            options={availableForecasts.map((f) => ({
              value: f._id,
              // Plain string used by filterOption — JSX label is not searchable
              searchLabel: `${f.forecastId} ${f.description ?? ''}`.toLowerCase(),
              label: (
                <div style={{ lineHeight: '1.3' }}>
                  <div>
                    <Text code style={{ fontSize: FONT_SIZE.sm }}>{f.forecastId}</Text>
                    <Text type="secondary" style={{ fontSize: FONT_SIZE.xs, marginLeft: 6 }}>
                      {f.fy} · {f.currency} {(f.projection ?? f.totalValue).toLocaleString()}
                    </Text>
                  </div>
                  {f.description && (
                    <div style={{ color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, marginTop: 1 }}>
                      {f.description}
                    </div>
                  )}
                </div>
              ),
            }))}
            filterOption={(input, option: any) =>
              (option?.searchLabel ?? '').includes(input.toLowerCase())
            }
            onChange={() => setAutoCreate(false)}
          />
        </Form.Item>

        {/* Mismatch note — a forecast can back several SOWs, so its projection is
            kept independent of any single SOW's milestone totals. Purely informational. */}
        {selectedForecast && forecastMismatch && (
          <Alert
            type="info"
            showIcon
            icon={<ExclamationCircleOutlined />}
            style={{ marginBottom: 16 }}
            message="Milestone totals differ from the forecast projection"
            description="That's expected — a forecast can back multiple SOWs, so its projection is kept separate from any single SOW's milestones."
          />
        )}

        {/* No forecast alert — shown on CREATE only; on EDIT it is informational only */}
        {!watchedForecastId && selectedCustomerId && (
          <Alert
            type={isEdit ? 'warning' : 'info'}
            showIcon
            style={{ marginBottom: 16 }}
            message="No forecast linked"
            description={
              <div>
                <Text style={{ fontSize: FONT_SIZE.sm }}>
                  {isEdit
                    ? 'This SOW has no linked forecast. You can link one above or save without one.'
                    : 'This SOW is not linked to any forecast. A forecast helps track revenue projections.'}
                </Text>
                {!isEdit && (
                  <div style={{ marginTop: 8 }}>
                    <Button
                      size="small"
                      type={autoCreate ? 'primary' : 'default'}
                      onClick={() => setAutoCreate((v) => !v)}
                    >
                      {autoCreate ? 'Auto-create forecast — ON' : 'Auto-create a forecast from milestones'}
                    </Button>
                    {autoCreate && (
                      <Text type="secondary" style={{ fontSize: FONT_SIZE.xs, display: 'block', marginTop: 6 }}>
                        A new forecast will be created with distributions derived from the milestone delivery dates above.
                      </Text>
                    )}
                  </div>
                )}
              </div>
            }
          />
        )}

        {/* ── Notes ─────────────────────────────────────────────────────── */}
        <Divider style={{ margin: '16px 0 12px' }} />
        <Form.Item name="notes" label="Notes">
          <Input.TextArea
            rows={2}
            placeholder="Any additional context for this SOW…"
            maxLength={500}
            showCount
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
