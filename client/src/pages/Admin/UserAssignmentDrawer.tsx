import { useState, useEffect } from 'react';
import {
  Drawer, Button, Typography, Tree, Spin, Alert, message, Tag, Empty,
} from 'antd';
import { ApartmentOutlined, TeamOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DataNode } from 'antd/es/tree';
import { usersApi } from '@/api/users';
import { customersApi } from '@/api/customers';
import { customerPlantsApi } from '@/api/customerPlants';
import { User, Customer, CustomerPlant, FORECAST_ROLES } from '@/types';

const { Text } = Typography;

interface Props {
  open: boolean;
  user: User | null;
  onClose: () => void;
}

export default function UserAssignmentDrawer({ open, user, onClose }: Props) {
  const qc = useQueryClient();
  const [checkedSites, setCheckedSites] = useState<string[]>([]);

  const isForecastRole = user ? FORECAST_ROLES.includes(user.role) : false;

  // Load all customers
  const { data: customersData, isLoading: loadingCustomers } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => customersApi.list({ isActive: true, limit: 200 }),
    enabled: open,
  });
  const customers: Customer[] = (customersData?.data as any)?.data || [];

  // Load all sites (plants)
  const { data: plantsData, isLoading: loadingPlants } = useQuery({
    queryKey: ['plants-all'],
    queryFn: async () => {
      // Fetch sites for each customer — up to 200 total
      const results = await Promise.all(
        customers.map((c) =>
          customerPlantsApi.listByCustomer(c._id).then((r) => (r.data as any)?.data || [])
        )
      );
      return results.flat() as CustomerPlant[];
    },
    enabled: open && customers.length > 0,
  });
  const allPlants: CustomerPlant[] = plantsData || [];

  // Initialise checked sites from user's current assignments
  useEffect(() => {
    if (open && user) {
      const current = (user.assignedSites || []).map((s) =>
        typeof s === 'string' ? s : (s as CustomerPlant)._id
      );
      setCheckedSites(current);
    }
  }, [open, user]);

  // Build tree data: Customer → Sites
  const treeData: DataNode[] = customers.map((c) => {
    const sites = allPlants.filter(
      (p) => (typeof p.customerId === 'string' ? p.customerId : (p.customerId as Customer)._id) === c._id
    );
    return {
      key: `customer-${c._id}`,
      title: (
        <span>
          <TeamOutlined style={{ marginRight: 6, color: '#1677ff' }} />
          <Text strong>{c.name}</Text>
          {c.displayName && c.displayName !== c.name && (
            <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>({c.displayName})</Text>
          )}
          <Tag style={{ marginLeft: 8, fontSize: 10 }}>{sites.length} site{sites.length !== 1 ? 's' : ''}</Tag>
        </span>
      ),
      selectable: false,
      children: sites.map((p) => ({
        key: p._id,
        title: (
          <span>
            <ApartmentOutlined style={{ marginRight: 6, color: '#52c41a' }} />
            <Text>{p.plantName}</Text>
            <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>({p.plantCode})</Text>
            {p.isDefault && <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>Default</Tag>}
          </span>
        ),
      })),
    };
  });

  const mutation = useMutation({
    mutationFn: () => {
      const checkedCustomerIds = customers
        .filter((c) =>
          allPlants
            .filter((p) => checkedSites.includes(p._id))
            .some(
              (p) =>
                (typeof p.customerId === 'string' ? p.customerId : (p.customerId as Customer)._id) === c._id
            )
        )
        .map((c) => c._id);

      return usersApi.updateAssignments(user!._id, {
        assignedSites: checkedSites,
        assignedCustomers: checkedCustomerIds,
      });
    },
    onSuccess: () => {
      message.success('Assignments saved');
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: () => {
      message.error('Failed to save assignments');
    },
  });

  const isLoading = loadingCustomers || loadingPlants;

  if (!user) return null;

  return (
    <Drawer
      title={
        <div>
          <div>Assign Sites — {user.name}</div>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            Select the sites this user can create forecasts for
          </Text>
        </div>
      }
      open={open}
      onClose={onClose}
      width={520}
      destroyOnClose
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Save Assignments
          </Button>
        </div>
      }
    >
      {!isForecastRole && (
        <Alert
          type="warning"
          message="This user's role does not include forecast access"
          description={`Role "${user.role}" cannot create forecasts. Change the role to Account Manager or Project Manager to enable forecast access.`}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : customers.length === 0 ? (
        <Empty description="No customers found. Create customers first." />
      ) : (
        <>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
            Check the sites this user should have access to. Checking a site automatically grants access to the parent customer.
          </Text>
          <Text style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
            <strong>{checkedSites.length}</strong> site{checkedSites.length !== 1 ? 's' : ''} selected
          </Text>
          <Tree
            checkable
            selectable={false}
            defaultExpandAll
            treeData={treeData}
            checkedKeys={checkedSites}
            onCheck={(checked) => {
              const keys = Array.isArray(checked) ? checked : checked.checked;
              setCheckedSites(
                (keys as string[]).filter((k) => !String(k).startsWith('customer-'))
              );
            }}
          />
        </>
      )}
    </Drawer>
  );
}
