import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { entitiesApi } from '@/api/entities';
import { customersApi } from '@/api/customers';
import { customerPlantsApi } from '@/api/customerPlants';
import { Entity, Customer, CustomerPlant, Currency } from '@/types';
import { useAuthStore } from '@/store/authStore';

interface Options {
  /** Whether the parent drawer/modal is open — gates all queries. */
  open: boolean;
}

interface FormSelectorsResult {
  entities: Entity[];
  defaultEntity: Entity | undefined;
  customers: Customer[];
  plants: CustomerPlant[];
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
  selectedPlantId: string;
  setSelectedPlantId: (id: string) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  /** Reset all selector state to initial values (call on drawer close / create-mode reset). */
  resetSelectors: () => void;
}

export function useFormSelectors({ open }: Options): FormSelectorsResult {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'finance_admin';

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedPlantId, setSelectedPlantId] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');

  // Entities are shared across drawers — same cache key intentionally.
  const { data: entitiesData } = useQuery({
    queryKey: ['entities'],
    queryFn: () => entitiesApi.list(),
    enabled: open,
  });
  const entities: Entity[] = (entitiesData?.data as any)?.data || [];
  const defaultEntity = entities.find((e) => e.isDefault);

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.list({ isActive: true, limit: 200 }),
    enabled: open,
  });
  const allCustomers: Customer[] = (customersData?.data as any)?.data || [];
  const customers = isAdmin
    ? allCustomers
    : allCustomers.filter((c) => {
        const assigned = (user?.assignedCustomers || []).map((x) =>
          typeof x === 'string' ? x : (x as Customer)._id
        );
        return assigned.includes(c._id);
      });

  const { data: plantsData } = useQuery({
    queryKey: ['plants', selectedCustomerId],
    queryFn: () => customerPlantsApi.listByCustomer(selectedCustomerId),
    enabled: open && !!selectedCustomerId,
  });
  const allPlants: CustomerPlant[] = (plantsData?.data as any)?.data || [];
  const plants = isAdmin
    ? allPlants
    : allPlants.filter((p) => {
        const assigned = (user?.assignedSites || []).map((x) =>
          typeof x === 'string' ? x : (x as CustomerPlant)._id
        );
        return assigned.includes(p._id);
      });

  // Derive currency whenever the selected plant (or its loaded data) changes.
  useEffect(() => {
    if (!selectedPlantId) return;
    const plant = plants.find((p) => p._id === selectedPlantId);
    if (plant?.currency) {
      setCurrency(plant.currency);
    } else {
      const customer = customers.find((c) => c._id === selectedCustomerId);
      setCurrency(customer?.defaultCurrency || 'USD');
    }
  }, [selectedPlantId, plants, customers, selectedCustomerId]);

  const resetSelectors = () => {
    setSelectedCustomerId('');
    setSelectedPlantId('');
    setCurrency('USD');
  };

  return {
    entities,
    defaultEntity,
    customers,
    plants,
    selectedCustomerId,
    setSelectedCustomerId,
    selectedPlantId,
    setSelectedPlantId,
    currency,
    setCurrency,
    resetSelectors,
  };
}
