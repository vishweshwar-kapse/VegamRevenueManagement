import { Card, Typography, Tag, List } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const CAPABILITIES = [
  'User management',
  'Role assignment',
  'Audit logs',
  'System configuration',
];

export default function AdminPage() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          <SettingOutlined /> Administration
        </Title>
        <Text type="secondary">User management, system configuration, and governance</Text>
      </div>
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <SettingOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 16 }} />
          <Title level={4}>Coming Soon</Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
            This module is under active development.
          </Text>
          <List
            header={<Text strong>Key Capabilities</Text>}
            bordered
            dataSource={CAPABILITIES}
            renderItem={(item) => (
              <List.Item>
                <Tag color="blue" /> {item}
              </List.Item>
            )}
            style={{ maxWidth: 500, margin: '0 auto', textAlign: 'left' }}
          />
        </div>
      </Card>
    </div>
  );
}
