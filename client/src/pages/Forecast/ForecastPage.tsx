import { useState } from 'react';
import {
  Card, Table, Button, Tag, Space, Typography, Select, Input, Statistic,
  Row, Col, Popconfirm, Tooltip, message, Grid, Empty,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { forecastsApi } from '@/api/forecasts';
import { Forecast, ForecastStatus, Customer, CustomerPlant, Currency } from '@/types';
import { useIsForecastUser } from '@/store/authStore';
import ForecastFormDrawer from './ForecastFormDrawer';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const STATUS_COLORS: Record<ForecastStatus, string> = {
  projected: 'blue',
  signed: 'green',
  closed: 'default',
};

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

const fmt = (v: number, currency?: Currency) => {
  const prefix = currency ? `${currency} ` : '';
  if (v >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${prefix}${(v / 1_000).toFixed(0)}K`;
  return `${prefix}${v.toLocaleString()}`;
};

export default function ForecastPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isForecastUser = useIsForecastUser();
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

  const total = forecasts.reduce((s, f) => s + f.totalValue, 0);
  const signed = forecasts.filter((f) => f.status === 'signed').reduce((s, f) => s + f.totalValue, 0);
  const projected = forecasts.filter((f) => f.status === 'projected').reduce((s, f) => s + f.totalValue, 0);

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
        <Tag color={STATUS_COLORS[s]}>{s.charAt(0).toUpperCase() + s.slice(1)}</Tag>
      ),
    },
    {
      title: 'Total Value',
      dataIndex: 'totalValue',
      key: 'totalValue',
      width: 130,
      align: 'right' as const,
      render: (v: number, r: Forecast) => (
        <Text strong style={{ fontSize: 13 }}>{fmt(v, r.currency)}</Text>
      ),
    },
    {
      title: 'Owner',
      key: 'owner',
      width: 120,
      render: (_: unknown, r: Forecast) => {
        const owner = typeof r.ownerId === 'string' ? null : (r.ownerId as any);
        return <Text style={{ fontSize: 12 }}>{owner?.name || '—'}</Text>;
      },
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 100,
      render: (d: string) => <Text style={{ fontSize: 11 }}>{dayjs(d).format('DD MMM YY')}</Text>,
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
          <Text type="secondary" style={{ fontSize: 13 }}>
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
          { label: 'Total Forecast', value: total,     color: '#1677ff' },
          { label: 'Signed',         value: signed,    color: '#52c41a' },
          { label: 'Projected',      value: projected, color: '#722ed1' },
        ].map((item) => (
          <Col xs={8} key={item.label}>
            <Card size="small" styles={{ body: { padding: '10px 14px' } }}>
              <Statistic
                title={<span style={{ fontSize: 11 }}>{item.label}</span>}
                value={item.value}
                formatter={(v) => fmt(Number(v))}
                valueStyle={{ fontSize: isMobile ? 14 : 18, color: item.color }}
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
            style={{ width: 140 }}
            onChange={setStatusFilter}
            options={[
              { value: 'projected', label: 'Projected' },
              { value: 'signed',    label: 'Signed' },
              { value: 'closed',    label: 'Closed' },
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

      {/* Table */}
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={forecasts}
          columns={columns}
          rowKey="_id"
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} forecasts` }}
          size="small"
          scroll={{ x: 900 }}
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
