import { useState } from 'react';
import {
  Typography, Button, Table, Input, Select, Tag, Space, Tooltip,
  Popconfirm, message, Grid, Card,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, EyeOutlined,
  StopOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '@/api/customers';
import { Customer } from '@/types';
import { INDUSTRIES } from '@/constants/masterData';
import CustomerFormDrawer from './CustomerFormDrawer';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function CustomerListPage() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState<string | undefined>();
  const [showInactive, setShowInactive] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, industry, showInactive],
    queryFn: () =>
      customersApi.list({
        search: search || undefined,
        industry,
        isActive: showInactive ? undefined : true,
        limit: 100,
      }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      customersApi.update(id, { isActive } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      message.success('Customer status updated');
    },
  });

  const customers: Customer[] = data?.data?.data || [];

  const openCreate = () => {
    setEditingCustomer(null);
    setDrawerOpen(true);
  };

  const openEdit = (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCustomer(customer);
    setDrawerOpen(true);
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: 110,
      render: (code: string) => (
        <Text code style={{ fontSize: 12 }}>{code}</Text>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Customer) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{name}</Text>
          {record.displayName && record.displayName !== name && (
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>{record.displayName}</Text>
            </div>
          )}
        </div>
      ),
    },
    ...(!isMobile ? [
      {
        title: 'Parent Group',
        dataIndex: 'parentGroup',
        key: 'parentGroup',
        render: (v?: string) => v ? <Text style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
      },
      {
        title: 'Industry',
        dataIndex: 'industry',
        key: 'industry',
        render: (v?: string) => v ? <Tag>{v}</Tag> : null,
      },
      {
        title: 'HQ',
        key: 'hq',
        render: (_: unknown, r: Customer) => (
          <Text style={{ fontSize: 12 }}>
            {[r.hqCity, r.hqCountry].filter(Boolean).join(', ') || '—'}
          </Text>
        ),
      },
      {
        title: 'Currency',
        dataIndex: 'defaultCurrency',
        key: 'defaultCurrency',
        width: 90,
        render: (c: string) => <Tag color="blue">{c}</Tag>,
      },
    ] : []),
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 90,
      render: (active: boolean) =>
        active
          ? <Tag color="success">Active</Tag>
          : <Tag color="default">Inactive</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: isMobile ? 80 : 130,
      render: (_: unknown, record: Customer) => (
        <Space size={4}>
          <Tooltip title="View details">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/admin/customers/${record._id}`)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => openEdit(record, e)}
            />
          </Tooltip>
          {!isMobile && (
            <Tooltip title={record.isActive ? 'Deactivate' : 'Reactivate'}>
              <Popconfirm
                title={record.isActive ? 'Deactivate this customer?' : 'Reactivate this customer?'}
                onConfirm={() =>
                  toggleActiveMutation.mutate({ id: record._id, isActive: !record.isActive })
                }
                okText="Yes"
                cancelText="No"
              >
                <Button
                  size="small"
                  danger={record.isActive}
                  icon={record.isActive ? <StopOutlined /> : <CheckCircleOutlined />}
                />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? 12 : 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>Customer Management</Title>
          <Text type="secondary" style={{ fontSize: isMobile ? 11 : 13 }}>
            Manage customer master data, sites, contracts and cost structures
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          {isMobile ? 'New' : 'New Customer'}
        </Button>
      </div>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 12 }} styles={{ body: { padding: '10px 12px' } }}>
        <Space wrap size={8}>
          <Input
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="Search by name or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: isMobile ? '100%' : 240 }}
          />
          <Select
            placeholder="Industry"
            value={industry}
            onChange={setIndustry}
            allowClear
            style={{ width: 180 }}
            options={INDUSTRIES.map((i) => ({ value: i, label: i }))}
            showSearch
          />
          <Button
            type={showInactive ? 'primary' : 'default'}
            size="small"
            onClick={() => setShowInactive((v) => !v)}
          >
            {showInactive ? 'Showing All' : 'Active Only'}
          </Button>
        </Space>
      </Card>

      {/* Table */}
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={customers}
          columns={columns}
          rowKey="_id"
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 20, showTotal: (total) => `${total} customers` }}
          onRow={(record) => ({
            onClick: () => navigate(`/admin/customers/${record._id}`),
            style: { cursor: 'pointer' },
          })}
          locale={{ emptyText: search ? 'No customers match your search' : 'No customers yet. Click "New Customer" to add one.' }}
        />
      </Card>

      <CustomerFormDrawer
        open={drawerOpen}
        customer={editingCustomer}
        onClose={() => setDrawerOpen(false)}
        onSuccess={() => {
          setDrawerOpen(false);
          qc.invalidateQueries({ queryKey: ['customers'] });
        }}
      />
    </div>
  );
}
