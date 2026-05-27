import { Row, Col, Card, Statistic, Tag, Typography, List, Badge, Space, Divider } from 'antd';
import {
  ArrowUpOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  DollarOutlined,
  FileTextOutlined,
  ShoppingCartOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useCanViewCashflow } from '@/store/authStore';

const { Title, Text } = Typography;

// ─── Mock data — will be replaced with real API calls ─────────────────────────

const MOCK_KPIS = {
  revenueInvoiced: 2_850_000,
  revenueRealized: 2_340_000,
  revenueOutlook: 4_200_000,
  outstandingReceivables: 510_000,
  overdueReceivables: 185_000,
  cashRunway: { status: 'green' as const, greenTill: 'Feb-27' },
  currency: 'USD',
  fy: 'FY25-26',
};

const MOCK_ALERTS = [
  {
    key: '1',
    type: 'overdue_invoice',
    severity: 'critical',
    count: 3,
    message: '3 invoices are overdue',
    link: '/invoices?status=overdue',
  },
  {
    key: '2',
    type: 'pending_invoice_request',
    severity: 'warning',
    count: 5,
    message: '5 invoice requests awaiting Finance action',
    link: '/invoices?status=draft',
  },
  {
    key: '3',
    type: 'sow_without_po',
    severity: 'warning',
    count: 2,
    message: '2 submitted SOWs without a linked PO',
    link: '/sow?filter=no_po',
  },
  {
    key: '4',
    type: 'missing_document',
    severity: 'info',
    count: 4,
    message: '4 POs are missing uploaded documents',
    link: '/po?filter=no_doc',
  },
];

const MOCK_FORECAST_SUMMARY = {
  totalForecastValue: 6_500_000,
  signedValue: 3_800_000,
  projectedValue: 2_700_000,
  conversionRate: 58.5,
};

const MOCK_OPEN_SOWS = 8;
const MOCK_OPEN_POS = 14;

// ─── Helper Components ────────────────────────────────────────────────────────

const SeverityIcon = ({ severity }: { severity: string }) => {
  if (severity === 'critical') return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
  if (severity === 'warning') return <WarningOutlined style={{ color: '#faad14' }} />;
  return <ClockCircleOutlined style={{ color: '#1677ff' }} />;
};

const formatCurrency = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString();
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const canViewCashflow = useCanViewCashflow();

  const kpis = MOCK_KPIS;

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          Dashboard
        </Title>
        <Text type="secondary">
          Commercial Operations Overview · {kpis.fy} · {kpis.currency}
        </Text>
      </div>

      {/* ─── Top KPI Strip ─────────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Revenue Invoiced */}
        <Col xs={24} sm={12} lg={4}>
          <Card className="kpi-card" hoverable onClick={() => navigate('/invoices')}>
            <Statistic
              title="Revenue Invoiced"
              value={kpis.revenueInvoiced}
              formatter={(val) => `${kpis.currency} ${formatCurrency(Number(val))}`}
              prefix={<FileDoneOutlined style={{ color: '#1677ff' }} />}
              valueStyle={{ fontSize: 20, color: '#1677ff' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {kpis.fy} · Issued invoices
            </Text>
          </Card>
        </Col>

        {/* Revenue Realized */}
        <Col xs={24} sm={12} lg={4}>
          <Card className="kpi-card" hoverable onClick={() => navigate('/payments')}>
            <Statistic
              title="Revenue Realized"
              value={kpis.revenueRealized}
              formatter={(val) => `${kpis.currency} ${formatCurrency(Number(val))}`}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ fontSize: 20, color: '#52c41a' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {kpis.fy} · Actual bank receipts
            </Text>
          </Card>
        </Col>

        {/* Revenue Outlook */}
        <Col xs={24} sm={12} lg={4}>
          <Card className="kpi-card" hoverable onClick={() => navigate('/forecast')}>
            <Statistic
              title="Revenue Outlook"
              value={kpis.revenueOutlook}
              formatter={(val) => `${kpis.currency} ${formatCurrency(Number(val))}`}
              prefix={<ArrowUpOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ fontSize: 20, color: '#722ed1' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {kpis.fy} · Invoiced + Forecast
            </Text>
          </Card>
        </Col>

        {/* Outstanding Receivables */}
        <Col xs={24} sm={12} lg={4}>
          <Card className="kpi-card" hoverable onClick={() => navigate('/payments')}>
            <Statistic
              title="Outstanding"
              value={kpis.outstandingReceivables}
              formatter={(val) => `${kpis.currency} ${formatCurrency(Number(val))}`}
              prefix={<DollarOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ fontSize: 20, color: '#fa8c16' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              Live · Unpaid invoices
            </Text>
          </Card>
        </Col>

        {/* Overdue Receivables */}
        <Col xs={24} sm={12} lg={4}>
          <Card className="kpi-card" hoverable onClick={() => navigate('/invoices?status=overdue')}>
            <Statistic
              title="Overdue"
              value={kpis.overdueReceivables}
              formatter={(val) => `${kpis.currency} ${formatCurrency(Number(val))}`}
              prefix={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ fontSize: 20, color: '#ff4d4f' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              Live · Past due date
            </Text>
          </Card>
        </Col>

        {/* Cash Runway — only for Finance/Management */}
        {canViewCashflow && (
          <Col xs={24} sm={12} lg={4}>
            <Card
              className="kpi-card"
              hoverable
              onClick={() => navigate('/cashflow')}
              style={{
                borderLeft: `4px solid ${kpis.cashRunway.status === 'green' ? '#52c41a' : '#ff4d4f'}`,
              }}
            >
              <Statistic
                title="Cash Runway"
                value={`GREEN till ${kpis.cashRunway.greenTill}`}
                formatter={(val) => (
                  <Tag
                    color={kpis.cashRunway.status === 'green' ? 'success' : 'error'}
                    style={{ fontSize: 13, padding: '4px 8px' }}
                  >
                    {val as string}
                  </Tag>
                )}
                valueStyle={{ fontSize: 14 }}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                Future liquidity outlook
              </Text>
            </Card>
          </Col>
        )}
      </Row>

      {/* ─── Main Body: 2 columns ─────────────────────────────────────────── */}
      <Row gutter={[16, 16]}>
        {/* Left column */}
        <Col xs={24} lg={16}>
          {/* Action Required */}
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: '#faad14' }} />
                <span>Action Required</span>
                <Badge count={MOCK_ALERTS.length} style={{ backgroundColor: '#ff4d4f' }} />
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <List
              dataSource={MOCK_ALERTS}
              renderItem={(alert) => (
                <List.Item
                  className={`severity-${alert.severity}`}
                  style={{
                    cursor: 'pointer',
                    paddingLeft: 12,
                    borderRadius: 4,
                    marginBottom: 8,
                    background: '#fafafa',
                  }}
                  onClick={() => navigate(alert.link)}
                  actions={[
                    <Badge
                      count={alert.count}
                      style={{
                        backgroundColor:
                          alert.severity === 'critical'
                            ? '#ff4d4f'
                            : alert.severity === 'warning'
                            ? '#faad14'
                            : '#1677ff',
                      }}
                    />,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<SeverityIcon severity={alert.severity} />}
                    title={
                      <Text style={{ fontSize: 13 }}>{alert.message}</Text>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>

          {/* Forecast Snapshot */}
          <Card
            title={
              <Space>
                <span>Forecast Snapshot</span>
                <Tag color="blue">{kpis.fy}</Tag>
              </Space>
            }
            extra={
              <a onClick={() => navigate('/forecast')} style={{ fontSize: 12 }}>
                View all →
              </a>
            }
            style={{ marginBottom: 16 }}
          >
            <Row gutter={[24, 16]}>
              <Col span={6}>
                <Statistic
                  title="Total Forecast"
                  value={MOCK_FORECAST_SUMMARY.totalForecastValue}
                  formatter={(v) => `$${formatCurrency(Number(v))}`}
                  valueStyle={{ fontSize: 18 }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Signed"
                  value={MOCK_FORECAST_SUMMARY.signedValue}
                  formatter={(v) => `$${formatCurrency(Number(v))}`}
                  valueStyle={{ fontSize: 18, color: '#52c41a' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Projected"
                  value={MOCK_FORECAST_SUMMARY.projectedValue}
                  formatter={(v) => `$${formatCurrency(Number(v))}`}
                  valueStyle={{ fontSize: 18, color: '#1677ff' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Conversion"
                  value={MOCK_FORECAST_SUMMARY.conversionRate}
                  suffix="%"
                  valueStyle={{ fontSize: 18, color: '#722ed1' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Right column */}
        <Col xs={24} lg={8}>
          {/* SOW + PO Snapshot */}
          <Card
            title="Commercial Snapshot"
            style={{ marginBottom: 16 }}
          >
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => navigate('/sow')}
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                >
                  <FileTextOutlined style={{ fontSize: 24, color: '#1677ff', marginBottom: 8 }} />
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{MOCK_OPEN_SOWS}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Open SOWs</Text>
                </Card>
              </Col>
              <Col span={12}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => navigate('/po')}
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                >
                  <ShoppingCartOutlined style={{ fontSize: 24, color: '#722ed1', marginBottom: 8 }} />
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{MOCK_OPEN_POS}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Open POs</Text>
                </Card>
              </Col>
            </Row>
          </Card>

          {/* Receivables aging */}
          <Card title="Receivables Aging" extra={<a onClick={() => navigate('/payments')} style={{ fontSize: 12 }}>Details →</a>}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {[
                { label: '0–30 days', amount: 185_000, color: '#52c41a' },
                { label: '31–60 days', amount: 142_000, color: '#faad14' },
                { label: '61–90 days', amount: 98_000, color: '#fa8c16' },
                { label: '90+ days', amount: 85_000, color: '#ff4d4f' },
              ].map((bucket) => (
                <div
                  key={bucket.label}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Space>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: bucket.color,
                      }}
                    />
                    <Text style={{ fontSize: 13 }}>{bucket.label}</Text>
                  </Space>
                  <Text strong style={{ fontSize: 13, color: bucket.color }}>
                    ${formatCurrency(bucket.amount)}
                  </Text>
                </div>
              ))}
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text strong>Total Outstanding</Text>
                <Text strong style={{ color: '#fa8c16' }}>
                  ${formatCurrency(kpis.outstandingReceivables)}
                </Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
