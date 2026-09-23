import { LandingCopy, Language, supportedLanguages } from './landing-content';

const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://vayro.com';

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
}

function upsertLink(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLLinkElement>(selector);

  if (!element) {
    element = document.createElement('link');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
}

function upsertJsonLd(id: string, payload: unknown) {
  let element = document.getElementById(id) as HTMLScriptElement | null;

  if (!element) {
    element = document.createElement('script');
    element.id = id;
    element.type = 'application/ld+json';
    document.head.appendChild(element);
  }

  element.textContent = JSON.stringify(payload);
}

export function applySeo(language: Language, copy: LandingCopy) {
  const langMeta = supportedLanguages[language];
  const canonical = `${SITE_URL}/${language}`;
  const image = `${SITE_URL}/og-vayro.png`;

  document.documentElement.lang = language;
  document.documentElement.dir = langMeta.dir;
  document.title = copy.seo.title;

  upsertMeta('meta[name="description"]', {
    name: 'description',
    content: copy.seo.description,
  });
  upsertMeta('meta[name="keywords"]', {
    name: 'keywords',
    content: copy.seo.keywords.join(', '),
  });
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: copy.seo.title });
  upsertMeta('meta[property="og:description"]', {
    property: 'og:description',
    content: copy.seo.description,
  });
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
  upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image });
  upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: langMeta.locale });
  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: copy.seo.title });
  upsertMeta('meta[name="twitter:description"]', {
    name: 'twitter:description',
    content: copy.seo.description,
  });
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image });
  upsertLink('link[rel="canonical"]', { rel: 'canonical', href: canonical });

  Object.keys(supportedLanguages).forEach((lang) => {
    upsertLink(`link[rel="alternate"][hreflang="${lang}"]`, {
      rel: 'alternate',
      hreflang: lang,
      href: `${SITE_URL}/${lang}`,
    });
  });
  upsertLink('link[rel="alternate"][hreflang="x-default"]', {
    rel: 'alternate',
    hreflang: 'x-default',
    href: `${SITE_URL}/ar`,
  });

  upsertJsonLd('schema-organization', {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'VAYRO',
    url: SITE_URL,
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      availableLanguage: Object.values(supportedLanguages).map((item) => item.label),
    },
  });

  upsertJsonLd('schema-software', {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'VAYRO',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: copy.pricing.plans.map((plan) => ({
      '@type': 'Offer',
      name: plan.name,
      price: plan.monthly,
      priceCurrency: plan.currency.replace('$', 'USD'),
    })),
  });

  upsertJsonLd('schema-faq', {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: copy.faq.items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  });

  upsertJsonLd('schema-breadcrumb', {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: copy.nav.home,
        item: canonical,
      },
    ],
  });
}
