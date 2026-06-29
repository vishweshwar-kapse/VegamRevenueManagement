import { useState, useEffect } from 'react';
import {
  Drawer, Form, Input, Select, Button, Typography, Divider, Tag,
  InputNumber, Table, Space, message, Alert, Grid,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { forecastsApi, CreateForecastPayload } from '@/api/forecasts';
import { Forecast, Entity, Customer, CustomerPlant, Currency } from '@/types';
import { useFormSelectors } from '@/hooks/useFormSelectors';
import SectionLabel from '@/components/Form/SectionLabel';
import { COLORS, FONT_SIZE } from '@/constants/theme';

const { Text } = Typography;
const { useBreakpoint } = Grid;

interface Props {
  open: boolean;
  forecast: Forecast | null;
  onClose: () => void;
  /** Receives the saved forecast's primary FY so the list can switch to it */
  onSuccess: (savedFy: string) => void;
}

interface DistributionRow {
  fy: string;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

function getFYOptions(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const fyStartYear = month >= 4 ? year : year - 1;
  return [-1, 0, 1, 2].map((offset) => {
    const s = fyStartYear + offset;
    return `FY${String(s).slice(-2)}-${String(s + 1).slice(-2)}`;
  });
}

const FY_OPTIONS = getFYOptions();

// ── Mobile card for one distribution row ─────────────────────────────────────

interface DistCardProps {
  row: DistributionRow;
  index: number;
  distributions: DistributionRow[];
  currency: Currency;
  updateDistRow: (index: number, field: keyof DistributionRow, value: number | string) => void;
  removeFYRow: (index: number) => void;
}

function DistributionCard({ row, index, distributions, currency, updateDistRow, removeFYRow }: DistCardProps) {
  const total = row.q1 + row.q2 + row.q3 + row.q4;
  return (
    <div style={{
      background: COLORS.bgSubtle,
      border: `1px solid ${COLORS.borderLight}`,
      borderRadius: 8,
      padding: '10px 12px',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Select
          value={row.fy}
          style={{ width: 130 }}
          options={FY_OPTIONS.map((fy) => ({
            value: fy,
            label: fy,
            disabled: distributions.some((d, i) => d.fy === fy && i !== index),
          }))}
          onChange={(v) => updateDistRow(index, 'fy', v)}
        />
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeFYRow(index)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {(['q1', 'q2', 'q3', 'q4'] as const).map((q) => (
          <div key={q}>
            <Text type="secondary" style={{ fontSize: FONT_SIZE.xs, display: 'block', marginBottom: 3 }}>
              {q.toUpperCase()}
            </Text>
            <InputNumber
              value={row[q]}
              min={0}
              precision={0}
              style={{ width: '100%' }}
              onChange={(v) => updateDistRow(index, q, v ?? 0)}
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, textAlign: 'right' }}>
        <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>Total: </Text>
        <Text strong style={{ fontSize: FONT_SIZE.md }}>{currency} {total.toLocaleString()}</Text>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ForecastFormDrawer({ open, forecast, onClose, onSuccess }: Props) {
  const qc = useQueryClient();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isEdit = !!forecast;

  const [form] = Form.useForm();
  const [distributions, setDistributions] = useState<DistributionRow[]>([
    { fy: FY_OPTIONS[1], q1: 0, q2: 0, q3: 0, q4: 0 },
  ]);

  const {
    entities, defaultEntity,
    customers, plants,
    selectedCustomerId, setSelectedCustomerId,
    selectedPlantId, setSelectedPlantId,
    currency, setCurrency,
    resetSelectors,
  } = useFormSelectors({ open });

  // Pre-select default entity in create mode
  useEffect(() => {
    if (open && !isEdit && defaultEntity && !form.getFieldValue('entityId')) {
      form.setFieldsValue({ entityId: defaultEntity._id });
    }
  }, [open, isEdit, defaultEntity, form]);

  // Populate form in edit mode / reset in create mode
  useEffect(() => {
    if (open && forecast) {
      const cId = typeof forecast.customerId === 'string'
        ? forecast.customerId
        : (forecast.customerId as Customer)._id;
      const pId = typeof forecast.plantId === 'string'
        ? forecast.plantId
        : (forecast.plantId as CustomerPlant)._id;
      const eId = forecast.entityId
        ? (typeof forecast.entityId === 'string' ? forecast.entityId : (forecast.entityId as Entity)._id)
        : undefined;

      setSelectedCustomerId(cId);
      setSelectedPlantId(pId);
      setCurrency(forecast.currency);
      setDistributions(
        forecast.distributions.map((d) => ({
          fy: d.fy, q1: d.q1, q2: d.q2, q3: d.q3, q4: d.q4,
        }))
      );
      form.setFieldsValue({
        entityId: eId,
        customerId: cId,
        plantId: pId,
        description: forecast.description,
        fy: forecast.fy,
        status: forecast.status,
        notes: forecast.notes,
        projection: forecast.projection,
        signedValue: forecast.status === 'signed' ? forecast.signedValue : undefined,
      });
    } else if (open && !forecast) {
      form.resetFields();
      form.setFieldsValue({ fy: FY_OPTIONS[1] });
      resetSelectors();
      setDistributions([{ fy: FY_OPTIONS[1], q1: 0, q2: 0, q3: 0, q4: 0 }]);
    }
  }, [open, forecast, form]);

  const mutation = useMutation({
    mutationFn: (payload: CreateForecastPayload) =>
      isEdit
        ? forecastsApi.update(forecast!._id, payload)
        : forecastsApi.create(payload),
    onSuccess: (_, payload) => {
      message.success(isEdit ? 'Forecast updated' : 'Forecast created');
      qc.invalidateQueries({ queryKey: ['forecasts'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      onSuccess(payload.fy);
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      message.error(data?.message || data?.errors?.[0]?.msg || 'Failed to save forecast');
    },
  });

  const handleFinish = (values: any) => {
    const projectionNum = Number(values.projection) || 0;
    if (grandTotal !== projectionNum) {
      message.error(
        `Distribution total (${currency} ${grandTotal.toLocaleString()}) must equal the Projection Value (${currency} ${projectionNum.toLocaleString()})`
      );
      return;
    }
    mutation.mutate({
      entityId: values.entityId,
      customerId: values.customerId,
      plantId: values.plantId,
      description: values.description,
      fy: values.fy,
      status: values.status || 'projected',
      distributions: distributions.map((d) => ({ ...d, total: d.q1 + d.q2 + d.q3 + d.q4 })),
      notes: values.notes,
      projection: projectionNum,
      signedValue: values.status === 'signed' ? values.signedValue : undefined,
    });
  };

  const updateDistRow = (index: number, field: keyof DistributionRow, value: number | string) => {
    setDistributions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addFYRow = () => {
    const usedFYs = distributions.map((d) => d.fy);
    const nextFY = FY_OPTIONS.find((fy) => !usedFYs.includes(fy));
    if (!nextFY) {
      message.warning('No more financial years available to add');
      return;
    }
    setDistributions((prev) => [...prev, { fy: nextFY, q1: 0, q2: 0, q3: 0, q4: 0 }]);
  };

  const removeFYRow = (index: number) => {
    if (distributions.length === 1) {
      message.warning('At least one financial year is required');
      return;
    }
    setDistributions((prev) => prev.filter((_, i) => i !== index));
  };

  const grandTotal = distributions.reduce((sum, d) => sum + d.q1 + d.q2 + d.q3 + d.q4, 0);

  const watchedProjection = Form.useWatch('projection', form);
  const watchedStatus = Form.useWatch('status', form);
  const projectionValue = Number(watchedProjection) || 0;
  const remainingValue = projectionValue - grandTotal;
  const remainingColor = remainingValue === 0 ? COLORS.success : COLORS.error;

  const distColumns = [
    {
      title: 'Financial Year',
      dataIndex: 'fy',
      key: 'fy',
      width: 130,
      render: (_: string, _row: DistributionRow, index: number) => (
        <Select
          value={distributions[index].fy}
          size="small"
          style={{ width: '100%' }}
          options={FY_OPTIONS.map((fy) => ({
            value: fy,
            label: fy,
            disabled: distributions.some((d, i) => d.fy === fy && i !== index),
          }))}
          onChange={(v) => updateDistRow(index, 'fy', v)}
        />
      ),
    },
    ...(['q1', 'q2', 'q3', 'q4'] as const).map((q) => ({
      title: q.toUpperCase(),
      dataIndex: q,
      key: q,
      width: 100,
      render: (_: number, _row: DistributionRow, index: number) => (
        <InputNumber
          value={distributions[index][q]}
          min={0}
          precision={0}
          size="small"
          style={{ width: '100%' }}
          onChange={(v) => updateDistRow(index, q, v ?? 0)}
        />
      ),
    })),
    {
      title: 'Total',
      key: 'total',
      width: 110,
      render: (_: unknown, _row: DistributionRow, index: number) => {
        const d = distributions[index];
        const t = d.q1 + d.q2 + d.q3 + d.q4;
        return <Text strong style={{ fontSize: FONT_SIZE.md }}>{currency} {t.toLocaleString()}</Text>;
      },
    },
    {
      title: '',
      key: 'del',
      width: 36,
      render: (_: unknown, _row: DistributionRow, index: number) => (
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeFYRow(index)} />
      ),
    },
  ];

  return (
    <Drawer
      title={isEdit ? `Edit Forecast: ${forecast?.forecastId}` : 'New Forecast'}
      open={open}
      onClose={onClose}
      maskClosable={false}
      width={isMobile ? '100%' : 680}
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>
            Allocated: <strong>{currency} {grandTotal.toLocaleString()}</strong>
            {' / '}Projection: <strong>{currency} {projectionValue.toLocaleString()}</strong>
          </Text>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" loading={mutation.isPending} onClick={() => form.submit()}>
              {isEdit ? 'Save Changes' : 'Create Forecast'}
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
          rules={[{ required: true, message: 'Select the entity raising this forecast' }]}
          extra="The legal entity in your organisation providing the service or product"
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
              form.setFieldValue('plantId', undefined);
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
                Currency for this forecast: <Tag color="blue">{currency}</Tag>
                <Text type="secondary" style={{ marginLeft: 4 }}>
                  {plants.find((p) => p._id === selectedPlantId)?.currency
                    ? '(from site configuration)'
                    : '(inherited from customer default)'}
                </Text>
              </Text>
            }
          />
        )}

        {/* ── Forecast Details ─────────────────────────────────────────── */}
        <SectionLabel>Forecast Details</SectionLabel>

        <Form.Item
          name="description"
          label="Description"
          rules={[{ required: true, message: 'Description is required' }]}
        >
          <Input placeholder="e.g. Annual SFS deployment and services engagement" maxLength={200} />
        </Form.Item>

        <div style={{ display: 'flex', gap: 12 }}>
          <Form.Item
            name="fy"
            label="Primary FY"
            rules={[{ required: true, message: 'Select primary FY' }]}
            style={{ flex: 1 }}
            extra={!isMobile ? 'Primary FY for this forecast; revenue below can span multiple FYs' : undefined}
          >
            <Select
              placeholder="Select FY"
              options={FY_OPTIONS.map((fy) => ({ value: fy, label: fy }))}
            />
          </Form.Item>

          <Form.Item name="status" label="Status" style={{ flex: 1 }} initialValue="projected">
            <Select
              options={[
                { value: 'projected', label: 'Projection' },
                { value: 'signed',    label: 'Signed' },
                { value: 'closed',    label: 'Closed' },
              ]}
            />
          </Form.Item>
        </div>

        <Form.Item
          name="projection"
          label="Projection Value"
          rules={[{ required: true, message: 'Projection Value is required' }]}
          extra={`Total projected revenue for this forecast in ${currency}`}
        >
          <InputNumber min={0} precision={0} style={{ width: '100%' }} />
        </Form.Item>

        {watchedStatus === 'signed' && (
          <Form.Item
            name="signedValue"
            label="Signed Value"
            rules={[{ required: true, message: 'Signed Value is required when status is Signed' }]}
            extra={`Confirmed signed amount in ${currency}`}
          >
            <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="Enter signed value" />
          </Form.Item>
        )}

        {/* ── Revenue Distribution ─────────────────────────────────────── */}
        <SectionLabel>Revenue Distribution</SectionLabel>
        <Text type="secondary" style={{ fontSize: FONT_SIZE.sm, display: 'block', marginBottom: 12 }}>
          Break down the total forecast across financial years and quarters. All amounts in <Tag>{currency}</Tag>
        </Text>

        <Text type="secondary" style={{ fontSize: FONT_SIZE.sm, display: 'block', marginBottom: 12 }}>
          Allocated: {currency} {grandTotal.toLocaleString()} / {currency} {projectionValue.toLocaleString()} — Remaining:{' '}
          <span style={{ color: remainingColor }}>
            {currency} {remainingValue.toLocaleString()}
          </span>
        </Text>

        {isMobile ? (
          <>
            {distributions.map((row, index) => (
              <DistributionCard
                key={index}
                row={row}
                index={index}
                distributions={distributions}
                currency={currency}
                updateDistRow={updateDistRow}
                removeFYRow={removeFYRow}
              />
            ))}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              background: COLORS.bgHighlight,
              borderRadius: 6,
              marginBottom: 10,
            }}>
              <Text strong style={{ fontSize: FONT_SIZE.md }}>Grand Total</Text>
              <Text strong style={{ fontSize: FONT_SIZE.lg, color: COLORS.primary }}>
                {currency} {grandTotal.toLocaleString()}
              </Text>
            </div>
          </>
        ) : (
          <Table
            dataSource={distributions.map((d, i) => ({ ...d, key: i }))}
            columns={distColumns}
            pagination={false}
            size="small"
            style={{ marginBottom: 8 }}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}>
                  <Text strong style={{ fontSize: FONT_SIZE.sm }}>Grand Total</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} colSpan={4} />
                <Table.Summary.Cell index={5}>
                  <Text strong style={{ fontSize: FONT_SIZE.md, color: COLORS.primary }}>
                    {currency} {grandTotal.toLocaleString()}
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} />
              </Table.Summary.Row>
            )}
          />
        )}

        {distributions.length < FY_OPTIONS.length && (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={addFYRow}
            size="small"
            style={{ marginBottom: 16, width: isMobile ? '100%' : 'auto' }}
          >
            Add Financial Year
          </Button>
        )}

        {/* ── Notes ─────────────────────────────────────────────────────── */}
        <Divider style={{ margin: '16px 0 12px' }} />
        <Form.Item name="notes" label="Notes">
          <Input.TextArea
            rows={2}
            placeholder="Any additional context for this forecast…"
            maxLength={500}
            showCount
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
