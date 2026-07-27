import { useState } from 'react';
import {
  Card, Table, Button, Tag, Space, Typography, Select, Input, Statistic,
  Row, Col, Popconfirm, Tooltip, message, Grid, Empty, Modal,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  DownloadOutlined, SendOutlined, StopOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { invoicesApi } from '@/api/invoices';
import { customersApi } from '@/api/customers';
import { customerPlantsApi } from '@/api/customerPlants';
import { posApi } from '@/api/pos';
import { Invoice, InvoiceStatus, Customer, CustomerPlant, PO } from '@/types';
import { useIsForecastUser, useAuthStore } from '@/store/authStore';
import { INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS, COLORS, FONT_SIZE } from '@/constants/theme';
import { fmt } from '@/utils/format';
import BulkUploadSection from '@/components/BulkUpload/BulkUploadSection';
import { saveBlob, today, FailedRow } from '@/utils/excelBulk';
import {
  InvoiceRefData, generateTemplate, parseAndValidate, buildInvoiceErrorWorkbook,
  exportInvoices, payloadToFailedRow,
} from '@/utils/invoiceBulk';
import InvoiceFormDrawer from './InvoiceFormDrawer';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function InvoicePage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const isForecastUser = useIsForecastUser();
  const currentUser = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | undefined>(undefined);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: () => invoicesApi.list({ status: statusFilter, limit: 200 }),
    enabled: isForecastUser,
  });

  const rawInvoices: Invoice[] = (data?.data as any)?.data || [];
  const invoices = search
    ? rawInvoices.filter((inv) => {
        const cName = typeof inv.customerId === 'string' ? '' : (inv.customerId as Customer).name;
        return (
          inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
          cName.toLowerCase().includes(search.toLowerCase())
        );
      })
    : rawInvoices;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['invoices'] });
    qc.invalidateQueries({ queryKey: ['pos'] });
  };

  const issueMutation = useMutation({
    mutationFn: (id: string) => invoicesApi.issue(id),
    onSuccess: () => { message.success('Invoice issued'); invalidate(); },
    onError: (e: any) => message.error(e?.response?.data?.message || 'Failed to issue invoice'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => invoicesApi.cancel(id),
    onSuccess: () => { message.success('Invoice cancelled'); invalidate(); },
    onError: (e: any) => message.error(e?.response?.data?.message || 'Failed to cancel invoice'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => invoicesApi.deactivate(id),
    onSuccess: () => { message.success('Invoice removed'); invalidate(); },
    onError: (e: any) => message.error(e?.response?.data?.message || 'Failed to remove invoice'),
  });

  const handleDownload = async (inv: Invoice) => {
    try {
      const resp = await invoicesApi.downloadPdf(inv._id);
      const blob = new Blob([resp.data as any], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${inv.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Could not download the PDF');
    }
  };

  const openCreate = () => { setSelectedInvoice(null); setDrawerOpen(true); };
  const openEdit = (inv: Invoice) => { setSelectedInvoice(inv); setDrawerOpen(true); };

  // ── Bulk upload ────────────────────────────────────────────────────────────
  // Reference data restricted to what THIS user can access (admins see all).
  const loadRefData = async (): Promise<InvoiceRefData> => {
    const [cRes, pRes, poRes] = await Promise.all([
      customersApi.list({ isActive: true, limit: 500 }),
      customerPlantsApi.listAll(),
      posApi.list({ limit: 500 }),
    ]);
    const allCustomers: Customer[] = (cRes.data as any)?.data || [];
    const allPlants: CustomerPlant[] = (pRes.data as any)?.data || [];
    const allPos: PO[] = (poRes.data as any)?.data || [];

    const isAdmin = currentUser?.role === 'finance_admin';
    const idOf = (x: unknown) => (typeof x === 'string' ? x : (x as { _id: string })?._id);
    const aCust = (currentUser?.assignedCustomers || []).map(idOf);
    const aSite = (currentUser?.assignedSites || []).map(idOf);

    return {
      customers: isAdmin ? allCustomers : allCustomers.filter((c) => aCust.includes(c._id)),
      plants: isAdmin ? allPlants : allPlants.filter((p) => aSite.includes(p._id)),
      pos: isAdmin ? allPos : allPos.filter((po) => aCust.includes(String(idOf(po.customerId)))),
    };
  };

  const handleDownloadTemplate = async () => {
    try {
      const ref = await loadRefData();
      saveBlob(await generateTemplate(ref), 'invoice-import-template.xlsx');
    } catch {
      message.error('Failed to generate the template');
    }
  };

  const handleUpload = async (file: File) => {
    try {
      const ref = await loadRefData();
      const { valid, failed, totalDataRows } = await parseAndValidate(file, ref);
      if (totalDataRows === 0) {
        message.warning('The uploaded file has no data rows.');
        return;
      }

      const serverFailed: FailedRow[] = [];
      let uploaded = 0;
      for (const item of valid) {
        try {
          await invoicesApi.create(item.payload);
          uploaded += 1;
        } catch (err: any) {
          const msg = err?.response?.data?.message || err?.response?.data?.errors?.[0]?.msg || 'Server rejected this record';
          serverFailed.push(payloadToFailedRow(item.payload, ref, msg));
        }
      }

      if (uploaded > 0) invalidate();

      const allFailed = [...failed, ...serverFailed];
      if (allFailed.length > 0) {
        saveBlob(await buildInvoiceErrorWorkbook(ref, allFailed), `invoice-upload-errors-${today()}.xlsx`);
        Modal.warning({
          title: 'Some records could not be uploaded',
          content: `${uploaded} of ${totalDataRows} record(s) uploaded as drafts. ${allFailed.length} failed validation — a file with only the failed rows has been downloaded, with the reason commented on each flagged cell.`,
        });
      } else {
        Modal.success({
          title: 'Upload successful',
          content: `${uploaded} invoice${uploaded === 1 ? '' : 's'} created as draft${uploaded === 1 ? '' : 's'}. Review and issue them from the list.`,
        });
      }
    } catch (err: any) {
      message.error(err?.message || 'Failed to process the uploaded file');
    }
  };

  const handleExport = async () => {
    if (invoices.length === 0) {
      message.info('No records to export.');
      return;
    }
    try {
      saveBlob(await exportInvoices(invoices), `invoices-${today()}.xlsx`);
    } catch {
      message.error('Failed to export records');
    }
  };

  const totalBilled = invoices
    .filter((i) => i.status !== 'cancelled' && i.status !== 'draft')
    .reduce((s, i) => s + (i.totalAmount || 0), 0);
  const drafts = invoices.filter((i) => i.status === 'draft').length;
  const outstanding = invoices.reduce((s, i) => s + (i.outstandingAmount || 0), 0);

  const columns = [
    {
      title: 'Invoice #',
      dataIndex: 'invoiceNumber',
      key: 'invoiceNumber',
      width: 140,
      render: (n: string) => <Text code style={{ fontSize: FONT_SIZE.sm }}>{n}</Text>,
    },
    {
      title: 'Customer',
      key: 'customer',
      render: (_: unknown, r: Invoice) => {
        const customer = typeof r.customerId === 'string' ? null : r.customerId as Customer;
        return <Text strong style={{ fontSize: FONT_SIZE.md }}>{customer?.name || '—'}</Text>;
      },
    },
    {
      title: 'POs',
      key: 'pos',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, r: Invoice) => (
        <Tag icon={<FileTextOutlined />}>{r.lineItems?.length || 0}</Tag>
      ),
    },
    {
      title: 'Invoice Date',
      dataIndex: 'invoiceDate',
      key: 'invoiceDate',
      width: 110,
      render: (d: string) => <Text style={{ fontSize: FONT_SIZE.xs }}>{dayjs(d).format('DD MMM YY')}</Text>,
    },
    {
      title: 'Pay By',
      dataIndex: 'payByDate',
      key: 'payByDate',
      width: 110,
      render: (d: string) => <Text style={{ fontSize: FONT_SIZE.xs }}>{dayjs(d).format('DD MMM YY')}</Text>,
    },
    {
      title: 'Total',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 130,
      align: 'right' as const,
      render: (v: number, r: Invoice) => (
        <Text strong style={{ fontSize: FONT_SIZE.md }}>{fmt(v || 0, r.currency)}</Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (s: InvoiceStatus) => (
        <Tag color={INVOICE_STATUS_COLORS[s]}>{INVOICE_STATUS_LABELS[s]}</Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 170,
      render: (_: unknown, r: Invoice) => {
        const isDraft = r.status === 'draft';
        const isCancellable = ['issued', 'partial', 'overdue'].includes(r.status);
        const hasPdf = r.status !== 'draft' && r.status !== 'cancelled';
        return (
          <Space size={4}>
            {isDraft && (
              <Tooltip title="Edit">
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
              </Tooltip>
            )}
            {isDraft && (
              <Tooltip title="Issue (generate PDF)">
                <Popconfirm
                  title="Issue this invoice?"
                  description="The PDF will be generated and the linked POs drawn down."
                  onConfirm={() => issueMutation.mutate(r._id)}
                  okText="Issue"
                >
                  <Button size="small" type="primary" icon={<SendOutlined />} loading={issueMutation.isPending} />
                </Popconfirm>
              </Tooltip>
            )}
            {hasPdf && (
              <Tooltip title="Download PDF">
                <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(r)} />
              </Tooltip>
            )}
            {isCancellable && (
              <Tooltip title="Cancel">
                <Popconfirm
                  title="Cancel this invoice?"
                  description="PO drawdown will be reversed."
                  onConfirm={() => cancelMutation.mutate(r._id)}
                  okText="Cancel invoice"
                  okButtonProps={{ danger: true }}
                >
                  <Button size="small" danger icon={<StopOutlined />} />
                </Popconfirm>
              </Tooltip>
            )}
            {(isDraft || r.status === 'cancelled') && (
              <Tooltip title="Remove">
                <Popconfirm
                  title="Remove this invoice?"
                  onConfirm={() => removeMutation.mutate(r._id)}
                  okText="Remove"
                  okButtonProps={{ danger: true }}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  if (!isForecastUser) {
    return (
      <Card>
        <Empty description="You don't have access to the Invoices module." />
      </Card>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>Invoices</Title>
          <Text type="secondary" style={{ fontSize: FONT_SIZE.md }}>
            Raise invoices against purchase orders and generate the invoice PDF
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          {!isMobile && 'New Invoice'}
        </Button>
      </div>

      {/* Summary strip */}
      <Row gutter={[10, 10]} style={{ marginBottom: 16 }}>
        {[
          { label: 'Billed (issued)', value: totalBilled, color: COLORS.primary, isCurrency: true },
          { label: 'Outstanding',     value: outstanding, color: COLORS.purple,  isCurrency: true },
          { label: 'Drafts',          value: drafts,      color: COLORS.success },
        ].map((item) => (
          <Col xs={8} key={item.label}>
            <Card size="small" styles={{ body: { padding: '10px 14px' } }}>
              <Statistic
                title={<span style={{ fontSize: FONT_SIZE.xs }}>{item.label}</span>}
                value={item.value}
                formatter={item.isCurrency ? (v) => fmt(Number(v)) : undefined}
                valueStyle={{ fontSize: isMobile ? FONT_SIZE.lg : FONT_SIZE.xl, color: item.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 12 }} styles={{ body: { padding: '10px 12px' } }}>
        <Space wrap>
          <Select
            value={statusFilter}
            placeholder="All statuses"
            allowClear
            style={{ width: 160 }}
            onChange={setStatusFilter}
            options={[
              { value: 'draft',     label: 'Draft' },
              { value: 'issued',    label: 'Issued' },
              { value: 'partial',   label: 'Partially Paid' },
              { value: 'paid',      label: 'Paid' },
              { value: 'overdue',   label: 'Overdue' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search invoice # or customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: isMobile ? '100%' : 280 }}
          />
        </Space>
      </Card>

      {/* Bulk Upload */}
      <BulkUploadSection
        title="Bulk Upload"
        description="Download the template, fill in your invoices (one PO line per row), and upload — they're created as drafts. Download exports the currently filtered records."
        onDownloadTemplate={handleDownloadTemplate}
        onUpload={handleUpload}
        onExport={handleExport}
      />

      {/* Table */}
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={invoices}
          columns={columns}
          rowKey="_id"
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} invoices` }}
          size="small"
          scroll={{ x: 1040 }}
          locale={{ emptyText: 'No invoices found. Raise your first invoice.' }}
        />
      </Card>

      <InvoiceFormDrawer
        open={drawerOpen}
        invoice={selectedInvoice}
        onClose={() => setDrawerOpen(false)}
        onSuccess={() => setDrawerOpen(false)}
      />
    </div>
  );
}
