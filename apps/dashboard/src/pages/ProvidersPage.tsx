import { FormEvent, useEffect, useState } from 'react';
import { SectionCard } from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

interface ProviderAccount {
  _id: string;
  tenantId: string;
  providerType: string;
  status: string;
  config: Record<string, unknown>;
}

export function ProvidersPage() {
  const { token, user } = useAuth();
  const [providers, setProviders] = useState<ProviderAccount[]>([]);
  const [form, setForm] = useState({
    tenantId: '',
    providerType: 'mock',
    accountSid: '',
    authToken: '',
    fromNumber: '',
  });

  async function loadProviders() {
    if (!token) return;
    setProviders(await apiRequest<ProviderAccount[]>('/providers', {}, token));
  }

  useEffect(() => {
    loadProviders();
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    await apiRequest('/providers', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: user?.role === 'tenant_admin' ? user.tenantId : form.tenantId,
        providerType: form.providerType,
        status: 'active',
        config:
          form.providerType === 'twilio'
            ? {
                accountSid: form.accountSid,
                authToken: form.authToken,
                fromNumber: form.fromNumber,
              }
            : {},
      }),
    }, token);

    await loadProviders();
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Providers</p>
          <h1>WhatsApp provider settings</h1>
        </div>
      </header>

      <SectionCard title="Configure provider" description="Use mock locally or wire a Twilio WhatsApp sender for real delivery.">
        <form className="form-grid" onSubmit={handleSubmit}>
          {user?.role === 'super_admin' ? (
            <input placeholder="Tenant ID" value={form.tenantId} onChange={(event) => setForm({ ...form, tenantId: event.target.value })} />
          ) : null}
          <select value={form.providerType} onChange={(event) => setForm({ ...form, providerType: event.target.value })}>
            <option value="mock">mock</option>
            <option value="twilio">twilio</option>
          </select>
          {form.providerType === 'twilio' ? (
            <>
              <input placeholder="Twilio Account SID" value={form.accountSid} onChange={(event) => setForm({ ...form, accountSid: event.target.value })} />
              <input placeholder="Twilio Auth Token" value={form.authToken} onChange={(event) => setForm({ ...form, authToken: event.target.value })} />
              <input placeholder="From WhatsApp Number" value={form.fromNumber} onChange={(event) => setForm({ ...form, fromNumber: event.target.value })} />
            </>
          ) : null}
          <button type="submit">Save provider</button>
        </form>
      </SectionCard>

      <SectionCard title="Provider list">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Config</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={provider._id}>
                  <td>{provider.tenantId}</td>
                  <td>{provider.providerType}</td>
                  <td>{provider.status}</td>
                  <td>{JSON.stringify(provider.config)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
