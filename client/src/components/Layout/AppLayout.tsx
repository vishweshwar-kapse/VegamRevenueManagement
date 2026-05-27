import { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography, Badge, Space, Tag } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  FundProjectionScreenOutlined,
  FileTextOutlined,
  ShoppingCartOutlined,
  FileDoneOutlined,
  DollarOutlined,
  LineChartOutlined,
  FolderOpenOutlined,
  UploadOutlined,
  BarChartOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  path: string;
  roles: UserRole[];   // Which roles can see this menu item
}

const NAV_ITEMS: NavItem[] = [
  {
    key: 'dashboard',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
    path: '/dashboard',
    roles: ['finance_admin', 'management', 'am_pm', 'read_only_pm'],
  },
  {
    key: 'forecast',
    icon: <FundProjectionScreenOutlined />,
    label: 'Forecast',
    path: '/forecast',
    roles: ['finance_admin', 'management', 'am_pm', 'read_only_pm'],
  },
  {
    key: 'sow',
    icon: <FileTextOutlined />,
    label: 'SOW',
    path: '/sow',
    roles: ['finance_admin', 'management', 'am_pm', 'read_only_pm'],
  },
  {
    key: 'po',
    icon: <ShoppingCartOutlined />,
    label: 'Purchase Orders',
    path: '/po',
    roles: ['finance_admin', 'management', 'am_pm', 'read_only_pm'],
  },
  {
    key: 'invoices',
    icon: <FileDoneOutlined />,
    label: 'Invoices',
    path: '/invoices',
    roles: ['finance_admin', 'management', 'am_pm', 'read_only_pm'],
  },
  {
    key: 'payments',
    icon: <DollarOutlined />,
    label: 'Payments',
    path: '/payments',
    roles: ['finance_admin', 'management', 'am_pm'],
  },
  {
    key: 'cashflow',
    icon: <LineChartOutlined />,
    label: 'Cashflow & Runway',
    path: '/cashflow',
    roles: ['finance_admin', 'management'],
  },
  {
    key: 'repository',
    icon: <FolderOpenOutlined />,
    label: 'Repository',
    path: '/repository',
    roles: ['finance_admin', 'management', 'am_pm', 'read_only_pm'],
  },
  {
    key: 'reports',
    icon: <BarChartOutlined />,
    label: 'Reports',
    path: '/reports',
    roles: ['finance_admin', 'management', 'am_pm', 'read_only_pm'],
  },
  {
    key: 'bulk-upload',
    icon: <UploadOutlined />,
    label: 'Bulk Upload',
    path: '/bulk-upload',
    roles: ['finance_admin'],
  },
  {
    key: 'admin',
    icon: <SettingOutlined />,
    label: 'Administration',
    path: '/admin',
    roles: ['finance_admin'],
  },
];

const ROLE_LABELS: Record<UserRole, { text: string; color: string }> = {
  finance_admin: { text: 'Finance / Admin', color: 'blue' },
  management: { text: 'Management', color: 'purple' },
  am_pm: { text: 'AM / PM', color: 'green' },
  read_only_pm: { text: 'Read-Only PM', color: 'default' },
};

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  // Get active menu key from current path
  const activeKey = NAV_ITEMS.find((item) =>
    location.pathname.startsWith(item.path)
  )?.key || 'dashboard';

  // Filter nav items by role
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role)
  );

  const menuItems = visibleNavItems.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
    onClick: () => navigate(item.path),
  }));

  const userDropdownItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'My Profile',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      danger: true,
      onClick: () => {
        logout();
        navigate('/login');
      },
    },
  ];

  const roleInfo = user ? ROLE_LABELS[user.role] : null;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sidebar */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={240}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: collapsed ? '16px 8px' : '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            transition: 'all 0.2s',
          }}
        >
          {collapsed ? (
            <div style={{ textAlign: 'center', color: '#fff', fontWeight: 700, fontSize: 18 }}>V</div>
          ) : (
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
                Vegam Revenue
              </div>
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>
                Commercial Governance
              </div>
            </div>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[activeKey]}
          items={menuItems}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>

      {/* Main layout */}
      <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'all 0.2s' }}>
        {/* Header */}
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            position: 'sticky',
            top: 0,
            zIndex: 99,
          }}
        >
          {/* Collapse button */}
          <div
            onClick={() => setCollapsed(!collapsed)}
            style={{ cursor: 'pointer', fontSize: 18, color: '#595959' }}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>

          {/* Right side */}
          <Space size="middle">
            {/* Notifications bell */}
            <Badge count={5} size="small">
              <BellOutlined style={{ fontSize: 18, color: '#595959', cursor: 'pointer' }} />
            </Badge>

            {/* User avatar + dropdown */}
            <Dropdown menu={{ items: userDropdownItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar
                  size="small"
                  style={{ backgroundColor: '#1a56db' }}
                  icon={<UserOutlined />}
                />
                <Space direction="vertical" size={0}>
                  <Text style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.2 }}>
                    {user?.name}
                  </Text>
                  {roleInfo && (
                    <Tag
                      color={roleInfo.color}
                      style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', margin: 0 }}
                    >
                      {roleInfo.text}
                    </Tag>
                  )}
                </Space>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* Page content */}
        <Content
          style={{
            margin: '24px',
            minHeight: 'calc(100vh - 64px - 48px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
