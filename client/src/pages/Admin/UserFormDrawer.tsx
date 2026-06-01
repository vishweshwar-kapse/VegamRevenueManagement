import { useEffect } from 'react';
import { Drawer, Form, Input, Select, Button, Typography, message } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, CreateUserPayload, UpdateUserPayload } from '@/api/users';
import { User, UserRole, USER_ROLE_LABELS } from '@/types';

const { Text } = Typography;

interface Props {
  open: boolean;
  user: User | null;
  onClose: () => void;
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'finance_admin',   label: USER_ROLE_LABELS.finance_admin },
  { value: 'management',      label: USER_ROLE_LABELS.management },
  { value: 'account_manager', label: USER_ROLE_LABELS.account_manager },
  { value: 'project_manager', label: USER_ROLE_LABELS.project_manager },
  { value: 'read_only_pm',    label: USER_ROLE_LABELS.read_only_pm },
];

type FormValues = CreateUserPayload & { isActive?: boolean };

export default function UserFormDrawer({ open, user, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const qc = useQueryClient();
  const isEdit = !!user;

  useEffect(() => {
    if (open) {
      if (user) {
        form.setFieldsValue({ name: user.name, email: user.email, role: user.role, isActive: user.isActive });
      } else {
        form.resetFields();
        form.setFieldsValue({ role: 'account_manager' });
      }
    }
  }, [open, user, form]);

  const createMutation = useMutation({
    mutationFn: (v: CreateUserPayload) => usersApi.create(v),
    onSuccess: () => {
      message.success('User created successfully');
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      message.error(data?.message || data?.errors?.[0]?.msg || 'Failed to create user');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (v: UpdateUserPayload) => usersApi.update(user!._id, v),
    onSuccess: () => {
      message.success('User updated');
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || 'Failed to update user');
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleFinish = (values: FormValues) => {
    if (isEdit) {
      updateMutation.mutate({ name: values.name, role: values.role, isActive: values.isActive });
    } else {
      createMutation.mutate({ name: values.name, email: values.email, password: values.password!, role: values.role });
    }
  };

  return (
    <Drawer
      title={isEdit ? `Edit: ${user?.name}` : 'New User'}
      open={open}
      onClose={onClose}
      width={440}
      destroyOnClose
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={isPending} onClick={() => form.submit()}>
            {isEdit ? 'Save Changes' : 'Create User'}
          </Button>
        </div>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} requiredMark="optional">
        <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Name is required' }]}>
          <Input placeholder="e.g. Priya Sharma" maxLength={80} />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email Address"
          rules={[
            { required: true, message: 'Email is required' },
            { type: 'email', message: 'Enter a valid email' },
          ]}
        >
          <Input placeholder="user@company.com" disabled={isEdit} />
        </Form.Item>

        {!isEdit && (
          <Form.Item
            name="password"
            label="Password"
            extra="Minimum 8 characters. User can change this after first login."
            rules={[
              { required: true, message: 'Password is required' },
              { min: 8, message: 'At least 8 characters' },
            ]}
          >
            <Input.Password placeholder="Initial password" />
          </Form.Item>
        )}

        <Form.Item name="role" label="Role" rules={[{ required: true }]}>
          <Select options={ROLE_OPTIONS} />
        </Form.Item>

        {isEdit && (
          <Form.Item name="isActive" label="Status">
            <Select
              options={[
                { value: true,  label: 'Active' },
                { value: false, label: 'Inactive' },
              ]}
            />
          </Form.Item>
        )}

        {!isEdit && (
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            After creating the user, use the "Assign Sites" button to grant access to specific customers and sites.
          </Text>
        )}
      </Form>
    </Drawer>
  );
}
