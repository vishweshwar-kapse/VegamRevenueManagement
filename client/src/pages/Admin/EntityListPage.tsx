import { useState } from 'react';
import {
  Card, Table, Button, Tag, Typography, Space, Popconfirm,
  Tooltip, message, Grid, Empty,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, StarFilled } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entitiesApi } from '@/api/entities';
import { Entity } from '@/types';
import EntityFormDrawer from './EntityFormDrawer';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function EntityListPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const qc = useQueryClient();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['entities'],
    queryFn: () => entitiesApi.list(),
  });

  const entities: Entity[] = (data?.data as any)?.data || [];

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => entitiesApi.deactivate(id),
    onSuccess: () => {
      message.success('Entity removed');
      qc.invalidateQueries({ queryKey: ['entities'] });
    },
    onError: () => message.error('Failed to remove entity'),
  });

  const openCreate = () => {
    setSelectedEntity(null);
    setDrawerOpen(true);
  };

  const openEdit = (e: Entity) => {
    setSelectedEntity(e);
    setDrawerOpen(true);
  };

  const columns = [
    {
      title: 'Code',
      dataIndex: 'entityCode',
      key: 'entityCode',
      width: 110,
      render: (code: string, r: Entity) => (
        <Space size={4}>
          <Text code style={{ fontSize: 12 }}>{code}</Text>
          {r.isDefault && (
            <Tooltip title="Default entity">
              <StarFilled style={{ color: '#faad14', fontSize: 12 }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Name',
      key: 'name',
      render: (_: unknown, r: Entity) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{r.name}</Text>
          {r.legalName && r.legalName !== r.name && (
            <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{r.legalName}</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Location',
      key: 'location',
      render: (_: unknown, r: Entity) => {
        const parts = [r.city, r.country].filter(Boolean).join(', ');
        return parts ? <Text style={{ fontSize: 12 }}>{parts}</Text> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Currency',
      dataIndex: 'defaultCurrency',
      key: 'currency',
      width: 90,
      render: (c: string) => <Tag>{c}</Tag>,
    },
    {
      title: 'GSTIN',
      dataIndex: 'gstin',
      key: 'gstin',
      width: 160,
      render: (v?: string) => v
        ? <Text style={{ fontSize: 12 }}>{v}</Text>
        : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: unknown, r: Entity) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title="Remove">
            <Popconfirm
              title="Remove this entity?"
              description="Existing forecasts linked to this entity will not be affected."
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>Business Entities</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Legal entities in your organisation that raise revenue forecasts and invoices
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          {!isMobile && 'Add Entity'}
        </Button>
      </div>

      {entities.length === 0 && !isLoading ? (
        <Card>
          <Empty
            description="No entities added yet. Add at least one entity to use in forecasts."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Add Your First Entity
            </Button>
          </Empty>
        </Card>
      ) : (
        <Card size="small" styles={{ body: { padding: 0 } }}>
          <Table
            dataSource={entities}
            columns={columns}
            rowKey="_id"
            loading={isLoading}
            pagination={false}
            size="small"
            scroll={{ x: 700 }}
          />
        </Card>
      )}

      <EntityFormDrawer
        open={drawerOpen}
        entity={selectedEntity}
        onClose={() => setDrawerOpen(false)}
        onSuccess={() => setDrawerOpen(false)}
      />
    </div>
  );
}
