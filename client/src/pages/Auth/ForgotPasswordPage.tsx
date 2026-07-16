import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api/auth';

const { Title, Text } = Typography;

const errMsg = (err: unknown, fallback: string) => {
  const e = err as { response?: { data?: { message?: string; errors?: { msg: string }[] } } };
  return e.response?.data?.message || e.response?.data?.errors?.[0]?.msg || fallback;
};

/**
 * Public forgot-password flow:
 *   1. Enter email → server emails a reset OTP (if an active account exists).
 *   2. Enter the OTP + a new password → password is reset.
 * The server never reveals whether the email is registered.
 */
export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const requestCode = async (values: { email: string }) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await authApi.forgotPassword(values.email);
      setEmail(values.email);
      setInfo(data.message);
      setStep('reset');
    } catch (err) {
      setError(errMsg(err, 'Could not start password reset. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (values: { otp: string; newPassword: string }) => {
    setLoading(true);
    setError(null);
    try {
      await authApi.resetPassword({ email, otp: values.otp.trim(), newPassword: values.newPassword });
      message.success('Password reset. Please sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(errMsg(err, 'Could not reset password. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #001529 0%, #1a56db 100%)',
      }}
    >
      <Card style={{ width: 440, borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }} bodyStyle={{ padding: 40 }}>
        <Space direction="vertical" size="small" style={{ width: '100%', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0, textAlign: 'center' }}>Reset your password</Title>
          <Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>
            {step === 'email'
              ? 'Enter your account email and we’ll send you a one-time code.'
              : `Enter the code sent to ${email} and choose a new password.`}
          </Text>
        </Space>

        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} closable onClose={() => setError(null)} />}
        {info && step === 'reset' && <Alert message={info} type="success" showIcon style={{ marginBottom: 16 }} />}

        {step === 'email' ? (
          <Form name="forgot-email" onFinish={requestCode} layout="vertical" size="large" autoComplete="off">
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: 'Please enter your email' },
                { type: 'email', message: 'Please enter a valid email' },
              ]}
            >
              <Input prefix={<UserOutlined />} placeholder="your@email.com" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 8 }}>
              <Button type="primary" htmlType="submit" loading={loading} block>Send reset code</Button>
            </Form.Item>
          </Form>
        ) : (
          <Form name="forgot-reset" onFinish={resetPassword} layout="vertical" size="large" autoComplete="off">
            <Form.Item
              name="otp"
              label="Verification code"
              rules={[{ required: true, message: 'Enter the code from your email' }]}
            >
              <Input placeholder="6-digit code" maxLength={6} style={{ letterSpacing: 4 }} />
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
            <Form.Item style={{ marginBottom: 8 }}>
              <Button type="primary" htmlType="submit" loading={loading} block>Set new password</Button>
            </Form.Item>
            <Button type="link" block onClick={() => { setStep('email'); setError(null); setInfo(null); }}>
              Use a different email
            </Button>
          </Form>
        )}

        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Button type="link" onClick={() => navigate('/login')}>Back to sign in</Button>
        </div>
      </Card>
    </div>
  );
}
