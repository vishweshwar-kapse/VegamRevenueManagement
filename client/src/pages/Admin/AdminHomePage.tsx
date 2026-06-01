import { Card, Row, Col, Typography, Grid } from 'antd';
import { TeamOutlined, SettingOutlined, AuditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const MODULES = [
  {
    key: 'entities',
    title: 'Business Entities',
    description: 'Manage the legal entities in your organisation that sell services and products. Select the entity when raising a forecast.',
    icon: <AuditOutlined style={{ fontSize: 32, color: '#fa8c16' }} />,
    path: '/admin/entities',
    available: true,
  },
  {
    key: 'customers',
    title: 'Customer Management',
    description: 'Manage customer master data, plant/site definitions, master contracts, and negotiated cost structures.',
    icon: <TeamOutlined style={{ fontSize: 32, color: '#1a56db' }} />,
    path: '/admin/customers',
    available: true,
  },
  {
    key: 'users',
    title: 'User Management',
    description: 'Create and manage system users, assign roles and control site-level forecast access.',
    icon: <AuditOutlined style={{ fontSize: 32, color: '#722ed1' }} />,
    path: '/admin/users',
    available: true,
  },
  {
    key: 'config',
    title: 'System Configuration',
    description: 'Configure system-wide settings, fiscal year, and operational parameters.',
    icon: <SettingOutlined style={{ fontSize: 32, color: '#52c41a' }} />,
    path: '/admin/config',
    available: false,
  },
];

export default function AdminHomePage() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  return (
    <div>
      <div style={{ marginBottom: isMobile ? 16 : 24 }}>
        <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>Administration</Title>
        <Text type="secondary" style={{ fontSize: isMobile ? 12 : 13 }}>
          System configuration, master data, and user management
        </Text>
      </div>

      <Row gutter={[16, 16]}>
        {MODULES.map((mod) => (
          <Col xs={24} sm={12} lg={8} key={mod.key}>
            <Card
              hoverable={mod.available}
              onClick={() => mod.available && navigate(mod.path)}
              style={{
                cursor: mod.available ? 'pointer' : 'default',
                opacity: mod.available ? 1 : 0.55,
                height: '100%',
                borderRadius: 8,
              }}
              styles={{ body: { padding: isMobile ? 16 : 24 } }}
            >
              <div style={{ marginBottom: 16 }}>{mod.icon}</div>
              <Title level={5} style={{ margin: '0 0 6px 0' }}>
                {mod.title}
                {!mod.available && (
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 400, marginLeft: 8 }}>
                    (Coming soon)
                  </Text>
                )}
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>{mod.description}</Text>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
