import { useEffect, useMemo, useState } from 'react';
import {
  Card, Table, Button, Typography, Space, InputNumber, Select, Popover,
  Popconfirm, Tooltip, Tag, message, Grid, Empty,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SaveOutlined, CalendarOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { currencyRatesApi, RateRow } from '@/api/currencyRates';
import { CURRENCY_OPTIONS } from '@/constants/masterData';
import { useIsFinanceAdmin } from '@/store/authStore';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// First month shown when the grid is empty.
const DEFAULT_START = { month: 4, year: 2026 }; // April 2026

const monthLabel = (r: { month: number; year: number }) =>
  `${MONTH_NAMES[r.month - 1]} ${r.year}`;

// The calendar month immediately following the last row in the grid.
const nextMonthAfter = (rows: RateRow[]) => {
  if (rows.length === 0) return { ...DEFAULT_START };
  const last = rows[rows.length - 1];
  return last.month === 12
    ? { month: 1, year: last.year + 1 }
    : { month: last.month + 1, year: last.year };
};

export default function CurrencyRatesPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const qc = useQueryClient();
  const canEdit = useIsFinanceAdmin();

  // Working copy of the grid — edited locally, persisted on Save.
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [rows, setRows] = useState<RateRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [addCurOpen, setAddCurOpen] = useState(false);
  const [pendingCur, setPendingCur] = useState<string | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['currency-rates'],
    queryFn: () => currencyRatesApi.get(),
  });

  // Hydrate local state whenever the server copy loads/changes.
  useEffect(() => {
    const grid = (data?.data as any)?.data;
    if (grid) {
      setCurrencies(grid.currencies || []);
      setRows((grid.rows || []).map((r: RateRow) => ({ ...r, rates: { ...r.rates } })));
      setDirty(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => currencyRatesApi.save({ currencies, rows }),
    onSuccess: () => {
      message.success('Currency rates saved');
      qc.invalidateQueries({ queryKey: ['currency-rates'] });
      setDirty(false);
    },
    onError: (err: any) => {
      const d = err?.response?.data;
      message.error(d?.message || d?.errors?.[0]?.msg || 'Failed to save rates');
    },
  });

  // Currencies not yet used as a column — candidates for "Add Currency".
  const availableCurrencies = useMemo(
    () => CURRENCY_OPTIONS.filter((c) => !currencies.includes(c.value)),
    [currencies]
  );

  // ─── Editing handlers ─────────────────────────────────────────────────────────

  const updateCell = (rowIndex: number, cur: string, value: number | null) => {
    setRows((prev) => {
      const next = prev.map((r) => ({ ...r, rates: { ...r.rates } }));
      if (value === null || value === undefined) {
        delete next[rowIndex].rates[cur];
      } else {
        next[rowIndex].rates[cur] = value;
      }
      return next;
    });
    setDirty(true);
  };

  const addMonth = () => {
    setRows((prev) => [...prev, { ...nextMonthAfter(prev), rates: {} }]);
    setDirty(true);
  };

  const removeRow = (rowIndex: number) => {
    setRows((prev) => prev.filter((_, i) => i !== rowIndex));
    setDirty(true);
  };

  const addCurrency = () => {
    if (!pendingCur) return;
    setCurrencies((prev) => [...prev, pendingCur]);
    setPendingCur(undefined);
    setAddCurOpen(false);
    setDirty(true);
  };

  const removeCurrency = (cur: string) => {
    setCurrencies((prev) => prev.filter((c) => c !== cur));
    setRows((prev) =>
      prev.map((r) => {
        const rates = { ...r.rates };
        delete rates[cur];
        return { ...r, rates };
      })
    );
    setDirty(true);
  };

  // ─── Columns ──────────────────────────────────────────────────────────────────

  const columns: any[] = [
    {
      title: 'Month',
      dataIndex: 'month',
      key: 'month',
      fixed: 'left' as const,
      width: 150,
      render: (_: unknown, r: RateRow) => (
        <Space size={6}>
          <CalendarOutlined style={{ color: '#8c8c8c' }} />
          <Text strong style={{ fontSize: 13 }}>{monthLabel(r)}</Text>
        </Space>
      ),
    },
    ...currencies.map((cur) => ({
      title: (
        <Space size={4}>
          <span>{cur}</span>
          {canEdit && (
            <Popconfirm
              title={`Remove ${cur} column?`}
              description="Values entered for this currency will be discarded."
              onConfirm={() => removeCurrency(cur)}
              okText="Remove"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined style={{ fontSize: 11 }} />}
                style={{ padding: '0 4px' }}
              />
            </Popconfirm>
          )}
        </Space>
      ),
      dataIndex: cur,
      key: cur,
      width: 150,
      render: (_: unknown, r: RateRow, index: number) => (
        <InputNumber
          value={r.rates[cur] ?? null}
          onChange={(v) => updateCell(index, cur, v as number | null)}
          disabled={!canEdit}
          placeholder="—"
          min={0}
          step={0.01}
          controls={false}
          style={{ width: '100%' }}
        />
      ),
    })),
  ];

  if (canEdit) {
    columns.push({
      title: '',
      key: 'actions',
      fixed: 'right' as const,
      width: 50,
      render: (_: unknown, __: RateRow, index: number) => (
        <Tooltip title="Remove month">
          <Popconfirm
            title="Remove this month?"
            onConfirm={() => removeRow(index)}
            okText="Remove"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Tooltip>
      ),
    });
  }

  const addCurrencyContent = (
    <Space direction="vertical" style={{ width: 220 }}>
      <Select
        placeholder="Select a currency"
        style={{ width: '100%' }}
        value={pendingCur}
        onChange={setPendingCur}
        options={availableCurrencies}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button size="small" onClick={() => { setAddCurOpen(false); setPendingCur(undefined); }}>
          Cancel
        </Button>
        <Button size="small" type="primary" disabled={!pendingCur} onClick={addCurrency}>
          Add
        </Button>
      </div>
    </Space>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>Currency Conversion Rates</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Maintain the monthly conversion rate for each currency. Add a month to
            extend the table, or add a currency column.
          </Text>
        </div>
        {canEdit && (
          <Space>
            {dirty && <Tag color="orange">Unsaved changes</Tag>}
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saveMutation.isPending}
              disabled={!dirty}
              onClick={() => saveMutation.mutate()}
            >
              Save
            </Button>
          </Space>
        )}
      </div>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={rows.map((r, i) => ({ ...r, _key: `${r.year}-${r.month}-${i}` }))}
          columns={columns}
          rowKey="_key"
          loading={isLoading}
          pagination={false}
          size="small"
          scroll={{ x: 150 + currencies.length * 150 + 50 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No months added yet"
              />
            ),
          }}
        />

        {canEdit && (
          <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #f0f0f0', flexWrap: 'wrap' }}>
            <Button icon={<PlusOutlined />} onClick={addMonth}>
              Add Month
            </Button>
            <Popover
              open={addCurOpen}
              onOpenChange={(o) => { setAddCurOpen(o); if (!o) setPendingCur(undefined); }}
              trigger="click"
              placement="bottomLeft"
              content={addCurrencyContent}
              title="Add currency column"
            >
              <Button
                icon={<PlusOutlined />}
                disabled={availableCurrencies.length === 0}
              >
                Add Currency
              </Button>
            </Popover>
          </div>
        )}
      </Card>

      {!canEdit && (
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
          You have view-only access. Only Finance Admins can edit conversion rates.
        </Text>
      )}
    </div>
  );
}
