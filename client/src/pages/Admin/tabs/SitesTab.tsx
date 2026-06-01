import { useState } from 'react';
import {
  Button, Table, Tag, Space, Tooltip, Popconfirm, message, Typography, Empty,
} from 'antd';
import {
  PlusOutlined, EditOutlined, StopOutlined, StarFilled,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerPlantsApi } from '@/api/customerPlants';
import { CustomerPlant } from '@/types';
import SiteFormDrawer from '../SiteFormDrawer';

const { Text } = Typography;

interface Props {
  customerId: string;
}

export default function SitesTab({ customerId }: Props) {
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPlant, setEditingPlant] = useState<CustomerPlant | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['plants', customerId],
    queryFn: () => customerPlantsApi.listByCustomer(customerId),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => customerPlantsApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plants', customerId] });
      message.success('Site deactivated');
    },
  });

  const plants: CustomerPlant[] = (data?.data as any)?.data || [];

  const openCreate = () => {
    setEditingPlant(null);
    setDrawerOpen(true);
  };

  const openEdit = (plant: CustomerPlant) => {
    setEditingPlant(plant);
    setDrawerOpen(true);
  };

  const columns = [
    {
      title: 'Plant Code',
      dataIndex: 'plantCode',
      key: 'plantCode',
      width: 150,
      render: (code: string, record: CustomerPlant) => (
        <Space size={4}>
          <Text code style={{ fontSize: 12 }}>{code}</Text>
          {record.isDefault && (
            <Tooltip title="Default site">
              <StarFilled style={{ color: '#faad14', fontSize: 12 }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Plant Name',
      dataIndex: 'plantName',
      key: 'plantName',
      render: (name: string) => <Text style={{ fontSize: 13 }}>{name}</Text>,
    },
    {
      title: 'Country',
      dataIndex: 'country',
      key: 'country',
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'City',
      dataIndex: 'city',
      key: 'city',
      render: (v?: string) => v ? <Text style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
    },
    {
      title: 'Timezone',
      dataIndex: 'timezone',
      key: 'timezone',
      render: (tz: string) => <Text style={{ fontSize: 12 }}>{tz}</Text>,
    },
    {
      title: 'Currency',
      dataIndex: 'currency',
      key: 'currency',
      width: 90,
      render: (c?: string) =>
        c ? <Tag color="blue">{c}</Tag> : <Text type="secondary" style={{ fontSize: 11 }}>Inherited</Text>,
    },
    {
      title: 'Region',
      dataIndex: 'region',
      key: 'region',
      render: (r?: string) => r ? <Tag>{r}</Tag> : null,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: CustomerPlant) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          <Tooltip title="Deactivate">
            <Popconfirm
              title="Deactivate this site?"
              onConfirm={() => deactivateMutation.mutate(record._id)}
              okText="Yes"
              cancelText="No"
            >
              <Button size="small" danger icon={<StopOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Physical and administrative sites for this customer. Each site has its own location, tax, and commercial settings.
        </Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Add Site
        </Button>
      </div>

      <Table
        dataSource={plants}
        columns={columns}
        rowKey="_id"
        loading={isLoading}
        size="small"
        pagination={false}
        locale={{
          emptyText: (
            <Empty
              description="No sites added yet"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Add First Site
              </Button>
            </Empty>
          ),
        }}
      />

      <SiteFormDrawer
        open={drawerOpen}
        customerId={customerId}
        plant={editingPlant}
        onClose={() => setDrawerOpen(false)}
        onSuccess={() => {
          setDrawerOpen(false);
          qc.invalidateQueries({ queryKey: ['plants', customerId] });
        }}
      />
    </div>
  );
}
