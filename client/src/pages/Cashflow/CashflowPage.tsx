import { useMemo, useState } from 'react';
import { Card, Typography, Select, Table, Row, Col, Statistic, Empty } from 'antd';
import { LineChartOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { forecastsApi } from '@/api/forecasts';
import { Forecast } from '@/types';
import { fmt } from '@/utils/format';

const { Title, Text } = Typography;

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

function getFiscalMonthColumns(fy: string) {
  const startYear = Number.parseInt(fy.replace('FY', '').split('-')[0], 10);
  const fyStartYear = startYear < 50 ? 2000 + startYear : 1900 + startYear;
  const start = new Date(fyStartYear, 3, 1);

  return Array.from({ length: 12 }, (_, index) => {
    const monthDate = new Date(start.getFullYear(), start.getMonth() + index, 1);
    return {
      key: monthDate.toISOString().slice(0, 7),
      label: `${monthDate.toLocaleString('en-US', { month: 'short' })} ${monthDate.getFullYear()}`,
      fiscalMonth: index,
    };
  });
}

type MatrixRow = {
  key: string;
  section: string;
  rowTotal: number;
  [monthKey: string]: string | number;
};

function buildMatrix(forecasts: Forecast[], fy: string) {
  const monthColumns = getFiscalMonthColumns(fy);
  const rows = [
    {
      key: 'projected',
      label: 'Projected',
      valueOf: (forecast: Forecast) =>
        Math.max(
          (forecast.projectedValue ?? Math.max((forecast.totalValue || 0) - (forecast.signedValue || 0), 0)) || 0,
          0
        ),
    },
    {
      key: 'recognized',
      label: 'Recognized',
      valueOf: (forecast: Forecast) => forecast.signedValue || 0,
    },
    {
      key: 'realized',
      label: 'Realized',
      valueOf: () => 0,
    },
  ] as const;

  const rowData: MatrixRow[] = rows.map((row) => {
    const monthValues: Record<string, number> = {};
    let rowTotal = 0;

    for (const month of monthColumns) {
      let monthTotal = 0;

      for (const forecast of forecasts) {
        const dist = forecast.distributions?.find((d) => d.fy === fy);
        const quarterKey = `q${Math.floor(month.fiscalMonth / 3) + 1}` as 'q1' | 'q2' | 'q3' | 'q4';
        const qTotal = dist?.[quarterKey] ?? 0;
        const value = row.valueOf(forecast);

        if (value > 0 && qTotal > 0) {
          monthTotal += value * (qTotal / 3 / Math.max(qTotal, 1));
        }
      }

      monthValues[month.key] = monthTotal;
      rowTotal += monthTotal;
    }

    return {
      key: row.key,
      section: row.label,
      rowTotal,
      ...monthValues,
    };
  });

  const columnTotals: Record<string, number> = {};
  for (const month of monthColumns) {
    columnTotals[month.key] = rowData.reduce((sum, row) => sum + (Number(row[month.key]) || 0), 0);
  }

  const totalRow: MatrixRow = {
    key: 'totals',
    section: 'Total',
    rowTotal: rowData.reduce((sum, row) => sum + (Number(row.rowTotal) || 0), 0),
    ...columnTotals,
  };

  return {
    monthColumns,
    rowData,
    totalRow,
  };
}

export default function CashflowPage() {
  const [fy, setFy] = useState(FY_OPTIONS[1]);

  const { data, isLoading } = useQuery({
    queryKey: ['forecasts', fy],
    queryFn: () => forecastsApi.list({ fy, limit: 500 }),
  });

  const forecasts: Forecast[] = (data?.data as any)?.data || [];

  const { monthColumns, rowData, totalRow } = useMemo(
    () => buildMatrix(forecasts, fy),
    [forecasts, fy]
  );

  const projectedOpen = useMemo(
    () => forecasts.reduce((sum, f) => sum + Math.max((f.projectedValue ?? Math.max((f.totalValue || 0) - (f.signedValue || 0), 0)) || 0, 0), 0),
    [forecasts]
  );

  const recognizedTotal = useMemo(
    () => forecasts.reduce((sum, f) => sum + (f.signedValue || 0), 0),
    [forecasts]
  );

  const columns = [
    {
      title: 'Section',
      dataIndex: 'section',
      key: 'section',
      width: 180,
      fixed: 'left' as const,
      render: (value: string) => <Text strong>{value}</Text>,
    },
    ...monthColumns.map((month) => ({
      title: month.label,
      dataIndex: month.key,
      key: month.key,
      width: 120,
      align: 'right' as const,
      render: (value: number) => <Text>{fmt(value)}</Text>,
    })),
    {
      title: 'Row Total',
      dataIndex: 'rowTotal',
      key: 'rowTotal',
      width: 120,
      align: 'right' as const,
      fixed: 'right' as const,
      render: (value: number) => <Text strong>{fmt(value)}</Text>,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>
          <LineChartOutlined /> Cashflow & Runway
        </Title>
        <Text type="secondary">Projected, recognized, and realized cash view by month and FY</Text>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={24} md={12}>
            <Text strong>Financial year</Text>
            <Select
              value={fy}
              style={{ width: 170, display: 'block', marginTop: 8 }}
              options={FY_OPTIONS.map((option) => ({ value: option, label: option }))}
              onChange={setFy}
            />
          </Col>
          <Col span={24} md={12}>
            <Text type="secondary">Initial view: all forecast amounts not already signed are shown against projected.</Text>
          </Col>
        </Row>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic title="Projected" value={projectedOpen} formatter={(value) => fmt(Number(value))} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="Recognized" value={recognizedTotal} formatter={(value) => fmt(Number(value))} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="Realized" value={0} formatter={(value) => fmt(Number(value))} />
          </Card>
        </Col>
      </Row>

      <Card>
        {isLoading ? (
          <Text>Loading cashflow view…</Text>
        ) : forecasts.length === 0 ? (
          <Empty description="No forecast data available for this FY" />
        ) : (
          <Table
            columns={columns}
            dataSource={[...rowData, totalRow]}
            pagination={false}
            size="small"
            bordered
            scroll={{ x: 1200 }}
            rowClassName={(record) => (record.key === 'totals' ? 'ant-table-row-total' : '')}
            summary={() => null}
          />
        )}
      </Card>
    </div>
  );
}
