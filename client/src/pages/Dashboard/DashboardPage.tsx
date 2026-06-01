import { useState } from 'react';
import { Row, Col, Card, Statistic, Tag, Typography, List, Badge, Space, Divider, Grid, Select, Skeleton } from 'antd';
import {
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  FileTextOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCanViewCashflow } from '@/store/authStore';
import { dashboardApi } from '@/api/forecasts';
import { DashboardSummary } from '@/types';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

function getFYOptions(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const fyStart = month >= 4 ? year : year - 1;
  return [-1, 0, 1, 2].map((offset) => {
    const s = fyStart + offset;
    return `FY${String(s).slice(-2)}-${String(s + 1).slice(-2)}`;
  });
}
const FY_OPTIONS = getFYOptions();
const CURRENT_FY = FY_OPTIONS[1];

const fmt = (v: number) => {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
};

const SeverityIcon = ({ severity }: { severity: string }) => {
  if (severity === 'critical') return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
  if (severity === 'warning')  return <WarningOutlined style={{ color: '#faad14' }} />;
  return <ClockCircleOutlined style={{ color: '#1677ff' }} />;
};

const alertBadgeColor = (s: string) =>
  s === 'critical' ? '#ff4d4f' : s === 'warning' ? '#faad14' : '#1677ff';

export default function DashboardPage() {
  const navigate = useNavigate();
  const canViewCashflow = useCanViewCashflow();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [fy, setFy] = useState(CURRENT_FY);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-summary', fy],
    queryFn: () => dashboardApi.summary(fy),
  });

  const summary: DashboardSummary | null = (data?.data as any)?.data || null;
  const forecast = summary?.forecast;
  const currency = summary?.currency || 'USD';
  const kpiSpan = { xs: 12, sm: 8, md: 8, lg: 4 };

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? 12 : 20 }}>
        <div>
          <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>Dashboard</Title>
          <Text type="secondary" style={{ fontSize: isMobile ? 11 : 13 }}>
            Commercial Operations Overview · {fy} · {currency}
          </Text>
        </div>
        <Select
          value={fy}
          onChange={setFy}
          size="small"
          style={{ width: 110 }}
          options={FY_OPTIONS.map((f) => ({ value: f, label: f }))}
        />
      </div>

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <>
          {/* ── KPI Strip ──────────────────────────────────────────────── */}
          <Row gutter={[10, 10]} style={{ marginBottom: isMobile ? 12 : 20 }}>
            <Col {...kpiSpan}>
              <Card className="kpi-card" hoverable size="small" onClick={() => navigate('/invoices')}
                styles={{ body: { padding: isMobile ? '10px 12px' : '16px 20px' } }}>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>Revenue Invoiced</div>
                <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: '#1677ff' }}>
                  {currency} {fmt(summary?.revenueInvoiced || 0)}
                </div>
                <div style={{ fontSize: 10, color: '#bfbfbf', marginTop: 2 }}>{fy} · Issued</div>
              </Card>
            </Col>

            <Col {...kpiSpan}>
              <Card className="kpi-card" hoverable size="small" onClick={() => navigate('/payments')}
                styles={{ body: { padding: isMobile ? '10px 12px' : '16px 20px' } }}>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>Revenue Realized</div>
                <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: '#52c41a' }}>
                  {currency} {fmt(summary?.revenueRealized || 0)}
                </div>
                <div style={{ fontSize: 10, color: '#bfbfbf', marginTop: 2 }}>{fy} · Bank receipts</div>
              </Card>
            </Col>

            <Col {...kpiSpan}>
              <Card className="kpi-card" hoverable size="small" onClick={() => navigate('/forecast')}
                styles={{ body: { padding: isMobile ? '10px 12px' : '16px 20px' } }}>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>Revenue Outlook</div>
                <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: '#722ed1' }}>
                  {currency} {fmt(forecast?.totalForecastValue || 0)}
                </div>
                <div style={{ fontSize: 10, color: '#bfbfbf', marginTop: 2 }}>{fy} · Total Forecast</div>
              </Card>
            </Col>

            <Col {...kpiSpan}>
              <Card className="kpi-card" hoverable size="small" onClick={() => navigate('/payments')}
                styles={{ body: { padding: isMobile ? '10px 12px' : '16px 20px' } }}>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>Outstanding</div>
                <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: '#fa8c16' }}>
                  {currency} {fmt(summary?.outstandingReceivables || 0)}
                </div>
                <div style={{ fontSize: 10, color: '#bfbfbf', marginTop: 2 }}>Live · Unpaid invoices</div>
              </Card>
            </Col>

            <Col {...kpiSpan}>
              <Card className="kpi-card" hoverable size="small" onClick={() => navigate('/invoices?status=overdue')}
                styles={{ body: { padding: isMobile ? '10px 12px' : '16px 20px' } }}>
                <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>Overdue</div>
                <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: '#ff4d4f' }}>
                  {currency} {fmt(summary?.overdueReceivables || 0)}
                </div>
                <div style={{ fontSize: 10, color: '#bfbfbf', marginTop: 2 }}>Live · Past due date</div>
              </Card>
            </Col>

            {canViewCashflow && (
              <Col {...kpiSpan}>
                <Card className="kpi-card" hoverable size="small" onClick={() => navigate('/cashflow')}
                  style={{ borderLeft: '4px solid #52c41a' }}
                  styles={{ body: { padding: isMobile ? '10px 12px' : '16px 20px' } }}>
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4 }}>Cash Runway</div>
                  <Tag color="success" style={{ fontSize: isMobile ? 11 : 13, padding: '2px 8px' }}>
                    Coming soon
                  </Tag>
                  <div style={{ fontSize: 10, color: '#bfbfbf', marginTop: 4 }}>Future liquidity</div>
                </Card>
              </Col>
            )}
          </Row>

          {/* ── Body ───────────────────────────────────────────────────── */}
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
                    <Badge count={summary?.alerts?.length || 0} style={{ backgroundColor: '#ff4d4f' }} />
                  </Space>
                }
                style={{ marginBottom: 10 }}
              >
                {!summary?.alerts?.length ? (
                  <Text type="secondary" style={{ fontSize: 13 }}>No actions required — all clear.</Text>
                ) : (
                  <List
                    dataSource={summary.alerts}
                    renderItem={(alert) => (
                      <List.Item
                        style={{ cursor: 'pointer', paddingLeft: 10, borderRadius: 4, marginBottom: 6, background: '#fafafa', padding: '8px 10px' }}
                        onClick={() => alert.link && navigate(alert.link)}
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
                )}
              </Card>

              {/* Forecast Snapshot */}
              <Card
                size="small"
                title={
                  <Space>
                    <span style={{ fontSize: isMobile ? 13 : 14 }}>Forecast Snapshot</span>
                    <Tag color="blue">{fy}</Tag>
                  </Space>
                }
                extra={<a onClick={() => navigate('/forecast')} style={{ fontSize: 12 }}>View all →</a>}
              >
                <Row gutter={[12, 12]}>
                  {[
                    { label: 'Total Forecast', value: forecast?.totalForecastValue || 0, color: undefined,   fmtFn: (v: number) => `${currency} ${fmt(v)}` },
                    { label: 'Signed',         value: forecast?.signedValue || 0,        color: '#52c41a',   fmtFn: (v: number) => `${currency} ${fmt(v)}` },
                    { label: 'Projected',      value: forecast?.projectedValue || 0,     color: '#1677ff',   fmtFn: (v: number) => `${currency} ${fmt(v)}` },
                    { label: 'Conversion',     value: forecast?.conversionRate || 0,     color: '#722ed1',   fmtFn: (v: number) => `${v}%` },
                  ].map((item) => (
                    <Col xs={12} sm={6} key={item.label}>
                      <Statistic
                        title={<span style={{ fontSize: 11 }}>{item.label}</span>}
                        value={item.value}
                        formatter={(v) => item.fmtFn(Number(v))}
                        valueStyle={{ fontSize: isMobile ? 15 : 18, color: item.color }}
                      />
                    </Col>
                  ))}
                </Row>
                {forecast && (
                  <>
                    <Divider style={{ margin: '12px 0 8px' }} />
                    <Row gutter={[12, 4]}>
                      {(['q1', 'q2', 'q3', 'q4'] as const).map((q) => (
                        <Col xs={6} key={q}>
                          <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>{q.toUpperCase()}</Text>
                          <Text strong style={{ fontSize: 13 }}>
                            {currency} {fmt(forecast.quarterly?.[q] || 0)}
                          </Text>
                        </Col>
                      ))}
                    </Row>
                  </>
                )}
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
                      <div style={{ fontSize: 24, fontWeight: 700 }}>{summary?.openSOWs || 0}</div>
                      <Text type="secondary" style={{ fontSize: 11 }}>Open SOWs</Text>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" hoverable onClick={() => navigate('/po')}
                      style={{ textAlign: 'center', cursor: 'pointer' }}>
                      <ShoppingCartOutlined style={{ fontSize: 20, color: '#722ed1', marginBottom: 4 }} />
                      <div style={{ fontSize: 24, fontWeight: 700 }}>{summary?.openPOs || 0}</div>
                      <Text type="secondary" style={{ fontSize: 11 }}>Open POs</Text>
                    </Card>
                  </Col>
                </Row>
              </Card>

              {/* Forecast by site count */}
              <Card
                size="small"
                title={<span style={{ fontSize: isMobile ? 13 : 14 }}>Forecast Coverage</span>}
              >
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13 }}>Active sites with forecasts</Text>
                    <Text strong style={{ fontSize: 13, color: '#1677ff' }}>{forecast?.activeSites || 0}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13 }}>Customers covered</Text>
                    <Text strong style={{ fontSize: 13, color: '#1677ff' }}>{forecast?.activeCustomers || 0}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13 }}>Forecast entries</Text>
                    <Text strong style={{ fontSize: 13, color: '#1677ff' }}>{forecast?.forecastCount || 0}</Text>
                  </div>
                  <Divider style={{ margin: '4px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text strong style={{ fontSize: 13 }}>Conversion Rate</Text>
                    <Text strong style={{ fontSize: 13, color: forecast?.conversionRate ? '#52c41a' : '#bfbfbf' }}>
                      {forecast?.conversionRate || 0}%
                    </Text>
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
