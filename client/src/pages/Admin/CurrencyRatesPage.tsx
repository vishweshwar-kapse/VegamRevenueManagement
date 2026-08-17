import { useEffect, useMemo, useState } from 'react';
import {
  Card, Table, Button, Typography, Space, InputNumber, Select, Popover,
  Popconfirm, Tooltip, Tag, message, Grid, Empty, Input,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SaveOutlined, CalendarOutlined, EditOutlined,
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

const buildEmptyRates = (currencies: string[]) => {
  const rates = currencies.reduce<Record<string, Record<string, number>>>((acc, cur) => {
    acc[cur] = {};
    return acc;
  }, {});

  currencies.forEach((cur) => {
    rates[cur][cur] = 1;
  });

  return rates;
};

const normalizeRatesForCurrencies = (
  rates: Record<string, Record<string, number>> | undefined,
  currencies: string[]
) => {
  const normalized = currencies.reduce<Record<string, Record<string, number>>>((acc, fromCur) => {
    acc[fromCur] = {};
    return acc;
  }, {});

  currencies.forEach((fromCur) => {
    const existing = rates?.[fromCur] || {};
    currencies.forEach((toCur) => {
      if (fromCur === toCur) {
        normalized[fromCur][toCur] = 1;
      } else if (existing[toCur] !== undefined && existing[toCur] !== null) {
        normalized[fromCur][toCur] = existing[toCur];
      }
    });
  });

  return normalized;
};

const getCellValue = (rates: Record<string, Record<string, number>> | undefined, fromCur: string, toCur: string) => {
  const fromRates = rates?.[fromCur];
  if (!fromRates) return null;
  if (fromCur === toCur) return 1;
  return fromRates[toCur] ?? null;
};

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
  const [manageCurOpen, setManageCurOpen] = useState(false);
  const [pendingCur, setPendingCur] = useState<string | undefined>();
  const [currencyDrafts, setCurrencyDrafts] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['currency-rates'],
    queryFn: () => currencyRatesApi.get(),
  });

  // Hydrate local state whenever the server copy loads/changes.
  useEffect(() => {
    const grid = (data?.data as any)?.data;
    if (grid) {
      const nextCurrencies = grid.currencies || [];
      setCurrencies(nextCurrencies);
      const drafts: Record<string, string> = {};
      nextCurrencies.forEach((cur: string) => {
        drafts[cur] = cur;
      });
      setCurrencyDrafts(drafts);
      setRows(
        (grid.rows || []).map((r: RateRow) => ({
          ...r,
          rates: normalizeRatesForCurrencies(
            Object.fromEntries(
              Object.entries(r.rates || {}).map(([fromCur, values]) => [
                fromCur,
                Object.fromEntries(
                  Object.entries(values || {}).filter(([, value]) => value !== undefined && value !== null)
                ),
              ])
            ),
            nextCurrencies
          ),
        }))
      );
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

  const updateCell = (rowIndex: number, fromCur: string, toCur: string, value: number | null) => {
    if (fromCur === toCur) {
      return;
    }

    setRows((prev) => {
      const next = prev.map((r) => ({ ...r, rates: { ...r.rates } }));
      const currentRow = next[rowIndex];
      const currentFromRates = { ...(currentRow.rates?.[fromCur] || {}) };

      if (value === null || value === undefined) {
        delete currentFromRates[toCur];
      } else {
        currentFromRates[toCur] = value;
      }

      currentRow.rates = {
        ...currentRow.rates,
        [fromCur]: currentFromRates,
      };
      return next;
    });
    setDirty(true);
  };

  const addMonth = () => {
    setRows((prev) => [...prev, { ...nextMonthAfter(prev), rates: buildEmptyRates(currencies) }]);
    setDirty(true);
  };

  const removeRow = (rowIndex: number) => {
    setRows((prev) => prev.filter((_, i) => i !== rowIndex));
    setDirty(true);
  };

  const addCurrency = () => {
    if (!pendingCur) return;
    const nextCurrency = pendingCur.trim().toUpperCase();
    const nextCurrencies = currencies.includes(nextCurrency) ? currencies : [...currencies, nextCurrency];

    setCurrencies(nextCurrencies);
    setCurrencyDrafts((prev) => ({ ...prev, [nextCurrency]: nextCurrency }));
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        rates: normalizeRatesForCurrencies(
          {
            ...row.rates,
            [nextCurrency]: {
              ...(row.rates?.[nextCurrency] || {}),
              [nextCurrency]: 1,
            },
          },
          nextCurrencies
        ),
      }))
    );
    setPendingCur(undefined);
    setAddCurOpen(false);
    setDirty(true);
  };

  const renameCurrency = (oldCur: string, newCur: string) => {
    const normalized = newCur.trim().toUpperCase();
    if (!normalized) {
      message.error('Currency code cannot be empty');
      return;
    }
    if (normalized !== oldCur && currencies.includes(normalized)) {
      message.error('A currency with this code already exists');
      return;
    }

    const nextCurrencies = currencies.map((cur) => (cur === oldCur ? normalized : cur));
    setCurrencies(nextCurrencies);
    setCurrencyDrafts((prev) => ({ ...prev, [normalized]: normalized, [oldCur]: normalized }));
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        rates: normalizeRatesForCurrencies(
          Object.fromEntries(
            Object.entries(row.rates || {}).map(([fromCur, values]) => {
              const nextFromCur = fromCur === oldCur ? normalized : fromCur;
              const renamedValues = Object.fromEntries(
                Object.entries(values || {}).map(([toCur, value]) => [
                  toCur === oldCur ? normalized : toCur,
                  value,
                ])
              );
              return [nextFromCur, renamedValues];
            })
          ),
          nextCurrencies
        ),
      }))
    );
    setDirty(true);
    message.success(`Currency updated to ${normalized}`);
  };

  const removeCurrency = (cur: string) => {
    if (currencies.length <= 1) {
      message.error('At least one currency must remain');
      return;
    }

    const nextCurrencies = currencies.filter((c) => c !== cur);
    setCurrencies(nextCurrencies);
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        rates: normalizeRatesForCurrencies(
          Object.fromEntries(
            Object.entries(row.rates || {})
              .filter(([fromCur]) => fromCur !== cur)
              .map(([fromCur, values]) => [
                fromCur,
                Object.fromEntries(
                  Object.entries(values || {}).filter(([toCur]) => toCur !== cur)
                ),
              ])
          ),
          nextCurrencies
        ),
      }))
    );
    setCurrencyDrafts((prev) => {
      const next = { ...prev };
      delete next[cur];
      return next;
    });
    setDirty(true);
    message.success(`Currency ${cur} removed`);
  };

  const monthTables = useMemo(() => {
    if (currencies.length === 0) {
      return null;
    }

    return rows.map((row, rowIndex) => {
      const dataSource = currencies.map((toCur) => ({ key: toCur, toCur }));

      const columns: any[] = [
        {
          title: <Text strong>Currency</Text>,
          dataIndex: 'toCur',
          key: 'toCur',
          width: 130,
          fixed: 'left' as const,
          render: (value: string) => <Text strong>{value}</Text>,
        },
        ...currencies.map((fromCur) => ({
          title: <span>To {fromCur}</span>,
          key: fromCur,
          width: 140,
          render: (_: unknown, record: { toCur: string }) => {
            const isDiagonal = fromCur === record.toCur;
            return (
              <InputNumber
                value={getCellValue(rows[rowIndex].rates, fromCur, record.toCur) ?? null}
                onChange={(value) => updateCell(rowIndex, fromCur, record.toCur, value as number | null)}
                disabled={!canEdit || isDiagonal}
                placeholder="—"
                min={0.01}
                precision={2}
                step={0.01}
                controls={false}
                style={{ width: '100%' }}
              />
            );
          },
        })),
      ];

      return (
        <Card
          key={`${row.year}-${row.month}`}
          size="small"
          title={
            <Space size={6}>
              <CalendarOutlined style={{ color: '#8c8c8c' }} />
              <span>{monthLabel(row)}</span>
            </Space>
          }
          extra={
            canEdit && (
              <Tooltip title="Remove month">
                <Popconfirm
                  title="Remove this month?"
                  onConfirm={() => removeRow(rowIndex)}
                  okText="Remove"
                  okButtonProps={{ danger: true }}
                >
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Tooltip>
            )
          }
          style={{ marginBottom: 12 }}
        >
          <Table
            dataSource={dataSource}
            columns={columns}
            rowKey="key"
            pagination={false}
            size="small"
            scroll={{ x: 160 + currencies.length * 140 }}
            locale={{
              emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No currencies added yet" />,
            }}
          />
        </Card>
      );
    });
  }, [canEdit, currencies, rows]);

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

  const manageCurrencyContent = (
    <Space direction="vertical" style={{ width: 280 }}>
      {currencies.map((cur) => (
        <div key={cur} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Input
            size="small"
            value={currencyDrafts[cur] || cur}
            onChange={(e) => setCurrencyDrafts((prev) => ({ ...prev, [cur]: e.target.value }))}
            style={{ flex: 1 }}
          />
          <Button size="small" type="primary" onClick={() => renameCurrency(cur, currencyDrafts[cur] || cur)}>
            Save
          </Button>
          <Popconfirm
            title={`Remove ${cur}?`}
            description="This will delete all values for this currency from every month."
            onConfirm={() => removeCurrency(cur)}
            okText="Remove"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ))}
    </Space>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>Currency Conversion Rates</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Maintain the monthly conversion rate between currencies. Add a month to
            extend the matrix, or add a currency to expand the rows and columns.
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
        {isLoading ? (
          <div style={{ padding: 16 }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Loading rates" />
          </div>
        ) : (
          <div style={{ padding: 12 }}>
            {rows.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No months added yet"
              />
            ) : (
              monthTables
            )}
          </div>
        )}

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
              title="Add currency"
            >
              <Button
                icon={<PlusOutlined />}
                disabled={availableCurrencies.length === 0}
              >
                Add Currency
              </Button>
            </Popover>
            <Popover
              open={manageCurOpen}
              onOpenChange={(o) => { setManageCurOpen(o); if (!o) setCurrencyDrafts(currencies.reduce<Record<string, string>>((acc, cur) => { acc[cur] = cur; return acc; }, {})); }}
              trigger="click"
              placement="bottomLeft"
              content={manageCurrencyContent}
              title="Manage currencies"
            >
              <Button icon={<EditOutlined />}>
                Edit Currencies
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
