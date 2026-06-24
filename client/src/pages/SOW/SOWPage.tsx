import { useState } from 'react';
import {
  Card, Table, Button, Tag, Space, Typography, Select, Input, Statistic,
  Row, Col, Popconfirm, Tooltip, message, Grid, Empty,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { sowsApi } from '@/api/sows';
import { SOW, SOWStatus, Customer, CustomerPlant, Forecast } from '@/types';
import { useIsForecastUser } from '@/store/authStore';
import { SOW_STATUS_COLORS, SOW_STATUS_LABELS, COLORS, FONT_SIZE } from '@/constants/theme';
import { fmt } from '@/utils/format';
import SOWFormDrawer from './SOWFormDrawer';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function SOWPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isForecastUser = useIsForecastUser();
  const qc = useQueryClient();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSOW, setSelectedSOW] = useState<SOW | null>(null);
  const [statusFilter, setStatusFilter] = useState<SOWStatus | undefined>(undefined);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sows', statusFilter],
    queryFn: () => sowsApi.list({ status: statusFilter, limit: 200 }),
    enabled: isForecastUser,
  });

  const rawSOWs: SOW[] = (data?.data as any)?.data || [];
  const sows = search
    ? rawSOWs.filter((s) => {
        const cName = typeof s.customerId === 'string' ? '' : (s.customerId as Customer).name;
        const pName = typeof s.plantId === 'string' ? '' : (s.plantId as CustomerPlant)?.plantName || '';
        return (
          s.title.toLowerCase().includes(search.toLowerCase()) ||
          s.sowId.toLowerCase().includes(search.toLowerCase()) ||
          cName.toLowerCase().includes(search.toLowerCase()) ||
          pName.toLowerCase().includes(search.toLowerCase())
        );
      })
    : rawSOWs;

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => sowsApi.deactivate(id),
    onSuccess: () => {
      message.success('SOW removed');
      qc.invalidateQueries({ queryKey: ['sows'] });
    },
    onError: () => message.error('Failed to remove SOW'),
  });

  const openCreate = () => {
    setSelectedSOW(null);
    setDrawerOpen(true);
  };

  const openEdit = (s: SOW) => {
    setSelectedSOW(s);
    setDrawerOpen(true);
  };

  const linked = sows.filter((s) => s.status === 'linked').length;
  const draft = sows.filter((s) => s.status === 'draft').length;

  const columns = [
    {
      title: 'SOW ID',
      dataIndex: 'sowId',
      key: 'sowId',
      width: 130,
      render: (id: string) => <Text code style={{ fontSize: FONT_SIZE.sm }}>{id}</Text>,
    },
    {
      title: 'Customer / Site',
      key: 'customer',
      render: (_: unknown, r: SOW) => {
        const customer = typeof r.customerId === 'string' ? null : r.customerId as Customer;
        const plant = typeof r.plantId === 'string' ? null : r.plantId as CustomerPlant;
        return (
          <div>
            <Text strong style={{ fontSize: FONT_SIZE.md }}>{customer?.name || '—'}</Text>
            {plant && (
              <Text type="secondary" style={{ display: 'block', fontSize: FONT_SIZE.xs }}>
                {plant.plantName} · {plant.plantCode}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (t: string) => (
        <Tooltip title={t}>
          <Text ellipsis style={{ maxWidth: 200, fontSize: FONT_SIZE.md }}>{t}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Milestones',
      key: 'milestones',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, r: SOW) => (
        <Tag icon={<FileTextOutlined />}>{r.milestones?.length || 0}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (s: SOWStatus) => (
        <Tag color={SOW_STATUS_COLORS[s]}>{SOW_STATUS_LABELS[s]}</Tag>
      ),
    },
    {
      title: 'Total Value',
      dataIndex: 'totalValue',
      key: 'totalValue',
      width: 130,
      align: 'right' as const,
      render: (v: number, r: SOW) => (
        <Text strong style={{ fontSize: FONT_SIZE.md }}>{fmt(v || 0, r.currency)}</Text>
      ),
    },
    {
      title: 'Signed / Pending',
      key: 'signed',
      width: 150,
      align: 'right' as const,
      render: (_: unknown, r: SOW) => {
        const total = r.totalValue || 0;
        const signed = r.signedValue || 0;
        const pending = Math.max(total - signed, 0);
        const fullySigned = total > 0 && signed >= total;
        return (
          <div>
            <Text style={{ fontSize: FONT_SIZE.sm, color: COLORS.success }}>
              {fmt(signed, r.currency)}
            </Text>
            <Text type="secondary" style={{ display: 'block', fontSize: FONT_SIZE.xs }}>
              {fullySigned
                ? 'Fully signed'
                : `${fmt(pending, r.currency)} pending`}
            </Text>
          </div>
        );
      },
    },
    {
      title: 'Forecast',
      key: 'forecast',
      width: 110,
      render: (_: unknown, r: SOW) => {
        if (!r.forecastId) return <Text type="secondary" style={{ fontSize: FONT_SIZE.xs }}>—</Text>;
        const fc = typeof r.forecastId === 'string' ? null : r.forecastId as Forecast;
        return <Text code style={{ fontSize: FONT_SIZE.xs }}>{fc?.forecastId || '—'}</Text>;
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
      render: (_: unknown, r: SOW) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title="Remove">
            <Popconfirm
              title="Remove this SOW?"
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
        <Empty description="You don't have access to the SOW module." />
      </Card>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>Statements of Work</Title>
          <Text type="secondary" style={{ fontSize: FONT_SIZE.md }}>
            Manage SOWs, milestones, and forecast linkages
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          {!isMobile && 'Create SOW'}
        </Button>
      </div>

      {/* Summary strip */}
      <Row gutter={[10, 10]} style={{ marginBottom: 16 }}>
        {[
          { label: 'Total SOWs', value: sows.length, color: COLORS.primary },
          { label: 'Linked',     value: linked,       color: COLORS.success },
          { label: 'Drafts',     value: draft,         color: COLORS.purple },
        ].map((item) => (
          <Col xs={8} key={item.label}>
            <Card size="small" styles={{ body: { padding: '10px 14px' } }}>
              <Statistic
                title={<span style={{ fontSize: FONT_SIZE.xs }}>{item.label}</span>}
                value={item.value}
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
            value={statusFilter}
            placeholder="All statuses"
            allowClear
            style={{ width: 150 }}
            onChange={setStatusFilter}
            options={[
              { value: 'draft',              label: 'Draft' },
              { value: 'submitted',          label: 'Submitted' },
              { value: 'linked',             label: 'Linked' },
              { value: 'partially_accepted', label: 'Partially Accepted' },
              { value: 'accepted',           label: 'Accepted' },
              { value: 'closed',             label: 'Closed' },
              { value: 'archived',           label: 'Archived' },
            ]}
          />
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search SOW ID, customer, title…"
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
          dataSource={sows}
          columns={columns}
          rowKey="_id"
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} SOWs` }}
          size="small"
          scroll={{ x: 1110 }}
          locale={{ emptyText: 'No SOWs found. Create your first SOW.' }}
        />
      </Card>

      <SOWFormDrawer
        open={drawerOpen}
        sow={selectedSOW}
        onClose={() => setDrawerOpen(false)}
        onSuccess={() => setDrawerOpen(false)}
      />
    </div>
  );
}
