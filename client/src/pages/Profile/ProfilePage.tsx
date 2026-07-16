import { useState } from 'react';
import {
  Card, Avatar, Button, Upload, Typography, Form, Input, message, Space, Divider, Grid,
} from 'antd';
import { UserOutlined, UploadOutlined, MailOutlined, LockOutlined } from '@ant-design/icons';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';
import { FONT_SIZE } from '@/constants/theme';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const errMsg = (err: unknown, fallback: string) => {
  const e = err as { response?: { data?: { message?: string; errors?: { msg: string }[] } } };
  return e.response?.data?.message || e.response?.data?.errors?.[0]?.msg || fallback;
};

export default function ProfilePage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  // ── Avatar ─────────────────────────────────────────────────────────────────
  const [avatarLoading, setAvatarLoading] = useState(false);

  const handleAvatar = async (file: File) => {
    setAvatarLoading(true);
    try {
      const { data } = await authApi.uploadAvatar(file);
      updateUser({ avatarUrl: data.data.avatarUrl });
      message.success('Profile picture updated');
    } catch (err) {
      message.error(errMsg(err, 'Failed to upload picture'));
    } finally {
      setAvatarLoading(false);
    }
  };

  // ── Email change (OTP) ───────────────────────────────────────────────────────
  const [emailStep, setEmailStep] = useState<'idle' | 'enter' | 'verify'>('idle');
  const [newEmail, setNewEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  const sendCode = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      message.error('Enter a valid email address');
      return;
    }
    setEmailBusy(true);
    try {
      const { data } = await authApi.requestEmailOtp(newEmail);
      message.success(data.message);
      setEmailStep('verify');
    } catch (err) {
      message.error(errMsg(err, 'Failed to send verification code'));
    } finally {
      setEmailBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!otp.trim()) {
      message.error('Enter the verification code');
      return;
    }
    setEmailBusy(true);
    try {
      const { data } = await authApi.verifyEmailOtp(otp.trim());
      updateUser({ email: data.data.email });
      message.success('Email address updated');
      setEmailStep('idle');
      setNewEmail('');
      setOtp('');
    } catch (err) {
      message.error(errMsg(err, 'Verification failed'));
    } finally {
      setEmailBusy(false);
    }
  };

  const cancelEmail = () => {
    setEmailStep('idle');
    setNewEmail('');
    setOtp('');
  };

  // ── Password ──────────────────────────────────────────────────────────────
  const [pwForm] = Form.useForm();
  const [pwBusy, setPwBusy] = useState(false);

  const changePassword = async (values: { currentPassword: string; newPassword: string }) => {
    setPwBusy(true);
    try {
      await authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success('Password updated');
      pwForm.resetFields();
    } catch (err) {
      message.error(errMsg(err, 'Failed to update password'));
    } finally {
      setPwBusy(false);
    }
  };

  const maxWidth = isMobile ? '100%' : 640;

  return (
    <div style={{ maxWidth, margin: '0 auto' }}>
      <Title level={isMobile ? 5 : 4} style={{ marginTop: 0 }}>My Profile</Title>

      {/* Profile picture */}
      <Card size="small" style={{ marginBottom: 16 }} title="Profile Picture">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Avatar
            size={72}
            src={user?.avatarUrl || undefined}
            icon={<UserOutlined />}
            style={{ backgroundColor: '#1a56db', flexShrink: 0 }}
          />
          <div>
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={(file) => { handleAvatar(file as File); return false; }}
            >
              <Button icon={<UploadOutlined />} loading={avatarLoading}>Change picture</Button>
            </Upload>
            <Text type="secondary" style={{ display: 'block', fontSize: FONT_SIZE.xs, marginTop: 6 }}>
              PNG, JPG, GIF or WEBP · up to 5 MB
            </Text>
          </div>
        </div>
      </Card>

      {/* Email */}
      <Card size="small" style={{ marginBottom: 16 }} title="Email Address">
        <div style={{ marginBottom: emailStep === 'idle' ? 0 : 16 }}>
          <Text type="secondary" style={{ fontSize: FONT_SIZE.sm }}>Current email</Text>
          <div>
            <Text strong>{user?.email}</Text>
            {emailStep === 'idle' && (
              <Button type="link" onClick={() => setEmailStep('enter')}>Change email</Button>
            )}
          </div>
        </div>

        {emailStep === 'enter' && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input
              prefix={<MailOutlined />}
              placeholder="New email address"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onPressEnter={sendCode}
            />
            <Space>
              <Button type="primary" loading={emailBusy} onClick={sendCode}>Send verification code</Button>
              <Button onClick={cancelEmail}>Cancel</Button>
            </Space>
          </Space>
        )}

        {emailStep === 'verify' && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text style={{ fontSize: FONT_SIZE.sm }}>
              Enter the 6-digit code sent to <Text strong>{newEmail}</Text>.
            </Text>
            <Input
              placeholder="6-digit code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              onPressEnter={verifyCode}
              style={{ width: 160, letterSpacing: 4 }}
            />
            <Space>
              <Button type="primary" loading={emailBusy} onClick={verifyCode}>Verify & update</Button>
              <Button loading={emailBusy} onClick={sendCode}>Resend code</Button>
              <Button onClick={cancelEmail}>Cancel</Button>
            </Space>
          </Space>
        )}
      </Card>

      {/* Password */}
      <Card size="small" title="Change Password">
        <Form form={pwForm} layout="vertical" onFinish={changePassword} requiredMark="optional" style={{ maxWidth: 380 }}>
          <Form.Item
            name="currentPassword"
            label="Current password"
            rules={[{ required: true, message: 'Enter your current password' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Current password" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="New password"
            rules={[
              { required: true, message: 'Enter a new password' },
              { min: 8, message: 'Password must be at least 8 characters' },
            ]}
            hasFeedback
          >
            <Input.Password prefix={<LockOutlined />} placeholder="New password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Confirm new password"
            dependencies={['newPassword']}
            hasFeedback
            rules={[
              { required: true, message: 'Re-enter the new password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                  return Promise.reject(new Error('The two passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Confirm new password" />
          </Form.Item>
          <Divider style={{ margin: '4px 0 16px' }} />
          <Button type="primary" htmlType="submit" loading={pwBusy}>Update password</Button>
        </Form>
      </Card>
    </div>
  );
}
