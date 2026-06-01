import { useState, useEffect } from 'react';
import {
  Card, Button, Table, Tag, Typography, Space, Divider, Form,
  Select, InputNumber, Input, Upload, Modal, message, Tooltip,
  Row, Col, Alert,
} from 'antd';
import {
  UploadOutlined, FilePdfOutlined, FileWordOutlined,
  PlusOutlined, DeleteOutlined, SaveOutlined, DownloadOutlined,
} from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UploadFile } from 'antd/es/upload';
import { customersApi } from '@/api/customers';
import { Customer, CostStructure, ContractVersion, SFSModule, SFS_MODULES, SFS_MODULE_LABELS } from '@/types';
import { CURRENCY_OPTIONS, COMMON_ROLES } from '@/constants/masterData';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface Props {
  customer: Customer;
}

// ─── Contract section ─────────────────────────────────────────────────────────

function ContractSection({ customer }: { customer: Customer }) {
  const qc = useQueryClient();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [remarks, setRemarks] = useState('');

  const uploadMutation = useMutation({
    mutationFn: ({ file, remarks }: { file: File; remarks: string }) =>
      customersApi.uploadContract(customer._id, file, remarks),
    onSuccess: () => {
      message.success('Contract version uploaded successfully');
      qc.invalidateQueries({ queryKey: ['customer', customer._id] });
      setUploadModalOpen(false);
      setFileList([]);
      setRemarks('');
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || 'Upload failed');
    },
  });

  const handleUpload = () => {
    if (fileList.length === 0 || !fileList[0].originFileObj) {
      message.warning('Please select a file first');
      return;
    }
    uploadMutation.mutate({ file: fileList[0].originFileObj as File, remarks });
  };

  const latestContract = customer.contractVersions?.find((v) => v.isLatest);
  const sortedVersions = [...(customer.contractVersions || [])].sort((a, b) => b.version - a.version);

  const fileIcon = (mimeType?: string) => {
    if (mimeType === 'application/pdf')
      return <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />;
    return <FileWordOutlined style={{ color: '#1677ff', fontSize: 16 }} />;
  };

  const contractColumns = [
    {
      title: 'Ver.',
      dataIndex: 'version',
      key: 'version',
      width: 60,
      render: (v: number, r: ContractVersion) => (
        <Space size={4}>
          <Text strong>v{v}</Text>
          {r.isLatest && <Tag color="green" style={{ fontSize: 10, padding: '0 4px' }}>Latest</Tag>}
        </Space>
      ),
    },
    {
      title: 'File Name',
      dataIndex: 'originalName',
      key: 'originalName',
      render: (name: string, r: ContractVersion) => (
        <Space size={6}>
          {fileIcon(r.mimeType)}
          <Text style={{ fontSize: 13 }}>{name}</Text>
        </Space>
      ),
    },
    {
      title: 'Uploaded',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      width: 140,
      render: (d: string) => <Text style={{ fontSize: 12 }}>{dayjs(d).format('DD MMM YYYY')}</Text>,
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      key: 'remarks',
      render: (r?: string) => r ? <Text type="secondary" style={{ fontSize: 12 }}>{r}</Text> : null,
    },
    {
      title: '',
      key: 'download',
      width: 80,
      render: (_: unknown, r: ContractVersion) => (
        <Tooltip title="Open file">
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => window.open(`/uploads/contracts/${r.storedName}`, '_blank')}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <Title level={5} style={{ margin: 0 }}>Master Contract</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Version history of the customer's master agreement. New uploads are added as a new version.
          </Text>
        </div>
        <Button icon={<UploadOutlined />} onClick={() => setUploadModalOpen(true)}>
          Upload New Version
        </Button>
      </div>

      {latestContract && (
        <Card
          size="small"
          style={{ marginBottom: 12, background: '#f6ffed', borderColor: '#b7eb8f' }}
          styles={{ body: { padding: '10px 14px' } }}
        >
          <Space>
            {fileIcon(latestContract.mimeType)}
            <div>
              <Text strong style={{ fontSize: 13 }}>
                Current: {latestContract.originalName}
              </Text>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                Version {latestContract.version} · Uploaded {dayjs(latestContract.uploadedAt).format('DD MMM YYYY')}
                {latestContract.remarks && ` · ${latestContract.remarks}`}
              </Text>
            </div>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => window.open(`/uploads/contracts/${latestContract.storedName}`, '_blank')}
            >
              Open
            </Button>
          </Space>
        </Card>
      )}

      {sortedVersions.length === 0 ? (
        <Alert
          message="No contract uploaded yet"
          description="Upload the master agreement to start tracking version history."
          type="info"
          showIcon
          action={
            <Button size="small" icon={<UploadOutlined />} onClick={() => setUploadModalOpen(true)}>
              Upload
            </Button>
          }
        />
      ) : (
        <Table
          dataSource={sortedVersions}
          columns={contractColumns}
          rowKey="_id"
          size="small"
          pagination={false}
        />
      )}

      {/* Upload modal */}
      <Modal
        title="Upload New Contract Version"
        open={uploadModalOpen}
        onCancel={() => { setUploadModalOpen(false); setFileList([]); setRemarks(''); }}
        onOk={handleUpload}
        okText="Upload"
        confirmLoading={uploadMutation.isPending}
        okButtonProps={{ disabled: fileList.length === 0 }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Upload
            fileList={fileList}
            maxCount={1}
            beforeUpload={() => false}
            onChange={({ fileList: fl }) => setFileList(fl)}
            accept=".pdf,.doc,.docx"
          >
            <Button icon={<UploadOutlined />}>Select File (PDF or Word)</Button>
          </Upload>
          <div>
            <Text style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
              Remarks <Text type="secondary">(optional)</Text>
            </Text>
            <Input
              placeholder="e.g. Annual renewal 2025, Amendment A3…"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              maxLength={200}
            />
          </div>
        </Space>
      </Modal>
    </>
  );
}

// ─── Cost structure section ───────────────────────────────────────────────────

function CostStructureSection({ customer }: { customer: Customer }) {
  const qc = useQueryClient();
  const [form] = Form.useForm<CostStructure>();

  useEffect(() => {
    const cs = customer.costStructure;
    if (cs) {
      // Build module costs — ensure all 4 modules are present
      const existingModuleCosts = cs.moduleCosts || [];
      const moduleCostsWithDefaults = SFS_MODULES.map((mod) => {
        const existing = existingModuleCosts.find((m) => m.moduleName === mod);
        return existing || { moduleName: mod, licenseCost: 0, notes: '' };
      });
      form.setFieldsValue({
        currency: cs.currency || 'USD',
        manHourRates: cs.manHourRates || [],
        sfsDeploymentCost: cs.sfsDeploymentCost,
        sfsDeploymentNotes: cs.sfsDeploymentNotes,
        moduleCosts: moduleCostsWithDefaults,
      });
    } else {
      form.setFieldsValue({
        currency: customer.defaultCurrency || 'USD',
        manHourRates: [],
        moduleCosts: SFS_MODULES.map((mod) => ({ moduleName: mod, licenseCost: 0, notes: '' })),
      });
    }
  }, [customer, form]);

  const mutation = useMutation({
    mutationFn: (values: CostStructure) =>
      customersApi.saveCostStructure(customer._id, values),
    onSuccess: () => {
      message.success('Cost structure saved');
      qc.invalidateQueries({ queryKey: ['customer', customer._id] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || 'Save failed');
    },
  });

  return (
    <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v as CostStructure)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <Title level={5} style={{ margin: 0 }}>Cost Structure</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Negotiated rates for this customer. Used in project quotations and revenue planning.
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

      {/* Currency selector */}
      <Row gutter={16} style={{ marginBottom: 8 }}>
        <Col xs={24} sm={10} md={8}>
          <Form.Item
            name="currency"
            label="All costs in currency"
            rules={[{ required: true, message: 'Select a currency' }]}
          >
            <Select options={CURRENCY_OPTIONS} />
          </Form.Item>
        </Col>
      </Row>

      {/* Man-hour rates */}
      <Divider orientation="left" style={{ fontSize: 13 }}>Man-Hour Rates</Divider>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
        Consulting and services rates agreed with this customer.
      </Text>

      <Form.List name="manHourRates">
        {(fields, { add, remove }) => (
          <>
            {fields.length > 0 && (
              <Row gutter={8} style={{ marginBottom: 4 }}>
                <Col flex="1"><Text style={{ fontSize: 11, color: '#8c8c8c' }}>ROLE TYPE</Text></Col>
                <Col style={{ width: 160 }}><Text style={{ fontSize: 11, color: '#8c8c8c' }}>RATE PER HOUR</Text></Col>
                <Col style={{ width: 32 }} />
              </Row>
            )}
            {fields.map(({ key, name }) => (
              <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                <Col flex="1">
                  <Form.Item
                    name={[name, 'roleType']}
                    noStyle
                    rules={[{ required: true, message: 'Role type required' }]}
                  >
                    <Input
                      placeholder="e.g. Senior Engineer"
                      maxLength={60}
                      list="role-suggestions"
                    />
                  </Form.Item>
                  <datalist id="role-suggestions">
                    {COMMON_ROLES.map((r) => <option key={r} value={r} />)}
                  </datalist>
                </Col>
                <Col style={{ width: 160 }}>
                  <Form.Item
                    name={[name, 'ratePerHour']}
                    noStyle
                    rules={[
                      { required: true, message: 'Rate required' },
                      { type: 'number', min: 0, message: 'Must be ≥ 0' },
                    ]}
                  >
                    <InputNumber
                      min={0}
                      precision={2}
                      style={{ width: '100%' }}
                      placeholder="0.00"
                      prefix={<Text type="secondary" style={{ fontSize: 12 }}>Rate:</Text>}
                    />
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
            ))}
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => add({ roleType: '', ratePerHour: 0 })}
              style={{ marginBottom: 8 }}
            >
              Add Role
            </Button>
          </>
        )}
      </Form.List>

      {/* SFS Deployment License */}
      <Divider orientation="left" style={{ fontSize: 13 }}>SFS Deployment License</Divider>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
        Base cost for a full SFS platform deployment at this customer.
      </Text>
      <Row gutter={16}>
        <Col xs={24} sm={12} md={10}>
          <Form.Item name="sfsDeploymentCost" label="Platform License Cost">
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="0.00"
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={14}>
          <Form.Item name="sfsDeploymentNotes" label="Notes">
            <Input placeholder="e.g. Includes 1 year support" maxLength={200} />
          </Form.Item>
        </Col>
      </Row>

      {/* Module license costs */}
      <Divider orientation="left" style={{ fontSize: 13 }}>Module License Costs</Divider>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
        Per-module add-on license cost negotiated with this customer.
      </Text>

      <Row gutter={8} style={{ marginBottom: 4 }}>
        <Col style={{ width: 160 }}><Text style={{ fontSize: 11, color: '#8c8c8c' }}>MODULE</Text></Col>
        <Col style={{ width: 180 }}><Text style={{ fontSize: 11, color: '#8c8c8c' }}>LICENSE COST</Text></Col>
        <Col flex="1"><Text style={{ fontSize: 11, color: '#8c8c8c' }}>NOTES</Text></Col>
      </Row>

      <Form.List name="moduleCosts">
        {(fields) => (
          <>
            {fields.map(({ key, name }, index) => {
              // Modules are always initialised in SFS_MODULES order, so index is reliable
              const moduleKey: SFSModule = SFS_MODULES[index] ?? 'goods_receipt';
              const moduleLabel = SFS_MODULE_LABELS[moduleKey];
              return (
              <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                <Col style={{ width: 160 }}>
                  {/* Hidden field keeps the value; label div shows human-readable name */}
                  <Form.Item name={[name, 'moduleName']} noStyle hidden>
                    <Input />
                  </Form.Item>
                  <div style={{
                    height: 32, lineHeight: '32px', padding: '0 11px',
                    background: '#fafafa', border: '1px solid #d9d9d9', borderRadius: 6,
                    fontSize: 13, fontWeight: 500, color: 'rgba(0,0,0,0.85)',
                  }}>
                    {moduleLabel}
                  </div>
                </Col>
                <Col style={{ width: 180 }}>
                  <Form.Item
                    name={[name, 'licenseCost']}
                    noStyle
                    rules={[{ type: 'number', min: 0, message: 'Must be ≥ 0' }]}
                  >
                    <InputNumber
                      min={0}
                      precision={2}
                      style={{ width: '100%' }}
                      placeholder="0.00"
                    />
                  </Form.Item>
                </Col>
                <Col flex="1">
                  <Form.Item name={[name, 'notes']} noStyle>
                    <Input placeholder="Optional notes" maxLength={150} />
                  </Form.Item>
                </Col>
              </Row>
              );
            })}
          </>
        )}
      </Form.List>
    </Form>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function ContractCostsTab({ customer }: Props) {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={24}>
      <Card size="small" styles={{ body: { padding: 16 } }}>
        <ContractSection customer={customer} />
      </Card>
      <Card size="small" styles={{ body: { padding: 16 } }}>
        <CostStructureSection customer={customer} />
      </Card>
    </Space>
  );
}
