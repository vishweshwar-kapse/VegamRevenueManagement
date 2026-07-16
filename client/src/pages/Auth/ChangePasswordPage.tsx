import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/authStore';

const { Title, Text } = Typography;

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Forced password change — shown on first login (or after an admin reset)
 * when the user's `mustChangePassword` flag is set. The route gate in App.tsx
 * keeps the user here until the change succeeds.
 */
export default function ChangePasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const logout = useAuthStore((s) => s.logout);

  const handleSubmit = async (values: FormValues) => {
    setLoading(true);
    setError(null);
    try {
      await authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      updateUser({ mustChangePassword: false });
      message.success('Password updated. Welcome!');
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; errors?: { msg: string }[] } } };
      setError(
        axiosErr.response?.data?.message ||
          axiosErr.response?.data?.errors?.[0]?.msg ||
          'Could not update password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
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
          <Title level={3} style={{ margin: 0, textAlign: 'center' }}>
            Set a new password
          </Title>
          <Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>
            {user?.name ? `Hi ${user.name}, for` : 'For'} your security, please change the
            password you were given before continuing.
          </Text>
        </Space>

        {error && (
          <Alert message={error} type="error" showIcon style={{ marginBottom: 24 }} closable onClose={() => setError(null)} />
        )}

        <Form name="change-password" onFinish={handleSubmit} layout="vertical" size="large" autoComplete="off">
          <Form.Item
            name="currentPassword"
            label="Current password"
            rules={[{ required: true, message: 'Enter the password you were given' }]}
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

          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Update password
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button type="link" onClick={handleSignOut}>Sign out</Button>
        </div>
      </Card>
    </div>
  );
}
