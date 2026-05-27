import { Card, Typography, Tag, List } from 'antd';
import { ShoppingCartOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const CAPABILITIES = [
  'Record customer POs',
  'Link to SOWs',
  'Track invoiced vs remaining value',
  'PO amendments',
];

export default function POPage() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          <ShoppingCartOutlined /> Customer PO
        </Title>
        <Text type="secondary">Customer Purchase Order governance</Text>
      </div>
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <ShoppingCartOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 16 }} />
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
