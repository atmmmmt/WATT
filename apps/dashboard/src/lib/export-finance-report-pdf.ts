import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface FinanceReportInput {
  monthName: string;
  year: string;
  totalRevenue: number;
  totalWithdrawals: number;
  netProfit: number;
  transactions: {
    date: string;
    description: string;
    amount: number;
    type: 'sale' | 'withdrawal';
  }[];
}

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function exportFinanceReportPdf(input: FinanceReportInput) {
  // Load Arabic font first to ensure it's in browser cache
  await document.fonts.load('16px Cairo');

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-10000px';
  wrapper.style.top = '0';
  wrapper.style.width = '794px';
  wrapper.style.zIndex = '-1';

  const rows = input.transactions.length > 0
    ? input.transactions.map(t => `
      <tr>
        <td style="padding:12px; border-bottom:1px solid #f1f5f9; font-size:13px;">${escapeHtml(t.date)}</td>
        <td style="padding:12px; border-bottom:1px solid #f1f5f9; font-size:13px;">${escapeHtml(t.description)}</td>
        <td style="padding:12px; border-bottom:1px solid #f1f5f9; font-size:13px; color:${t.type === 'sale' ? '#10b981' : '#ef4444'}; font-weight:600;">${t.type === 'sale' ? '+' : '-'}$${escapeHtml(t.amount)}</td>
        <td style="padding:12px; border-bottom:1px solid #f1f5f9; font-size:13px;">${t.type === 'sale' ? 'مبيعات' : 'سحوبات'}</td>
      </tr>
    `).join('')
    : `<tr><td colspan="4" style="padding:24px; text-align:center; color:#94a3b8; font-size:13px;">لا توجد عمليات لعرضها</td></tr>`;

  wrapper.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body, .report-shell, .report-shell * {
        font-family: 'Cairo', 'Tahoma', 'Arial Unicode MS', Arial, sans-serif !important;
        direction: rtl;
        unicode-bidi: embed;
        text-align: right;
      }
      .report-shell {
        width: 794px;
        padding: 48px;
        background: #ffffff;
        color: #1a1a1a;
        line-height: 1.7;
      }
    </style>
    <div class="report-shell" dir="rtl">

      <!-- Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #064E3B; padding-bottom:24px; margin-bottom:36px;">
        <div style="text-align:right;">
          <div style="font-size:22px; font-weight:800; color:#1a1a1a; margin-bottom:4px;">التقرير المالي الشهري</div>
          <div style="font-size:14px; color:#64748b;">شهر: ${escapeHtml(input.monthName)} ${escapeHtml(input.year)}</div>
        </div>
        <div style="font-size:28px; font-weight:800; color:#064E3B; letter-spacing:-1px;">VAYRO</div>
      </div>

      <!-- Summary Cards -->
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; margin-bottom:40px;">
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:16px; padding:24px; text-align:center;">
          <div style="font-size:12px; color:#166534; margin-bottom:8px; font-weight:600;">إجمالي الإيرادات</div>
          <div style="font-size:26px; font-weight:800; color:#16a34a;">$${input.totalRevenue.toLocaleString()}</div>
        </div>
        <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:16px; padding:24px; text-align:center;">
          <div style="font-size:12px; color:#991b1b; margin-bottom:8px; font-weight:600;">إجمالي السحوبات</div>
          <div style="font-size:26px; font-weight:800; color:#dc2626;">$${input.totalWithdrawals.toLocaleString()}</div>
        </div>
        <div style="background:#f5f3ff; border:1px solid #ddd6fe; border-radius:16px; padding:24px; text-align:center;">
          <div style="font-size:12px; color:#053D2E; margin-bottom:8px; font-weight:600;">صافي الأرباح</div>
          <div style="font-size:26px; font-weight:800; color:#065F46;">$${input.netProfit.toLocaleString()}</div>
        </div>
      </div>

      <!-- Transactions Table -->
      <div style="font-size:17px; font-weight:700; margin-bottom:16px; color:#1a1a1a;">تفاصيل العمليات</div>
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:14px 12px; text-align:right; border-bottom:2px solid #e2e8f0; font-size:13px; font-weight:700; color:#374151;">التاريخ</th>
            <th style="padding:14px 12px; text-align:right; border-bottom:2px solid #e2e8f0; font-size:13px; font-weight:700; color:#374151;">الوصف / العميل</th>
            <th style="padding:14px 12px; text-align:right; border-bottom:2px solid #e2e8f0; font-size:13px; font-weight:700; color:#374151;">القيمة</th>
            <th style="padding:14px 12px; text-align:right; border-bottom:2px solid #e2e8f0; font-size:13px; font-weight:700; color:#374151;">النوع</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <!-- Footer -->
      <div style="margin-top:48px; text-align:center; font-size:11px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:20px;">
        تم إنشاء هذا التقرير آلياً بواسطة نظام VAYRO الإداري — ${new Date().toLocaleDateString('ar-SY')}
      </div>
    </div>
  `;

  document.body.appendChild(wrapper);

  // Wait for fonts to render
  await new Promise(r => setTimeout(r, 800));

  try {
    const canvas = await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      windowWidth: 794,
    });
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    let y = 0;
    while (y < canvas.height) {
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = Math.min((pageHeight / pageWidth) * canvas.width, canvas.height - y);
      const ctx = sliceCanvas.getContext('2d')!;
      ctx.drawImage(canvas, 0, -y);
      const imgData = sliceCanvas.toDataURL('image/png');
      if (y > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, (sliceCanvas.height * pageWidth) / canvas.width);
      y += sliceCanvas.height;
    }

    pdf.save(`finance-report-${input.monthName}-${input.year}.pdf`);
  } finally {
    document.body.removeChild(wrapper);
  }
}
