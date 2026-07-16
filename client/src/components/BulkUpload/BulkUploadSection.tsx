import { useRef, useState } from 'react';
import { Card, Button, Space, Typography } from 'antd';
import { DownloadOutlined, UploadOutlined, ExportOutlined } from '@ant-design/icons';
import SectionLabel from '@/components/Form/SectionLabel';
import { FONT_SIZE } from '@/constants/theme';

const { Text } = Typography;

interface Props {
  /** Section heading. */
  title?: string;
  /** Sub-text under the heading. */
  description?: string;
  /** Generate & download the blank import template. */
  onDownloadTemplate: () => void | Promise<void>;
  /** Handle a user-selected file (parse, validate, upload). */
  onUpload: (file: File) => void | Promise<void>;
  /** Export the current (filtered) records. */
  onExport: () => void | Promise<void>;
  /** Accepted file types for upload. */
  accept?: string;
  disabled?: boolean;
}

/**
 * Reusable Bulk Upload toolbar: Download Template · Upload · Download (export).
 * The parent supplies the format-specific generate/parse/export logic.
 */
export default function BulkUploadSection({
  title = 'Bulk Upload',
  description,
  onDownloadTemplate,
  onUpload,
  onExport,
  accept = '.xlsx',
  disabled = false,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | 'template' | 'upload' | 'export'>(null);

  const run = async (which: 'template' | 'upload' | 'export', fn: () => void | Promise<void>) => {
    setBusy(which);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so selecting the same file again re-triggers change.
    e.target.value = '';
    if (file) await run('upload', () => onUpload(file));
  };

  return (
    <Card size="small" style={{ marginBottom: 12 }} styles={{ body: { padding: '12px 14px' } }}>
      <SectionLabel>{title}</SectionLabel>
      {description && (
        <Text type="secondary" style={{ fontSize: FONT_SIZE.sm, display: 'block', marginBottom: 10 }}>
          {description}
        </Text>
      )}
      <Space wrap>
        <Button
          icon={<DownloadOutlined />}
          loading={busy === 'template'}
          disabled={disabled || (busy !== null && busy !== 'template')}
          onClick={() => run('template', onDownloadTemplate)}
        >
          Download Template
        </Button>
        <Button
          type="primary"
          icon={<UploadOutlined />}
          loading={busy === 'upload'}
          disabled={disabled || (busy !== null && busy !== 'upload')}
          onClick={() => fileRef.current?.click()}
        >
          Upload Template
        </Button>
        <Button
          icon={<ExportOutlined />}
          loading={busy === 'export'}
          disabled={disabled || (busy !== null && busy !== 'export')}
          onClick={() => run('export', onExport)}
        >
          Download
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          style={{ display: 'none' }}
          onChange={onFilePicked}
        />
      </Space>
    </Card>
  );
}
