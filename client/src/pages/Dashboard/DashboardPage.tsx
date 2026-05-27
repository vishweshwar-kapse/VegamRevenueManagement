import { Row, Col, Card, Statistic, Tag, Typography, List, Badge, Space, Divider, Grid } from 'antd';
import {
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  FileTextOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useCanViewCashflow } from '@/store/authStore';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

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
  { key: '1', severity: 'critical', count: 3,  message: '3 invoices are overdue',                     link: '/invoices?status=overdue' },
  { key: '2', severity: 'warning',  count: 5,  message: '5 invoice requests awaiting Finance action',  link: '/invoices?status=draft'   },
  { key: '3', severity: 'warning',  count: 2,  message: '2 submitted SOWs without a linked PO',       link: '/sow?filter=no_po'        },
  { key: '4', severity: 'info',     count: 4,  message: '4 POs are missing uploaded documents',        link: '/po?filter=no_doc'        },
];

const MOCK_FORECAST_SUMMARY = {
  totalForecastValue: 6_500_000,
  signedValue: 3_800_000,
  projectedValue: 2_700_000,
  conversionRate: 58.5,
};

const MOCK_AGING = [
  { label: '0–30 days',  amount: 185_000, color: '#52c41a' },
  { label: '31–60 days', amount: 142_000, color: '#faad14' },
  { label: '61–90 days', amount: 98_000,  color: '#fa8c16' },
  { label: '90+ days',   amount: 85_000,  color: '#ff4d4f' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
};

const SeverityIcon = ({ severity }: { severity: string }) => {
  if (severity === 'critical') return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
  if (severity === 'warning')  return <WarningOutlined           style={{ color: '#faad14' }} />;
  return                              <ClockCircleOutlined        style={{ color: '#1677ff' }} />;
};

const alertBadgeColor = (s: string) =>
  s === 'critical' ? '#ff4d4f' : s === 'warning' ? '#faad14' : '#1677ff';

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate      = useNavigate();
  const canViewCashflow = useCanViewCashflow();
  const screens       = useBreakpoint();
  const isMobile      = !screens.md;
  const kpis          = MOCK_KPIS;

  // On mobile show 2 KPIs per row; on tablet 3; on desktop all inline
  const kpiSpan = { xs: 12, sm: 8, md: 8, lg: 4 };

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: isMobile ? 12 : 20 }}>
        <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>Dashboard</Title>
        <Text type="secondary" style={{ fontSize: isMobile ? 11 : 13 }}>
          Commercial Operations Overview · {kpis.fy} · {kpis.currency}
        </Text>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────────────── */}
      <Row gutter={[10, 10]} style={{ marginBottom: isMobile ? 12 : 20 }}>

        <Col {...kpiSpan}>
          <Card className="kpi-card" hoverable size="small" onClick={() => navigate('/invoices')}
            styles={{ body: { padding: isMobile ? '10px 12px' : '16px 20px' } }}>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>Revenue Invoiced</div>
            <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: '#1677ff' }}>
              {kpis.currency} {fmt(kpis.revenueInvoiced)}
            </div>
            <div style={{ fontSize: 10, color: '#bfbfbf', marginTop: 2 }}>{kpis.fy} · Issued</div>
          </Card>
        </Col>

        <Col {...kpiSpan}>
          <Card className="kpi-card" hoverable size="small" onClick={() => navigate('/payments')}
            styles={{ body: { padding: isMobile ? '10px 12px' : '16px 20px' } }}>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>Revenue Realized</div>
            <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: '#52c41a' }}>
              {kpis.currency} {fmt(kpis.revenueRealized)}
            </div>
            <div style={{ fontSize: 10, color: '#bfbfbf', marginTop: 2 }}>{kpis.fy} · Bank receipts</div>
          </Card>
        </Col>

        <Col {...kpiSpan}>
          <Card className="kpi-card" hoverable size="small" onClick={() => navigate('/forecast')}
            styles={{ body: { padding: isMobile ? '10px 12px' : '16px 20px' } }}>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>Revenue Outlook</div>
            <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: '#722ed1' }}>
              {kpis.currency} {fmt(kpis.revenueOutlook)}
            </div>
            <div style={{ fontSize: 10, color: '#bfbfbf', marginTop: 2 }}>{kpis.fy} · Invoiced + Forecast</div>
          </Card>
        </Col>

        <Col {...kpiSpan}>
          <Card className="kpi-card" hoverable size="small" onClick={() => navigate('/payments')}
            styles={{ body: { padding: isMobile ? '10px 12px' : '16px 20px' } }}>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>Outstanding</div>
            <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: '#fa8c16' }}>
              {kpis.currency} {fmt(kpis.outstandingReceivables)}
            </div>
            <div style={{ fontSize: 10, color: '#bfbfbf', marginTop: 2 }}>Live · Unpaid invoices</div>
          </Card>
        </Col>

        <Col {...kpiSpan}>
          <Card className="kpi-card" hoverable size="small" onClick={() => navigate('/invoices?status=overdue')}
            styles={{ body: { padding: isMobile ? '10px 12px' : '16px 20px' } }}>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>Overdue</div>
            <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: '#ff4d4f' }}>
              {kpis.currency} {fmt(kpis.overdueReceivables)}
            </div>
            <div style={{ fontSize: 10, color: '#bfbfbf', marginTop: 2 }}>Live · Past due date</div>
          </Card>
        </Col>

        {canViewCashflow && (
          <Col {...kpiSpan}>
            <Card
              className="kpi-card" hoverable size="small"
              onClick={() => navigate('/cashflow')}
              style={{ borderLeft: `4px solid #52c41a` }}
              styles={{ body: { padding: isMobile ? '10px 12px' : '16px 20px' } }}
            >
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>Cash Runway</div>
              <Tag color="success" style={{ fontSize: isMobile ? 11 : 13, padding: '2px 8px' }}>
                GREEN till {kpis.cashRunway.greenTill}
              </Tag>
              <div style={{ fontSize: 10, color: '#bfbfbf', marginTop: 4 }}>Future liquidity</div>
            </Card>
          </Col>
        )}
      </Row>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <Row gutter={[10, 10]}>

        {/* Left / main column */}
        <Col xs={24} lg={16}>

          {/* Action Required */}
          <Card
            size="small"
            title={
              <Space>
                <WarningOutlined style={{ color: '#faad14' }} />
                <span style={{ fontSize: isMobile ? 13 : 14 }}>Action Required</span>
                <Badge count={MOCK_ALERTS.length} style={{ backgroundColor: '#ff4d4f' }} />
              </Space>
            }
            style={{ marginBottom: 10 }}
          >
            <List
              dataSource={MOCK_ALERTS}
              renderItem={(alert) => (
                <List.Item
                  className={`severity-${alert.severity}`}
                  style={{ cursor: 'pointer', paddingLeft: 10, borderRadius: 4, marginBottom: 6, background: '#fafafa', padding: '8px 10px' }}
                  onClick={() => navigate(alert.link)}
                  actions={[
                    <Badge count={alert.count} style={{ backgroundColor: alertBadgeColor(alert.severity) }} />,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<SeverityIcon severity={alert.severity} />}
                    title={<Text style={{ fontSize: isMobile ? 12 : 13 }}>{alert.message}</Text>}
                  />
                </List.Item>
              )}
            />
          </Card>

          {/* Forecast Snapshot */}
          <Card
            size="small"
            title={
              <Space>
                <span style={{ fontSize: isMobile ? 13 : 14 }}>Forecast Snapshot</span>
                <Tag color="blue">{kpis.fy}</Tag>
              </Space>
            }
            extra={<a onClick={() => navigate('/forecast')} style={{ fontSize: 12 }}>View all →</a>}
          >
            <Row gutter={[12, 12]}>
              {[
                { label: 'Total Forecast', value: MOCK_FORECAST_SUMMARY.totalForecastValue, color: undefined,   fmt: (v: number) => `$${fmt(v)}` },
                { label: 'Signed',         value: MOCK_FORECAST_SUMMARY.signedValue,        color: '#52c41a',   fmt: (v: number) => `$${fmt(v)}` },
                { label: 'Projected',      value: MOCK_FORECAST_SUMMARY.projectedValue,     color: '#1677ff',   fmt: (v: number) => `$${fmt(v)}` },
                { label: 'Conversion',     value: MOCK_FORECAST_SUMMARY.conversionRate,     color: '#722ed1',   fmt: (v: number) => `${v}%`      },
              ].map((item) => (
                <Col xs={12} sm={6} key={item.label}>
                  <Statistic
                    title={<span style={{ fontSize: 11 }}>{item.label}</span>}
                    value={item.value}
                    formatter={(v) => item.fmt(Number(v))}
                    valueStyle={{ fontSize: isMobile ? 15 : 18, color: item.color }}
                  />
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        {/* Right column */}
        <Col xs={24} lg={8}>

          {/* Commercial Snapshot */}
          <Card size="small" title={<span style={{ fontSize: isMobile ? 13 : 14 }}>Commercial Snapshot</span>} style={{ marginBottom: 10 }}>
            <Row gutter={[10, 10]}>
              <Col span={12}>
                <Card size="small" hoverable onClick={() => navigate('/sow')}
                  style={{ textAlign: 'center', cursor: 'pointer' }}>
                  <FileTextOutlined style={{ fontSize: 20, color: '#1677ff', marginBottom: 4 }} />
                  <div style={{ fontSize: 24, fontWeight: 700 }}>8</div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Open SOWs</Text>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" hoverable onClick={() => navigate('/po')}
                  style={{ textAlign: 'center', cursor: 'pointer' }}>
                  <ShoppingCartOutlined style={{ fontSize: 20, color: '#722ed1', marginBottom: 4 }} />
                  <div style={{ fontSize: 24, fontWeight: 700 }}>14</div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Open POs</Text>
                </Card>
              </Col>
            </Row>
          </Card>

          {/* Receivables Aging */}
          <Card
            size="small"
            title={<span style={{ fontSize: isMobile ? 13 : 14 }}>Receivables Aging</span>}
            extra={<a onClick={() => navigate('/payments')} style={{ fontSize: 12 }}>Details →</a>}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={6}>
              {MOCK_AGING.map((b) => (
                <div key={b.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space size={6}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: b.color, flexShrink: 0 }} />
                    <Text style={{ fontSize: isMobile ? 12 : 13 }}>{b.label}</Text>
                  </Space>
                  <Text strong style={{ fontSize: isMobile ? 12 : 13, color: b.color }}>${fmt(b.amount)}</Text>
                </div>
              ))}
              <Divider style={{ margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text strong style={{ fontSize: isMobile ? 12 : 13 }}>Total Outstanding</Text>
                <Text strong style={{ fontSize: isMobile ? 12 : 13, color: '#fa8c16' }}>${fmt(kpis.outstandingReceivables)}</Text>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
