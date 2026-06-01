import { useState } from 'react';
import {
  Card, Table, Button, Tag, Space, Typography, Tooltip, Breadcrumb,
  Popconfirm, message, Badge,
} from 'antd';
import {
  PlusOutlined, EditOutlined, ApartmentOutlined, LockOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/users';
import { User, UserRole, USER_ROLE_LABELS, FORECAST_ROLES, CustomerPlant } from '@/types';
import UserFormDrawer from './UserFormDrawer';
import UserAssignmentDrawer from './UserAssignmentDrawer';

const { Title, Text } = Typography;

const ROLE_COLORS: Record<UserRole, string> = {
  finance_admin: 'red',
  management: 'purple',
  account_manager: 'blue',
  project_manager: 'geekblue',
  am_pm: 'cyan',
  read_only_pm: 'default',
};

export default function UserListPage() {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });
  const users: User[] = (data?.data as any)?.data || [];

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      usersApi.update(id, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => message.error('Failed to update user'),
  });

  const openEdit = (user: User) => {
    setSelectedUser(user);
    setFormOpen(true);
  };

  const openAssign = (user: User) => {
    setSelectedUser(user);
    setAssignOpen(true);
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, r: User) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{name}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{r.email}</Text>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 160,
      render: (role: UserRole) => (
        <Tag color={ROLE_COLORS[role]}>{USER_ROLE_LABELS[role]}</Tag>
      ),
    },
    {
      title: 'Assigned Sites',
      dataIndex: 'assignedSites',
      key: 'assignedSites',
      width: 130,
      render: (sites: (string | CustomerPlant)[], r: User) => {
        if (!FORECAST_ROLES.includes(r.role)) {
          return <Text type="secondary" style={{ fontSize: 11 }}>N/A</Text>;
        }
        const count = sites?.length || 0;
        return (
          <Badge
            count={count}
            style={{ backgroundColor: count > 0 ? '#52c41a' : '#d9d9d9' }}
            showZero
          >
            <ApartmentOutlined style={{ fontSize: 16, color: count > 0 ? '#52c41a' : '#bfbfbf' }} />
          </Badge>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 90,
      render: (active: boolean) => (
        <Tag color={active ? 'success' : 'default'}>{active ? 'Active' : 'Inactive'}</Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 140,
      render: (_: unknown, r: User) => (
        <Space size={4}>
          <Tooltip title="Edit user">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          {FORECAST_ROLES.includes(r.role) && (
            <Tooltip title="Assign sites">
              <Button size="small" icon={<ApartmentOutlined />} onClick={() => openAssign(r)} />
            </Tooltip>
          )}
          <Tooltip title={r.isActive ? 'Deactivate' : 'Activate'}>
            <Popconfirm
              title={r.isActive ? 'Deactivate this user?' : 'Activate this user?'}
              onConfirm={() => toggleActiveMutation.mutate({ id: r._id, isActive: !r.isActive })}
              okText="Yes"
              cancelText="No"
            >
              <Button
                size="small"
                icon={<LockOutlined />}
                danger={r.isActive}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb
        style={{ marginBottom: 12, fontSize: 12 }}
        items={[
          { title: 'Administration' },
          { title: 'User Management' },
        ]}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>User Management</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Create users, assign roles, and control site-level forecast access
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { setSelectedUser(null); setFormOpen(true); }}
        >
          New User
        </Button>
      </div>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={users}
          columns={columns}
          rowKey="_id"
          loading={isLoading}
          pagination={false}
          size="small"
          locale={{ emptyText: 'No users found' }}
        />
      </Card>

      <UserFormDrawer
        open={formOpen}
        user={selectedUser}
        onClose={() => setFormOpen(false)}
      />

      <UserAssignmentDrawer
        open={assignOpen}
        user={selectedUser}
        onClose={() => setAssignOpen(false)}
      />
    </div>
  );
}
