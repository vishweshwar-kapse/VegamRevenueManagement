import { Card, Typography, Tag, List } from 'antd';
import { LineChartOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const CAPABILITIES = [
  'Cash runway visualization',
  'Monthly inflow/outflow',
  'GREEN/RED alerts',
  'Scenario planning',
];

export default function CashflowPage() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          <LineChartOutlined /> Cashflow & Runway
        </Title>
        <Text type="secondary">Future liquidity planning and management intelligence</Text>
      </div>
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <LineChartOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 16 }} />
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
