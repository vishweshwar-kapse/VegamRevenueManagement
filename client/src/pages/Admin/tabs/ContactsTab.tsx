import { useEffect } from 'react';
import {
  Row, Col, Form, Input, Button, Typography, Checkbox, Divider,
  Card, message, Empty, Tooltip,
} from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, StarOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '@/api/customers';
import { Customer, ContactPerson } from '@/types';

const { Title, Text } = Typography;

interface Props {
  customer: Customer;
}

export default function ContactsTab({ customer }: Props) {
  const qc = useQueryClient();
  const [form] = Form.useForm<{ contacts: ContactPerson[] }>();

  useEffect(() => {
    form.setFieldsValue({ contacts: customer.corporateContacts || [] });
  }, [customer, form]);

  const mutation = useMutation({
    mutationFn: (contacts: ContactPerson[]) =>
      customersApi.saveContacts(customer._id, contacts),
    onSuccess: () => {
      message.success('Contacts saved');
      qc.invalidateQueries({ queryKey: ['customer', customer._id] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || 'Save failed');
    },
  });

  return (
    <Card size="small" styles={{ body: { padding: 16 } }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <Title level={5} style={{ margin: 0 }}>Corporate Contacts</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            C-level, procurement, and corporate-wide contacts. Site-specific contacts are managed within each site.
          </Text>
        </div>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={mutation.isPending}
          onClick={() => form.submit()}
        >
          Save
        </Button>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => mutation.mutate(values.contacts || [])}
      >
        <Form.List name="contacts">
          {(fields, { add, remove }) => (
            <>
              {fields.length > 0 && (
                <Row gutter={8} style={{ marginBottom: 4 }}>
                  <Col flex="1"><Text style={{ fontSize: 11, color: '#8c8c8c' }}>NAME *</Text></Col>
                  <Col style={{ width: 200 }}><Text style={{ fontSize: 11, color: '#8c8c8c' }}>EMAIL *</Text></Col>
                  <Col style={{ width: 140 }}><Text style={{ fontSize: 11, color: '#8c8c8c' }}>PHONE</Text></Col>
                  <Col style={{ width: 160 }}><Text style={{ fontSize: 11, color: '#8c8c8c' }}>DESIGNATION</Text></Col>
                  <Col style={{ width: 70, textAlign: 'center' }}>
                    <Tooltip title="Primary contact">
                      <StarOutlined style={{ color: '#faad14' }} />
                    </Tooltip>
                  </Col>
                  <Col style={{ width: 32 }} />
                </Row>
              )}

              {fields.map(({ key, name }) => (
                <div key={key}>
                  <Row gutter={8} align="middle" style={{ marginBottom: 8 }}>
                    <Col flex="1">
                      <Form.Item
                        name={[name, 'name']}
                        noStyle
                        rules={[{ required: true, message: 'Name required' }]}
                      >
                        <Input placeholder="Full name" maxLength={80} />
                      </Form.Item>
                    </Col>
                    <Col style={{ width: 200 }}>
                      <Form.Item
                        name={[name, 'email']}
                        noStyle
                        rules={[
                          { required: true, message: 'Email required' },
                          { type: 'email', message: 'Invalid email' },
                        ]}
                      >
                        <Input placeholder="email@company.com" />
                      </Form.Item>
                    </Col>
                    <Col style={{ width: 140 }}>
                      <Form.Item name={[name, 'phone']} noStyle>
                        <Input placeholder="+1 555 000 0000" />
                      </Form.Item>
                    </Col>
                    <Col style={{ width: 160 }}>
                      <Form.Item name={[name, 'designation']} noStyle>
                        <Input placeholder="e.g. CFO" maxLength={60} />
                      </Form.Item>
                    </Col>
                    <Col style={{ width: 70, textAlign: 'center' }}>
                      <Form.Item name={[name, 'isPrimary']} noStyle valuePropName="checked">
                        <Checkbox />
                      </Form.Item>
                    </Col>
                    <Col style={{ width: 32 }}>
                      <Tooltip title="Remove">
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => remove(name)}
                        />
                      </Tooltip>
                    </Col>
                  </Row>
                  {fields.length > 1 && <Divider style={{ margin: '0 0 8px' }} />}
                </div>
              ))}

              {fields.length === 0 && (
                <Empty
                  description="No corporate contacts added yet"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  style={{ marginBottom: 16 }}
                />
              )}

              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => add({ name: '', email: '', phone: '', designation: '', isPrimary: false })}
              >
                Add Contact
              </Button>
            </>
          )}
        </Form.List>
      </Form>
    </Card>
  );
}
