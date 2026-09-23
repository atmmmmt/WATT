import { FormEvent, useEffect, useState } from 'react';
import { SectionCard } from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

interface Subscription {
  _id: string;
  tenantId: string;
  planName: string;
  durationMonths: number;
  maxMonthlyOtp: number;
  price: number;
  currency: string;
  endsAt: string;
  status: string;
}

export function SubscriptionsPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<Subscription[]>([]);
  const [form, setForm] = useState({
    tenantId: '',
    planName: '',
    durationMonths: '12',
    maxMonthlyOtp: '5000',
    price: '499',
    currency: 'USD',
    notes: '',
  });

  async function loadSubscriptions() {
    if (!token) return;
    setItems(await apiRequest<Subscription[]>('/subscriptions', {}, token));
  }

  useEffect(() => {
    loadSubscriptions();
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    await apiRequest('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        durationMonths: Number(form.durationMonths),
        maxMonthlyOtp: Number(form.maxMonthlyOtp),
        price: Number(form.price),
      }),
    }, token);

    await loadSubscriptions();
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Subscriptions</p>
          <h1>Commercial plans and durations</h1>
        </div>
      </header>

      {user?.role === 'super_admin' ? (
        <SectionCard title="Create subscription">
          <form className="form-grid" onSubmit={handleSubmit}>
            <input placeholder="Tenant ID" value={form.tenantId} onChange={(event) => setForm({ ...form, tenantId: event.target.value })} />
            <input placeholder="Plan name" value={form.planName} onChange={(event) => setForm({ ...form, planName: event.target.value })} />
            <input placeholder="Months (6, 12, 120)" value={form.durationMonths} onChange={(event) => setForm({ ...form, durationMonths: event.target.value })} />
            <input placeholder="Monthly OTP quota" value={form.maxMonthlyOtp} onChange={(event) => setForm({ ...form, maxMonthlyOtp: event.target.value })} />
            <input placeholder="Price" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
            <input placeholder="Currency" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} />
            <input placeholder="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            <button type="submit">Create subscription</button>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard title="Subscription list">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Tenant</th>
                <th>Months</th>
                <th>Quota</th>
                <th>Ends</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id}>
                  <td>{item.planName}</td>
                  <td>{item.tenantId}</td>
                  <td>{item.durationMonths}</td>
                  <td>{item.maxMonthlyOtp}</td>
                  <td>{new Date(item.endsAt).toLocaleDateString()}</td>
                  <td>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
