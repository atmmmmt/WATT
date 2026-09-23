import { FormEvent, useEffect, useState } from 'react';
import { SectionCard } from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';

interface ApiKeyRow {
  _id?: string;
  id?: string;
  tenantId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: string;
}

export function ApiKeysPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<ApiKeyRow[]>([]);
  const [latestPackage, setLatestPackage] = useState<object | null>(null);
  const [form, setForm] = useState({
    tenantId: '',
    name: 'Production API Key',
    scopes: 'otp:send,otp:verify,whatsapp:session',
  });

  async function loadApiKeys() {
    if (!token) return;
    setItems(await apiRequest<ApiKeyRow[]>('/api-keys', {}, token));
  }

  useEffect(() => {
    loadApiKeys();
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    const result = await apiRequest<{ setupPackage: object; rawKey: string }>(
      '/api-keys',
      {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          tenantId: user?.role === 'tenant_admin' ? user.tenantId : form.tenantId,
          scopes: form.scopes.split(',').map((scope) => scope.trim()).filter(Boolean),
        }),
      },
      token,
    );

    setLatestPackage({
      rawKey: result.rawKey,
      ...result.setupPackage,
    });

    await loadApiKeys();
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">مفاتيح API</p>
          <h1>إصدار بيانات الربط للمطور</h1>
        </div>
      </header>

      <SectionCard title="إصدار مفتاح جديد" description="المفتاح الخام يظهر مرة واحدة فقط. احتفظ به مباشرة أو ضعه داخل ملف التسليم.">
        <form className="form-grid" onSubmit={handleSubmit}>
          {user?.role === 'super_admin' ? (
            <input placeholder="Tenant ID" value={form.tenantId} onChange={(event) => setForm({ ...form, tenantId: event.target.value })} />
          ) : null}
          <input placeholder="اسم المفتاح" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <input placeholder="الصلاحيات مفصولة بفاصلة" value={form.scopes} onChange={(event) => setForm({ ...form, scopes: event.target.value })} />
          <button type="submit">إصدار المفتاح</button>
        </form>
      </SectionCard>

      <SectionCard title="المفاتيح الحالية">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>العميل</th>
                <th>المقدمة</th>
                <th>الصلاحيات</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id || item._id}>
                  <td>{item.name}</td>
                  <td>{item.tenantId}</td>
                  <td>{item.keyPrefix}</td>
                  <td>{item.scopes.join(', ')}</td>
                  <td>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {latestPackage ? (
        <SectionCard title="آخر بيانات تسليم">
          <pre className="code-block">{JSON.stringify(latestPackage, null, 2)}</pre>
        </SectionCard>
      ) : null}
    </div>
  );
}
