import { useState, useEffect } from 'react';
import {
  Drawer, Form, Input, Select, Button, Typography, Divider, Tag,
  InputNumber, Table, Space, message, Alert, Grid,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { forecastsApi, CreateForecastPayload } from '@/api/forecasts';
import { entitiesApi } from '@/api/entities';
import { customersApi } from '@/api/customers';
import { customerPlantsApi } from '@/api/customerPlants';
import { Forecast, Entity, Customer, CustomerPlant, Currency } from '@/types';
import { useAuthStore } from '@/store/authStore';

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
      background: '#fafafa',
      border: '1px solid #f0f0f0',
      borderRadius: 8,
      padding: '10px 12px',
      marginBottom: 10,
    }}>
      {/* FY selector + delete */}
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
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeFYRow(index)}
        />
      </div>

      {/* 2×2 quarter grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {(['q1', 'q2', 'q3', 'q4'] as const).map((q) => (
          <div key={q}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 3 }}>
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

      {/* Row total */}
      <div style={{ marginTop: 10, textAlign: 'right' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Total: </Text>
        <Text strong style={{ fontSize: 13 }}>{currency} {total.toLocaleString()}</Text>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ForecastFormDrawer({ open, forecast, onClose, onSuccess }: Props) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const isEdit = !!forecast;
  const isAdmin = user?.role === 'finance_admin';

  const [form] = Form.useForm();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedPlantId, setSelectedPlantId] = useState<string>('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [distributions, setDistributions] = useState<DistributionRow[]>([
    { fy: FY_OPTIONS[1], q1: 0, q2: 0, q3: 0, q4: 0 },
  ]);

  // Load entities for selector
  const { data: entitiesData } = useQuery({
    queryKey: ['entities'],
    queryFn: () => entitiesApi.list(),
    enabled: open,
  });
  const entities: Entity[] = (entitiesData?.data as any)?.data || [];
  const defaultEntity = entities.find((e) => e.isDefault);

  // Pre-select default entity when opening in create mode
  useEffect(() => {
    if (open && !isEdit && defaultEntity && !form.getFieldValue('entityId')) {
      form.setFieldsValue({ entityId: defaultEntity._id });
    }
  }, [open, isEdit, defaultEntity, form]);

  // Load customers — admins see all, forecast users see only assigned
  const { data: customersData } = useQuery({
    queryKey: ['customers-for-forecast'],
    queryFn: () => customersApi.list({ isActive: true, limit: 200 }),
    enabled: open,
  });
  const allCustomers: Customer[] = (customersData?.data as any)?.data || [];
  const customers = isAdmin
    ? allCustomers
    : allCustomers.filter((c) => {
        const assigned = (user?.assignedCustomers || []).map((x) =>
          typeof x === 'string' ? x : (x as Customer)._id
        );
        return assigned.includes(c._id);
      });

  // Load plants for selected customer
  const { data: plantsData } = useQuery({
    queryKey: ['plants-for-forecast', selectedCustomerId],
    queryFn: () => customerPlantsApi.listByCustomer(selectedCustomerId),
    enabled: open && !!selectedCustomerId,
  });
  const allPlants: CustomerPlant[] = (plantsData?.data as any)?.data || [];
  const plants = isAdmin
    ? allPlants
    : allPlants.filter((p) => {
        const assigned = (user?.assignedSites || []).map((x) =>
          typeof x === 'string' ? x : (x as CustomerPlant)._id
        );
        return assigned.includes(p._id);
      });

  // Derive currency when plant changes
  useEffect(() => {
    if (!selectedPlantId) return;
    const plant = plants.find((p) => p._id === selectedPlantId);
    if (plant?.currency) {
      setCurrency(plant.currency);
    } else {
      const customer = customers.find((c) => c._id === selectedCustomerId);
      setCurrency(customer?.defaultCurrency || 'USD');
    }
  }, [selectedPlantId, plants, customers, selectedCustomerId]);

  // Populate form in edit mode
  useEffect(() => {
    if (open && forecast) {
      const cId = typeof forecast.customerId === 'string'
        ? forecast.customerId
        : (forecast.customerId as Customer)._id;
      const pId = typeof forecast.plantId === 'string'
        ? forecast.plantId
        : (forecast.plantId as CustomerPlant)._id;
      setSelectedCustomerId(cId);
      setSelectedPlantId(pId);
      setCurrency(forecast.currency);
      setDistributions(
        forecast.distributions.map((d) => ({
          fy: d.fy, q1: d.q1, q2: d.q2, q3: d.q3, q4: d.q4,
        }))
      );
      const eId = forecast.entityId
        ? (typeof forecast.entityId === 'string' ? forecast.entityId : (forecast.entityId as Entity)._id)
        : undefined;
      form.setFieldsValue({
        entityId: eId,
        customerId: cId,
        plantId: pId,
        description: forecast.description,
        fy: forecast.fy,
        status: forecast.status,
        notes: forecast.notes,
      });
    } else if (open && !forecast) {
      form.resetFields();
      form.setFieldsValue({ fy: FY_OPTIONS[1] });
      setSelectedCustomerId('');
      setSelectedPlantId('');
      setCurrency('USD');
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
    mutation.mutate({
      entityId: values.entityId,
      customerId: values.customerId,
      plantId: values.plantId,
      description: values.description,
      fy: values.fy,
      status: values.status || 'projected',
      distributions: distributions.map((d) => ({ ...d, total: d.q1 + d.q2 + d.q3 + d.q4 })),
      notes: values.notes,
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

  const grandTotal = distributions.reduce(
    (sum, d) => sum + d.q1 + d.q2 + d.q3 + d.q4, 0
  );

  // Desktop-only table columns
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
        return <Text strong style={{ fontSize: 13 }}>{currency} {t.toLocaleString()}</Text>;
      },
    },
    {
      title: '',
      key: 'del',
      width: 36,
      render: (_: unknown, _row: DistributionRow, index: number) => (
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeFYRow(index)}
        />
      ),
    },
  ];

  return (
    <Drawer
      title={isEdit ? `Edit Forecast: ${forecast?.forecastId}` : 'New Forecast'}
      open={open}
      onClose={onClose}
      width={isMobile ? '100%' : 680}
      destroyOnClose
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Grand total: <strong>{currency} {grandTotal.toLocaleString()}</strong>
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
                  <span style={{ color: '#8c8c8c', fontSize: 11, marginLeft: 6 }}>({e.entityCode})</span>
                </span>
              ),
            }))}
          />
        </Form.Item>

        {/* ── Customer & Site ─────────────────────────────────────────── */}
        <SectionLabel>Customer & Site</SectionLabel>

        <Form.Item
          name="customerId"
          label="Customer"
          rules={[{ required: true, message: 'Select a customer' }]}
        >
          <Select
            showSearch
            placeholder="Select customer"
            disabled={isEdit}
            options={customers.map((c) => ({
              value: c._id,
              label: c.displayName || c.name,
            }))}
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

        <Form.Item
          name="plantId"
          label="Site"
          rules={[{ required: true, message: 'Select a site' }]}
        >
          <Select
            showSearch
            placeholder="Select site"
            disabled={isEdit || !selectedCustomerId}
            options={plants.map((p) => ({
              value: p._id,
              label: `${p.plantName} (${p.plantCode})`,
            }))}
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
              <Text style={{ fontSize: 12 }}>
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
                { value: 'projected', label: 'Projected' },
                { value: 'signed',    label: 'Signed' },
                { value: 'closed',    label: 'Closed' },
              ]}
            />
          </Form.Item>
        </div>

        {/* ── Revenue Distribution ─────────────────────────────────────── */}
        <SectionLabel>Revenue Distribution</SectionLabel>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          Break down the total forecast across financial years and quarters. All amounts in <Tag>{currency}</Tag>
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
              background: '#f0f5ff',
              borderRadius: 6,
              marginBottom: 10,
            }}>
              <Text strong style={{ fontSize: 13 }}>Grand Total</Text>
              <Text strong style={{ fontSize: 14, color: '#1677ff' }}>
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
                  <Text strong style={{ fontSize: 12 }}>Grand Total</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} colSpan={4} />
                <Table.Summary.Cell index={5}>
                  <Text strong style={{ fontSize: 13, color: '#1677ff' }}>
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
