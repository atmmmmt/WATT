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

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function absoluteAsset(path: string) {
  return new URL(path, window.location.origin).href;
}

async function preloadImage(src: string) {
  await new Promise<void>((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });
}

export async function exportFinanceReportPdf(input: FinanceReportInput) {
  await document.fonts.load('16px Cairo');

  const logoUrl = absoluteAsset('/brand/vayro-logo-white.png');
  const mascotUrl = absoluteAsset('/mascot/working.webp');
  await Promise.all([preloadImage(logoUrl), preloadImage(mascotUrl)]);

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-10000px';
  wrapper.style.top = '0';
  wrapper.style.width = '794px';
  wrapper.style.zIndex = '-1';
  wrapper.style.background = '#ffffff';

  const saleCount = input.transactions.filter((item) => item.type === 'sale').length;
  const withdrawalCount = input.transactions.filter((item) => item.type === 'withdrawal').length;
  const generatedAt = new Date().toLocaleDateString('ar-SY', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const rows = input.transactions.length > 0
    ? input.transactions.map((transaction, index) => `
      <tr style="background:${index % 2 === 0 ? '#ffffff' : '#F8FBFA'};">
        <td style="padding:14px 12px; border-bottom:1px solid #E8EFEC; font-size:12.5px; color:#52625D; white-space:nowrap;">${escapeHtml(transaction.date)}</td>
        <td style="padding:14px 12px; border-bottom:1px solid #E8EFEC; font-size:12.5px; color:#15231F; font-weight:600;">${escapeHtml(transaction.description)}</td>
        <td style="padding:14px 12px; border-bottom:1px solid #E8EFEC; font-size:12.5px; color:${transaction.type === 'sale' ? '#07845F' : '#D14343'}; font-weight:800; white-space:nowrap;">${transaction.type === 'sale' ? '+' : '-'}$${formatMoney(transaction.amount)}</td>
        <td style="padding:14px 12px; border-bottom:1px solid #E8EFEC; font-size:12px;">
          <span style="display:inline-block; min-width:70px; text-align:center; padding:5px 10px; border-radius:999px; background:${transaction.type === 'sale' ? '#EAF9F2' : '#FFF0F0'}; color:${transaction.type === 'sale' ? '#057252' : '#B93232'}; font-weight:700;">
            ${transaction.type === 'sale' ? 'مبيعات' : 'سحوبات'}
          </span>
        </td>
      </tr>
    `).join('')
    : `<tr><td colspan="4" style="padding:42px 24px; text-align:center; color:#8A9994; font-size:13px; background:#FAFCFB;">لا توجد عمليات مسجلة خلال هذه الفترة</td></tr>`;

  wrapper.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap');
      * { margin:0; padding:0; box-sizing:border-box; }
      .vayro-report, .vayro-report * {
        font-family:'Cairo','Tahoma','Arial Unicode MS',Arial,sans-serif !important;
        box-sizing:border-box;
      }
      .vayro-report {
        width:794px;
        min-height:1123px;
        background:#ffffff;
        color:#17211E;
        direction:rtl;
        line-height:1.6;
        padding-bottom:34px;
      }
      .rtl { direction:rtl; text-align:right; }
      table { direction:rtl; }
      img { display:block; }
    </style>

    <div class="vayro-report" dir="rtl">
      <section style="position:relative; min-height:225px; background:#064E3B; color:#ffffff; overflow:hidden; padding:34px 42px 30px;">
        <div style="position:absolute; left:-44px; top:-65px; width:210px; height:210px; border:30px solid rgba(255,255,255,0.055); border-radius:50%;"></div>
        <div style="position:absolute; left:128px; bottom:-74px; width:150px; height:150px; border:22px solid rgba(245,158,11,0.10); border-radius:50%;"></div>

        <div style="position:relative; z-index:2; display:flex; align-items:flex-start; justify-content:space-between; gap:24px;">
          <div style="flex:1; text-align:right; padding-top:2px;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:26px;">
              <div style="background:#ffffff; border-radius:12px; padding:9px 13px; min-width:118px; display:flex; align-items:center; justify-content:center;">
                <img src="${logoUrl}" alt="VAYRO" style="max-width:96px; max-height:28px; object-fit:contain; filter:brightness(0) saturate(100%) invert(20%) sepia(19%) saturate(2126%) hue-rotate(116deg) brightness(91%) contrast(101%);" />
              </div>
              <div>
                <div style="font-size:10px; opacity:0.72; font-weight:600;">BUSINESS MESSAGING PLATFORM</div>
                <div style="font-size:11px; opacity:0.92; font-weight:600;">تواصل أذكى لأعمال أكبر</div>
              </div>
            </div>

            <div style="font-size:29px; font-weight:800; line-height:1.3; margin-bottom:7px;">التقرير المالي الشهري</div>
            <div style="font-size:13px; opacity:0.82; margin-bottom:18px;">ملخص مالي واضح لأداء المنصة خلال الفترة المحددة</div>

            <div style="display:inline-flex; align-items:center; gap:9px; padding:8px 13px; border-radius:12px; background:rgba(255,255,255,0.10); border:1px solid rgba(255,255,255,0.15); font-size:12px; font-weight:700;">
              <span>${escapeHtml(input.monthName)} ${escapeHtml(input.year)}</span>
              <span style="width:4px; height:4px; background:#F59E0B; border-radius:50%; display:inline-block;"></span>
              <span style="opacity:0.84;">تاريخ الإصدار ${generatedAt}</span>
            </div>
          </div>

          <div style="width:155px; height:165px; align-self:flex-end; display:flex; align-items:flex-end; justify-content:center; position:relative;">
            <div style="position:absolute; width:125px; height:28px; bottom:2px; background:rgba(0,0,0,0.15); filter:blur(9px); border-radius:50%;"></div>
            <img src="${mascotUrl}" alt="VAYRO mascot" style="position:relative; z-index:2; max-width:145px; max-height:158px; object-fit:contain;" />
          </div>
        </div>
      </section>

      <main style="padding:30px 42px 0;">
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:13px; margin-bottom:27px;">
          <div style="background:#F1FBF6; border:1px solid #D5F1E2; border-radius:18px; padding:18px 17px; min-height:106px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:11px;">
              <div style="font-size:11.5px; color:#477166; font-weight:700;">إجمالي الإيرادات</div>
              <div style="width:30px; height:30px; border-radius:10px; background:#DDF5E8; color:#07845F; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:800;">+</div>
            </div>
            <div style="font-size:24px; line-height:1; font-weight:800; color:#064E3B; direction:ltr; text-align:right;">$${formatMoney(input.totalRevenue)}</div>
            <div style="font-size:10.5px; color:#6F8B82; margin-top:8px;">${saleCount} عملية مبيعات مسجلة</div>
          </div>

          <div style="background:#FFF7F6; border:1px solid #F8DEDB; border-radius:18px; padding:18px 17px; min-height:106px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:11px;">
              <div style="font-size:11.5px; color:#8B5B56; font-weight:700;">إجمالي السحوبات</div>
              <div style="width:30px; height:30px; border-radius:10px; background:#FBE5E2; color:#D14343; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:800;">−</div>
            </div>
            <div style="font-size:24px; line-height:1; font-weight:800; color:#A53636; direction:ltr; text-align:right;">$${formatMoney(input.totalWithdrawals)}</div>
            <div style="font-size:10.5px; color:#99706B; margin-top:8px;">${withdrawalCount} عملية سحب مسجلة</div>
          </div>

          <div style="background:#FFF9EA; border:1px solid #F7E7BA; border-radius:18px; padding:18px 17px; min-height:106px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:11px;">
              <div style="font-size:11.5px; color:#7A6735; font-weight:700;">صافي الأرباح</div>
              <div style="width:30px; height:30px; border-radius:10px; background:#F9EBC2; color:#A97000; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800;">V</div>
            </div>
            <div style="font-size:24px; line-height:1; font-weight:800; color:#6F570C; direction:ltr; text-align:right;">$${formatMoney(input.netProfit)}</div>
            <div style="font-size:10.5px; color:#8E7A46; margin-top:8px;">الإيرادات بعد خصم السحوبات</div>
          </div>
        </div>

        <div style="display:flex; align-items:flex-end; justify-content:space-between; margin-bottom:13px; gap:20px;">
          <div>
            <div style="font-size:17px; font-weight:800; color:#12231E; margin-bottom:2px;">تفاصيل العمليات</div>
            <div style="font-size:10.5px; color:#7E8D88;">جميع الحركات المالية المسجلة ضمن التقرير</div>
          </div>
          <div style="font-size:10.5px; color:#547069; background:#F1F6F4; border:1px solid #E1EBE7; border-radius:999px; padding:6px 11px; font-weight:700;">
            ${input.transactions.length} عملية
          </div>
        </div>

        <div style="border:1px solid #E2EBE7; border-radius:16px; overflow:hidden; background:#ffffff;">
          <table style="width:100%; border-collapse:collapse; table-layout:fixed;">
            <thead>
              <tr style="background:#0B5D48; color:#ffffff;">
                <th style="width:19%; padding:12px; text-align:right; font-size:11.5px; font-weight:700;">التاريخ</th>
                <th style="width:42%; padding:12px; text-align:right; font-size:11.5px; font-weight:700;">الوصف / العميل</th>
                <th style="width:21%; padding:12px; text-align:right; font-size:11.5px; font-weight:700;">القيمة</th>
                <th style="width:18%; padding:12px; text-align:right; font-size:11.5px; font-weight:700;">النوع</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>

        <div style="margin-top:28px; display:grid; grid-template-columns:1.5fr 1fr; gap:14px; align-items:stretch;">
          <div style="background:#F6FAF8; border:1px solid #E4ECE9; border-radius:16px; padding:16px 17px;">
            <div style="font-size:11px; color:#64756F; font-weight:700; margin-bottom:5px;">ملاحظة التقرير</div>
            <div style="font-size:10.5px; color:#7D8D87; line-height:1.8;">هذا التقرير مولد تلقائياً من بيانات VAYRO المسجلة في النظام. استخدم الأرقام الظاهرة لأغراض المراجعة والإدارة الداخلية.</div>
          </div>
          <div style="background:#064E3B; color:#ffffff; border-radius:16px; padding:16px 17px; display:flex; flex-direction:column; justify-content:center;">
            <div style="font-size:10px; opacity:0.7; margin-bottom:3px;">VAYRO</div>
            <div style="font-size:12px; font-weight:800; margin-bottom:2px;">Business Messaging Platform</div>
            <div style="font-size:10px; opacity:0.78;">vayro-wa.com</div>
          </div>
        </div>
      </main>

      <footer style="margin:26px 42px 0; border-top:1px solid #E6ECEA; padding-top:13px; display:flex; align-items:center; justify-content:space-between; color:#8A9994; font-size:9.5px;">
        <span>© VAYRO - تقرير مالي آلي</span>
        <span>${escapeHtml(input.monthName)} ${escapeHtml(input.year)}</span>
      </footer>
    </div>
  `;

  document.body.appendChild(wrapper);

  await new Promise((resolve) => setTimeout(resolve, 500));

  try {
    const canvas = await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      windowWidth: 794,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const sliceHeightPx = (pageHeight / pageWidth) * canvas.width;

    let y = 0;
    while (y < canvas.height) {
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = Math.min(sliceHeightPx, canvas.height - y);
      const context = sliceCanvas.getContext('2d');
      if (!context) break;

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      context.drawImage(
        canvas,
        0,
        y,
        canvas.width,
        sliceCanvas.height,
        0,
        0,
        canvas.width,
        sliceCanvas.height,
      );

      const imageData = sliceCanvas.toDataURL('image/png', 1);
      if (y > 0) pdf.addPage();
      pdf.addImage(
        imageData,
        'PNG',
        0,
        0,
        pageWidth,
        (sliceCanvas.height * pageWidth) / canvas.width,
      );
      y += sliceCanvas.height;
    }

    pdf.save(`vayro-finance-${input.monthName}-${input.year}.pdf`);
  } finally {
    document.body.removeChild(wrapper);
  }
}
