'use strict';
/* =====================================================================
   CalcPlus - calculator + tools (VAT, discount, split bill, currency,
   units, loan, dates, BMI, number bases). 10 languages. No dependencies.
   ===================================================================== */

/* ============================ ENGINE ============================ */
function tokenize(s) {
  const re = /\s*(\d+\.?\d*|\.\d+|asin\(|acos\(|atan\(|sin\(|cos\(|tan\(|log\(|ln\(|√\(|π|e|[+\-−×÷*\/^()%!])/y;
  const out = [];
  re.lastIndex = 0;
  while (re.lastIndex < s.length) {
    const pos = re.lastIndex;
    const m = re.exec(s);
    if (!m) {
      if (/^\s*$/.test(s.slice(pos))) break;
      throw new Error('token');
    }
    const x = m[1];
    if (/^[\d.]/.test(x)) out.push({ t: 'n', v: parseFloat(x) });
    else if (x === 'π' || x === 'e') out.push({ t: 'c', v: x });
    else if (x.length > 1 && x.endsWith('(')) out.push({ t: 'f', v: x === '√(' ? 'sqrt' : x.slice(0, -1) });
    else out.push({ t: 'o', v: x === '−' ? '-' : x === '×' ? '*' : x === '÷' ? '/' : x });
  }
  return out;
}

function factorial(n) {
  if (n < 0 || !Number.isInteger(n) || n > 170) throw new Error('fact');
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function applyFn(f, a, deg) {
  const k = deg ? Math.PI / 180 : 1;
  let r;
  switch (f) {
    case 'sin': r = Math.sin(a * k); break;
    case 'cos': r = Math.cos(a * k); break;
    case 'tan':
      if (deg && Math.abs((((a % 180) + 180) % 180) - 90) < 1e-9) throw new Error('tan');
      r = Math.tan(a * k); break;
    case 'asin': r = Math.asin(a) / k; break;
    case 'acos': r = Math.acos(a) / k; break;
    case 'atan': r = Math.atan(a) / k; break;
    case 'log': r = Math.log10(a); break;
    case 'ln': r = Math.log(a); break;
    case 'sqrt': r = Math.sqrt(a); break;
    default: throw new Error('fn');
  }
  if (!isFinite(r)) throw new Error('math');
  return Math.abs(r) < 1e-12 ? 0 : r;
}

function evaluate(str, deg) {
  const toks = tokenize(str);
  let i = 0;
  const peek = () => toks[i];
  const isOp = (v) => toks[i] && toks[i].t === 'o' && toks[i].v === v;
  const startsOperand = (t) => t.t === 'n' || t.t === 'f' || t.t === 'c' || (t.t === 'o' && t.v === '(');

  function expr() {
    let l = term();
    while (peek() && peek().t === 'o' && (peek().v === '+' || peek().v === '-')) {
      const op = toks[i++].v;
      const r = term();
      if (r.p) l = { v: op === '+' ? l.v + l.v * r.v : l.v - l.v * r.v };
      else l = { v: op === '+' ? l.v + r.v : l.v - r.v };
    }
    return l;
  }
  function term() {
    let l = unary();
    for (;;) {
      const t = peek();
      if (!t) break;
      if (t.t === 'o' && (t.v === '*' || t.v === '/')) {
        i++;
        const r = unary();
        l = { v: t.v === '*' ? l.v * r.v : l.v / r.v };
      } else if (startsOperand(t)) {
        const r = unary();
        l = { v: l.v * r.v };
      } else break;
    }
    return l;
  }
  function unary() {
    if (isOp('-')) { i++; const x = unary(); return { v: -x.v }; }
    if (isOp('+')) { i++; return unary(); }
    return power();
  }
  function power() {
    const b = postfix();
    if (isOp('^')) { i++; const e = unary(); return { v: Math.pow(b.v, e.v) }; }
    return b;
  }
  function postfix() {
    let x = primary();
    let p = false;
    for (;;) {
      if (isOp('!')) { i++; x = factorial(x); p = false; }
      else if (isOp('%')) { i++; x = x / 100; p = true; }
      else break;
    }
    return { v: x, p };
  }
  function close() { if (isOp(')')) i++; else throw new Error('paren'); }
  function primary() {
    const t = toks[i++];
    if (!t) throw new Error('end');
    if (t.t === 'n') return t.v;
    if (t.t === 'c') return t.v === 'π' ? Math.PI : Math.E;
    if (t.t === 'f') { const a = expr().v; close(); return applyFn(t.v, a, deg); }
    if (t.t === 'o' && t.v === '(') { const a = expr().v; close(); return a; }
    throw new Error('syntax');
  }

  const r = expr();
  if (i !== toks.length) throw new Error('syntax');
  return r.v;
}

function fmtNum(v) {
  if (!isFinite(v)) return 'Error';
  const r = parseFloat(v.toPrecision(12));
  if (Math.abs(r) >= 1e15 || (r !== 0 && Math.abs(r) < 1e-9)) {
    return r.toExponential(8).replace(/\.?0+e/, 'e');
  }
  return String(r);
}

if (typeof module !== 'undefined') module.exports = { evaluate, fmtNum, tokenize };

/* ============================== UI =============================== */
(function () {
  if (typeof document === 'undefined') return;

  const $ = (s, r = document) => r.querySelector(s);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('cp_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cp_' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };

  /* ---------------- i18n ---------------- */
  const LANGS = { ar: 'العربية', en: 'English', fr: 'Français', es: 'Español', pt: 'Português', de: 'Deutsch', ru: 'Русский', tr: 'Türkçe', zh: '中文', hi: 'हिन्दी' };
  const LOC = { ar: 'ar-MA', en: 'en-US', fr: 'fr-FR', es: 'es-ES', pt: 'pt-PT', de: 'de-DE', ru: 'ru-RU', tr: 'tr-TR', zh: 'zh-CN', hi: 'hi-IN' };
  const I18N = {
    en: { calc: 'Calculator', tva: 'VAT', disc: 'Discount', split: 'Split bill', cur: 'Currency', unit: 'Units', loan: 'Loan', date: 'Dates', bmi: 'BMI', prog: 'Bases', hist: 'History', sett: 'Settings', lang: 'Language', theme: 'Theme', auto: 'Auto', light: 'Light', dark: 'Dark', vib: 'Vibration', copy: 'Copy', copied: 'Copied ✓', noHist: 'No history yet', clearHist: 'Clear history', amount: 'Amount', rate: 'Rate (%)', toTTC: 'Excl. → Incl. tax', toHT: 'Incl. → Excl. tax', ht: 'Excl. tax', vat: 'VAT', ttc: 'Incl. tax', price: 'Price', discPct: 'Discount (%)', finalPrice: 'Final price', saved: 'You save', bill: 'Bill amount', tipPct: 'Tip (%)', people: 'People', perPerson: 'Per person', tip: 'Tip', total: 'Total', from: 'From', to: 'To', update: 'Update rates', updated: 'Updated', approx: 'Approximate offline rates', category: 'Category', value: 'Value', length: 'Length', weight: 'Weight', temp: 'Temperature', area: 'Area', volume: 'Volume', speed: 'Speed', principal: 'Loan amount', annualRate: 'Annual rate (%)', years: 'Years', monthly: 'Monthly payment', totalPay: 'Total to pay', interest: 'Total interest', d1: 'Start / birth date', d2: 'End date', diff: 'Difference', yrs: 'years', mos: 'months', dys: 'days', totalDays: 'Total days', kg: 'Weight (kg)', cm: 'Height (cm)', under: 'Underweight', normal: 'Normal', over: 'Overweight', obese: 'Obese', number: 'Number', invalid: 'Invalid', privacy: 'Privacy policy', loading: 'Loading…', failed: 'Update failed', today: 'Today', base: 'Base' },
    fr: { calc: 'Calculatrice', tva: 'TVA', disc: 'Remise', split: 'Partage', cur: 'Devises', unit: 'Unités', loan: 'Prêt', date: 'Dates', bmi: 'IMC', prog: 'Bases', hist: 'Historique', sett: 'Réglages', lang: 'Langue', theme: 'Thème', auto: 'Auto', light: 'Clair', dark: 'Sombre', vib: 'Vibration', copy: 'Copier', copied: 'Copié ✓', noHist: 'Aucun historique', clearHist: 'Effacer l’historique', amount: 'Montant', rate: 'Taux (%)', toTTC: 'HT → TTC', toHT: 'TTC → HT', ht: 'HT', vat: 'TVA', ttc: 'TTC', price: 'Prix', discPct: 'Remise (%)', finalPrice: 'Prix final', saved: 'Vous économisez', bill: 'Montant de l’addition', tipPct: 'Pourboire (%)', people: 'Personnes', perPerson: 'Par personne', tip: 'Pourboire', total: 'Total', from: 'De', to: 'Vers', update: 'Actualiser les taux', updated: 'Mis à jour', approx: 'Taux approximatifs (hors ligne)', category: 'Catégorie', value: 'Valeur', length: 'Longueur', weight: 'Poids', temp: 'Température', area: 'Surface', volume: 'Volume', speed: 'Vitesse', principal: 'Montant du prêt', annualRate: 'Taux annuel (%)', years: 'Années', monthly: 'Mensualité', totalPay: 'Total à payer', interest: 'Intérêts totaux', d1: 'Date de début / naissance', d2: 'Date de fin', diff: 'Différence', yrs: 'ans', mos: 'mois', dys: 'jours', totalDays: 'Total en jours', kg: 'Poids (kg)', cm: 'Taille (cm)', under: 'Insuffisance pondérale', normal: 'Normal', over: 'Surpoids', obese: 'Obésité', number: 'Nombre', invalid: 'Invalide', privacy: 'Politique de confidentialité', loading: 'Chargement…', failed: 'Échec de la mise à jour', today: 'Aujourd’hui', base: 'Base' },
    ar: { calc: 'الآلة الحاسبة', tva: 'الضريبة (TVA)', disc: 'التخفيض', split: 'تقسيم الفاتورة', cur: 'العملات', unit: 'الوحدات', loan: 'القرض', date: 'التواريخ', bmi: 'مؤشر الكتلة', prog: 'الأنظمة العددية', hist: 'السجل', sett: 'الإعدادات', lang: 'اللغة', theme: 'المظهر', auto: 'تلقائي', light: 'فاتح', dark: 'داكن', vib: 'الاهتزاز', copy: 'نسخ', copied: 'تم النسخ ✓', noHist: 'لا يوجد سجل', clearHist: 'مسح السجل', amount: 'المبلغ', rate: 'النسبة (%)', toTTC: 'بدون ضريبة ← مع الضريبة', toHT: 'مع الضريبة ← بدون ضريبة', ht: 'بدون ضريبة', vat: 'الضريبة', ttc: 'مع الضريبة', price: 'الثمن', discPct: 'التخفيض (%)', finalPrice: 'الثمن النهائي', saved: 'توفّر', bill: 'مبلغ الفاتورة', tipPct: 'البقشيش (%)', people: 'عدد الأشخاص', perPerson: 'لكل شخص', tip: 'البقشيش', total: 'المجموع', from: 'من', to: 'إلى', update: 'تحديث الأسعار', updated: 'آخر تحديث', approx: 'أسعار تقريبية (بدون إنترنت)', category: 'الفئة', value: 'القيمة', length: 'الطول', weight: 'الوزن', temp: 'الحرارة', area: 'المساحة', volume: 'الحجم', speed: 'السرعة', principal: 'مبلغ القرض', annualRate: 'الفائدة السنوية (%)', years: 'السنوات', monthly: 'القسط الشهري', totalPay: 'المجموع المطلوب أداؤه', interest: 'مجموع الفوائد', d1: 'تاريخ البداية / الازدياد', d2: 'تاريخ النهاية', diff: 'الفرق', yrs: 'سنة', mos: 'شهر', dys: 'يوم', totalDays: 'مجموع الأيام', kg: 'الوزن (كغ)', cm: 'الطول (سم)', under: 'نحافة', normal: 'طبيعي', over: 'وزن زائد', obese: 'سمنة', number: 'الرقم', invalid: 'غير صالح', privacy: 'سياسة الخصوصية', loading: 'جارٍ التحميل…', failed: 'فشل التحديث', today: 'اليوم', base: 'النظام' },
    es: { calc: 'Calculadora', tva: 'IVA', disc: 'Descuento', split: 'Dividir cuenta', cur: 'Divisas', unit: 'Unidades', loan: 'Préstamo', date: 'Fechas', bmi: 'IMC', prog: 'Bases', hist: 'Historial', sett: 'Ajustes', lang: 'Idioma', theme: 'Tema', auto: 'Auto', light: 'Claro', dark: 'Oscuro', vib: 'Vibración', copy: 'Copiar', copied: 'Copiado ✓', noHist: 'Sin historial', clearHist: 'Borrar historial', amount: 'Importe', rate: 'Tasa (%)', toTTC: 'Sin IVA → Con IVA', toHT: 'Con IVA → Sin IVA', ht: 'Sin IVA', vat: 'IVA', ttc: 'Con IVA', price: 'Precio', discPct: 'Descuento (%)', finalPrice: 'Precio final', saved: 'Ahorras', bill: 'Importe de la cuenta', tipPct: 'Propina (%)', people: 'Personas', perPerson: 'Por persona', tip: 'Propina', total: 'Total', from: 'De', to: 'A', update: 'Actualizar tasas', updated: 'Actualizado', approx: 'Tasas aproximadas (sin conexión)', category: 'Categoría', value: 'Valor', length: 'Longitud', weight: 'Peso', temp: 'Temperatura', area: 'Área', volume: 'Volumen', speed: 'Velocidad', principal: 'Importe del préstamo', annualRate: 'Interés anual (%)', years: 'Años', monthly: 'Cuota mensual', totalPay: 'Total a pagar', interest: 'Intereses totales', d1: 'Fecha inicial / nacimiento', d2: 'Fecha final', diff: 'Diferencia', yrs: 'años', mos: 'meses', dys: 'días', totalDays: 'Total de días', kg: 'Peso (kg)', cm: 'Altura (cm)', under: 'Bajo peso', normal: 'Normal', over: 'Sobrepeso', obese: 'Obesidad', number: 'Número', invalid: 'No válido', privacy: 'Política de privacidad', loading: 'Cargando…', failed: 'Error al actualizar', today: 'Hoy', base: 'Base' },
    pt: { calc: 'Calculadora', tva: 'IVA', disc: 'Desconto', split: 'Dividir conta', cur: 'Moedas', unit: 'Unidades', loan: 'Empréstimo', date: 'Datas', bmi: 'IMC', prog: 'Bases', hist: 'Histórico', sett: 'Definições', lang: 'Idioma', theme: 'Tema', auto: 'Auto', light: 'Claro', dark: 'Escuro', vib: 'Vibração', copy: 'Copiar', copied: 'Copiado ✓', noHist: 'Sem histórico', clearHist: 'Limpar histórico', amount: 'Valor', rate: 'Taxa (%)', toTTC: 'Sem IVA → Com IVA', toHT: 'Com IVA → Sem IVA', ht: 'Sem IVA', vat: 'IVA', ttc: 'Com IVA', price: 'Preço', discPct: 'Desconto (%)', finalPrice: 'Preço final', saved: 'Você economiza', bill: 'Valor da conta', tipPct: 'Gorjeta (%)', people: 'Pessoas', perPerson: 'Por pessoa', tip: 'Gorjeta', total: 'Total', from: 'De', to: 'Para', update: 'Atualizar taxas', updated: 'Atualizado', approx: 'Taxas aproximadas (offline)', category: 'Categoria', value: 'Valor', length: 'Comprimento', weight: 'Peso', temp: 'Temperatura', area: 'Área', volume: 'Volume', speed: 'Velocidade', principal: 'Valor do empréstimo', annualRate: 'Juros anuais (%)', years: 'Anos', monthly: 'Parcela mensal', totalPay: 'Total a pagar', interest: 'Juros totais', d1: 'Data inicial / nascimento', d2: 'Data final', diff: 'Diferença', yrs: 'anos', mos: 'meses', dys: 'dias', totalDays: 'Total de dias', kg: 'Peso (kg)', cm: 'Altura (cm)', under: 'Abaixo do peso', normal: 'Normal', over: 'Sobrepeso', obese: 'Obesidade', number: 'Número', invalid: 'Inválido', privacy: 'Política de privacidade', loading: 'Carregando…', failed: 'Falha na atualização', today: 'Hoje', base: 'Base' },
    de: { calc: 'Rechner', tva: 'MwSt.', disc: 'Rabatt', split: 'Rechnung teilen', cur: 'Währung', unit: 'Einheiten', loan: 'Kredit', date: 'Datum', bmi: 'BMI', prog: 'Zahlensysteme', hist: 'Verlauf', sett: 'Einstellungen', lang: 'Sprache', theme: 'Design', auto: 'Auto', light: 'Hell', dark: 'Dunkel', vib: 'Vibration', copy: 'Kopieren', copied: 'Kopiert ✓', noHist: 'Kein Verlauf', clearHist: 'Verlauf löschen', amount: 'Betrag', rate: 'Satz (%)', toTTC: 'Netto → Brutto', toHT: 'Brutto → Netto', ht: 'Netto', vat: 'MwSt.', ttc: 'Brutto', price: 'Preis', discPct: 'Rabatt (%)', finalPrice: 'Endpreis', saved: 'Ersparnis', bill: 'Rechnungsbetrag', tipPct: 'Trinkgeld (%)', people: 'Personen', perPerson: 'Pro Person', tip: 'Trinkgeld', total: 'Gesamt', from: 'Von', to: 'Nach', update: 'Kurse aktualisieren', updated: 'Aktualisiert', approx: 'Ungefähre Kurse (offline)', category: 'Kategorie', value: 'Wert', length: 'Länge', weight: 'Gewicht', temp: 'Temperatur', area: 'Fläche', volume: 'Volumen', speed: 'Geschwindigkeit', principal: 'Kreditbetrag', annualRate: 'Jahreszins (%)', years: 'Jahre', monthly: 'Monatsrate', totalPay: 'Gesamtbetrag', interest: 'Zinsen gesamt', d1: 'Startdatum / Geburtsdatum', d2: 'Enddatum', diff: 'Differenz', yrs: 'Jahre', mos: 'Monate', dys: 'Tage', totalDays: 'Tage gesamt', kg: 'Gewicht (kg)', cm: 'Größe (cm)', under: 'Untergewicht', normal: 'Normal', over: 'Übergewicht', obese: 'Adipositas', number: 'Zahl', invalid: 'Ungültig', privacy: 'Datenschutz', loading: 'Lädt…', failed: 'Aktualisierung fehlgeschlagen', today: 'Heute', base: 'Basis' },
    ru: { calc: 'Калькулятор', tva: 'НДС', disc: 'Скидка', split: 'Разделить счёт', cur: 'Валюта', unit: 'Единицы', loan: 'Кредит', date: 'Даты', bmi: 'ИМТ', prog: 'Системы счисления', hist: 'История', sett: 'Настройки', lang: 'Язык', theme: 'Тема', auto: 'Авто', light: 'Светлая', dark: 'Тёмная', vib: 'Вибрация', copy: 'Копировать', copied: 'Скопировано ✓', noHist: 'История пуста', clearHist: 'Очистить историю', amount: 'Сумма', rate: 'Ставка (%)', toTTC: 'Без НДС → С НДС', toHT: 'С НДС → Без НДС', ht: 'Без НДС', vat: 'НДС', ttc: 'С НДС', price: 'Цена', discPct: 'Скидка (%)', finalPrice: 'Итоговая цена', saved: 'Экономия', bill: 'Сумма счёта', tipPct: 'Чаевые (%)', people: 'Человек', perPerson: 'На человека', tip: 'Чаевые', total: 'Итого', from: 'Из', to: 'В', update: 'Обновить курсы', updated: 'Обновлено', approx: 'Примерные курсы (офлайн)', category: 'Категория', value: 'Значение', length: 'Длина', weight: 'Вес', temp: 'Температура', area: 'Площадь', volume: 'Объём', speed: 'Скорость', principal: 'Сумма кредита', annualRate: 'Годовая ставка (%)', years: 'Лет', monthly: 'Ежемесячный платёж', totalPay: 'Всего к оплате', interest: 'Всего процентов', d1: 'Начальная дата / дата рождения', d2: 'Конечная дата', diff: 'Разница', yrs: 'лет', mos: 'мес.', dys: 'дн.', totalDays: 'Всего дней', kg: 'Вес (кг)', cm: 'Рост (см)', under: 'Недостаточный вес', normal: 'Норма', over: 'Избыточный вес', obese: 'Ожирение', number: 'Число', invalid: 'Неверно', privacy: 'Политика конфиденциальности', loading: 'Загрузка…', failed: 'Не удалось обновить', today: 'Сегодня', base: 'Система' },
    tr: { calc: 'Hesap Makinesi', tva: 'KDV', disc: 'İndirim', split: 'Hesap bölüş', cur: 'Döviz', unit: 'Birimler', loan: 'Kredi', date: 'Tarihler', bmi: 'VKİ', prog: 'Sayı tabanları', hist: 'Geçmiş', sett: 'Ayarlar', lang: 'Dil', theme: 'Tema', auto: 'Otomatik', light: 'Açık', dark: 'Koyu', vib: 'Titreşim', copy: 'Kopyala', copied: 'Kopyalandı ✓', noHist: 'Geçmiş yok', clearHist: 'Geçmişi sil', amount: 'Tutar', rate: 'Oran (%)', toTTC: 'KDV hariç → KDV dahil', toHT: 'KDV dahil → KDV hariç', ht: 'KDV hariç', vat: 'KDV', ttc: 'KDV dahil', price: 'Fiyat', discPct: 'İndirim (%)', finalPrice: 'Son fiyat', saved: 'Tasarruf', bill: 'Hesap tutarı', tipPct: 'Bahşiş (%)', people: 'Kişi', perPerson: 'Kişi başı', tip: 'Bahşiş', total: 'Toplam', from: 'Kaynak', to: 'Hedef', update: 'Kurları güncelle', updated: 'Güncellendi', approx: 'Yaklaşık kurlar (çevrimdışı)', category: 'Kategori', value: 'Değer', length: 'Uzunluk', weight: 'Ağırlık', temp: 'Sıcaklık', area: 'Alan', volume: 'Hacim', speed: 'Hız', principal: 'Kredi tutarı', annualRate: 'Yıllık faiz (%)', years: 'Yıl', monthly: 'Aylık taksit', totalPay: 'Toplam ödeme', interest: 'Toplam faiz', d1: 'Başlangıç / doğum tarihi', d2: 'Bitiş tarihi', diff: 'Fark', yrs: 'yıl', mos: 'ay', dys: 'gün', totalDays: 'Toplam gün', kg: 'Kilo (kg)', cm: 'Boy (cm)', under: 'Zayıf', normal: 'Normal', over: 'Fazla kilolu', obese: 'Obez', number: 'Sayı', invalid: 'Geçersiz', privacy: 'Gizlilik politikası', loading: 'Yükleniyor…', failed: 'Güncelleme başarısız', today: 'Bugün', base: 'Taban' },
    zh: { calc: '计算器', tva: '增值税', disc: '折扣', split: '分摊账单', cur: '汇率', unit: '单位', loan: '贷款', date: '日期', bmi: 'BMI', prog: '进制', hist: '历史', sett: '设置', lang: '语言', theme: '主题', auto: '自动', light: '浅色', dark: '深色', vib: '振动', copy: '复制', copied: '已复制 ✓', noHist: '暂无历史', clearHist: '清除历史', amount: '金额', rate: '税率 (%)', toTTC: '不含税 → 含税', toHT: '含税 → 不含税', ht: '不含税', vat: '税额', ttc: '含税', price: '价格', discPct: '折扣 (%)', finalPrice: '最终价格', saved: '节省', bill: '账单金额', tipPct: '小费 (%)', people: '人数', perPerson: '每人', tip: '小费', total: '总计', from: '从', to: '到', update: '更新汇率', updated: '更新于', approx: '大致汇率（离线）', category: '类别', value: '数值', length: '长度', weight: '重量', temp: '温度', area: '面积', volume: '体积', speed: '速度', principal: '贷款金额', annualRate: '年利率 (%)', years: '年数', monthly: '月供', totalPay: '还款总额', interest: '利息总额', d1: '开始 / 出生日期', d2: '结束日期', diff: '相差', yrs: '年', mos: '个月', dys: '天', totalDays: '总天数', kg: '体重 (kg)', cm: '身高 (cm)', under: '偏瘦', normal: '正常', over: '超重', obese: '肥胖', number: '数字', invalid: '无效', privacy: '隐私政策', loading: '加载中…', failed: '更新失败', today: '今天', base: '进制' },
    hi: { calc: 'कैलकुलेटर', tva: 'जीएसटी/वैट', disc: 'छूट', split: 'बिल बाँटें', cur: 'मुद्रा', unit: 'इकाइयाँ', loan: 'ऋण', date: 'तारीखें', bmi: 'बीएमआई', prog: 'संख्या पद्धति', hist: 'इतिहास', sett: 'सेटिंग्स', lang: 'भाषा', theme: 'थीम', auto: 'ऑटो', light: 'लाइट', dark: 'डार्क', vib: 'कंपन', copy: 'कॉपी', copied: 'कॉपी हो गया ✓', noHist: 'कोई इतिहास नहीं', clearHist: 'इतिहास मिटाएँ', amount: 'राशि', rate: 'दर (%)', toTTC: 'कर रहित → कर सहित', toHT: 'कर सहित → कर रहित', ht: 'कर रहित', vat: 'कर', ttc: 'कर सहित', price: 'कीमत', discPct: 'छूट (%)', finalPrice: 'अंतिम कीमत', saved: 'बचत', bill: 'बिल राशि', tipPct: 'टिप (%)', people: 'लोग', perPerson: 'प्रति व्यक्ति', tip: 'टिप', total: 'कुल', from: 'से', to: 'में', update: 'दरें अपडेट करें', updated: 'अपडेट किया', approx: 'अनुमानित दरें (ऑफ़लाइन)', category: 'श्रेणी', value: 'मान', length: 'लंबाई', weight: 'वज़न', temp: 'तापमान', area: 'क्षेत्रफल', volume: 'आयतन', speed: 'गति', principal: 'ऋण राशि', annualRate: 'वार्षिक ब्याज (%)', years: 'वर्ष', monthly: 'मासिक किस्त', totalPay: 'कुल भुगतान', interest: 'कुल ब्याज', d1: 'प्रारंभ / जन्म तिथि', d2: 'अंतिम तिथि', diff: 'अंतर', yrs: 'वर्ष', mos: 'महीने', dys: 'दिन', totalDays: 'कुल दिन', kg: 'वज़न (किग्रा)', cm: 'कद (सेमी)', under: 'कम वज़न', normal: 'सामान्य', over: 'अधिक वज़न', obese: 'मोटापा', number: 'संख्या', invalid: 'अमान्य', privacy: 'गोपनीयता नीति', loading: 'लोड हो रहा है…', failed: 'अपडेट विफल', today: 'आज', base: 'पद्धति' }
  };

  function detectLang() {
    const l = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return I18N[l] ? l : 'en';
  }

  const S = {
    lang: store.get('lang', null) || detectLang(),
    theme: store.get('theme', 'auto'),
    vib: store.get('vib', true),
    deg: store.get('deg', true),
    sci: store.get('sci', false),
    screen: store.get('screen', 'calc')
  };
  const t = (k) => (I18N[S.lang] && I18N[S.lang][k]) || I18N.en[k] || k;

  /* ---------------- helpers ---------------- */
  const loc = () => LOC[S.lang] || 'en-US';
  const money = (v) => isFinite(v) ? new Intl.NumberFormat(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) : '—';
  const nf = (v, d = 6) => isFinite(v) ? new Intl.NumberFormat(loc(), { maximumFractionDigits: d }).format(v) : '—';
  const num = (id) => { const e = $('#' + id); const v = e ? parseFloat(e.value) : NaN; return isFinite(v) ? v : NaN; };
  const row = (label, val, cls = '') => `<div class="orow ${cls}"><span>${label}</span><b data-copy="${String(val).replace(/"/g, '')}">${val}</b></div>`;
  const field = (id, label, attrs = '') => `<label class="f"><span>${label}</span><input id="${id}" type="number" inputmode="decimal" step="any" ${attrs}></label>`;
  const vibrate = () => { if (S.vib && navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { /* ignore */ } } };

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1300);
  }
  function copyText(txt) {
    const done = () => toast(t('copied'));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done));
    } else fallbackCopy(txt, done);
  }
  function fallbackCopy(txt, cb) {
    const ta = document.createElement('textarea');
    ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); cb(); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  /* ============================ CALCULATOR ============================ */
  const CALC = { expr: '', prev: '', done: false, resText: '', mem: store.get('mem', 0) };
  const OPS = ['+', '−', '×', '÷'];

  function tryEval(s) {
    if (!s) return null;
    s = s.replace(/[+−×÷^]+$/, '');
    if (!s) return null;
    const open = (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
    if (open > 0) s += ')'.repeat(open);
    try { const v = evaluate(s, S.deg); return isFinite(v) ? v : null; } catch (e) { return null; }
  }

  function calcHTML() {
    const k = (l, v, c = '') => `<button class="k ${c}" data-k="${v}">${l}</button>`;
    const sciKeys = [['sin', 'sin('], ['cos', 'cos('], ['tan', 'tan('], ['sin⁻¹', 'asin('], ['cos⁻¹', 'acos('], ['tan⁻¹', 'atan('], ['log', 'log('], ['ln', 'ln('], ['√', '√('], ['x²', '^2'], ['xʸ', '^'], ['x!', '!'], ['π', 'π'], ['e', 'e'], ['1/x', 'INV']];
    return `
      <div class="disp"><div id="expr" class="expr"></div><div id="res" class="res" title="${t('copy')}">0</div></div>
      <div class="tools">
        <button data-k="MC">MC</button><button data-k="MR">MR</button><button data-k="M+">M+</button><button data-k="M-">M−</button>
        <button data-k="SCI" class="${S.sci ? 'on' : ''}">f(x)</button><button data-k="DEG" class="${S.deg ? '' : 'on'}">${S.deg ? 'DEG' : 'RAD'}</button>
      </div>
      <div class="sci" id="sci" ${S.sci ? '' : 'hidden'}>${sciKeys.map(([l, v]) => k(l, v, 'sm')).join('')}</div>
      <div class="pad">
        ${k('AC', 'AC', 'fn')}${k('( )', 'PAREN', 'fn')}${k('%', '%', 'fn')}${k('÷', '÷', 'op')}
        ${k('7', '7')}${k('8', '8')}${k('9', '9')}${k('×', '×', 'op')}
        ${k('4', '4')}${k('5', '5')}${k('6', '6')}${k('−', '−', 'op')}
        ${k('1', '1')}${k('2', '2')}${k('3', '3')}${k('+', '+', 'op')}
        ${k('0', '0')}${k('.', '.')}${k('⌫', 'DEL', 'fn')}${k('=', '=', 'eq')}
      </div>`;
  }

  function calcUpdate() {
    const E = CALC;
    const exprEl = $('#expr'), resEl = $('#res');
    if (!exprEl) return;
    if (E.done) {
      exprEl.textContent = E.prev + ' =';
      resEl.textContent = E.resText;
    } else {
      const plain = /^[0-9.]*$/.test(E.expr);
      exprEl.textContent = plain ? '' : E.expr;
      const v = tryEval(E.expr);
      resEl.textContent = v !== null ? fmtNum(v) : (E.expr || '0');
      if (plain && E.expr) resEl.textContent = E.expr;
    }
    exprEl.scrollLeft = exprEl.scrollWidth;
    const mr = $('[data-k="MR"]'), mc = $('[data-k="MC"]');
    if (mr) { mr.classList.toggle('on', CALC.mem !== 0); mc.classList.toggle('on', CALC.mem !== 0); }
  }

  function pushHistory(e, r) {
    const h = store.get('hist', []);
    if (h.length && h[0].e === e && h[0].r === r) return;
    h.unshift({ e, r });
    store.set('hist', h.slice(0, 50));
  }

  function press(v) {
    const E = CALC;
    vibrate();
    const isDigit = /^[0-9.]$/.test(v);
    const isStart = /^(asin|acos|atan|sin|cos|tan|log|ln|√)\($|^[π(]$|^e$/.test(v);
    if (v === 'AC') { E.expr = ''; E.done = false; return calcUpdate(); }
    if (v === 'DEL') {
      E.done = false;
      E.expr = E.expr.replace(/(asin\(|acos\(|atan\(|sin\(|cos\(|tan\(|log\(|ln\(|√\(|[\s\S])$/, '');
      return calcUpdate();
    }
    if (v === '=') {
      const val = tryEval(E.expr);
      if (val === null || !E.expr) { if (E.expr) toast(t('invalid')); return; }
      const txt = fmtNum(val);
      pushHistory(E.expr, txt);
      E.prev = E.expr;
      E.resText = txt;
      E.expr = txt.replace(/e\+?(-?\d+)/, '×10^$1');
      E.done = true;
      return calcUpdate();
    }
    if (v === 'SCI') { S.sci = !S.sci; store.set('sci', S.sci); $('#sci').hidden = !S.sci; $('[data-k="SCI"]').classList.toggle('on', S.sci); return; }
    if (v === 'DEG') { S.deg = !S.deg; store.set('deg', S.deg); const b = $('[data-k="DEG"]'); b.textContent = S.deg ? 'DEG' : 'RAD'; b.classList.toggle('on', !S.deg); return calcUpdate(); }
    if (v === 'MC') { E.mem = 0; store.set('mem', 0); return calcUpdate(); }
    if (v === 'M+' || v === 'M-') {
      const val = tryEval(E.expr);
      if (val === null) return;
      E.mem = parseFloat((E.mem + (v === 'M+' ? val : -val)).toPrecision(12));
      store.set('mem', E.mem);
      toast('M = ' + fmtNum(E.mem));
      return calcUpdate();
    }
    if (v === 'MR') { return press('MEMINS'); }
    if (v === 'MEMINS') {
      if (E.mem === 0) return;
      if (E.done) { E.expr = ''; E.done = false; }
      const last = E.expr.slice(-1);
      if (/[0-9.)πe%!]/.test(last)) E.expr += '×';
      E.expr += fmtNum(E.mem).replace(/e\+?(-?\d+)/, '×10^$1');
      return calcUpdate();
    }
    if (v === 'INV') {
      if (!E.expr) return;
      E.done = false;
      E.expr = '1÷(' + E.expr + ')';
      return calcUpdate();
    }
    if (v === 'PAREN') {
      const open = (E.expr.match(/\(/g) || []).length - (E.expr.match(/\)/g) || []).length;
      const last = E.expr.slice(-1);
      v = (open > 0 && /[0-9.)πe%!]/.test(last)) ? ')' : '(';
    }
    if (E.done) {
      if (isDigit || isStart) E.expr = '';
      E.done = false;
    }
    const last = E.expr.slice(-1);
    if (v === '.') {
      const m = E.expr.match(/[0-9.]*$/)[0];
      if (m.includes('.')) return;
      if (!m) v = '0.';
    }
    if (OPS.includes(v)) {
      if (!E.expr) { if (v === '−') E.expr = '−'; return calcUpdate(); }
      if (E.expr === '−') return;
      if (OPS.includes(last)) E.expr = E.expr.slice(0, -1) + v;
      else if (last === '(' && v !== '−') return;
      else if (last === '^' && v !== '−') return;
      else E.expr += v;
      return calcUpdate();
    }
    if (v === '^' || v === '!' || v === '%' || v === '^2') {
      if (!E.expr || OPS.includes(last) || last === '(' || last === '^') return;
    }
    E.expr += v;
    calcUpdate();
  }

  function calcBind() {
    const main = $('#main');
    main.onclick = (e) => {
      const b = e.target.closest('[data-k]');
      if (b) return press(b.dataset.k);
      if (e.target.closest('#res')) copyText(CALC.done ? CALC.resText : ($('#res').textContent || ''));
    };
    calcUpdate();
  }

  document.addEventListener('keydown', (e) => {
    if (S.screen !== 'calc' || !$('#modal').hidden) return;
    const tg = e.target.tagName;
    if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (/^[0-9]$/.test(k)) press(k);
    else if (k === '.' || k === ',') press('.');
    else if (k === '+') press('+');
    else if (k === '-') press('−');
    else if (k === '*' || k === 'x' || k === 'X') press('×');
    else if (k === '/') { e.preventDefault(); press('÷'); }
    else if (k === '(' || k === ')') press(k);
    else if (k === '%' || k === '!' || k === '^') press(k);
    else if (k === 'Enter' || k === '=') { e.preventDefault(); press('='); }
    else if (k === 'Backspace') press('DEL');
    else if (k === 'Escape' || k === 'Delete') press('AC');
  });

  /* ============================ OTHER TOOLS ============================ */
  const SCR = {};

  /* ---- VAT ---- */
  SCR.tva = {
    html: () => `
      <div class="seg" id="tvaMode"><button data-m="ttc" class="on">${t('toTTC')}</button><button data-m="ht">${t('toHT')}</button></div>
      ${field('tvaAmt', t('amount'))}
      <div class="chips" id="tvaChips">${[20, 14, 10, 7].map(r => `<button data-r="${r}" class="${r === 20 ? 'on' : ''}">${r}%</button>`).join('')}</div>
      ${field('tvaRate', t('rate'), 'value="20"')}
      <div id="out" class="out"></div>`,
    bind() {
      let mode = 'ttc';
      const calc = () => {
        const a = num('tvaAmt'), r = num('tvaRate');
        if (isNaN(a) || isNaN(r)) { $('#out').innerHTML = ''; return; }
        let ht, ttc;
        if (mode === 'ttc') { ht = a; ttc = a * (1 + r / 100); } else { ttc = a; ht = a / (1 + r / 100); }
        $('#out').innerHTML = row(t('ht'), money(ht)) + row(t('vat') + ' (' + nf(r, 2) + '%)', money(ttc - ht)) + row(t('ttc'), money(ttc), 'big');
      };
      $('#tvaMode').onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; mode = b.dataset.m; [...$('#tvaMode').children].forEach(x => x.classList.toggle('on', x === b)); calc(); };
      $('#tvaChips').onclick = (e) => { const b = e.target.closest('[data-r]'); if (!b) return; $('#tvaRate').value = b.dataset.r; [...$('#tvaChips').children].forEach(x => x.classList.toggle('on', x === b)); calc(); };
      $('#main').oninput = (e) => {
        if (e.target.id === 'tvaRate') [...$('#tvaChips').children].forEach(x => x.classList.toggle('on', x.dataset.r === e.target.value));
        calc();
      };
    }
  };

  /* ---- Discount ---- */
  SCR.disc = {
    html: () => `${field('dcPrice', t('price'))}${field('dcPct', t('discPct'))}
      <div class="chips" id="dcChips">${[10, 20, 30, 50, 70].map(r => `<button data-r="${r}">${r}%</button>`).join('')}</div>
      <div id="out" class="out"></div>`,
    bind() {
      const calc = () => {
        const p = num('dcPrice'), d = num('dcPct');
        if (isNaN(p) || isNaN(d)) { $('#out').innerHTML = ''; return; }
        const fin = p * (1 - d / 100);
        $('#out').innerHTML = row(t('saved'), money(p - fin)) + row(t('finalPrice'), money(fin), 'big');
      };
      $('#dcChips').onclick = (e) => { const b = e.target.closest('[data-r]'); if (!b) return; $('#dcPct').value = b.dataset.r; calc(); };
      $('#main').oninput = calc;
    }
  };

  /* ---- Split bill ---- */
  SCR.split = {
    html: () => `${field('spBill', t('bill'))}${field('spTip', t('tipPct'), 'value="10"')}${field('spPeople', t('people'), 'value="2" min="1" step="1"')}
      <div id="out" class="out"></div>`,
    bind() {
      const calc = () => {
        const b = num('spBill'), tp = num('spTip'), n = Math.max(1, Math.round(num('spPeople')));
        if (isNaN(b) || isNaN(tp) || isNaN(n)) { $('#out').innerHTML = ''; return; }
        const tip = b * tp / 100, tot = b + tip;
        $('#out').innerHTML = row(t('tip'), money(tip)) + row(t('total'), money(tot)) + row(t('perPerson'), money(tot / n), 'big');
      };
      $('#main').oninput = calc;
    }
  };

  /* ---- Currency ---- */
  const CUR = ['MAD', 'EUR', 'USD', 'GBP', 'SAR', 'AED', 'CAD', 'CHF', 'TRY', 'CNY', 'JPY', 'RUB', 'INR', 'BRL', 'DZD', 'TND', 'EGP', 'QAR', 'KWD', 'AUD'];
  const FALLBACK = { USD: 1, EUR: 0.92, GBP: 0.79, MAD: 9.9, SAR: 3.75, AED: 3.6725, CAD: 1.37, CHF: 0.88, TRY: 34, CNY: 7.2, JPY: 150, RUB: 92, INR: 83, BRL: 5.5, DZD: 134, TND: 3.1, EGP: 48, QAR: 3.64, KWD: 0.307, AUD: 1.5 };
  const getRates = () => { const c = store.get('rates', null); return c && c.r ? c : { r: FALLBACK, t: 0 }; };
  async function fetchRates() {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 10000);
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: ctl.signal });
      const j = await res.json();
      if (j.result !== 'success' || !j.rates) throw new Error('bad');
      store.set('rates', { r: j.rates, t: Date.now() });
    } finally { clearTimeout(to); }
  }
  SCR.cur = {
    html: () => {
      const opts = (sel) => CUR.map(c => `<option ${c === sel ? 'selected' : ''}>${c}</option>`).join('');
      return `${field('cuAmt', t('amount'), 'value="100"')}
        <div class="two"><label class="f"><span>${t('from')}</span><select id="cuFrom">${opts(store.get('cuFrom', 'EUR'))}</select></label>
        <button id="cuSwap" class="sw" aria-label="swap">⇄</button>
        <label class="f"><span>${t('to')}</span><select id="cuTo">${opts(store.get('cuTo', 'MAD'))}</select></label></div>
        <div id="out" class="out"></div>
        <p class="note" id="cuNote"></p>
        <button id="cuUpd" class="btn">${t('update')}</button>`;
    },
    bind() {
      const calc = () => {
        const a = num('cuAmt'), f = $('#cuFrom').value, to = $('#cuTo').value;
        store.set('cuFrom', f); store.set('cuTo', to);
        const R = getRates().r;
        if (isNaN(a) || !R[f] || !R[to]) { $('#out').innerHTML = ''; return; }
        const v = a / R[f] * R[to];
        $('#out').innerHTML = row(f + ' → ' + to, nf(v, 4), 'big') + row('1 ' + f, nf(R[to] / R[f], 4) + ' ' + to);
      };
      const note = () => { const c = getRates(); $('#cuNote').textContent = c.t ? t('updated') + ': ' + new Date(c.t).toLocaleString(loc()) : t('approx'); };
      const upd = async () => {
        $('#cuNote').textContent = t('loading');
        try { await fetchRates(); } catch (e) { toast(t('failed')); }
        note(); calc();
      };
      $('#main').oninput = calc;
      $('#cuSwap').onclick = () => { const f = $('#cuFrom'), to = $('#cuTo'); const x = f.value; f.value = to.value; to.value = x; calc(); };
      $('#cuUpd').onclick = upd;
      note(); calc();
      const c = getRates();
      if (navigator.onLine && (!c.t || Date.now() - c.t > 6 * 3600 * 1000)) upd();
    }
  };

  /* ---- Units ---- */
  const UNITS = {
    length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254 },
    weight: { kg: 1, g: 0.001, mg: 1e-6, t: 1000, lb: 0.45359237, oz: 0.028349523125 },
    area: { 'm²': 1, 'km²': 1e6, ha: 1e4, 'ft²': 0.09290304, ac: 4046.8564224 },
    volume: { L: 1, mL: 0.001, 'm³': 1000, gal: 3.785411784, cup: 0.2365882365 },
    speed: { 'm/s': 1, 'km/h': 1 / 3.6, mph: 0.44704, kn: 0.514444444 },
    temp: { '°C': 0, '°F': 0, K: 0 }
  };
  function convUnit(cat, v, f, to) {
    if (cat === 'temp') {
      const c = f === '°C' ? v : f === '°F' ? (v - 32) * 5 / 9 : v - 273.15;
      return to === '°C' ? c : to === '°F' ? c * 9 / 5 + 32 : c + 273.15;
    }
    return v * UNITS[cat][f] / UNITS[cat][to];
  }
  SCR.unit = {
    html: () => `<label class="f"><span>${t('category')}</span><select id="unCat">${Object.keys(UNITS).map(c => `<option value="${c}">${t(c)}</option>`).join('')}</select></label>
      ${field('unVal', t('value'), 'value="1"')}
      <div class="two"><label class="f"><span>${t('from')}</span><select id="unFrom"></select></label>
      <button id="unSwap" class="sw" aria-label="swap">⇄</button>
      <label class="f"><span>${t('to')}</span><select id="unTo"></select></label></div>
      <div id="out" class="out"></div>`,
    bind() {
      const fill = () => {
        const keys = Object.keys(UNITS[$('#unCat').value]);
        const o = keys.map(k => `<option>${k}</option>`).join('');
        $('#unFrom').innerHTML = o; $('#unTo').innerHTML = o;
        $('#unTo').value = keys[1] || keys[0];
      };
      const calc = () => {
        const v = num('unVal');
        if (isNaN(v)) { $('#out').innerHTML = ''; return; }
        const r = convUnit($('#unCat').value, v, $('#unFrom').value, $('#unTo').value);
        $('#out').innerHTML = row($('#unFrom').value + ' → ' + $('#unTo').value, nf(r, 8), 'big');
      };
      $('#unCat').onchange = () => { fill(); calc(); };
      $('#unSwap').onclick = () => { const f = $('#unFrom'), to = $('#unTo'); const x = f.value; f.value = to.value; to.value = x; calc(); };
      $('#main').oninput = calc;
      fill(); calc();
    }
  };

  /* ---- Loan ---- */
  SCR.loan = {
    html: () => `${field('lnP', t('principal'))}${field('lnR', t('annualRate'))}${field('lnY', t('years'))}<div id="out" class="out"></div>`,
    bind() {
      const calc = () => {
        const P = num('lnP'), R = num('lnR'), Y = num('lnY');
        if (isNaN(P) || isNaN(R) || isNaN(Y) || P <= 0 || Y <= 0) { $('#out').innerHTML = ''; return; }
        const n = Math.round(Y * 12), r = R / 1200;
        const m = r === 0 ? P / n : P * r / (1 - Math.pow(1 + r, -n));
        $('#out').innerHTML = row(t('monthly'), money(m), 'big') + row(t('totalPay'), money(m * n)) + row(t('interest'), money(m * n - P));
      };
      $('#main').oninput = calc;
    }
  };

  /* ---- Dates ---- */
  function ymdDiff(a, b) {
    let y = b.getFullYear() - a.getFullYear(), m = b.getMonth() - a.getMonth(), d = b.getDate() - a.getDate();
    if (d < 0) { m--; d += new Date(b.getFullYear(), b.getMonth(), 0).getDate(); }
    if (m < 0) { y--; m += 12; }
    return { y, m, d };
  }
  SCR.date = {
    html: () => {
      const n = new Date();
      const iso = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
      return `<label class="f"><span>${t('d1')}</span><input id="dt1" type="date"></label>
        <label class="f"><span>${t('d2')}</span><input id="dt2" type="date" value="${iso}"></label>
        <div id="out" class="out"></div>`;
    },
    bind() {
      const parse = (id) => { const v = $('#' + id).value; if (!v) return null; const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d); };
      const calc = () => {
        let a = parse('dt1'), b = parse('dt2');
        if (!a || !b) { $('#out').innerHTML = ''; return; }
        if (a > b) { const x = a; a = b; b = x; }
        const r = ymdDiff(a, b);
        const days = Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5);
        $('#out').innerHTML = row(t('diff'), `${r.y} ${t('yrs')} ${r.m} ${t('mos')} ${r.d} ${t('dys')}`, 'big') + row(t('totalDays'), nf(days, 0));
      };
      $('#main').oninput = calc;
      $('#main').onchange = calc;
    }
  };

  /* ---- BMI ---- */
  SCR.bmi = {
    html: () => `${field('bmW', t('kg'))}${field('bmH', t('cm'))}<div id="out" class="out"></div>`,
    bind() {
      const calc = () => {
        const w = num('bmW'), h = num('bmH');
        if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) { $('#out').innerHTML = ''; return; }
        const b = w / Math.pow(h / 100, 2);
        const [lbl, cls] = b < 18.5 ? [t('under'), 'warn'] : b < 25 ? [t('normal'), 'good'] : b < 30 ? [t('over'), 'warn'] : [t('obese'), 'bad'];
        $('#out').innerHTML = row('BMI', nf(b, 1), 'big') + `<div class="pill ${cls}">${lbl}</div>`;
      };
      $('#main').oninput = calc;
    }
  };

  /* ---- Number bases ---- */
  SCR.prog = {
    html: () => `<label class="f"><span>${t('number')}</span><input id="pgIn" type="text" inputmode="text" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
      <label class="f"><span>${t('base')}</span><select id="pgBase"><option value="10">DEC (10)</option><option value="2">BIN (2)</option><option value="8">OCT (8)</option><option value="16">HEX (16)</option></select></label>
      <div id="out" class="out"></div>`,
    bind() {
      const go = () => {
        const s = $('#pgIn').value.trim().replace(/\s+/g, '');
        const b = +$('#pgBase').value;
        if (!s) { $('#out').innerHTML = ''; return; }
        const re = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^\d+$/, 16: /^[0-9a-fA-F]+$/ }[b];
        if (!re.test(s)) { $('#out').innerHTML = `<div class="orow err">${t('invalid')}</div>`; return; }
        const n = b === 10 ? BigInt(s) : BigInt((b === 16 ? '0x' : b === 8 ? '0o' : '0b') + s);
        $('#out').innerHTML = [['DEC', n.toString(10)], ['BIN', n.toString(2)], ['OCT', n.toString(8)], ['HEX', n.toString(16).toUpperCase()]]
          .map(([l, v]) => `<div class="orow"><span>${l}</span><b class="mono" data-copy="${v}">${v}</b></div>`).join('');
      };
      $('#main').oninput = go;
      $('#pgBase').onchange = go;
    }
  };

  SCR.calc = { html: calcHTML, bind: calcBind };

  /* ============================ SHELL ============================ */
  const ORDER = ['calc', 'tva', 'disc', 'split', 'cur', 'unit', 'loan', 'date', 'bmi', 'prog'];
  const ICON = { calc: '🧮', tva: '🧾', disc: '🏷️', split: '🍽️', cur: '💱', unit: '📏', loan: '🏦', date: '📅', bmi: '⚖️', prog: '💻' };

  function applyTheme() {
    const d = document.documentElement;
    if (S.theme === 'auto') d.removeAttribute('data-theme'); else d.setAttribute('data-theme', S.theme);
    const dark = S.theme === 'dark' || (S.theme === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', dark ? '#0f1115' : '#f4f5f7');
  }

  function renderNav() {
    $('#nav').innerHTML = ORDER.map(id => `<button data-s="${id}" class="${id === S.screen ? 'on' : ''}"><i>${ICON[id]}</i><span>${t(id)}</span></button>`).join('');
    const on = $('#nav .on');
    if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  function render() {
    document.documentElement.lang = S.lang;
    document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
    applyTheme();
    if (!SCR[S.screen]) S.screen = 'calc';
    const main = $('#main');
    main.onclick = null; main.oninput = null; main.onchange = null;
    $('#title').textContent = t(S.screen);
    $('#histBtn').setAttribute('aria-label', t('hist'));
    $('#settBtn').setAttribute('aria-label', t('sett'));
    main.innerHTML = SCR[S.screen].html();
    main.scrollTop = 0;
    SCR[S.screen].bind();
    renderNav();
  }

  function openModal(title, html, bind) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = html;
    $('#modal').hidden = false;
    if (bind) bind();
  }
  function closeModal() { $('#modal').hidden = true; }

  function openHistory() {
    const h = store.get('hist', []);
    const body = h.length
      ? h.map((x, i) => `<div class="h" data-i="${i}"><div><small>${x.e}</small><b>${x.r}</b></div><button data-cp="${i}" aria-label="${t('copy')}">⧉</button></div>`).join('') + `<button class="btn dng" id="hClr">${t('clearHist')}</button>`
      : `<p class="note">${t('noHist')}</p>`;
    openModal(t('hist'), body, () => {
      $('#modalBody').onclick = (e) => {
        const cp = e.target.closest('[data-cp]');
        if (cp) return copyText(h[+cp.dataset.cp].r);
        const it = e.target.closest('[data-i]');
        if (it) {
          const x = h[+it.dataset.i];
          CALC.expr = x.e; CALC.done = false;
          closeModal();
          if (S.screen !== 'calc') { S.screen = 'calc'; store.set('screen', 'calc'); render(); } else calcUpdate();
          return;
        }
        if (e.target.id === 'hClr') { store.set('hist', []); openHistory(); }
      };
    });
  }

  function openSettings() {
    const body = `
      <label class="f"><span>${t('lang')}</span><select id="stLang">${Object.keys(LANGS).map(k => `<option value="${k}" ${k === S.lang ? 'selected' : ''}>${LANGS[k]}</option>`).join('')}</select></label>
      <label class="f"><span>${t('theme')}</span><select id="stTheme">${['auto', 'light', 'dark'].map(k => `<option value="${k}" ${k === S.theme ? 'selected' : ''}>${t(k)}</option>`).join('')}</select></label>
      <label class="chk"><input id="stVib" type="checkbox" ${S.vib ? 'checked' : ''}><span>${t('vib')}</span></label>
      <p class="note"><a href="privacy.html" target="_blank" rel="noopener">${t('privacy')}</a></p>`;
    openModal(t('sett'), body, () => {
      $('#stLang').onchange = (e) => { S.lang = e.target.value; store.set('lang', S.lang); render(); openSettings(); };
      $('#stTheme').onchange = (e) => { S.theme = e.target.value; store.set('theme', S.theme); applyTheme(); };
      $('#stVib').onchange = (e) => { S.vib = e.target.checked; store.set('vib', S.vib); vibrate(); };
    });
  }

  function init() {
    $('#nav').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; S.screen = b.dataset.s; store.set('screen', S.screen); render(); };
    $('#histBtn').onclick = openHistory;
    $('#settBtn').onclick = openSettings;
    $('#modalClose').onclick = closeModal;
    $('#modal').onclick = (e) => { if (e.target.id === 'modal') closeModal(); };
    $('#main').addEventListener('click', (e) => {
      const c = e.target.closest('[data-copy]');
      if (c) copyText(c.dataset.copy);
    });
    if (window.matchMedia) {
      try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme); } catch (e) { /* ignore */ }
    }
    render();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* ignore */ });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
