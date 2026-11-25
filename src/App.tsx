import React, { useState, useEffect, useRef } from 'react';
import {
  Truck,
  ShieldCheck,
  Sparkles,
  Droplets,
  Wind,
  Flame,
  CheckCircle2,
  ChevronDown,
  PhoneCall,
  MapPin,
  User,
  ShoppingBag,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  ArrowDown
} from 'lucide-react';

// ==========================================
// 1. TOP-LEVEL CONFIGURATION & IMAGE SLOTS
// ==========================================
export const ORDER_WEBHOOK_URL: string = "";
export const WHATSAPP_NUMBER: string = "212600000000";

export const PRODUCT_IMAGES = {
  heroPack: "/images/hero-pack.jpg",
  shampooBottle: "/images/shampoo-150ml.jpg",
  maskJar: "/images/mask-200g.jpg",
};

const FALLBACK_IMAGES = {
  heroPack: "/src/assets/images/keraya_hero_pack_v2_1795619689320.jpg",
  shampooBottle: "/src/assets/images/keraya_shampoo_v2_1795619690740.jpg",
  maskJar: "/src/assets/images/keraya_mask_jar_1795619655466.jpg",
};

const MOROCCAN_CITIES = [
  "الدار البيضاء",
  "الرباط",
  "سلا",
  "مراكش",
  "طنجة",
  "فاس",
  "أكادير",
  "مكناس",
  "وجدة",
  "القنيطرة",
  "تطوان",
  "الجديدة",
  "آسفي",
  "بني ملال",
  "الناظور",
  "أخرى..."
];

export interface OrderPayload {
  name: string;
  phone: string;
  city: string;
  offer: string;
  quantity: number;
  totalMAD: number;
  timestamp: string;
  utmSource: string;
}

// TikTok Pixel Ready Helper
function trackTikTokOrder(payload: OrderPayload) {
  try {
    const win = window as unknown as {
      ttq?: {
        track?: (event: string, data: Record<string, unknown>) => void;
      };
    };
    if (win.ttq && typeof win.ttq.track === 'function') {
      win.ttq.track('CompletePayment', {
        content_id: payload.quantity === 2 ? 'keraya-winter-2pack' : 'keraya-winter-1pack',
        content_type: 'product',
        content_name: payload.offer,
        quantity: payload.quantity,
        price: payload.totalMAD,
        value: payload.totalMAD,
        currency: 'MAD',
      });
    }
  } catch {
    // Graceful no-op if pixel is not active
  }
}

// ==========================================
// 2. RESILIENT IMAGE SLOT COMPONENT
// ==========================================
interface ProductImageProps {
  src: string;
  fallbackSrc: string;
  alt: string;
  badgeText?: string;
  secondaryBadgeText?: string;
  aspectClass?: string;
}

function ProductImageSlot({
  src,
  fallbackSrc,
  alt,
  badgeText,
  secondaryBadgeText,
  aspectClass = "aspect-[4/3]"
}: ProductImageProps) {
  const [imgSrc, setImgSrc] = useState<string>(src);
  const [hasFailedAll, setHasFailedAll] = useState<boolean>(false);

  const handleError = () => {
    if (imgSrc === src && fallbackSrc && fallbackSrc !== src) {
      setImgSrc(fallbackSrc);
    } else {
      setHasFailedAll(true);
    }
  };

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl bg-[#F2ECE1] border border-[#E6DEC8] ${aspectClass}`}>
      {!hasFailedAll ? (
        <img
          src={imgSrc}
          alt={alt}
          onError={handleError}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover object-center transition-transform duration-300"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-[#143D2B] to-[#0D281C] p-6 text-center text-[#FAF7F2]">
          <Sparkles className="mb-2 h-8 w-8 text-[#C59B48]" />
          <span className="font-serif-brand text-xl tracking-widest text-[#C59B48]">KERAYA</span>
          <span className="mt-1 text-xs text-[#E6DEC8]/80">{alt}</span>
        </div>
      )}

      {/* Volume Badges */}
      {badgeText && (
        <div
          dir="ltr"
          className="font-latin absolute bottom-3 left-3 rounded-lg bg-[#143D2B]/90 px-2.5 py-1 text-xs font-semibold tracking-wide text-[#FAF7F2] backdrop-blur-xs border border-[#C59B48]/40 tabular-nums"
        >
          {badgeText}
        </div>
      )}
      {secondaryBadgeText && (
        <div
          dir="ltr"
          className="font-latin absolute bottom-3 right-3 rounded-lg bg-[#143D2B]/90 px-2.5 py-1 text-xs font-semibold tracking-wide text-[#FAF7F2] backdrop-blur-xs border border-[#C59B48]/40 tabular-nums"
        >
          {secondaryBadgeText}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. MAIN LANDING PAGE COMPONENT
// ==========================================
export default function App() {
  const [selectedOption, setSelectedOption] = useState<'1pack' | '2pack'>('1pack');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string; city?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<OrderPayload | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [isFormInView, setIsFormInView] = useState(false);

  const orderFormRef = useRef<HTMLElement | null>(null);

  // Auto-hide sticky bottom bar when #order-form is in view
  useEffect(() => {
    const target = orderFormRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsFormInView(entry.isIntersecting);
        });
      },
      { threshold: 0.12 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const scrollToOrderForm = () => {
    orderFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Moroccan phone validation: accepts 06..., 07..., or +2126/7..., 10 digits normalized
  const validateMoroccanPhone = (rawPhone: string): boolean => {
    const cleaned = rawPhone.replace(/[\s\-().]/g, '');
    const regex = /^(?:0[67]\d{8}|\+212[67]\d{8}|00212[67]\d{8})$/;
    return regex.test(cleaned);
  };

  const currentPrice = selectedOption === '1pack' ? 299 : 499;
  const currentOfferLabel =
    selectedOption === '1pack'
      ? 'باك واحد (شامبوان 150ml + ماسك 200g) — 299 DH'
      : '2 باكات (لكِ ولعائلتك — وفر 99 درهم) — 499 DH';

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { name?: string; phone?: string; city?: string } = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      newErrors.name = 'عافاك دخلي الاسم الكامل ديالك';
    }

    if (!phone.trim() || !validateMoroccanPhone(phone)) {
      newErrors.phone = 'عافاك دخلي رقم هاتف مغربي صحيح (مثال: 0612345678 أو 0712345678)';
    }

    const finalCity = city === 'أخرى...' ? customCity.trim() : city;
    if (!finalCity) {
      newErrors.city = 'عافاك اختاري المدينة ديالك';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get('utm_source') || 'direct';

    const payload: OrderPayload = {
      name: fullName.trim(),
      phone: phone.trim().replace(/[\s\-().]/g, ''),
      city: finalCity,
      offer: currentOfferLabel,
      quantity: selectedOption === '1pack' ? 1 : 2,
      totalMAD: currentPrice,
      timestamp: new Date().toISOString(),
      utmSource,
    };

    if (ORDER_WEBHOOK_URL && ORDER_WEBHOOK_URL.trim() !== '') {
      try {
        await fetch(ORDER_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        // Graceful fallback so customer order confirmation always succeeds
      }
    }

    trackTikTokOrder(payload);
    setIsSubmitting(false);
    setSubmittedOrder(payload);
  };

  const whatsappInquiryUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    'السلام عليكم، بغيت نسول على باك Keraya'
  )}`;

  const faqItems = [
    {
      question: 'واش الدفع عند الاستلام؟',
      answer: 'نعم، كتخلّصي غير ملي يوصلك الكولي حتى لباب الدار.',
    },
    {
      question: 'شحال كياخد التوصيل؟',
      answer: '24 حتى 48 ساعة فالمدن الكبرى، و2 إلى 4 أيام لباقي المدن.',
    },
    {
      question: 'واش مناسب للشعر المصبوغ أو بالكيراتين؟',
      answer: 'إيه، تركيبة لطيفة مصممة للترطيب والتغذية بلا ما تنشّف الشعر.',
    },
    {
      question: 'شنو هو حجم المنتجات؟',
      answer: 'الشامبوان 150 مل والماسك 200 غرام.',
    },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-[#EFEAE1] text-[#1A1D1B] font-arabic">
      {/* Mobile-First Centered Container (max-width: 480px on desktop with subtle frame) */}
      <div className="mx-auto max-w-[480px] min-h-screen bg-[#FAF7F2] shadow-xl border-x border-[#E6DEC8] pb-24">
        
        {/* 1. TOP ANNOUNCEMENT BAR */}
        <div className="bg-[#143D2B] px-3 py-2.5 text-center text-xs sm:text-sm font-semibold text-[#C59B48] border-b border-[#C59B48]/30">
          توصيل مجاني لجميع المدن المغربية • الدفع عند الاستلام 🇲🇦
        </div>

        {/* 2. HERO SECTION (ABOVE THE FOLD) */}
        <header className="px-5 pt-5 pb-7 border-b border-[#E6DEC8]">
          {/* Brand Header */}
          <div className="mb-4 flex items-center justify-between border-b border-[#E6DEC8] pb-3">
            <div dir="ltr" className="text-left">
              <span className="font-serif-brand text-xl font-bold tracking-wider text-[#143D2B]">
                Keraya
              </span>
              <span className="font-latin text-xs font-medium tracking-widest text-[#8C733E] uppercase">
                {' '}— SOINS CAPILLAIRES
              </span>
            </div>
            <button
              type="button"
              onClick={scrollToOrderForm}
              className="rounded-lg bg-[#143D2B]/10 px-3 py-1.5 text-xs font-bold text-[#143D2B] hover:bg-[#143D2B] hover:text-white transition-colors cursor-pointer"
            >
              أطلبي دابا
            </button>
          </div>

          {/* Kicker */}
          <p dir="ltr" className="font-latin mb-2 text-center text-xs font-semibold tracking-widest text-[#8C733E] uppercase">
            PACK RÉPARATION HIVER • 150 ml + 200 g
          </p>

          {/* High-Impact Darija Headline */}
          <h1 className="mb-3 text-center text-2xl sm:text-[28px] font-extrabold leading-snug text-[#143D2B] text-balance">
            رجّعي الرطوبة واللمعان لشعرك هاد الشتاء
          </h1>

          {/* Subheadline */}
          <p className="mb-5 text-center text-sm sm:text-base leading-relaxed text-[#1A1D1B]/80">
            باك العناية المتكامل للشعر الناشف، الخشن واللي كيتشابك فالمشيط{' '}
            <span dir="ltr" className="font-latin font-semibold text-[#143D2B] tabular-nums">
              (150 ml + 200 g)
            </span>
          </p>

          {/* Hero Product Image with Exact Volume Badges */}
          <div className="mb-5">
            <ProductImageSlot
              src={PRODUCT_IMAGES.heroPack}
              fallbackSrc={FALLBACK_IMAGES.heroPack}
              alt="Keraya Pack Réparation Hiver — Shampoing Protéines 150 ml + Masque Cacao & Karité 200 g"
              badgeText="Shampoing 150 ml"
              secondaryBadgeText="Masque 200 g"
              aspectClass="aspect-[4/3]"
            />
          </div>

          {/* Price Block */}
          <div className="mb-4 rounded-xl bg-white p-4 border border-[#E6DEC8] text-center">
            <div className="flex items-center justify-center gap-3 mb-1">
              <span
                dir="ltr"
                className="font-latin text-base text-[#1A1D1B]/45 line-through tabular-nums"
              >
                399 DH
              </span>
              <span
                dir="ltr"
                className="font-latin text-3xl font-extrabold text-[#143D2B] tabular-nums"
              >
                299 DH
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold text-[#9A7428]">
              عرض خاص -25% + توصيل فابور
            </p>
          </div>

          {/* Primary CTA Button */}
          <button
            type="button"
            onClick={scrollToOrderForm}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#143D2B] px-6 py-4 text-base sm:text-lg font-bold text-[#FAF7F2] shadow-md hover:bg-[#0F2E20] active:scale-[0.99] transition-all cursor-pointer"
          >
            <span>أطلبي الباك دابا — 299 درهم</span>
            <ArrowDown className="h-5 w-5 text-[#C59B48]" />
          </button>

          {/* Unboxed Clean Trust Metadata */}
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[#1A1D1B]/70">
            <span>الدفع عند الاستلام</span>
            <span aria-hidden="true">·</span>
            <span>توصيل مجاني 24-48 ساعة</span>
          </div>
        </header>

        {/* 3. WHY YOUR HAIR FEELS DRY IN WINTER (PROBLEM & SIMPLE SCIENCE) */}
        <section className="px-5 py-7 border-b border-[#E6DEC8]">
          <div className="mb-5 text-center">
            <p className="text-xs font-semibold text-[#9A7428] mb-1">
              علاش شعرك كيتبدّل ففصل الشتاء؟
            </p>
            <h2 className="text-xl font-extrabold text-[#143D2B]">
              3 عوامل كتخلي الشعر ناشف وصعيب فالمشيط
            </h2>
          </div>

          <div className="space-y-3">
            {/* Card 1 */}
            <div className="flex items-start gap-3.5 rounded-xl bg-white p-4 border border-[#E6DEC8]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FAF7F2] text-[#143D2B] border border-[#E6DEC8]">
                <Wind className="h-5 w-5 text-[#C59B48]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#143D2B] mb-0.5">
                  البرد والريح:
                </h3>
                <p className="text-sm leading-relaxed text-[#1A1D1B]/80">
                  كيسحبو الرطوبة الطبيعية من الزغبة.
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="flex items-start gap-3.5 rounded-xl bg-white p-4 border border-[#E6DEC8]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FAF7F2] text-[#143D2B] border border-[#E6DEC8]">
                <Droplets className="h-5 w-5 text-[#C59B48]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#143D2B] mb-0.5">
                  الماء القاصح (الكالكير):
                </h3>
                <p className="text-sm leading-relaxed text-[#1A1D1B]/80">
                  كيخلّي طبقة كتخلي الشعر حرش وصعيب فالمشيط.
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="flex items-start gap-3.5 rounded-xl bg-white p-4 border border-[#E6DEC8]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FAF7F2] text-[#143D2B] border border-[#E6DEC8]">
                <Flame className="h-5 w-5 text-[#C59B48]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#143D2B] mb-0.5">
                  السيشوار والبلاك:
                </h3>
                <p className="text-sm leading-relaxed text-[#1A1D1B]/80">
                  الحرارة كتفتح القشرة الخارجية وكتفقد الشعر اللمعان.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. THE 2-STEP KERAYA ROUTINE (PRODUCT BREAKDOWN) */}
        <section className="px-5 py-7 border-b border-[#E6DEC8]">
          <div className="mb-6 text-center">
            <p dir="ltr" className="font-latin text-xs font-semibold tracking-wider text-[#9A7428] uppercase mb-1">
              ROUTINE CAPILLAIRE EN 2 ÉTAPES
            </p>
            <h2 className="text-xl font-extrabold text-[#143D2B]">
              روتين Keraya المتكامل فخطوتين
            </h2>
          </div>

          <div className="space-y-5">
            {/* Step 1 — Shampoing Protéines (150 ml) */}
            <div className="rounded-2xl bg-white p-4 border border-[#E6DEC8]">
              <div className="mb-4">
                <ProductImageSlot
                  src={PRODUCT_IMAGES.shampooBottle}
                  fallbackSrc={FALLBACK_IMAGES.shampooBottle}
                  alt="Step 1 — Shampoing Protéines (150 ml)"
                  badgeText="150 ml"
                  aspectClass="aspect-square"
                />
              </div>
              <div className="mb-2 flex items-center justify-between border-b border-[#E6DEC8]/70 pb-2">
                <span className="text-xs font-bold text-[#9A7428]">الخطوة 01 • الغسل اللطيف</span>
                <span dir="ltr" className="font-latin text-xs font-semibold text-[#143D2B] tabular-nums">
                  150 ml
                </span>
              </div>
              <h3 dir="ltr" className="font-serif-brand text-lg font-bold text-[#143D2B] text-right mb-2">
                Step 1 — Shampoing Protéines (150 ml)
              </h3>
              <p className="text-sm leading-relaxed text-[#1A1D1B]/85">
                بروتينات، صوجا، جنين القمح، ألوفيرا، فيتامين A، كاكاو — كينظّف فروة الرأس بلطف وكيغدّي الشعرة بلا ما ينشفها.
              </p>
            </div>

            {/* Step 2 — Masque Cacao & Karité (200 g) */}
            <div className="rounded-2xl bg-white p-4 border border-[#E6DEC8]">
              <div className="mb-4">
                <ProductImageSlot
                  src={PRODUCT_IMAGES.maskJar}
                  fallbackSrc={FALLBACK_IMAGES.maskJar}
                  alt="Step 2 — Masque Cacao & Karité (200 g)"
                  badgeText="200 g"
                  aspectClass="aspect-square"
                />
              </div>
              <div className="mb-2 flex items-center justify-between border-b border-[#E6DEC8]/70 pb-2">
                <span className="text-xs font-bold text-[#9A7428]">الخطوة 02 • الترطيب العميق</span>
                <span dir="ltr" className="font-latin text-xs font-semibold text-[#143D2B] tabular-nums">
                  200 g
                </span>
              </div>
              <h3 dir="ltr" className="font-serif-brand text-lg font-bold text-[#143D2B] text-right mb-2">
                Step 2 — Masque Cacao & Karité (200 g)
              </h3>
              <p className="text-sm leading-relaxed text-[#1A1D1B]/85">
                كاكاو، زبدة الشيا، زيت جوز الهند وفيتامينات — كيرطّب بعمق، كيسهّل المشيط وكيعطي خفّة ولمعان طبيعي.
              </p>
            </div>
          </div>
        </section>

        {/* 5. SENSORY BENEFITS GRID (100% TIKTOK POLICY COMPLIANT) */}
        <section className="px-5 py-7 border-b border-[#E6DEC8]">
          <div className="mb-4 text-center">
            <h2 className="text-lg font-extrabold text-[#143D2B]">
              علاش غادي يعجبك باك Keraya من أول غسلة؟
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              'ترطيب عميق',
              'مشيط ساهل بلا تعكاز',
              'لمعان وخفة طبيعية',
              'مناسب للاستعمال المتكرر',
            ].map((benefit, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2.5 rounded-xl bg-white p-3.5 border border-[#E6DEC8]"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#C59B48]" />
                <span className="text-xs sm:text-sm font-bold text-[#143D2B]">
                  {benefit}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 6. HOW TO USE (3 EASY STEPS) */}
        <section className="px-5 py-7 border-b border-[#E6DEC8]">
          <div className="mb-5 text-center">
            <p className="text-xs font-semibold text-[#9A7428] mb-1">
              طريقة الاستعمال الصحيحة
            </p>
            <h2 className="text-xl font-extrabold text-[#143D2B]">
              3 خطوات بسيطة لنتيجة رطبة ولامعة
            </h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3.5 rounded-xl bg-white p-4 border border-[#E6DEC8]">
              <span className="font-latin flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#143D2B] text-xs font-bold text-[#C59B48] tabular-nums">
                01
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#143D2B] mb-0.5">
                  غسلي بشامبوان البروتينات (150 ml)
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed text-[#1A1D1B]/80">
                  فزّكي شعرك بماء دافئ، ديري كمية مناسبة من الشامبوان ودلّكي فروة الرأس بلطف باش تنظفيها وتغذيها، من بعد شلّلي مزيان.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 rounded-xl bg-white p-4 border border-[#E6DEC8]">
              <span className="font-latin flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#143D2B] text-xs font-bold text-[#C59B48] tabular-nums">
                02
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#143D2B] mb-0.5">
                  طبّقي ماسك الكاكاو وزبدة الشيا (200 g)
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed text-[#1A1D1B]/80">
                  وزّعي الماسك على طول الشعر والأطراف (بعدي شوية على الجذور)، وخلّيه يرتاح ما بين 5 حتى 10 دقائق باش الزغبة تشرب الترطيب.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 rounded-xl bg-white p-4 border border-[#E6DEC8]">
              <span className="font-latin flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#143D2B] text-xs font-bold text-[#C59B48] tabular-nums">
                03
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#143D2B] mb-0.5">
                  شلّلي واستمتعي بمشيط ساهل
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed text-[#1A1D1B]/80">
                  غسلي شعرك بالماء الفاتر وغادي تلاحظي كيفاش المشط كيدوز بسهولة مع ملمس رطب، خفّة ولمعان طبيعي.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 7 & 8. OFFER SELECTOR & COD ORDER FORM (#order-form) */}
        <section
          id="order-form"
          ref={orderFormRef}
          className="px-5 py-8 border-b border-[#E6DEC8] scroll-mt-4"
        >
          <div className="rounded-2xl bg-white p-5 border-2 border-[#143D2B]">
            <div className="mb-5 text-center border-b border-[#E6DEC8] pb-4">
              <span className="text-xs font-bold text-[#9A7428]">
                الدفع عند الاستلام • توصيل مجاني لباب الدار
              </span>
              <h2 className="mt-1 text-xl font-extrabold text-[#143D2B]">
                عمّري المعلومات ديالك باش نرسلو ليك الطلب
              </h2>
            </div>

            {submittedOrder ? (
              /* WARM DARIJA CONFIRMATION SCREEN */
              <div className="py-4 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#143D2B] text-[#C59B48]">
                  <PackageCheck className="h-7 w-7" />
                </div>

                <h3 className="mb-2 text-lg font-extrabold text-[#143D2B]">
                  مرحباً بك أختي {submittedOrder.name}!
                </h3>

                <p className="mb-5 text-sm leading-relaxed text-[#1A1D1B] bg-[#FAF7F2] p-4 rounded-xl border border-[#E6DEC8]">
                  تم تسجيل طلبك بنجاح! غادي يتصل بك فريقنا خلال ساعات لتأكيد العنوان والتوصيل (24 إلى 48 ساعة).
                </p>

                <div className="mb-5 rounded-xl bg-[#FAF7F2] p-4 text-right text-xs sm:text-sm space-y-2 border border-[#E6DEC8]">
                  <div className="flex justify-between">
                    <span className="text-[#1A1D1B]/70">الاسم الكامل:</span>
                    <span className="font-bold text-[#143D2B]">{submittedOrder.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#1A1D1B]/70">رقم الهاتف:</span>
                    <span dir="ltr" className="font-latin font-bold text-[#143D2B] tabular-nums">
                      {submittedOrder.phone}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#1A1D1B]/70">المدينة:</span>
                    <span className="font-bold text-[#143D2B]">{submittedOrder.city}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#1A1D1B]/70">العرض المختار:</span>
                    <span className="font-bold text-[#143D2B]">{submittedOrder.offer}</span>
                  </div>
                  <div className="flex justify-between border-t border-[#E6DEC8] pt-2">
                    <span className="font-bold text-[#143D2B]">المجموع (الدفع عند الاستلام):</span>
                    <span dir="ltr" className="font-latin font-extrabold text-[#143D2B] tabular-nums">
                      {submittedOrder.totalMAD} DH
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <a
                    href={whatsappInquiryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#143D2B] px-4 py-3.5 text-sm font-bold text-white hover:bg-[#0F2E20] transition-colors"
                  >
                    <MessageCircle className="h-4 w-4 text-[#C59B48]" />
                    <span>تواصلي معنا عبر واتساب لأي استفسار</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      setSubmittedOrder(null);
                      setFullName('');
                      setPhone('');
                      setCity('');
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#E6DEC8] px-4 py-2.5 text-xs font-semibold text-[#1A1D1B]/70 hover:bg-[#FAF7F2] transition-colors cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>تسجيل طلب آخر</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleOrderSubmit} noValidate className="space-y-5">
                {/* Interactive Offer Radio Selector */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-[#143D2B]">
                    اختاري العرض المناسب ليك:
                  </label>

                  {/* Option 1 (Default) */}
                  <label
                    onClick={() => setSelectedOption('1pack')}
                    className={`flex cursor-pointer items-start justify-between rounded-xl p-3.5 border transition-all ${
                      selectedOption === '1pack'
                        ? 'border-[#143D2B] bg-[#FAF7F2] ring-1 ring-[#143D2B]'
                        : 'border-[#E6DEC8] bg-white hover:bg-[#FAF7F2]/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="keraya_offer"
                        checked={selectedOption === '1pack'}
                        onChange={() => setSelectedOption('1pack')}
                        className="mt-1 h-4 w-4 accent-[#143D2B]"
                      />
                      <div>
                        <div className="text-sm font-bold text-[#143D2B]">
                          باك واحد (شامبوان 150ml + ماسك 200g) — 299 DH
                        </div>
                        <div className="mt-0.5 text-xs font-semibold text-[#9A7428]">
                          توصيل مجاني لجميع المدن
                        </div>
                      </div>
                    </div>
                    <span
                      dir="ltr"
                      className="font-latin shrink-0 text-base font-extrabold text-[#143D2B] tabular-nums"
                    >
                      299 DH
                    </span>
                  </label>

                  {/* Option 2 (Badge: الأكثر طلباً) */}
                  <label
                    onClick={() => setSelectedOption('2pack')}
                    className={`relative flex cursor-pointer items-start justify-between rounded-xl p-3.5 border transition-all ${
                      selectedOption === '2pack'
                        ? 'border-[#143D2B] bg-[#FAF7F2] ring-1 ring-[#143D2B]'
                        : 'border-[#E6DEC8] bg-white hover:bg-[#FAF7F2]/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="keraya_offer"
                        checked={selectedOption === '2pack'}
                        onChange={() => setSelectedOption('2pack')}
                        className="mt-1 h-4 w-4 accent-[#143D2B]"
                      />
                      <div>
                        <div className="mb-1 inline-block rounded bg-[#C59B48]/20 px-2 py-0.5 text-[11px] font-bold text-[#143D2B]">
                          الأكثر طلباً
                        </div>
                        <div className="text-sm font-bold text-[#143D2B]">
                          2 باكات (لكِ ولعائلتك — وفر 99 درهم) — 499 DH
                        </div>
                        <div className="mt-0.5 text-xs font-semibold text-[#9A7428]">
                          توصيل مجاني لجميع المدن
                        </div>
                      </div>
                    </div>
                    <span
                      dir="ltr"
                      className="font-latin shrink-0 text-base font-extrabold text-[#143D2B] tabular-nums"
                    >
                      499 DH
                    </span>
                  </label>
                </div>

                {/* Ultra-Fast 3-Field COD Form */}
                <div className="space-y-4">
                  {/* Field 1: Full Name */}
                  <div>
                    <label
                      htmlFor="customer-name"
                      className="mb-1.5 block text-xs font-bold text-[#1A1D1B]"
                    >
                      الاسم الكامل <span className="text-red-700">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="customer-name"
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (errors.name) setErrors({ ...errors, name: undefined });
                        }}
                        placeholder="كتبي اسمك الكامل هنا"
                        className={`w-full rounded-xl bg-[#FAF7F2] py-3 pr-10 pl-3.5 text-sm text-[#1A1D1B] placeholder:text-[#1A1D1B]/40 border focus:outline-none focus:ring-2 ${
                          errors.name
                            ? 'border-red-600 focus:ring-red-600'
                            : 'border-[#E6DEC8] focus:border-[#143D2B] focus:ring-[#143D2B]/20'
                        }`}
                      />
                      <User className="pointer-events-none absolute right-3.5 top-3.5 h-4 w-4 text-[#143D2B]/60" />
                    </div>
                    {errors.name && (
                      <p className="mt-1 text-xs font-semibold text-red-700">{errors.name}</p>
                    )}
                  </div>

                  {/* Field 2: Moroccan Phone */}
                  <div>
                    <label
                      htmlFor="customer-phone"
                      className="mb-1.5 block text-xs font-bold text-[#1A1D1B]"
                    >
                      رقم الهاتف <span className="text-red-700">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="customer-phone"
                        type="tel"
                        inputMode="tel"
                        dir="ltr"
                        required
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          if (errors.phone) setErrors({ ...errors, phone: undefined });
                        }}
                        placeholder="06 00 00 00 00"
                        className={`font-latin w-full rounded-xl bg-[#FAF7F2] py-3 pr-10 pl-3.5 text-right text-sm text-[#1A1D1B] placeholder:text-[#1A1D1B]/40 border focus:outline-none focus:ring-2 tabular-nums ${
                          errors.phone
                            ? 'border-red-600 focus:ring-red-600'
                            : 'border-[#E6DEC8] focus:border-[#143D2B] focus:ring-[#143D2B]/20'
                        }`}
                      />
                      <PhoneCall className="pointer-events-none absolute right-3.5 top-3.5 h-4 w-4 text-[#143D2B]/60" />
                    </div>
                    {errors.phone && (
                      <p className="mt-1 text-xs font-semibold text-red-700">{errors.phone}</p>
                    )}
                  </div>

                  {/* Field 3: City Dropdown */}
                  <div>
                    <label
                      htmlFor="customer-city"
                      className="mb-1.5 block text-xs font-bold text-[#1A1D1B]"
                    >
                      المدينة <span className="text-red-700">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="customer-city"
                        required
                        value={city}
                        onChange={(e) => {
                          setCity(e.target.value);
                          if (errors.city) setErrors({ ...errors, city: undefined });
                        }}
                        className={`w-full appearance-none rounded-xl bg-[#FAF7F2] py-3 pr-10 pl-9 text-sm text-[#1A1D1B] border focus:outline-none focus:ring-2 ${
                          errors.city
                            ? 'border-red-600 focus:ring-red-600'
                            : 'border-[#E6DEC8] focus:border-[#143D2B] focus:ring-[#143D2B]/20'
                        }`}
                      >
                        <option value="">اختاري المدينة ديالك...</option>
                        {MOROCCAN_CITIES.map((cityName) => (
                          <option key={cityName} value={cityName}>
                            {cityName}
                          </option>
                        ))}
                      </select>
                      <MapPin className="pointer-events-none absolute right-3.5 top-3.5 h-4 w-4 text-[#143D2B]/60" />
                      <ChevronDown className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-[#143D2B]/60" />
                    </div>

                    {city === 'أخرى...' && (
                      <input
                        type="text"
                        value={customCity}
                        onChange={(e) => {
                          setCustomCity(e.target.value);
                          if (errors.city) setErrors({ ...errors, city: undefined });
                        }}
                        placeholder="كتبي اسم مدينتك هنا"
                        className="mt-2.5 w-full rounded-xl bg-[#FAF7F2] py-2.5 px-3.5 text-sm text-[#1A1D1B] border border-[#E6DEC8] focus:border-[#143D2B] focus:outline-none"
                      />
                    )}
                    {errors.city && (
                      <p className="mt-1 text-xs font-semibold text-red-700">{errors.city}</p>
                    )}
                  </div>
                </div>

                {/* Live Order Summary Box */}
                <div className="rounded-xl bg-[#FAF7F2] p-4 border border-[#E6DEC8] space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[#1A1D1B]/75">العرض المختار:</span>
                    <span className="font-bold text-[#143D2B]">
                      {selectedOption === '1pack'
                        ? 'باك واحد (150ml + 200g)'
                        : '2 باكات (توفير 99 درهم)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#1A1D1B]/75">التوصيل:</span>
                    <span className="font-bold text-[#143D2B]">مجاني (0 DH)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#1A1D1B]/75">طريقة الدفع:</span>
                    <span className="font-bold text-[#143D2B]">عند الاستلام</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#E6DEC8] pt-2.5 text-base">
                    <span className="font-extrabold text-[#143D2B]">المجموع الواجب أداؤه:</span>
                    <span
                      dir="ltr"
                      className="font-latin text-lg font-extrabold text-[#143D2B] tabular-nums"
                    >
                      {currentPrice} DH
                    </span>
                  </div>
                </div>

                {/* Big Prominent Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#143D2B] px-6 py-4 text-base sm:text-lg font-bold text-[#FAF7F2] shadow-md hover:bg-[#0F2E20] active:scale-[0.99] disabled:opacity-60 transition-all cursor-pointer"
                >
                  <ShoppingBag className="h-5 w-5 text-[#C59B48]" />
                  <span>
                    {isSubmitting ? 'جاري تسجيل الطلب...' : 'تأكيد الطلب — الدفع عند الاستلام'}
                  </span>
                </button>

                {/* Subtle Secondary WhatsApp Inquiry Link */}
                <div className="pt-1 text-center">
                  <a
                    href={whatsappInquiryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[#143D2B]/80 hover:text-[#143D2B] underline underline-offset-4"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-[#C59B48]" />
                    <span>عندك شي سؤال؟ تواصلي معنا مباشرة عبر واتساب</span>
                  </a>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* 9. TRUST & FAQ ACCORDION (4 REAL MOROCCAN BUYER QUESTIONS) */}
        <section className="px-5 py-7 border-b border-[#E6DEC8]">
          <div className="mb-5 text-center">
            <p className="text-xs font-semibold text-[#9A7428] mb-1">
              معلومات مهمة قبل الطلب
            </p>
            <h2 className="text-xl font-extrabold text-[#143D2B]">
              الأسئلة الأكثر تداولاً
            </h2>
          </div>

          <div className="space-y-2.5">
            {faqItems.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl bg-white border border-[#E6DEC8] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between p-4 text-right text-sm font-bold text-[#143D2B] hover:bg-[#FAF7F2]/60 transition-colors cursor-pointer"
                    aria-expanded={isOpen}
                  >
                    <span>{item.question}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-[#C59B48] transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 text-xs sm:text-sm leading-relaxed text-[#1A1D1B]/80 border-t border-[#E6DEC8]/50">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 11. LAW 31-08 COMPLIANT FOOTER */}
        <footer className="px-5 py-8 text-center text-xs text-[#1A1D1B]/75 space-y-4">
          <div dir="ltr">
            <span className="font-serif-brand text-lg font-bold tracking-wider text-[#143D2B]">
              Keraya
            </span>
            <span className="font-latin text-[11px] font-medium tracking-widest text-[#8C733E] uppercase">
              {' '}— SOINS CAPILLAIRES
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[#143D2B] font-semibold">
            <span className="inline-flex items-center gap-1">
              <Truck className="h-3.5 w-3.5 text-[#C59B48]" />
              التوصيل: 24-48 ساعة
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-[#C59B48]" />
              الدفع عند الاستلام
            </span>
          </div>

          {/* Loi 31-08 Art. 38 Hygiene Notice */}
          <p className="mx-auto max-w-sm leading-relaxed text-[11px] text-[#1A1D1B]/65 bg-white/70 p-3 rounded-xl border border-[#E6DEC8]">
            طبقاً لمقتضيات القانون رقم 31-08 القاضي بتحديد تدابير لحماية المستهلك (المادة 38)، فإن منتجات التجميل والعناية الشخصية المختومة لا تقبل الاسترجاع بعد فتح غلافها الأصلي لأسباب تتعلق بالسلامة الصحية والنظافة. في حالة التوصل بمنتج متضرر أثناء الشحن، يرجى التواصل معنا فور الاستلام لاستبداله مجاناً.
          </p>

          <div>
            <a
              href={whatsappInquiryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-[#143D2B] hover:underline"
            >
              <MessageCircle className="h-3.5 w-3.5 text-[#C59B48]" />
              <span>خدمة الزبناء عبر واتساب</span>
            </a>
          </div>

          <p dir="ltr" className="font-latin text-[11px] text-[#1A1D1B]/50">
            © 2026 Keraya Maroc
          </p>
        </footer>
      </div>

      {/* 10. STICKY BOTTOM MOBILE BAR (Auto-hides when #order-form is in view) */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-200 ${
          isFormInView ? 'translate-y-full pointer-events-none' : 'translate-y-0'
        }`}
      >
        <div className="mx-auto max-w-[480px] bg-white/95 backdrop-blur-xs border-t border-x border-[#E6DEC8] px-4 py-2.5 shadow-lg flex items-center justify-between gap-3">
          <div>
            <div className="font-bold text-sm text-[#143D2B]">
              <span dir="ltr" className="font-latin font-extrabold tabular-nums">
                299 DH
              </span>{' '}
              • توصيل مجاني
            </div>
            <div className="text-[11px] text-[#1A1D1B]/70">
              الدفع عند الاستلام لجميع المدن
            </div>
          </div>

          <button
            type="button"
            onClick={scrollToOrderForm}
            className="shrink-0 rounded-xl bg-[#143D2B] px-5 py-2.5 text-sm font-bold text-[#FAF7F2] hover:bg-[#0F2E20] active:scale-95 transition-all cursor-pointer"
          >
            أطلبي دابا
          </button>
        </div>
      </div>
    </div>
  );
}
