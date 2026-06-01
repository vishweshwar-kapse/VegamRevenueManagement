import { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography, Badge, Tag, Drawer, Grid } from 'antd';
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
const { useBreakpoint } = Grid;

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  path: string;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard',   icon: <DashboardOutlined />,             label: 'Dashboard',        path: '/dashboard',   roles: ['finance_admin', 'management', 'am_pm', 'account_manager', 'project_manager', 'read_only_pm'] },
  { key: 'forecast',    icon: <FundProjectionScreenOutlined />,  label: 'Forecast',         path: '/forecast',    roles: ['finance_admin', 'account_manager', 'project_manager', 'am_pm'] },
  { key: 'sow',         icon: <FileTextOutlined />,              label: 'SOW',              path: '/sow',         roles: ['finance_admin', 'management', 'am_pm', 'account_manager', 'project_manager', 'read_only_pm'] },
  { key: 'po',          icon: <ShoppingCartOutlined />,          label: 'Purchase Orders',  path: '/po',          roles: ['finance_admin', 'management', 'am_pm', 'account_manager', 'project_manager', 'read_only_pm'] },
  { key: 'invoices',    icon: <FileDoneOutlined />,              label: 'Invoices',         path: '/invoices',    roles: ['finance_admin', 'management', 'am_pm', 'account_manager', 'project_manager', 'read_only_pm'] },
  { key: 'payments',    icon: <DollarOutlined />,                label: 'Payments',         path: '/payments',    roles: ['finance_admin', 'management', 'am_pm', 'account_manager', 'project_manager'] },
  { key: 'cashflow',    icon: <LineChartOutlined />,             label: 'Cashflow & Runway',path: '/cashflow',    roles: ['finance_admin', 'management'] },
  { key: 'repository',  icon: <FolderOpenOutlined />,            label: 'Repository',       path: '/repository',  roles: ['finance_admin', 'management', 'am_pm', 'account_manager', 'project_manager', 'read_only_pm'] },
  { key: 'reports',     icon: <BarChartOutlined />,              label: 'Reports',          path: '/reports',     roles: ['finance_admin', 'management', 'am_pm', 'account_manager', 'project_manager', 'read_only_pm'] },
  { key: 'bulk-upload', icon: <UploadOutlined />,                label: 'Bulk Upload',      path: '/bulk-upload', roles: ['finance_admin'] },
  { key: 'admin',       icon: <SettingOutlined />,               label: 'Administration',   path: '/admin',       roles: ['finance_admin'] },
];

const ROLE_LABELS: Record<UserRole, { text: string; color: string }> = {
  finance_admin:   { text: 'Finance / Admin',  color: 'blue' },
  management:      { text: 'Management',       color: 'purple' },
  account_manager: { text: 'Account Manager',  color: 'green' },
  project_manager: { text: 'Project Manager',  color: 'geekblue' },
  am_pm:           { text: 'AM / PM',          color: 'cyan' },
  read_only_pm:    { text: 'Read-Only PM',     color: 'default' },
};

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const screens = useBreakpoint();

  // md = 768px — anything below is "mobile"
  const isMobile = !screens.md;

  const activeKey = NAV_ITEMS.find((item) =>
    location.pathname.startsWith(item.path)
  )?.key || 'dashboard';

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role)
  );

  const menuItems = visibleNavItems.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
    onClick: () => {
      navigate(item.path);
      if (isMobile) setDrawerOpen(false); // close drawer on nav
    },
  }));

  const userDropdownItems = [
    { key: 'profile', icon: <UserOutlined />, label: 'My Profile' },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      danger: true,
      onClick: () => { logout(); navigate('/login'); },
    },
  ];

  const roleInfo = user ? ROLE_LABELS[user.role] : null;

  // ── Sidebar content (shared between Sider and Drawer) ────────────────────
  const SidebarContent = (
    <>
      <div
        style={{
          padding: isMobile ? '16px 20px' : collapsed ? '16px 8px' : '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          transition: 'all 0.2s',
        }}
      >
        {!isMobile && collapsed ? (
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
    </>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>

      {/* ── Desktop sidebar (hidden on mobile) ──────────────────────────── */}
      {!isMobile && (
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
          {SidebarContent}
        </Sider>
      )}

      {/* ── Mobile drawer (hidden on desktop) ───────────────────────────── */}
      {isMobile && (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={240}
          styles={{
            body: { padding: 0, background: '#001529' },
            header: { display: 'none' },
          }}
        >
          {SidebarContent}
        </Drawer>
      )}

      {/* ── Main layout ─────────────────────────────────────────────────── */}
      <Layout
        style={{
          marginLeft: isMobile ? 0 : collapsed ? 80 : 240,
          transition: 'margin-left 0.2s',
        }}
      >
        {/* Header */}
        <Header
          style={{
            padding: isMobile ? '0 12px' : '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            position: 'sticky',
            top: 0,
            zIndex: 99,
            height: 56,
            lineHeight: '56px',
          }}
        >
          {/* Left: hamburger */}
          <div
            onClick={() => isMobile ? setDrawerOpen(true) : setCollapsed(!collapsed)}
            style={{ cursor: 'pointer', fontSize: 18, color: '#595959', display: 'flex', alignItems: 'center' }}
          >
            {isMobile
              ? <MenuUnfoldOutlined />
              : collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
            }
          </div>

          {/* Right: bell + user */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 20 }}>
            <Badge count={5} size="small">
              <BellOutlined style={{ fontSize: 18, color: '#595959', cursor: 'pointer' }} />
            </Badge>

            {!isMobile && (
              <div style={{ width: 1, height: 24, background: '#f0f0f0' }} />
            )}

            <Dropdown menu={{ items: userDropdownItems }} placement="bottomRight" trigger={['click']}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <Avatar
                  size={isMobile ? 30 : 34}
                  style={{ backgroundColor: '#1a56db', flexShrink: 0 }}
                  icon={<UserOutlined />}
                />
                {/* Hide name/role text on mobile — just show avatar */}
                {!isMobile && (
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', lineHeight: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: 600, color: 'rgba(0,0,0,0.85)', lineHeight: '18px' }}>
                      {user?.name}
                    </Text>
                    {roleInfo && (
                      <Tag
                        color={roleInfo.color}
                        style={{ fontSize: 10, padding: '1px 5px', margin: '3px 0 0 0', lineHeight: '14px', display: 'inline-block', width: 'fit-content' }}
                      >
                        {roleInfo.text}
                      </Tag>
                    )}
                  </div>
                )}
              </div>
            </Dropdown>
          </div>
        </Header>

        {/* Page content */}
        <Content
          style={{
            margin: isMobile ? '12px 8px' : '24px',
            minHeight: 'calc(100vh - 56px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
