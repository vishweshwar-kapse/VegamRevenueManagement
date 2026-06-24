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
import { posApi } from '@/api/pos';
import { PO, POStatus, Customer, CustomerPlant } from '@/types';
import { useIsForecastUser } from '@/store/authStore';
import { PO_STATUS_COLORS, COLORS, FONT_SIZE } from '@/constants/theme';
import { fmt } from '@/utils/format';
import POFormDrawer from './POFormDrawer';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function POPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isForecastUser = useIsForecastUser();
  const qc = useQueryClient();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PO | null>(null);
  const [statusFilter, setStatusFilter] = useState<POStatus | undefined>(undefined);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pos', statusFilter],
    queryFn: () => posApi.list({ status: statusFilter, limit: 200 }),
    enabled: isForecastUser,
  });

  const rawPOs: PO[] = (data?.data as any)?.data || [];
  const pos = search
    ? rawPOs.filter((p) => {
        const cName = typeof p.customerId === 'string' ? '' : (p.customerId as Customer).name;
        return (
          p.poNumber.toLowerCase().includes(search.toLowerCase()) ||
          cName.toLowerCase().includes(search.toLowerCase())
        );
      })
    : rawPOs;

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => posApi.deactivate(id),
    onSuccess: () => {
      message.success('PO removed');
      qc.invalidateQueries({ queryKey: ['pos'] });
      qc.invalidateQueries({ queryKey: ['sows'] });
      qc.invalidateQueries({ queryKey: ['forecasts'] });
    },
    onError: () => message.error('Failed to remove PO'),
  });

  const openCreate = () => {
    setSelectedPO(null);
    setDrawerOpen(true);
  };

  const openEdit = (p: PO) => {
    setSelectedPO(p);
    setDrawerOpen(true);
  };

  const totalValue = pos.reduce((sum, p) => sum + (p.poValue || 0), 0);
  const open = pos.filter((p) => p.status === 'open').length;
  const partial = pos.filter((p) => p.status === 'partial').length;

  const columns = [
    {
      title: 'PO Number',
      dataIndex: 'poNumber',
      key: 'poNumber',
      width: 140,
      render: (n: string) => <Text code style={{ fontSize: FONT_SIZE.sm }}>{n}</Text>,
    },
    {
      title: 'Customer / Site',
      key: 'customer',
      render: (_: unknown, r: PO) => {
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
      title: 'Linked SOWs',
      key: 'sows',
      width: 110,
      align: 'center' as const,
      render: (_: unknown, r: PO) => (
        <Tag icon={<FileTextOutlined />}>{r.allocations?.length || 0}</Tag>
      ),
    },
    {
      title: 'PO Value',
      dataIndex: 'poValue',
      key: 'poValue',
      width: 130,
      align: 'right' as const,
      render: (v: number, r: PO) => (
        <Text strong style={{ fontSize: FONT_SIZE.md }}>{fmt(v || 0, r.currency)}</Text>
      ),
    },
    {
      title: 'PO Date',
      dataIndex: 'poDate',
      key: 'poDate',
      width: 110,
      render: (d: string) => <Text style={{ fontSize: FONT_SIZE.xs }}>{dayjs(d).format('DD MMM YY')}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: POStatus) => (
        <Tag color={PO_STATUS_COLORS[s]}>{s.charAt(0).toUpperCase() + s.slice(1)}</Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: unknown, r: PO) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title="Remove">
            <Popconfirm
              title="Remove this PO?"
              description="Signed amounts on linked SOWs and forecasts will be recalculated."
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
        <Empty description="You don't have access to the Purchase Orders module." />
      </Card>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>Purchase Orders</Title>
          <Text type="secondary" style={{ fontSize: FONT_SIZE.md }}>
            Register customer POs and confirm SOW value
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          {!isMobile && 'Register PO'}
        </Button>
      </div>

      {/* Summary strip */}
      <Row gutter={[10, 10]} style={{ marginBottom: 16 }}>
        {[
          { label: 'Total PO Value', value: totalValue, color: COLORS.primary, isCurrency: true },
          { label: 'Open',           value: open,       color: COLORS.success },
          { label: 'Partial',        value: partial,    color: COLORS.purple },
        ].map((item) => (
          <Col xs={8} key={item.label}>
            <Card size="small" styles={{ body: { padding: '10px 14px' } }}>
              <Statistic
                title={<span style={{ fontSize: FONT_SIZE.xs }}>{item.label}</span>}
                value={item.value}
                formatter={item.isCurrency ? (v) => fmt(Number(v)) : undefined}
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
              { value: 'open',      label: 'Open' },
              { value: 'partial',   label: 'Partial' },
              { value: 'closed',    label: 'Closed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search PO number or customer…"
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
          dataSource={pos}
          columns={columns}
          rowKey="_id"
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} POs` }}
          size="small"
          scroll={{ x: 920 }}
          locale={{ emptyText: 'No purchase orders found. Register your first PO.' }}
        />
      </Card>

      <POFormDrawer
        open={drawerOpen}
        po={selectedPO}
        onClose={() => setDrawerOpen(false)}
        onSuccess={() => setDrawerOpen(false)}
      />
    </div>
  );
}
