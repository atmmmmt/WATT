import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const landingCopyOverrides = {
  name: 'vayro-landing-copy-overrides',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id.replace(/\\/g, '/').endsWith('/src/landing-content.ts')) return null;

    return {
      code: code
        .replace(
          "'كل عمليات واتساب لشركتك في منصة واحدة'",
          "'واتساب شركتك، صار أذكى.'",
        )
        .replace(
          "'VAYRO يجمع إرسال رموز التحقق، توزيع محادثات العملاء على فريقك، ومتابعة المرشحين والمقابلات في لوحة عربية موحدة — بدون بناء نظام من الصفر.'",
          "'OTP، دعم العملاء، والتوظيف — كلهم في منصة واحدة.'",
        )
        .replace("'اطلب الخدمة الآن'", "'ابدأ الآن'")
        .replace("'شاهد كيف تعمل'", "'شاهد كيف يعمل'"),
      map: null,
    };
  },
};

export default defineConfig({
  plugins: [landingCopyOverrides, react(), tailwindcss()],
  server: {
    port: 5174,
  },
});
