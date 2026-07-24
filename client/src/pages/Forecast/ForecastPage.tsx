import { useState } from 'react';
import {
  Card, Table, Button, Tag, Space, Typography, Select, Input, Statistic,
  Row, Col, Popconfirm, Tooltip, message, Grid, Empty, Modal,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { forecastsApi } from '@/api/forecasts';
import { entitiesApi } from '@/api/entities';
import { customersApi } from '@/api/customers';
import { customerPlantsApi } from '@/api/customerPlants';
import { Forecast, ForecastStatus, Customer, CustomerPlant } from '@/types';
import { useIsForecastUser, useAuthStore } from '@/store/authStore';
import { FORECAST_STATUS_COLORS, FORECAST_STATUS_LABELS, COLORS, FONT_SIZE } from '@/constants/theme';
import { fmt } from '@/utils/format';
import BulkUploadSection from '@/components/BulkUpload/BulkUploadSection';
import {
  ForecastRefData, FailedRow, generateTemplate, parseAndValidate,
  buildErrorWorkbook, exportForecasts, payloadToFailedRow, saveBlob,
} from '@/utils/forecastBulk';
import ForecastFormDrawer from './ForecastFormDrawer';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

function getFYOptions(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const fyStart = month >= 4 ? year : year - 1;
  return [-1, 0, 1, 2].map((offset) => {
    const s = fyStart + offset;
    return `FY${String(s).slice(-2)}-${String(s + 1).slice(-2)}`;
  });
}

const FY_OPTIONS = getFYOptions();
const CURRENT_FY = FY_OPTIONS[1];

export default function ForecastPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isForecastUser = useIsForecastUser();
  const currentUser = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedForecast, setSelectedForecast] = useState<Forecast | null>(null);
  const [fy, setFy] = useState(CURRENT_FY);
  const [statusFilter, setStatusFilter] = useState<ForecastStatus | undefined>(undefined);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['forecasts', fy, statusFilter],
    queryFn: () => forecastsApi.list({ fy, status: statusFilter, limit: 200 }),
    enabled: isForecastUser,
  });

  const rawForecasts: Forecast[] = (data?.data as any)?.data || [];
  const forecasts = search
    ? rawForecasts.filter((f) => {
        const cName = typeof f.customerId === 'string' ? '' : (f.customerId as Customer).name;
        const pName = typeof f.plantId === 'string' ? '' : (f.plantId as CustomerPlant).plantName;
        return (
          f.description.toLowerCase().includes(search.toLowerCase()) ||
          f.forecastId.toLowerCase().includes(search.toLowerCase()) ||
          cName.toLowerCase().includes(search.toLowerCase()) ||
          pName.toLowerCase().includes(search.toLowerCase())
        );
      })
    : rawForecasts;

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => forecastsApi.deactivate(id),
    onSuccess: () => {
      message.success('Forecast removed');
      qc.invalidateQueries({ queryKey: ['forecasts'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onError: () => message.error('Failed to remove forecast'),
  });

  const openCreate = () => {
    setSelectedForecast(null);
    setDrawerOpen(true);
  };

  const openEdit = (f: Forecast) => {
    setSelectedForecast(f);
    setDrawerOpen(true);
  };

  // ── Bulk upload ────────────────────────────────────────────────────────────
  const today = () => new Date().toISOString().slice(0, 10);

  // Reference data for the template dropdowns — restricted to what THIS user can
  // access, mirroring the drawer selectors (finance_admin sees everything;
  // others see only their assigned customers/sites). Entities aren't
  // access-controlled per user, so all are offered.
  const loadRefData = async (): Promise<ForecastRefData> => {
    const [eRes, cRes, pRes] = await Promise.all([
      entitiesApi.list(),
      customersApi.list({ isActive: true, limit: 500 }),
      customerPlantsApi.listAll(),
    ]);
    const allEntities = (eRes.data as any)?.data || [];
    const allCustomers: Customer[] = (cRes.data as any)?.data || [];
    const allPlants: CustomerPlant[] = (pRes.data as any)?.data || [];

    const isAdmin = currentUser?.role === 'finance_admin';
    const idOf = (x: unknown) => (typeof x === 'string' ? x : (x as { _id: string })?._id);
    const assignedCustomers = (currentUser?.assignedCustomers || []).map(idOf);
    const assignedSites = (currentUser?.assignedSites || []).map(idOf);

    return {
      entities: allEntities,
      customers: isAdmin ? allCustomers : allCustomers.filter((c) => assignedCustomers.includes(c._id)),
      plants: isAdmin ? allPlants : allPlants.filter((p) => assignedSites.includes(p._id)),
    };
  };

  const handleDownloadTemplate = async () => {
    try {
      const ref = await loadRefData();
      saveBlob(await generateTemplate(ref), 'forecast-import-template.xlsx');
    } catch {
      message.error('Failed to generate the template');
    }
  };

  const handleUpload = async (file: File) => {
    try {
      const ref = await loadRefData();
      const { valid, failed, totalDataRows } = await parseAndValidate(file, ref);

      if (totalDataRows === 0) {
        message.warning('The uploaded file has no data rows.');
        return;
      }

      // Upload the client-valid rows; collect any server-side rejections.
      const serverFailed: FailedRow[] = [];
      let uploaded = 0;
      for (const item of valid) {
        try {
          await forecastsApi.create(item.payload);
          uploaded += 1;
        } catch (err: any) {
          const msg =
            err?.response?.data?.message ||
            err?.response?.data?.errors?.[0]?.msg ||
            'Server rejected this record';
          serverFailed.push(payloadToFailedRow(item.payload, ref, msg));
        }
      }

      if (uploaded > 0) {
        qc.invalidateQueries({ queryKey: ['forecasts'] });
        qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      }

      const allFailed = [...failed, ...serverFailed];
      if (allFailed.length > 0) {
        saveBlob(await buildErrorWorkbook(allFailed), `forecast-upload-errors-${today()}.xlsx`);
        Modal.warning({
          title: 'Some records could not be uploaded',
          content: `${uploaded} of ${totalDataRows} record(s) uploaded. ${allFailed.length} failed validation — a file containing only the failed rows has been downloaded, with the reason commented on each flagged cell.`,
        });
      } else {
        Modal.success({
          title: 'Upload successful',
          content: `${uploaded} forecast${uploaded === 1 ? '' : 's'} uploaded successfully.`,
        });
      }
    } catch (err: any) {
      message.error(err?.message || 'Failed to process the uploaded file');
    }
  };

  const handleExport = async () => {
    if (forecasts.length === 0) {
      message.info('No records to export.');
      return;
    }
    try {
      saveBlob(await exportForecasts(forecasts), `forecasts-${fy}-${today()}.xlsx`);
    } catch {
      message.error('Failed to export records');
    }
  };

  // Signed / projected reflect actual PO-confirmed amounts (not whole-forecast
  // status buckets) so partial PO signing is visible immediately.
  const total = forecasts.reduce((s, f) => s + f.totalValue, 0);
  const signed = forecasts.reduce((s, f) => s + (f.signedValue || 0), 0);
  const projected = forecasts.reduce(
    (s, f) => s + (f.projectedValue ?? Math.max(f.totalValue - (f.signedValue || 0), 0)),
    0
  );

  const columns = [
    {
      title: 'Forecast ID',
      dataIndex: 'forecastId',
      key: 'forecastId',
      width: 130,
      render: (id: string) => <Text code style={{ fontSize: 12 }}>{id}</Text>,
    },
    {
      title: 'Customer / Site',
      key: 'customer',
      render: (_: unknown, r: Forecast) => {
        const customer = typeof r.customerId === 'string' ? null : r.customerId as Customer;
        const plant = typeof r.plantId === 'string' ? null : r.plantId as CustomerPlant;
        return (
          <div>
            <Text strong style={{ fontSize: 13 }}>{customer?.name || '—'}</Text>
            {plant && (
              <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
                {plant.plantName} · {plant.plantCode}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (d: string) => (
        <Tooltip title={d}>
          <Text ellipsis style={{ maxWidth: 200, fontSize: 13 }}>{d}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'FY',
      dataIndex: 'fy',
      key: 'fy',
      width: 80,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s: ForecastStatus) => (
        <Tag color={FORECAST_STATUS_COLORS[s]}>{FORECAST_STATUS_LABELS[s] || s}</Tag>
      ),
    },
    {
      title: 'Total Value',
      dataIndex: 'totalValue',
      key: 'totalValue',
      width: 130,
      align: 'right' as const,
      render: (v: number, r: Forecast) => (
        <Text strong style={{ fontSize: FONT_SIZE.md }}>{fmt(v, r.currency)}</Text>
      ),
    },
    {
      title: 'Signed / Pending',
      key: 'signed',
      width: 150,
      align: 'right' as const,
      render: (_: unknown, r: Forecast) => {
        const signedVal = r.signedValue || 0;
        const pending = r.projectedValue ?? Math.max(r.totalValue - signedVal, 0);
        const fullySigned = r.totalValue > 0 && signedVal >= r.totalValue;
        return (
          <div>
            <Text style={{ fontSize: FONT_SIZE.sm, color: COLORS.success }}>
              {fmt(signedVal, r.currency)}
            </Text>
            <Text type="secondary" style={{ display: 'block', fontSize: FONT_SIZE.xs }}>
              {fullySigned ? 'Fully signed' : `${fmt(pending, r.currency)} pending`}
            </Text>
          </div>
        );
      },
    },
    {
      title: 'Owner',
      key: 'owner',
      width: 120,
      render: (_: unknown, r: Forecast) => {
        const owner = typeof r.ownerId === 'string' ? null : (r.ownerId as any);
        return <Text style={{ fontSize: FONT_SIZE.sm }}>{owner?.name || '—'}</Text>;
      },
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 100,
      render: (d: string) => <Text style={{ fontSize: FONT_SIZE.xs }}>{dayjs(d).format('DD MMM YY')}</Text>,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: unknown, r: Forecast) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title="Remove">
            <Popconfirm
              title="Remove this forecast?"
              description="This action cannot be undone."
              onConfirm={() => deactivateMutation.mutate(r._id)}
              okText="Remove"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (!isForecastUser) {
    return (
      <Card>
        <Empty description="You don't have access to the Forecast module." />
      </Card>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>Revenue Forecast</Title>
          <Text type="secondary" style={{ fontSize: FONT_SIZE.md }}>
            Site-level revenue predictions across financial years
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          {!isMobile && 'New Forecast'}
        </Button>
      </div>

      {/* Summary strip */}
      <Row gutter={[10, 10]} style={{ marginBottom: 16 }}>
        {[
          { label: 'Total Forecast', value: total,     color: COLORS.primary },
          { label: 'Signed',         value: signed,    color: COLORS.success },
          { label: 'Projected',      value: projected, color: COLORS.purple },
        ].map((item) => (
          <Col xs={8} key={item.label}>
            <Card size="small" styles={{ body: { padding: '10px 14px' } }}>
              <Statistic
                title={<span style={{ fontSize: FONT_SIZE.xs }}>{item.label}</span>}
                value={item.value}
                formatter={(v) => fmt(Number(v))}
                valueStyle={{ fontSize: isMobile ? FONT_SIZE.lg : FONT_SIZE.xl, color: item.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 12 }} styles={{ body: { padding: '10px 12px' } }}>
        <Space wrap>
          <Select
            value={fy}
            onChange={setFy}
            style={{ width: 120 }}
            options={FY_OPTIONS.map((f) => ({ value: f, label: f }))}
          />
          <Select
            value={statusFilter}
            placeholder="All statuses"
            allowClear
            style={{ width: 240 }}
            onChange={setStatusFilter}
            options={[
              { value: 'forecast_projected',            label: 'Forecast Projected' },
              { value: 'partial_sow_partial_projected', label: 'Partial SoW/Partial Projected' },
              { value: 'partial_sow_partial_closed',    label: 'Partial SoW/Partial Closed' },
              { value: 'forecast_cancelled',            label: 'Forecast Cancelled' },
            ]}
          />
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search customer, site or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: isMobile ? '100%' : 280 }}
          />
        </Space>
      </Card>

      {/* Bulk Upload */}
      <BulkUploadSection
        title="Bulk Upload"
        description="Download the template, fill in your forecasts, and upload. Download exports the currently filtered records."
        onDownloadTemplate={handleDownloadTemplate}
        onUpload={handleUpload}
        onExport={handleExport}
      />

      {/* Table */}
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={forecasts}
          columns={columns}
          rowKey="_id"
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} forecasts` }}
          size="small"
          scroll={{ x: 1050 }}
          locale={{ emptyText: 'No forecasts found. Create your first forecast.' }}
        />
      </Card>

      <ForecastFormDrawer
        open={drawerOpen}
        forecast={selectedForecast}
        onClose={() => setDrawerOpen(false)}
        onSuccess={(savedFy) => {
          if (savedFy !== fy) setFy(savedFy);
          setDrawerOpen(false);
        }}
      />
    </div>
  );
}
