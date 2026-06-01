import { useState } from 'react';
import {
  Typography, Tag, Button, Tabs, Skeleton, Alert, Breadcrumb,
  Descriptions, Grid, Space, Card,
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, TeamOutlined, ApartmentOutlined,
  FileProtectOutlined, ContactsOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '@/api/customers';
import { Customer } from '@/types';
import CustomerFormDrawer from './CustomerFormDrawer';
import SitesTab from './tabs/SitesTab';
import ContractCostsTab from './tabs/ContractCostsTab';
import ContactsTab from './tabs/ContactsTab';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const qc = useQueryClient();

  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customersApi.getById(customerId!),
    enabled: !!customerId,
  });

  const customer: Customer | undefined = (data?.data as any)?.data;

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 8 }} />;
  }

  if (isError || !customer) {
    return (
      <Alert
        type="error"
        message="Customer not found"
        description="The customer record could not be loaded."
        action={<Button onClick={() => navigate('/admin/customers')}>Back to list</Button>}
      />
    );
  }

  const latestContract = customer.contractVersions?.find((v) => v.isLatest);

  const tabItems = [
    {
      key: 'overview',
      label: (
        <span>
          <TeamOutlined />
          {!isMobile && ' Overview'}
        </span>
      ),
      children: <OverviewTab customer={customer} onEdit={() => setEditDrawerOpen(true)} />,
    },
    {
      key: 'sites',
      label: (
        <span>
          <ApartmentOutlined />
          {!isMobile && ' Sites'}
        </span>
      ),
      children: <SitesTab customerId={customer._id} />,
    },
    {
      key: 'contract',
      label: (
        <span>
          <FileProtectOutlined />
          {!isMobile && ' Contract & Costs'}
          {latestContract && !isMobile && (
            <Tag color="green" style={{ marginLeft: 6, fontSize: 10, padding: '0 4px' }}>
              v{latestContract.version}
            </Tag>
          )}
        </span>
      ),
      children: <ContractCostsTab customer={customer} />,
    },
    {
      key: 'contacts',
      label: (
        <span>
          <ContactsOutlined />
          {!isMobile && ' Contacts'}
          {customer.corporateContacts?.length > 0 && (
            <Tag style={{ marginLeft: 6, fontSize: 10, padding: '0 4px' }}>
              {customer.corporateContacts.length}
            </Tag>
          )}
        </span>
      ),
      children: <ContactsTab customer={customer} />,
    },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <Breadcrumb
        style={{ marginBottom: 12, fontSize: 12 }}
        items={[
          { title: <a onClick={() => navigate('/admin')}>Administration</a> },
          { title: <a onClick={() => navigate('/admin/customers')}>Customers</a> },
          { title: customer.displayName || customer.name },
        ]}
      />

      {/* Header card */}
      <Card
        size="small"
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: isMobile ? '12px 14px' : '16px 20px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <Button
              icon={<ArrowLeftOutlined />}
              size="small"
              onClick={() => navigate('/admin/customers')}
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            <div>
              <Space wrap size={6}>
                <Text code style={{ fontSize: 13 }}>{customer.code}</Text>
                <Title level={isMobile ? 5 : 4} style={{ margin: 0, display: 'inline' }}>
                  {customer.name}
                </Title>
                <Tag color={customer.isActive ? 'success' : 'default'}>
                  {customer.isActive ? 'Active' : 'Inactive'}
                </Tag>
              </Space>
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {[customer.industry, customer.parentGroup, customer.hqCountry]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </div>
            </div>
          </div>

          <Button icon={<EditOutlined />} onClick={() => setEditDrawerOpen(true)}>
            {!isMobile && 'Edit'}
          </Button>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size={isMobile ? 'small' : 'middle'}
      />

      <CustomerFormDrawer
        open={editDrawerOpen}
        customer={customer}
        onClose={() => setEditDrawerOpen(false)}
        onSuccess={() => {
          setEditDrawerOpen(false);
          qc.invalidateQueries({ queryKey: ['customer', customerId] });
        }}
      />
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ customer, onEdit }: { customer: Customer; onEdit: () => void }) {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const cs = customer.costStructure;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      {/* Basic info */}
      <Card size="small" styles={{ body: { padding: isMobile ? 12 : 16 } }}>
        <Descriptions
          title="Customer Information"
          size="small"
          column={{ xs: 1, sm: 2, md: 2, lg: 3 }}
          extra={<Button size="small" icon={<EditOutlined />} onClick={onEdit}>Edit</Button>}
        >
          <Descriptions.Item label="Code">
            <Text code>{customer.code}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Legal Name">{customer.name}</Descriptions.Item>
          {customer.displayName && (
            <Descriptions.Item label="Display Name">{customer.displayName}</Descriptions.Item>
          )}
          {customer.industry && (
            <Descriptions.Item label="Industry">
              <Tag>{customer.industry}</Tag>
            </Descriptions.Item>
          )}
          {customer.parentGroup && (
            <Descriptions.Item label="Parent Group">{customer.parentGroup}</Descriptions.Item>
          )}
          {customer.website && (
            <Descriptions.Item label="Website">
              <a href={customer.website} target="_blank" rel="noreferrer">{customer.website}</a>
            </Descriptions.Item>
          )}
          {customer.pan && (
            <Descriptions.Item label="PAN"><Text code>{customer.pan}</Text></Descriptions.Item>
          )}
          <Descriptions.Item label="HQ">
            {[customer.hqCity, customer.hqCountry].filter(Boolean).join(', ') || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Default Currency">
            <Tag color="blue">{customer.defaultCurrency}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Credit Period">
            {customer.defaultCreditPeriodDays} days
          </Descriptions.Item>
          {customer.notes && (
            <Descriptions.Item label="Notes" span={3}>{customer.notes}</Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Cost structure summary */}
      {cs && (
        <Card
          size="small"
          title="Cost Structure Summary"
          extra={<Text type="secondary" style={{ fontSize: 11 }}>All costs in {cs.currency}</Text>}
          styles={{ body: { padding: isMobile ? 12 : 16 } }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            {cs.sfsDeploymentCost !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13 }}>SFS Platform License</Text>
                <Text strong style={{ fontSize: 13 }}>
                  {cs.currency} {cs.sfsDeploymentCost.toLocaleString()}
                </Text>
              </div>
            )}
            {cs.manHourRates?.length > 0 && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Man-Hour Rates</Text>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {cs.manHourRates.map((r, i) => (
                    <Tag key={i}>
                      {r.roleType}: {cs.currency} {r.ratePerHour}/hr
                    </Tag>
                  ))}
                </div>
              </div>
            )}
            {cs.moduleCosts?.length > 0 && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Module Costs</Text>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {cs.moduleCosts.map((m, i) => (
                    <Tag key={i}>
                      {m.moduleName.replace(/_/g, ' ')}: {cs.currency} {m.licenseCost.toLocaleString()}
                    </Tag>
                  ))}
                </div>
              </div>
            )}
          </Space>
        </Card>
      )}
    </Space>
  );
}
