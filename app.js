'use strict';
/* =====================================================================
   CalcPlus - calculator + tools (VAT, discount, split bill, currency,
   units, loan, dates, BMI, bases, percentages, margin, price compare,
   trip cost, savings, work hours, gold, Hijri, zakat). 10 languages. No dependencies.
   ===================================================================== */

/* ============================ ENGINE ============================ */
function tokenize(s) {
  const re = /\s*(\d+\.?\d*|\.\d+|(?:asinh|acosh|atanh|asin|acos|atan|sinh|cosh|tanh|sin|cos|tan|log2|log|ln|cbrt|abs|floor|ceil|round|exp10|exp2|exp)\(|√\(|nCr|nPr|mod|gcd|lcm|ANS|π|e|[+\-−×÷*\/^()%!])/y;
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
    else if (x === 'π' || x === 'e' || x === 'ANS') out.push({ t: 'c', v: x });
    else if (x === 'nCr' || x === 'nPr' || x === 'mod' || x === 'gcd' || x === 'lcm') out.push({ t: 'o', v: x });
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

const BINOPS = ['nCr', 'nPr', 'mod', 'gcd', 'lcm'];
function binop(op, a, b) {
  const isInt = (x) => Number.isInteger(x);
  switch (op) {
    case 'mod':
      if (b === 0) throw new Error('mod');
      return ((a % b) + b) % b;
    case 'nCr': case 'nPr': {
      if (!isInt(a) || !isInt(b) || a < 0 || b < 0 || b > a || a > 1000) throw new Error('comb');
      let r = 1;
      for (let i = 0; i < b; i++) r = op === 'nPr' ? r * (a - i) : r * (a - i) / (i + 1);
      return Math.round(r) === r || op === 'nPr' ? r : Math.round(r);
    }
    case 'gcd': case 'lcm': {
      if (!isInt(a) || !isInt(b)) throw new Error('int');
      let x = Math.abs(a), y = Math.abs(b);
      while (y) { const t = y; y = x % y; x = t; }
      return op === 'gcd' ? x : (x === 0 ? 0 : Math.abs(a * b) / x);
    }
    default: throw new Error('op');
  }
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
    case 'sinh': r = Math.sinh(a); break;
    case 'cosh': r = Math.cosh(a); break;
    case 'tanh': r = Math.tanh(a); break;
    case 'asinh': r = Math.asinh(a); break;
    case 'acosh': r = Math.acosh(a); break;
    case 'atanh': r = Math.atanh(a); break;
    case 'cbrt': r = Math.cbrt(a); break;
    case 'abs': r = Math.abs(a); break;
    case 'log2': r = Math.log2(a); break;
    case 'floor': r = Math.floor(a); break;
    case 'ceil': r = Math.ceil(a); break;
    case 'round': r = Math.round(a); break;
    case 'exp': r = Math.exp(a); break;
    case 'exp10': r = Math.pow(10, a); break;
    case 'exp2': r = Math.pow(2, a); break;
    default: throw new Error('fn');
  }
  if (!isFinite(r)) throw new Error('math');
  return Math.abs(r) < 1e-12 ? 0 : r;
}

function evaluate(str, deg, ans) {
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
      } else if (t.t === 'o' && BINOPS.includes(t.v)) {
        i++;
        const r = unary();
        l = { v: binop(t.v, l.v, r.v) };
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
    if (t.t === 'c') return t.v === 'π' ? Math.PI : t.v === 'ANS' ? (typeof ans === 'number' ? ans : 0) : Math.E;
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

  /* ---- extra translations (new tools) ---- */
  const X = {
    en: { accent: 'Accent color', share: 'Share', fav: '★ Favorites', tools: 'Tools', search: 'Search', back: 'Back', pct: 'Percentages', marg: 'Profit margin', cmp: 'Compare prices', trip: 'Trip cost', comp: 'Savings growth', hrs: 'Work hours', gold: 'Gold', hij: 'Hijri date', zakat: 'Zakat', country: 'Country', custom: 'Custom', vatNote: 'Standard national rates; they can change and regional taxes may apply. Check with your tax authority.', pctOf: 'X% of Y', whatPct: 'A is what % of B', pchange: '% change', addSub: 'Add / subtract %', percent: 'Percent (%)', ofValue: 'Of value', ofTotal: 'Of total', result: 'Result', plusPct: 'Increased', minusPct: 'Decreased', cost: 'Cost price', sellPrice: 'Selling price', profit: 'Profit', margin: 'Margin (of selling price)', markup: 'Markup (on cost)', targetMargin: 'Target margin (%)', modePrices: 'From prices', modeTarget: 'Target margin', prodA: 'Product A', prodB: 'Product B', qty: 'Quantity', cheaper: 'Better deal', perUnit: 'Price per unit', savingPct: 'Saving', same: 'Same price', distance: 'Distance', consumption: 'Consumption', fuelPrice: 'Fuel price', fuelNeeded: 'Fuel needed', tripCost: 'Trip cost', metricSys: 'Metric (km, L)', impSys: 'US (mi, gal)', initial: 'Starting amount', monthlyAdd: 'Monthly deposit', finalBal: 'Final balance', contributed: 'Total deposited', earned: 'Interest earned', startT: 'Start time', endT: 'End time', breakMin: 'Break (minutes)', hourlyRate: 'Hourly rate', hoursWorked: 'Hours worked', decimalH: 'Decimal hours', pay: 'Pay', karat: 'Karat', goldPrice: 'Gold price (24K)', perGram: 'per gram', perOz: 'per troy ounce', pureGold: 'Pure gold (g)', goldValue: 'Value', g2h: 'Gregorian → Hijri', h2g: 'Hijri → Gregorian', hijDate: 'Hijri date', gregDate: 'Gregorian date', day: 'Day', month: 'Month', year: 'Year', hijNote: 'Umm al-Qura calendar. Local moon sighting can differ by a day.', zWealth: 'Cash, savings, gold & trade goods', zDebts: 'Debts due now', zGoldG: 'Gold price per gram (24K)', zNisab: 'Nisab (85 g of gold)', zDue: 'Zakat due (2.5%)', zBelow: 'Below nisab: no zakat due', zNote: 'Estimate only. Rules differ between schools; ask a scholar.', ratesBy: 'Rates by Exchange Rate API', fiat: 'Currencies', metals: 'Precious metals', crypto: 'Crypto', assetNote: 'Metals are priced per troy ounce. Crypto prices change every second; indicative only.' },
    fr: { accent: 'Couleur', share: 'Partager', fav: '★ Favoris', tools: 'Outils', search: 'Rechercher', back: 'Retour', pct: 'Pourcentages', marg: 'Marge bénéficiaire', cmp: 'Comparer les prix', trip: 'Coût du trajet', comp: 'Épargne', hrs: 'Heures de travail', gold: 'Or', hij: 'Date hégirienne', zakat: 'Zakât', country: 'Pays', custom: 'Personnalisé', vatNote: 'Taux normaux nationaux ; ils peuvent changer et des taxes régionales peuvent s’appliquer. Vérifiez auprès de l’administration fiscale.', pctOf: 'X % de Y', whatPct: 'A représente quel % de B', pchange: 'Variation en %', addSub: 'Ajouter / retirer un %', percent: 'Pourcentage (%)', ofValue: 'De la valeur', ofTotal: 'Du total', result: 'Résultat', plusPct: 'Augmenté', minusPct: 'Diminué', cost: 'Prix d’achat', sellPrice: 'Prix de vente', profit: 'Bénéfice', margin: 'Taux de marque (sur le prix de vente)', markup: 'Taux de marge (sur le coût)', targetMargin: 'Taux de marque visé (%)', modePrices: 'À partir des prix', modeTarget: 'Marque visée', prodA: 'Produit A', prodB: 'Produit B', qty: 'Quantité', cheaper: 'Meilleure affaire', perUnit: 'Prix unitaire', savingPct: 'Économie', same: 'Même prix', distance: 'Distance', consumption: 'Consommation', fuelPrice: 'Prix du carburant', fuelNeeded: 'Carburant nécessaire', tripCost: 'Coût du trajet', metricSys: 'Métrique (km, L)', impSys: 'US (mi, gal)', initial: 'Montant initial', monthlyAdd: 'Versement mensuel', finalBal: 'Solde final', contributed: 'Total versé', earned: 'Intérêts gagnés', startT: 'Heure de début', endT: 'Heure de fin', breakMin: 'Pause (minutes)', hourlyRate: 'Taux horaire', hoursWorked: 'Heures travaillées', decimalH: 'Heures décimales', pay: 'Rémunération', karat: 'Carats', goldPrice: 'Prix de l’or (24 carats)', perGram: 'par gramme', perOz: 'par once troy', pureGold: 'Or pur (g)', goldValue: 'Valeur', g2h: 'Grégorien → Hégirien', h2g: 'Hégirien → Grégorien', hijDate: 'Date hégirienne', gregDate: 'Date grégorienne', day: 'Jour', month: 'Mois', year: 'Année', hijNote: 'Calendrier Oumm al-Qura. L’observation locale de la lune peut différer d’un jour.', zWealth: 'Liquidités, épargne, or et marchandises', zDebts: 'Dettes exigibles', zGoldG: 'Prix de l’or au gramme (24 k)', zNisab: 'Nisab (85 g d’or)', zDue: 'Zakât due (2,5 %)', zBelow: 'Sous le nisab : aucune zakât due', zNote: 'Estimation seulement. Les règles varient selon les écoles ; demandez à un savant.', ratesBy: 'Taux fournis par Exchange Rate API', fiat: 'Devises', metals: 'Métaux précieux', crypto: 'Cryptos', assetNote: 'Les métaux sont cotés par once troy. Les cryptos varient à chaque seconde ; à titre indicatif.' },
    ar: { accent: 'اللون', share: 'مشاركة', fav: '★ المفضلة', tools: 'الأدوات', search: 'بحث', back: 'رجوع', pct: 'النسب المئوية', marg: 'هامش الربح', cmp: 'مقارنة الأسعار', trip: 'تكلفة الرحلة', comp: 'نمو المدخرات', hrs: 'ساعات العمل', gold: 'الذهب', hij: 'التاريخ الهجري', zakat: 'الزكاة', country: 'البلد', custom: 'مخصص', vatNote: 'نسب وطنية قياسية، وقد تتغير وقد تُضاف ضرائب محلية. تحقق من الجهة الضريبية.', pctOf: 'X% من Y', whatPct: 'A تمثل كم % من B', pchange: 'نسبة التغير', addSub: 'زيادة / نقصان بنسبة', percent: 'النسبة (%)', ofValue: 'من القيمة', ofTotal: 'من المجموع', result: 'النتيجة', plusPct: 'بعد الزيادة', minusPct: 'بعد النقصان', cost: 'سعر التكلفة', sellPrice: 'سعر البيع', profit: 'الربح', margin: 'هامش الربح (من سعر البيع)', markup: 'نسبة الزيادة (على التكلفة)', targetMargin: 'الهامش المطلوب (%)', modePrices: 'من الأسعار', modeTarget: 'هامش مستهدف', prodA: 'المنتج A', prodB: 'المنتج B', qty: 'الكمية', cheaper: 'الأفضل سعراً', perUnit: 'السعر للوحدة', savingPct: 'التوفير', same: 'نفس السعر', distance: 'المسافة', consumption: 'الاستهلاك', fuelPrice: 'سعر الوقود', fuelNeeded: 'الوقود اللازم', tripCost: 'تكلفة الرحلة', metricSys: 'متري (كم، لتر)', impSys: 'أمريكي (ميل، غالون)', initial: 'المبلغ الابتدائي', monthlyAdd: 'الإيداع الشهري', finalBal: 'الرصيد النهائي', contributed: 'مجموع الإيداعات', earned: 'الفوائد المكتسبة', startT: 'وقت البداية', endT: 'وقت النهاية', breakMin: 'الاستراحة (دقائق)', hourlyRate: 'الأجر بالساعة', hoursWorked: 'ساعات العمل', decimalH: 'الساعات بالعشري', pay: 'الأجر', karat: 'العيار', goldPrice: 'سعر الذهب (عيار 24)', perGram: 'للغرام', perOz: 'للأونصة', pureGold: 'الذهب الخالص (غ)', goldValue: 'القيمة', g2h: 'ميلادي ← هجري', h2g: 'هجري ← ميلادي', hijDate: 'التاريخ الهجري', gregDate: 'التاريخ الميلادي', day: 'اليوم', month: 'الشهر', year: 'السنة', hijNote: 'تقويم أم القرى. رؤية الهلال المحلية قد تختلف بيوم.', zWealth: 'النقد والمدخرات والذهب وعروض التجارة', zDebts: 'الديون الحالّة', zGoldG: 'سعر غرام الذهب (عيار 24)', zNisab: 'النصاب (85 غرام ذهب)', zDue: 'الزكاة المستحقة (2.5%)', zBelow: 'أقل من النصاب: لا زكاة', zNote: 'تقدير فقط. تختلف الأحكام بين المذاهب، فاسأل أهل العلم.', ratesBy: 'الأسعار من Exchange Rate API', fiat: 'العملات', metals: 'المعادن الثمينة', crypto: 'العملات الرقمية', assetNote: 'المعادن بسعر الأونصة. أسعار العملات الرقمية تتغير كل ثانية وهي للاسترشاد فقط.' },
    es: { accent: 'Color', share: 'Compartir', fav: '★ Favoritos', tools: 'Herramientas', search: 'Buscar', back: 'Atrás', pct: 'Porcentajes', marg: 'Margen de beneficio', cmp: 'Comparar precios', trip: 'Coste del viaje', comp: 'Ahorro', hrs: 'Horas de trabajo', gold: 'Oro', hij: 'Fecha hegiriana', zakat: 'Zakat', country: 'País', custom: 'Personalizado', vatNote: 'Tipos generales nacionales; pueden cambiar y pueden aplicarse impuestos regionales. Consulta a tu autoridad fiscal.', pctOf: 'X % de Y', whatPct: 'A es qué % de B', pchange: 'Variación %', addSub: 'Sumar / restar %', percent: 'Porcentaje (%)', ofValue: 'Del valor', ofTotal: 'Del total', result: 'Resultado', plusPct: 'Aumentado', minusPct: 'Reducido', cost: 'Precio de coste', sellPrice: 'Precio de venta', profit: 'Beneficio', margin: 'Margen (sobre el precio de venta)', markup: 'Recargo (sobre el coste)', targetMargin: 'Margen objetivo (%)', modePrices: 'Desde precios', modeTarget: 'Margen objetivo', prodA: 'Producto A', prodB: 'Producto B', qty: 'Cantidad', cheaper: 'Mejor oferta', perUnit: 'Precio por unidad', savingPct: 'Ahorro', same: 'Mismo precio', distance: 'Distancia', consumption: 'Consumo', fuelPrice: 'Precio del combustible', fuelNeeded: 'Combustible necesario', tripCost: 'Coste del viaje', metricSys: 'Métrico (km, L)', impSys: 'EE. UU. (mi, gal)', initial: 'Importe inicial', monthlyAdd: 'Aportación mensual', finalBal: 'Saldo final', contributed: 'Total aportado', earned: 'Intereses ganados', startT: 'Hora de inicio', endT: 'Hora de fin', breakMin: 'Descanso (minutos)', hourlyRate: 'Tarifa por hora', hoursWorked: 'Horas trabajadas', decimalH: 'Horas decimales', pay: 'Pago', karat: 'Quilates', goldPrice: 'Precio del oro (24 K)', perGram: 'por gramo', perOz: 'por onza troy', pureGold: 'Oro puro (g)', goldValue: 'Valor', g2h: 'Gregoriano → Hegiriano', h2g: 'Hegiriano → Gregoriano', hijDate: 'Fecha hegiriana', gregDate: 'Fecha gregoriana', day: 'Día', month: 'Mes', year: 'Año', hijNote: 'Calendario Umm al-Qura. La observación local de la luna puede diferir un día.', zWealth: 'Efectivo, ahorros, oro y mercancías', zDebts: 'Deudas exigibles', zGoldG: 'Precio del oro por gramo (24 K)', zNisab: 'Nisab (85 g de oro)', zDue: 'Zakat debido (2,5 %)', zBelow: 'Por debajo del nisab: no hay zakat', zNote: 'Solo una estimación. Las normas varían entre escuelas; consulta a un erudito.', ratesBy: 'Tipos de Exchange Rate API', fiat: 'Divisas', metals: 'Metales preciosos', crypto: 'Criptomonedas', assetNote: 'Los metales se cotizan por onza troy. Las criptomonedas cambian cada segundo; solo orientativo.' },
    pt: { accent: 'Cor', share: 'Compartilhar', fav: '★ Favoritos', tools: 'Ferramentas', search: 'Pesquisar', back: 'Voltar', pct: 'Percentagens', marg: 'Margem de lucro', cmp: 'Comparar preços', trip: 'Custo da viagem', comp: 'Poupança', hrs: 'Horas de trabalho', gold: 'Ouro', hij: 'Data hegírica', zakat: 'Zakat', country: 'País', custom: 'Personalizado', vatNote: 'Taxas normais nacionais; podem mudar e podem aplicar-se impostos regionais. Confirme com a autoridade fiscal.', pctOf: 'X% de Y', whatPct: 'A é quantos % de B', pchange: 'Variação %', addSub: 'Somar / subtrair %', percent: 'Percentagem (%)', ofValue: 'Do valor', ofTotal: 'Do total', result: 'Resultado', plusPct: 'Aumentado', minusPct: 'Reduzido', cost: 'Preço de custo', sellPrice: 'Preço de venda', profit: 'Lucro', margin: 'Margem (sobre o preço de venda)', markup: 'Markup (sobre o custo)', targetMargin: 'Margem pretendida (%)', modePrices: 'A partir dos preços', modeTarget: 'Margem pretendida', prodA: 'Produto A', prodB: 'Produto B', qty: 'Quantidade', cheaper: 'Melhor oferta', perUnit: 'Preço por unidade', savingPct: 'Poupança', same: 'Mesmo preço', distance: 'Distância', consumption: 'Consumo', fuelPrice: 'Preço do combustível', fuelNeeded: 'Combustível necessário', tripCost: 'Custo da viagem', metricSys: 'Métrico (km, L)', impSys: 'EUA (mi, gal)', initial: 'Valor inicial', monthlyAdd: 'Depósito mensal', finalBal: 'Saldo final', contributed: 'Total depositado', earned: 'Juros ganhos', startT: 'Hora de início', endT: 'Hora de fim', breakMin: 'Pausa (minutos)', hourlyRate: 'Valor por hora', hoursWorked: 'Horas trabalhadas', decimalH: 'Horas decimais', pay: 'Pagamento', karat: 'Quilates', goldPrice: 'Preço do ouro (24K)', perGram: 'por grama', perOz: 'por onça troy', pureGold: 'Ouro puro (g)', goldValue: 'Valor', g2h: 'Gregoriano → Hegírico', h2g: 'Hegírico → Gregoriano', hijDate: 'Data hegírica', gregDate: 'Data gregoriana', day: 'Dia', month: 'Mês', year: 'Ano', hijNote: 'Calendário Umm al-Qura. A observação local da lua pode diferir um dia.', zWealth: 'Dinheiro, poupanças, ouro e mercadorias', zDebts: 'Dívidas vencidas', zGoldG: 'Preço do ouro por grama (24K)', zNisab: 'Nisab (85 g de ouro)', zDue: 'Zakat devido (2,5%)', zBelow: 'Abaixo do nisab: sem zakat', zNote: 'Apenas uma estimativa. As regras variam entre escolas; consulte um estudioso.', ratesBy: 'Taxas da Exchange Rate API', fiat: 'Moedas', metals: 'Metais preciosos', crypto: 'Criptomoedas', assetNote: 'Os metais são cotados por onça troy. As criptomoedas variam a cada segundo; apenas indicativo.' },
    de: { accent: 'Farbe', share: 'Teilen', fav: '★ Favoriten', tools: 'Werkzeuge', search: 'Suchen', back: 'Zurück', pct: 'Prozente', marg: 'Gewinnspanne', cmp: 'Preise vergleichen', trip: 'Fahrtkosten', comp: 'Sparen', hrs: 'Arbeitsstunden', gold: 'Gold', hij: 'Hidschri-Datum', zakat: 'Zakat', country: 'Land', custom: 'Eigener Satz', vatNote: 'Nationale Normalsätze; sie können sich ändern, regionale Steuern können hinzukommen. Bitte bei der Steuerbehörde prüfen.', pctOf: 'X % von Y', whatPct: 'A sind wie viel % von B', pchange: 'Änderung in %', addSub: '% addieren / abziehen', percent: 'Prozent (%)', ofValue: 'Von Wert', ofTotal: 'Von Gesamt', result: 'Ergebnis', plusPct: 'Erhöht', minusPct: 'Verringert', cost: 'Einkaufspreis', sellPrice: 'Verkaufspreis', profit: 'Gewinn', margin: 'Marge (vom Verkaufspreis)', markup: 'Aufschlag (auf die Kosten)', targetMargin: 'Zielmarge (%)', modePrices: 'Aus Preisen', modeTarget: 'Zielmarge', prodA: 'Produkt A', prodB: 'Produkt B', qty: 'Menge', cheaper: 'Besseres Angebot', perUnit: 'Preis pro Einheit', savingPct: 'Ersparnis', same: 'Gleicher Preis', distance: 'Strecke', consumption: 'Verbrauch', fuelPrice: 'Kraftstoffpreis', fuelNeeded: 'Benötigter Kraftstoff', tripCost: 'Fahrtkosten', metricSys: 'Metrisch (km, L)', impSys: 'US (mi, gal)', initial: 'Startbetrag', monthlyAdd: 'Monatliche Einzahlung', finalBal: 'Endkapital', contributed: 'Eingezahlt gesamt', earned: 'Erzielte Zinsen', startT: 'Beginn', endT: 'Ende', breakMin: 'Pause (Minuten)', hourlyRate: 'Stundenlohn', hoursWorked: 'Gearbeitete Stunden', decimalH: 'Dezimalstunden', pay: 'Lohn', karat: 'Karat', goldPrice: 'Goldpreis (24 K)', perGram: 'pro Gramm', perOz: 'pro Feinunze', pureGold: 'Feingold (g)', goldValue: 'Wert', g2h: 'Gregorianisch → Hidschri', h2g: 'Hidschri → Gregorianisch', hijDate: 'Hidschri-Datum', gregDate: 'Gregorianisches Datum', day: 'Tag', month: 'Monat', year: 'Jahr', hijNote: 'Umm-al-Qura-Kalender. Die lokale Mondsichtung kann um einen Tag abweichen.', zWealth: 'Bargeld, Ersparnisse, Gold und Handelsware', zDebts: 'Fällige Schulden', zGoldG: 'Goldpreis pro Gramm (24 K)', zNisab: 'Nisab (85 g Gold)', zDue: 'Fällige Zakat (2,5 %)', zBelow: 'Unter dem Nisab: keine Zakat fällig', zNote: 'Nur eine Schätzung. Die Regeln unterscheiden sich je nach Rechtsschule; fragen Sie einen Gelehrten.', ratesBy: 'Kurse von Exchange Rate API', fiat: 'Währungen', metals: 'Edelmetalle', crypto: 'Krypto', assetNote: 'Metalle werden pro Feinunze angegeben. Kryptokurse ändern sich ständig; nur zur Orientierung.' },
    ru: { accent: 'Цвет', share: 'Поделиться', fav: '★ Избранное', tools: 'Инструменты', search: 'Поиск', back: 'Назад', pct: 'Проценты', marg: 'Маржа', cmp: 'Сравнение цен', trip: 'Стоимость поездки', comp: 'Накопления', hrs: 'Рабочие часы', gold: 'Золото', hij: 'Дата хиджры', zakat: 'Закят', country: 'Страна', custom: 'Своя ставка', vatNote: 'Стандартные национальные ставки; они могут меняться, возможны региональные налоги. Уточняйте в налоговом органе.', pctOf: 'X% от Y', whatPct: 'Сколько % составляет A от B', pchange: 'Изменение в %', addSub: 'Прибавить / вычесть %', percent: 'Процент (%)', ofValue: 'От значения', ofTotal: 'От общего', result: 'Результат', plusPct: 'После увеличения', minusPct: 'После уменьшения', cost: 'Себестоимость', sellPrice: 'Цена продажи', profit: 'Прибыль', margin: 'Маржа (от цены продажи)', markup: 'Наценка (на себестоимость)', targetMargin: 'Целевая маржа (%)', modePrices: 'По ценам', modeTarget: 'Целевая маржа', prodA: 'Товар A', prodB: 'Товар B', qty: 'Количество', cheaper: 'Выгоднее', perUnit: 'Цена за единицу', savingPct: 'Экономия', same: 'Цена одинакова', distance: 'Расстояние', consumption: 'Расход', fuelPrice: 'Цена топлива', fuelNeeded: 'Нужно топлива', tripCost: 'Стоимость поездки', metricSys: 'Метрическая (км, л)', impSys: 'США (мили, гал.)', initial: 'Начальная сумма', monthlyAdd: 'Ежемесячный взнос', finalBal: 'Итоговый баланс', contributed: 'Всего внесено', earned: 'Начисленные проценты', startT: 'Начало', endT: 'Конец', breakMin: 'Перерыв (минуты)', hourlyRate: 'Ставка в час', hoursWorked: 'Отработано часов', decimalH: 'Часы десятичные', pay: 'Оплата', karat: 'Карат', goldPrice: 'Цена золота (24K)', perGram: 'за грамм', perOz: 'за тройскую унцию', pureGold: 'Чистое золото (г)', goldValue: 'Стоимость', g2h: 'Григорианский → Хиджра', h2g: 'Хиджра → Григорианский', hijDate: 'Дата по хиджре', gregDate: 'Григорианская дата', day: 'День', month: 'Месяц', year: 'Год', hijNote: 'Календарь Умм аль-Кура. Местное наблюдение луны может отличаться на один день.', zWealth: 'Наличные, сбережения, золото и товары', zDebts: 'Текущие долги', zGoldG: 'Цена золота за грамм (24K)', zNisab: 'Нисаб (85 г золота)', zDue: 'Закят к уплате (2,5%)', zBelow: 'Ниже нисаба: закят не нужен', zNote: 'Только оценка. Правила различаются между мазхабами; спросите знающего человека.', ratesBy: 'Курсы от Exchange Rate API', fiat: 'Валюты', metals: 'Драгоценные металлы', crypto: 'Криптовалюты', assetNote: 'Металлы указаны за тройскую унцию. Курсы криптовалют меняются каждую секунду; только для справки.' },
    tr: { accent: 'Renk', share: 'Paylaş', fav: '★ Favoriler', tools: 'Araçlar', search: 'Ara', back: 'Geri', pct: 'Yüzdeler', marg: 'Kâr marjı', cmp: 'Fiyat karşılaştır', trip: 'Yolculuk maliyeti', comp: 'Birikim', hrs: 'Çalışma saatleri', gold: 'Altın', hij: 'Hicri tarih', zakat: 'Zekât', country: 'Ülke', custom: 'Özel', vatNote: 'Ulusal genel oranlar; değişebilir ve bölgesel vergiler uygulanabilir. Vergi dairesinden doğrulayın.', pctOf: 'Y’nin %X’i', whatPct: 'A, B’nin yüzde kaçı', pchange: 'Yüzde değişim', addSub: '% ekle / çıkar', percent: 'Yüzde (%)', ofValue: 'Değerin', ofTotal: 'Toplamın', result: 'Sonuç', plusPct: 'Artırılmış', minusPct: 'Azaltılmış', cost: 'Maliyet fiyatı', sellPrice: 'Satış fiyatı', profit: 'Kâr', margin: 'Marj (satış fiyatına göre)', markup: 'Kâr oranı (maliyete göre)', targetMargin: 'Hedef marj (%)', modePrices: 'Fiyatlardan', modeTarget: 'Hedef marj', prodA: 'Ürün A', prodB: 'Ürün B', qty: 'Miktar', cheaper: 'Daha avantajlı', perUnit: 'Birim fiyat', savingPct: 'Tasarruf', same: 'Aynı fiyat', distance: 'Mesafe', consumption: 'Tüketim', fuelPrice: 'Yakıt fiyatı', fuelNeeded: 'Gereken yakıt', tripCost: 'Yolculuk maliyeti', metricSys: 'Metrik (km, L)', impSys: 'ABD (mil, galon)', initial: 'Başlangıç tutarı', monthlyAdd: 'Aylık yatırılan', finalBal: 'Son bakiye', contributed: 'Toplam yatırılan', earned: 'Kazanılan faiz', startT: 'Başlangıç saati', endT: 'Bitiş saati', breakMin: 'Mola (dakika)', hourlyRate: 'Saatlik ücret', hoursWorked: 'Çalışılan saat', decimalH: 'Ondalık saat', pay: 'Ücret', karat: 'Ayar', goldPrice: 'Altın fiyatı (24 ayar)', perGram: 'gram başına', perOz: 'troy ons başına', pureGold: 'Saf altın (g)', goldValue: 'Değer', g2h: 'Miladi → Hicri', h2g: 'Hicri → Miladi', hijDate: 'Hicri tarih', gregDate: 'Miladi tarih', day: 'Gün', month: 'Ay', year: 'Yıl', hijNote: 'Ümmü’l-Kurâ takvimi. Yerel hilal gözlemi bir gün farklı olabilir.', zWealth: 'Nakit, birikim, altın ve ticaret malı', zDebts: 'Vadesi gelmiş borçlar', zGoldG: 'Gram altın fiyatı (24 ayar)', zNisab: 'Nisap (85 g altın)', zDue: 'Ödenecek zekât (%2,5)', zBelow: 'Nisabın altında: zekât gerekmez', zNote: 'Yalnızca tahmindir. Hükümler mezhebe göre değişir; bir âlime danışın.', ratesBy: 'Kurlar: Exchange Rate API', fiat: 'Para birimleri', metals: 'Değerli metaller', crypto: 'Kripto', assetNote: 'Metaller troy ons başına fiyatlanır. Kripto fiyatları saniyede bir değişir; yalnızca bilgi amaçlıdır.' },
    zh: { accent: '主题色', share: '分享', fav: '★ 收藏', tools: '工具', search: '搜索', back: '返回', pct: '百分比', marg: '利润率', cmp: '比价', trip: '行程费用', comp: '储蓄增长', hrs: '工作时长', gold: '黄金', hij: '伊斯兰历', zakat: '天课', country: '国家/地区', custom: '自定义', vatNote: '为各国标准税率，可能调整，部分地区另有地方税，请以税务部门为准。', pctOf: 'Y 的 X%', whatPct: 'A 占 B 的百分之几', pchange: '变化百分比', addSub: '加/减百分比', percent: '百分比 (%)', ofValue: '数值', ofTotal: '总数', result: '结果', plusPct: '增加后', minusPct: '减少后', cost: '成本价', sellPrice: '售价', profit: '利润', margin: '毛利率（占售价）', markup: '加成率（占成本）', targetMargin: '目标毛利率 (%)', modePrices: '按价格', modeTarget: '按目标毛利率', prodA: '商品 A', prodB: '商品 B', qty: '数量', cheaper: '更划算', perUnit: '单价', savingPct: '节省', same: '价格相同', distance: '距离', consumption: '油耗', fuelPrice: '油价', fuelNeeded: '所需燃油', tripCost: '行程费用', metricSys: '公制（公里、升）', impSys: '美制（英里、加仑）', initial: '初始金额', monthlyAdd: '每月存入', finalBal: '最终余额', contributed: '累计存入', earned: '利息收益', startT: '开始时间', endT: '结束时间', breakMin: '休息（分钟）', hourlyRate: '时薪', hoursWorked: '工作时长', decimalH: '小数小时', pay: '工资', karat: '成色（K）', goldPrice: '金价（24K）', perGram: '每克', perOz: '每金衡盎司', pureGold: '纯金（克）', goldValue: '价值', g2h: '公历 → 伊斯兰历', h2g: '伊斯兰历 → 公历', hijDate: '伊斯兰历日期', gregDate: '公历日期', day: '日', month: '月', year: '年', hijNote: '乌姆库拉历。各地观月结果可能相差一天。', zWealth: '现金、存款、黄金和商品', zDebts: '到期债务', zGoldG: '每克金价（24K）', zNisab: '天课起征点（85 克黄金）', zDue: '应缴天课 (2.5%)', zBelow: '低于起征点：无需缴纳', zNote: '仅为估算。各学派规定不同，请咨询学者。', ratesBy: '汇率来自 Exchange Rate API', fiat: '货币', metals: '贵金属', crypto: '加密货币', assetNote: '贵金属按金衡盎司计价。加密货币价格时刻变动，仅供参考。' },
    hi: { accent: 'रंग', share: 'शेयर करें', fav: '★ पसंदीदा', tools: 'टूल्स', search: 'खोजें', back: 'वापस', pct: 'प्रतिशत', marg: 'लाभ मार्जिन', cmp: 'कीमत की तुलना', trip: 'यात्रा खर्च', comp: 'बचत वृद्धि', hrs: 'काम के घंटे', gold: 'सोना', hij: 'हिजरी तारीख', zakat: 'ज़कात', country: 'देश', custom: 'अपनी दर', vatNote: 'राष्ट्रीय मानक दरें; ये बदल सकती हैं और क्षेत्रीय कर लग सकते हैं। कर विभाग से जाँच लें।', pctOf: 'Y का X%', whatPct: 'A, B का कितना %', pchange: '% बदलाव', addSub: '% जोड़ें / घटाएँ', percent: 'प्रतिशत (%)', ofValue: 'मान का', ofTotal: 'कुल का', result: 'परिणाम', plusPct: 'बढ़ाने पर', minusPct: 'घटाने पर', cost: 'लागत मूल्य', sellPrice: 'बिक्री मूल्य', profit: 'लाभ', margin: 'मार्जिन (बिक्री मूल्य पर)', markup: 'मार्कअप (लागत पर)', targetMargin: 'लक्षित मार्जिन (%)', modePrices: 'कीमतों से', modeTarget: 'लक्षित मार्जिन', prodA: 'उत्पाद A', prodB: 'उत्पाद B', qty: 'मात्रा', cheaper: 'बेहतर सौदा', perUnit: 'प्रति इकाई कीमत', savingPct: 'बचत', same: 'कीमत बराबर', distance: 'दूरी', consumption: 'खपत', fuelPrice: 'ईंधन की कीमत', fuelNeeded: 'ज़रूरी ईंधन', tripCost: 'यात्रा खर्च', metricSys: 'मीट्रिक (किमी, ली.)', impSys: 'US (मील, गैलन)', initial: 'शुरुआती राशि', monthlyAdd: 'मासिक जमा', finalBal: 'अंतिम राशि', contributed: 'कुल जमा', earned: 'कमाया ब्याज', startT: 'शुरू का समय', endT: 'अंत का समय', breakMin: 'ब्रेक (मिनट)', hourlyRate: 'प्रति घंटा दर', hoursWorked: 'काम के घंटे', decimalH: 'दशमलव घंटे', pay: 'वेतन', karat: 'कैरेट', goldPrice: 'सोने की कीमत (24K)', perGram: 'प्रति ग्राम', perOz: 'प्रति ट्रॉय औंस', pureGold: 'शुद्ध सोना (ग्रा.)', goldValue: 'मूल्य', g2h: 'ग्रेगोरियन → हिजरी', h2g: 'हिजरी → ग्रेगोरियन', hijDate: 'हिजरी तारीख', gregDate: 'ग्रेगोरियन तारीख', day: 'दिन', month: 'महीना', year: 'साल', hijNote: 'उम्म अल-कुरा कैलेंडर। स्थानीय चाँद दिखने से एक दिन का फ़र्क़ हो सकता है।', zWealth: 'नकद, बचत, सोना और व्यापार का माल', zDebts: 'चुकाने योग्य कर्ज़', zGoldG: 'सोने की कीमत प्रति ग्राम (24K)', zNisab: 'निसाब (85 ग्राम सोना)', zDue: 'देय ज़कात (2.5%)', zBelow: 'निसाब से कम: ज़कात नहीं', zNote: 'सिर्फ़ अनुमान। मसलकों में नियम अलग हैं; किसी आलिम से पूछें।', ratesBy: 'दरें: Exchange Rate API', fiat: 'मुद्राएँ', metals: 'कीमती धातुएँ', crypto: 'क्रिप्टो', assetNote: 'धातुओं की कीमत ट्रॉय औंस के हिसाब से है। क्रिप्टो की कीमतें हर पल बदलती हैं; सिर्फ़ जानकारी के लिए।' }
  };
  Object.keys(X).forEach((l) => Object.assign(I18N[l], X[l]));

  function detectLang() {
    const l = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return I18N[l] ? l : 'en';
  }

  const S = {
    lang: store.get('lang', null) || detectLang(),
    theme: store.get('theme', 'auto'),
    accent: store.get('accent', 0),
    vib: store.get('vib', true),
    deg: store.get('deg', true),
    sci: store.get('sci', false),
    tab: store.get('sciTab', 'trig'),
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

  function shareText(txt) {
    if (!txt) return;
    if (navigator.share) { navigator.share({ text: txt }).catch(() => { /* cancelled */ }); }
    else copyText(txt);
  }
  function outText() {
    const o = $('#out');
    if (!o) return '';
    return [...o.querySelectorAll('.orow')].map(r => r.children[0].textContent + ': ' + r.children[1].textContent).join('\n');
  }

  /* ============================ CALCULATOR ============================ */
  const CALC = { expr: '', prev: '', done: false, resText: '', mem: store.get('mem', 0), ans: store.get('ans', 0) };
  const OPS = ['+', '−', '×', '÷'];

  function tryEval(s) {
    if (!s) return null;
    s = s.replace(/[+−×÷^]+$/, '');
    if (!s) return null;
    const open = (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
    if (open > 0) s += ')'.repeat(open);
    try { const v = evaluate(s, S.deg, CALC.ans); return isFinite(v) ? v : null; } catch (e) { return null; }
  }

  const SCI_TABS = [['trig', 'sin'], ['hyp', 'sinh'], ['pow', '√'], ['log', 'log'], ['cmb', 'nCr']];
  const SCI_SETS = {
    trig: [['sin', 'sin('], ['cos', 'cos('], ['tan', 'tan('], ['π', 'π'], ['e', 'e'], ['sin⁻¹', 'asin('], ['cos⁻¹', 'acos('], ['tan⁻¹', 'atan('], ['ANS', 'ANS'], ['±', 'NEG']],
    hyp: [['sinh', 'sinh('], ['cosh', 'cosh('], ['tanh', 'tanh('], ['π', 'π'], ['e', 'e'], ['sinh⁻¹', 'asinh('], ['cosh⁻¹', 'acosh('], ['tanh⁻¹', 'atanh(']],
    pow: [['√', '√('], ['∛', 'cbrt('], ['ʸ√x', '^(1÷'], ['x²', '^2'], ['x³', '^3'], ['xʸ', '^'], ['1/x', 'INV'], ['|x|', 'abs('], ['10ˣ', 'exp10('], ['eˣ', 'exp(']],
    log: [['log', 'log('], ['ln', 'ln('], ['log₂', 'log2('], ['10ˣ', 'exp10('], ['eˣ', 'exp('], ['2ˣ', 'exp2('], ['⌊x⌋', 'floor('], ['⌈x⌉', 'ceil('], ['round', 'round(']],
    cmb: [['x!', '!'], ['nCr', 'nCr'], ['nPr', 'nPr'], ['mod', 'mod'], ['gcd', 'gcd'], ['lcm', 'lcm'], ['EE', 'EE'], ['ANS', 'ANS'], ['±', 'NEG'], ['%', '%']]
  };
  const sciKeysHTML = () => (SCI_SETS[S.tab] || SCI_SETS.trig).map(([l, v]) => `<button class="k sm" data-k="${v}">${l}</button>`).join('');

  function calcHTML() {
    const k = (l, v, c = '') => `<button class="k ${c}" data-k="${v}">${l}</button>`;
    const k0 = (l, v, c = '') => `<button class="k ${c}" data-k="${v}">${l}</button>`;
    return `
      <div class="disp"><button id="shBtn" class="shr" aria-label="${t('share')}">⤴</button><div id="expr" class="expr"></div><div id="res" class="res" title="${t('copy')}">0</div></div>
      <div class="tools">
        <button data-k="MC">MC</button><button data-k="MR">MR</button><button data-k="M+">M+</button><button data-k="M-">M−</button><button data-k="MS">MS</button>
        <button data-k="SCI" class="${S.sci ? 'on' : ''}">f(x)</button><button data-k="DEG" class="${S.deg ? '' : 'on'}">${S.deg ? 'DEG' : 'RAD'}</button>
      </div>
      <div class="sciw" id="sci" ${S.sci ? '' : 'hidden'}><div class="stabs" id="stabs">${SCI_TABS.map(([id, l]) => `<button data-tab="${id}" class="${id === S.tab ? 'on' : ''}">${l}</button>`).join('')}</div><div class="sci" id="sciKeys">${sciKeysHTML()}</div></div>
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
    const isStart = /^[a-z]{2,}[0-9]*\($|^√\($|^[π(]$|^e$|^ANS$/.test(v);
    if (v === 'AC') { E.expr = ''; E.done = false; return calcUpdate(); }
    if (v === 'DEL') {
      E.done = false;
      E.expr = E.expr.replace(/(\s(?:nCr|nPr|mod|gcd|lcm)\s|[a-z]{2,}[0-9]*\(|√\(|ANS|[\s\S])$/, '');
      return calcUpdate();
    }
    if (v === '=') {
      const val = tryEval(E.expr);
      if (val === null || !E.expr) { if (E.expr) toast(t('invalid')); return; }
      const txt = fmtNum(val);
      pushHistory(E.expr, txt);
      CALC.ans = val; store.set('ans', val);
      E.prev = E.expr;
      E.resText = txt;
      E.expr = txt.replace(/e\+?(-?\d+)/, '×10^$1');
      E.done = true;
      return calcUpdate();
    }
    if (v === 'SCI') { S.sci = !S.sci; store.set('sci', S.sci); $('#sci').hidden = !S.sci; $('[data-k="SCI"]').classList.toggle('on', S.sci); return; }
    if (v === 'DEG') { S.deg = !S.deg; store.set('deg', S.deg); const b = $('[data-k="DEG"]'); b.textContent = S.deg ? 'DEG' : 'RAD'; b.classList.toggle('on', !S.deg); return calcUpdate(); }
    if (v === 'NEG') {
      if (E.done) { E.done = false; }
      const m = E.expr.match(/(\d+\.?\d*|\.\d+)$/);
      if (!m) { if (E.expr === '−') E.expr = ''; else if (!E.expr) E.expr = '−'; return calcUpdate(); }
      const head = E.expr.slice(0, E.expr.length - m[0].length);
      if (/(^|[(+×÷^])−$/.test(head)) E.expr = head.slice(0, -1) + m[0];
      else E.expr = head + '−' + m[0];
      return calcUpdate();
    }
    if (v === 'EE') {
      if (!E.expr || !/[0-9.)πe]$/.test(E.expr)) return;
      E.done = false; E.expr += '×10^'; return calcUpdate();
    }
    if (v === 'nCr' || v === 'nPr' || v === 'mod' || v === 'gcd' || v === 'lcm') {
      if (!E.expr || !/[0-9.)πe!%]$|ANS$/.test(E.expr)) return;
      E.done = false; E.expr += ' ' + v + ' '; return calcUpdate();
    }
    if (v === 'MS') {
      const val = tryEval(E.expr);
      if (val === null) return;
      E.mem = parseFloat(val.toPrecision(12)); store.set('mem', E.mem); toast('M = ' + fmtNum(E.mem)); return calcUpdate();
    }
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
    if (v === '^' || v === '!' || v === '%' || v === '^2' || v === '^3' || v === '^(1÷') {
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
      const tb = e.target.closest('[data-tab]');
      if (tb) {
        S.tab = tb.dataset.tab; store.set('sciTab', S.tab);
        $('#sciKeys').innerHTML = sciKeysHTML();
        [...$('#stabs').children].forEach(x => x.classList.toggle('on', x === tb));
        return;
      }
      if (e.target.closest('#shBtn')) {
        const r = CALC.done ? CALC.prev + ' = ' + CALC.resText : ($('#res').textContent || '');
        return shareText(r + ' — CalcPlus');
      }
      if (e.target.closest('#res')) copyText(CALC.done ? CALC.resText : ($('#res').textContent || ''));
    };
    // swipe left/right on the display deletes the last character
    const dsp = $('.disp');
    let sx = 0, sy = 0;
    dsp.ontouchstart = (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; };
    dsp.ontouchend = (e) => {
      const c = e.changedTouches[0];
      if (Math.abs(c.clientX - sx) > 45 && Math.abs(c.clientY - sy) < 30) press('DEL');
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

  /* ---- VAT (by country) ---- */
  const VATS = [['MA', 20], ['FR', 20], ['DE', 19], ['ES', 21], ['IT', 22], ['PT', 23], ['NL', 21], ['BE', 21], ['GB', 20], ['IE', 23], ['CH', 8.1], ['SE', 25], ['NO', 25], ['DK', 25], ['FI', 25.5], ['AT', 20], ['GR', 24], ['PL', 23], ['CZ', 21], ['HU', 27], ['RO', 21], ['TR', 20], ['UA', 20], ['IL', 18], ['SA', 15], ['AE', 5], ['EG', 14], ['DZ', 19], ['TN', 19], ['NG', 7.5], ['ZA', 15], ['IN', 18], ['PK', 18], ['CN', 13], ['JP', 10], ['KR', 10], ['SG', 9], ['ID', 11], ['AU', 10], ['NZ', 15], ['MX', 16]];
  function regionName(c) {
    try { return new Intl.DisplayNames([loc()], { type: 'region' }).of(c) || c; } catch (e) { return c; }
  }
  SCR.tva = {
    html: () => {
      const list = VATS.map(([c, r]) => ({ c, r, n: regionName(c) })).sort((a, b) => a.n.localeCompare(b.n, loc()));
      const region = ((navigator.language || '').split('-')[1] || '').toUpperCase();
      const saved = store.get('tvaCty', VATS.some(v => v[0] === region) ? region : '');
      const cur = list.find(x => x.c === saved);
      return `
      <div class="seg" id="tvaMode"><button data-m="ttc" class="on">${t('toTTC')}</button><button data-m="ht">${t('toHT')}</button></div>
      <label class="f"><span>${t('country')}</span><select id="tvaCty"><option value="">${t('custom')}</option>${list.map(x => `<option value="${x.c}" ${x.c === saved ? 'selected' : ''}>${x.n} — ${x.r}%</option>`).join('')}</select></label>
      ${field('tvaAmt', t('amount'))}
      ${field('tvaRate', t('rate'), `value="${cur ? cur.r : 20}"`)}
      <div id="out" class="out"></div>
      <p class="note">${t('vatNote')}</p>`;
    },
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
      $('#main').oninput = (e) => {
        if (e.target.id === 'tvaCty') {
          const v = VATS.find(x => x[0] === e.target.value);
          store.set('tvaCty', e.target.value);
          if (v) $('#tvaRate').value = v[1];
        } else if (e.target.id === 'tvaRate') {
          const v = VATS.find(x => x[0] === $('#tvaCty').value);
          if (v && String(v[1]) !== e.target.value) { $('#tvaCty').value = ''; store.set('tvaCty', ''); }
        }
        calc();
      };
      calc();
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

  /* ---- Currency, precious metals & crypto ---- */
  const POPULAR = ['MAD', 'EUR', 'USD', 'GBP', 'SAR', 'AED', 'CAD', 'CHF', 'TRY', 'CNY', 'JPY', 'INR', 'RUB', 'BRL', 'DZD', 'TND', 'EGP', 'AUD'];
  const FALLBACK = { USD: 1, EUR: 0.92, GBP: 0.79, MAD: 9.9, SAR: 3.75, AED: 3.6725, CAD: 1.37, CHF: 0.88, TRY: 34, CNY: 7.2, JPY: 150, RUB: 92, INR: 83, BRL: 5.5, DZD: 134, TND: 3.1, EGP: 48, QAR: 3.64, KWD: 0.307, AUD: 1.5, MXN: 18, KRW: 1350, SEK: 10.5, NOK: 10.6, DKK: 6.9, PLN: 4, NZD: 1.65, SGD: 1.34, HKD: 7.8, ZAR: 18, NGN: 1500, IDR: 15800, THB: 35, MYR: 4.5, PKR: 278, BDT: 118, ILS: 3.7, UAH: 41, CZK: 23, HUF: 360, RON: 4.6, ARS: 900, CLP: 950, COP: 4000, PEN: 3.75 };
  const METALS = ['XAU', 'XAG', 'XPT', 'XPD']; // price per troy ounce
  const CRYPTO = { BTC: 'Bitcoin', ETH: 'Ethereum', USDT: 'Tether', USDC: 'USD Coin', BNB: 'BNB', XRP: 'XRP', SOL: 'Solana', DOGE: 'Dogecoin', ADA: 'Cardano', TON: 'Toncoin', AVAX: 'Avalanche', LINK: 'Chainlink', DOT: 'Polkadot', SHIB: 'Shiba Inu', LTC: 'Litecoin', BCH: 'Bitcoin Cash', XLM: 'Stellar', ATOM: 'Cosmos', NEAR: 'NEAR Protocol', UNI: 'Uniswap', DAI: 'Dai' };
  const kindOf = (c) => (CRYPTO[c] ? 'cr' : METALS.includes(c) ? 'mt' : 'fx');
  const getRates = () => { const c = store.get('rates', null); return c && c.r ? c : { r: FALLBACK, t: 0, s: {} }; };
  const stampOf = (c, kind) => (c.s && c.s[kind]) || (kind === 'fx' ? c.t : 0) || 0;

  async function fetchJSON(url) {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 10000);
    try {
      const res = await fetch(url, { signal: ctl.signal });
      if (!res.ok) throw new Error('http ' + res.status);
      return await res.json();
    } finally { clearTimeout(to); }
  }
  // Rates are stored as "units per 1 USD". Each source is independent: if one fails, the other values are kept.
  async function fetchRates() {
    const prev = store.get('rates', null);
    const [fx, cr, mt] = await Promise.allSettled([
      fetchJSON('https://open.er-api.com/v6/latest/USD'),
      fetchJSON('https://api.coinbase.com/v2/exchange-rates?currency=USD'),
      Promise.all(METALS.map(m => fetchJSON('https://api.gold-api.com/price/' + m)))
    ]);
    const r = Object.assign({}, FALLBACK, prev && prev.r);
    const s = Object.assign({}, prev && prev.s);
    const now = Date.now();
    let ok = false;
    if (fx.status === 'fulfilled' && fx.value.result === 'success' && fx.value.rates) { Object.assign(r, fx.value.rates); s.fx = now; ok = true; }
    if (cr.status === 'fulfilled' && cr.value.data && cr.value.data.rates) {
      let n = 0;
      Object.keys(CRYPTO).forEach(c => { const v = parseFloat(cr.value.data.rates[c]); if (v > 0) { r[c] = v; n++; } });
      if (n) { s.cr = now; ok = true; }
    }
    if (mt.status === 'fulfilled') {
      let n = 0;
      mt.value.forEach((j, i) => { if (j && j.price > 0) { r[METALS[i]] = 1 / j.price; n++; } });
      if (n) { s.mt = now; ok = true; }
    }
    if (!ok) throw new Error('all sources failed');
    store.set('rates', { r, t: now, s });
  }

  const dnCache = {};
  const METAL_NAMES = {
    en: ['Gold', 'Silver', 'Platinum', 'Palladium'], fr: ['Or', 'Argent', 'Platine', 'Palladium'], ar: ['الذهب', 'الفضة', 'البلاتين', 'البلاديوم'],
    es: ['Oro', 'Plata', 'Platino', 'Paladio'], pt: ['Ouro', 'Prata', 'Platina', 'Paládio'], de: ['Gold', 'Silber', 'Platin', 'Palladium'],
    ru: ['Золото', 'Серебро', 'Платина', 'Палладий'], tr: ['Altın', 'Gümüş', 'Platin', 'Paladyum'], zh: ['黄金', '白银', '铂金', '钯金'], hi: ['सोना', 'चाँदी', 'प्लैटिनम', 'पैलेडियम']
  };
  const aliasOf = (c) => (METALS.includes(c) ? METAL_NAMES.en[METALS.indexOf(c)] : '');
  function curName(code) {
    if (CRYPTO[code]) return CRYPTO[code];
    if (METALS.includes(code)) return (METAL_NAMES[S.lang] || METAL_NAMES.en)[METALS.indexOf(code)];
    try {
      const k = loc();
      if (!dnCache[k]) dnCache[k] = new Intl.DisplayNames([k], { type: 'currency' });
      const n = dnCache[k].of(code);
      return n && n !== code ? n : '';
    } catch (e) { return ''; }
  }
  // Flag (or icon) shown in front of each code. Currency code -> country: first 2 letters (USD -> US), with exceptions.
  const FLAG_EXC = { EUR: 'EU', ANG: 'CW', XPF: 'PF' };
  const FLAG_SPECIAL = { XAU: '🥇', XAG: '🥈', XPT: '⚪', XPD: '⚪', XAF: '🌍', XOF: '🌍', XCD: '🌴', XDR: '🌐' };
  const flagCache = {};
  let _rn;
  function flagOf(code) {
    if (flagCache[code]) return flagCache[code];
    let f;
    if (FLAG_SPECIAL[code]) f = FLAG_SPECIAL[code];
    else if (CRYPTO[code]) f = '🪙';
    else {
      const cc = FLAG_EXC[code] || code.slice(0, 2);
      let valid;
      try {
        if (typeof Intl.DisplayNames === 'function') { _rn = _rn || new Intl.DisplayNames(['en'], { type: 'region' }); valid = _rn.of(cc) !== cc; }
        else valid = code[0] !== 'X';
      } catch (e) { valid = false; }
      f = valid ? String.fromCodePoint(...[...cc].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65)) : '🌐';
    }
    return (flagCache[code] = f);
  }
  function curGroups() {
    const R = getRates().r;
    const pop = POPULAR.filter(c => R[c]);
    const fx = pop.concat(Object.keys(R).filter(c => !pop.includes(c) && kindOf(c) === 'fx').sort());
    return [['fiat', fx], ['metals', METALS.filter(c => R[c])], ['crypto', Object.keys(CRYPTO).filter(c => R[c])]];
  }
  const fmtConv = (v) => {
    if (!isFinite(v)) return '—';
    const a = Math.abs(v);
    const o = a < 1 ? { maximumSignificantDigits: 6 } : { maximumFractionDigits: a >= 1000 ? 2 : 4 };
    return new Intl.NumberFormat(loc(), o).format(v);
  };

  SCR.cur = {
    html: () => `<div class="cv">
          <div class="cvrow"><input id="cuAmt" type="number" inputmode="decimal" step="any" value="100" aria-label="${t('amount')}"><select id="cuFrom" aria-label="${t('from')}"></select></div>
          <button id="cuSwap" class="cvsw" aria-label="swap">⇅</button>
          <div class="cvrow"><input id="cuRes" type="number" inputmode="decimal" step="any" aria-label="${t('to')}"><select id="cuTo" aria-label="${t('to')}"></select></div>
        </div>
        <p class="cvrate" id="cuRate"></p>
        <div class="chips" id="cuFavs"></div>
        <label class="f srch"><input id="cuSearch" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="🔍 ${t('search')}: USD, Euro, Gold, Bitcoin…"></label>
        <div id="out" class="out"></div>
        <p class="note" id="cuNote"></p>
        <p class="note">${t('assetNote')}</p>
        <p class="note"><a href="https://www.exchangerate-api.com" target="_blank" rel="noopener">${t('ratesBy')}</a> · <a href="https://gold-api.com" target="_blank" rel="noopener">Gold-API</a> · <a href="https://www.coinbase.com" target="_blank" rel="noopener">Coinbase</a></p>
        <button id="cuUpd" class="btn">${t('update')}</button>`,
    bind() {
      let from = store.get('cuFrom', 'EUR'), to = store.get('cuTo', 'MAD');
      const fill = () => {
        const q = $('#cuSearch').value.trim().toLowerCase();
        const R0 = getRates().r;
        const favs = store.get('favs', []).filter(c => R0[c]);
        const base = curGroups().map(([g, l]) => [g, l.filter(c => !favs.includes(c))]);
        const groups = favs.length ? [['fav', favs]].concat(base) : base;
        $('#cuFavs').innerHTML = [['from', from], ['to', to]].map(([w, c]) => `<button data-w="${w}" class="${favs.includes(c) ? 'on' : ''}">${favs.includes(c) ? '★' : '☆'} ${flagOf(c)} ${c}</button>`).join('');
        [['cuFrom', from], ['cuTo', to]].forEach(([id, cur]) => {
          $('#' + id).innerHTML = groups.map(([g, list]) => {
            const items = list.filter(c => c === cur || !q || c.toLowerCase().includes(q) || curName(c).toLowerCase().includes(q) || aliasOf(c).toLowerCase().includes(q));
            if (!items.length) return '';
            return `<optgroup label="${t(g)}">${items.map(c => `<option value="${c}" ${c === cur ? 'selected' : ''}>${flagOf(c)} ${c}</option>`).join('')}</optgroup>`;
          }).join('');
        });
      };
      const setRes = (v) => { $('#cuRes').value = isFinite(v) ? String(parseFloat(v.toPrecision(8))) : ''; };
      const calc = (src) => {
        store.set('cuFrom', from); store.set('cuTo', to);
        const C = getRates(), R = C.r;
        if (!R[from] || !R[to]) { $('#out').innerHTML = ''; $('#cuRate').textContent = ''; return; }
        let a = num('cuAmt');
        if (src === 'res') {
          const r = num('cuRes');
          if (isNaN(r)) { $('#cuAmt').value = ''; $('#out').innerHTML = ''; return; }
          a = r / R[to] * R[from];
          $('#cuAmt').value = String(parseFloat(a.toPrecision(8)));
        }
        const unit = R[to] / R[from];
        $('#cuRate').textContent = '1 ' + from + ' = ' + fmtConv(unit) + ' ' + to;
        if (isNaN(a)) { $('#out').innerHTML = ''; if (src !== 'res') setRes(NaN); return; }
        const v = a / R[from] * R[to];
        if (src !== 'res') setRes(v);
        let h = `<div class="orow hid"><span>${fmtConv(a)} ${from}</span><b>${fmtConv(v)} ${to}</b></div>`;
        const stamps = [...new Set([kindOf(from), kindOf(to)])].filter(k => k !== 'fx').map(k => stampOf(C, k)).filter(x => x > 0);
        if (stamps.length) h += row(t('updated'), new Date(Math.min(...stamps)).toLocaleString(loc()));
        $('#out').innerHTML = h;
      };
      const note = () => { const c = getRates(); $('#cuNote').textContent = c.t ? t('updated') + ': ' + new Date(c.t).toLocaleString(loc()) : t('approx'); };
      const upd = async () => {
        $('#cuNote').textContent = t('loading');
        try { await fetchRates(); } catch (e) { toast(t('failed')); }
        if (!$('#cuNote')) return;
        fill(); note(); calc();
      };
      $('#main').oninput = (e) => {
        if (e.target.id === 'cuSearch') fill();
        else if (e.target.id === 'cuFrom') from = e.target.value;
        else if (e.target.id === 'cuTo') to = e.target.value;
        calc(e.target.id === 'cuRes' ? 'res' : undefined);
      };
      $('#main').onclick = (e) => {
        const b = e.target.closest('#cuFavs [data-w]');
        if (!b) return;
        const c = b.dataset.w === 'from' ? from : to;
        let f = store.get('favs', []);
        f = f.includes(c) ? f.filter(x => x !== c) : [c].concat(f).slice(0, 12);
        store.set('favs', f);
        fill();
      };
      $('#cuSwap').onclick = () => { const x = from; from = to; to = x; fill(); calc(); };
      $('#cuUpd').onclick = upd;
      fill(); note(); calc();
      const c = getRates();
      if (navigator.onLine && (!c.t || Date.now() - c.t > 15 * 60 * 1000)) upd();
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

  /* ============================ NEW TOOLS ============================ */
  const errRow = () => `<div class="orow err">${t('invalid')}</div>`;
  const segHTML = (id, items) => `<div class="seg" id="${id}">${items.map(([m, l], i) => `<button data-m="${m}" class="${i === 0 ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const segBind = (id, cb) => {
    $('#' + id).onclick = (e) => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      [...$('#' + id).children].forEach(x => x.classList.toggle('on', x === b));
      cb(b.dataset.m);
    };
  };

  /* ---- Percentages ---- */
  SCR.pct = {
    html: () => `<label class="f"><select id="pcMode"><option value="of">${t('pctOf')}</option><option value="what">${t('whatPct')}</option><option value="chg">${t('pchange')}</option><option value="addsub">${t('addSub')}</option></select></label>
      <label class="f"><span id="pcLa"></span><input id="pcA" type="number" inputmode="decimal" step="any"></label>
      <label class="f"><span id="pcLb"></span><input id="pcB" type="number" inputmode="decimal" step="any"></label>
      <div id="out" class="out"></div>`,
    bind() {
      const LB = { of: ['percent', 'ofValue'], what: ['value', 'ofTotal'], chg: ['from', 'to'], addsub: ['percent', 'value'] };
      const calc = () => {
        const m = $('#pcMode').value, a = num('pcA'), b = num('pcB');
        $('#pcLa').textContent = t(LB[m][0]); $('#pcLb').textContent = t(LB[m][1]);
        if (isNaN(a) || isNaN(b)) { $('#out').innerHTML = ''; return; }
        let h;
        if (m === 'of') h = row(t('result'), nf(b * a / 100), 'big');
        else if (m === 'what') h = b === 0 ? errRow() : row(t('result'), nf(a / b * 100, 4) + ' %', 'big');
        else if (m === 'chg') {
          if (a === 0) h = errRow();
          else { const c = (b - a) / a * 100; h = row(t('pchange'), (c > 0 ? '+' : '') + nf(c, 4) + ' %', 'big') + row(t('diff'), nf(b - a)); }
        } else h = row(t('plusPct'), nf(b * (1 + a / 100)), 'big') + row(t('minusPct'), nf(b * (1 - a / 100)));
        $('#out').innerHTML = h;
      };
      $('#main').oninput = calc;
      calc();
    }
  };

  /* ---- Profit margin ---- */
  SCR.marg = {
    html: () => `${segHTML('mgMode', [['p', t('modePrices')], ['t', t('modeTarget')]])}
      ${field('mgCost', t('cost'))}
      <div id="mgSellW">${field('mgSell', t('sellPrice'))}</div>
      <div id="mgTgtW" hidden>${field('mgTgt', t('targetMargin'), 'value="30"')}</div>
      <div id="out" class="out"></div>`,
    bind() {
      let mode = 'p';
      const calc = () => {
        const c = num('mgCost');
        if (isNaN(c)) { $('#out').innerHTML = ''; return; }
        let price;
        if (mode === 'p') { price = num('mgSell'); if (isNaN(price)) { $('#out').innerHTML = ''; return; } }
        else {
          const m = num('mgTgt');
          if (isNaN(m)) { $('#out').innerHTML = ''; return; }
          if (m >= 100) { $('#out').innerHTML = errRow(); return; }
          price = c / (1 - m / 100);
        }
        const profit = price - c;
        let h = row(t('profit'), money(profit), 'big');
        if (mode === 't') h = row(t('sellPrice'), money(price), 'big') + row(t('profit'), money(profit));
        if (price !== 0) h += row(t('margin'), nf(profit / price * 100, 2) + ' %');
        if (c !== 0) h += row(t('markup'), nf(profit / c * 100, 2) + ' %');
        $('#out').innerHTML = h;
      };
      segBind('mgMode', (m) => { mode = m; $('#mgSellW').hidden = m !== 'p'; $('#mgTgtW').hidden = m !== 't'; calc(); });
      $('#main').oninput = calc;
    }
  };

  /* ---- Compare prices ---- */
  SCR.cmp = {
    html: () => `<div class="sub">${t('prodA')}</div><div class="grid2">${field('cpPa', t('price'))}${field('cpQa', t('qty'))}</div>
      <div class="sub">${t('prodB')}</div><div class="grid2">${field('cpPb', t('price'))}${field('cpQb', t('qty'))}</div>
      <div id="out" class="out"></div>`,
    bind() {
      const calc = () => {
        const pa = num('cpPa'), qa = num('cpQa'), pb = num('cpPb'), qb = num('cpQb');
        if ([pa, qa, pb, qb].some(isNaN)) { $('#out').innerHTML = ''; return; }
        if (qa <= 0 || qb <= 0 || pa < 0 || pb < 0) { $('#out').innerHTML = errRow(); return; }
        const ua = pa / qa, ub = pb / qb;
        let h = row(t('prodA') + ' · ' + t('perUnit'), nf(ua, 4)) + row(t('prodB') + ' · ' + t('perUnit'), nf(ub, 4));
        if (Math.abs(ua - ub) < 1e-12) h += row(t('same'), '=', 'big');
        else {
          const lo = Math.min(ua, ub), hi = Math.max(ua, ub);
          h += row(t('cheaper'), (ua < ub ? t('prodA') : t('prodB')) + ' · −' + nf((hi - lo) / hi * 100, 1) + ' %', 'big');
        }
        $('#out').innerHTML = h;
      };
      $('#main').oninput = calc;
    }
  };

  /* ---- Trip cost ---- */
  SCR.trip = {
    html: () => `${segHTML('tpSys', [['m', t('metricSys')], ['i', t('impSys')]])}
      <label class="f"><span id="tpLd"></span><input id="tpD" type="number" inputmode="decimal" step="any"></label>
      <label class="f"><span id="tpLc"></span><input id="tpC" type="number" inputmode="decimal" step="any"></label>
      <label class="f"><span id="tpLp"></span><input id="tpP" type="number" inputmode="decimal" step="any"></label>
      ${field('tpN', t('people'), 'value="1" min="1" step="1"')}
      <div id="out" class="out"></div>`,
    bind() {
      let sys = 'm';
      const calc = () => {
        const met = sys === 'm';
        $('#tpLd').textContent = t('distance') + (met ? ' (km)' : ' (mi)');
        $('#tpLc').textContent = t('consumption') + (met ? ' (L/100 km)' : ' (mpg)');
        $('#tpLp').textContent = t('fuelPrice') + (met ? ' / L' : ' / gal');
        const d = num('tpD'), c = num('tpC'), p = num('tpP'), n = Math.max(1, Math.round(num('tpN')));
        if ([d, c, p].some(isNaN)) { $('#out').innerHTML = ''; return; }
        if (c <= 0 || d < 0 || p < 0) { $('#out').innerHTML = errRow(); return; }
        const fuel = met ? d * c / 100 : d / c, cost = fuel * p;
        let h = row(t('fuelNeeded'), nf(fuel, 2) + (met ? ' L' : ' gal')) + row(t('tripCost'), money(cost), 'big');
        if (n > 1) h += row(t('perPerson'), money(cost / n));
        $('#out').innerHTML = h;
      };
      segBind('tpSys', (m) => { sys = m; calc(); });
      $('#main').oninput = calc;
      calc();
    }
  };

  /* ---- Savings growth (compound interest) ---- */
  SCR.comp = {
    html: () => `${field('cmI', t('initial'))}${field('cmA', t('monthlyAdd'))}${field('cmR', t('annualRate'))}${field('cmY', t('years'))}<div id="out" class="out"></div>`,
    bind() {
      const calc = () => {
        const I = num('cmI'), A = num('cmA') || 0, R = num('cmR'), Y = num('cmY');
        if (isNaN(I) || isNaN(R) || isNaN(Y)) { $('#out').innerHTML = ''; return; }
        const n = Math.round(Y * 12), r = R / 1200;
        if (n <= 0 || n > 1200 || I < 0 || A < 0) { $('#out').innerHTML = errRow(); return; }
        const g = Math.pow(1 + r, n);
        const fv = I * g + (r === 0 ? A * n : A * (g - 1) / r);
        const dep = I + A * n;
        $('#out').innerHTML = row(t('finalBal'), money(fv), 'big') + row(t('contributed'), money(dep)) + row(t('earned'), money(fv - dep));
      };
      $('#main').oninput = calc;
    }
  };

  /* ---- Work hours ---- */
  SCR.hrs = {
    html: () => `<div class="grid2"><label class="f"><span>${t('startT')}</span><input id="hrS" type="time" value="09:00"></label><label class="f"><span>${t('endT')}</span><input id="hrE" type="time" value="17:00"></label></div>
      ${field('hrB', t('breakMin'), 'value="0" min="0"')}${field('hrR', t('hourlyRate'))}<div id="out" class="out"></div>`,
    bind() {
      const mins = (v) => { if (!v) return NaN; const [h, m] = v.split(':').map(Number); return h * 60 + m; };
      const calc = () => {
        const s = mins($('#hrS').value);
        let e = mins($('#hrE').value);
        const b = num('hrB') || 0, rate = num('hrR');
        if (isNaN(s) || isNaN(e)) { $('#out').innerHTML = ''; return; }
        if (e < s) e += 1440;
        const w = e - s - b;
        if (w < 0) { $('#out').innerHTML = errRow(); return; }
        const hh = Math.floor(w / 60), mm = Math.round(w % 60);
        let h = row(t('hoursWorked'), hh + ':' + String(mm).padStart(2, '0'), 'big') + row(t('decimalH'), nf(w / 60, 2));
        if (!isNaN(rate)) h += row(t('pay'), money(w / 60 * rate));
        $('#out').innerHTML = h;
      };
      $('#main').oninput = calc;
      $('#main').onchange = calc;
      calc();
    }
  };

  /* ---- Gold ---- */
  SCR.gold = {
    html: () => `${field('gdW', t('weight') + ' (g)')}
      <label class="f"><span>${t('karat')}</span><select id="gdK">${[24, 22, 21, 18, 14, 10, 9].map(k => `<option value="${k}" ${k === 21 ? 'selected' : ''}>${k}K</option>`).join('')}</select></label>
      <div class="two"><label class="f"><span>${t('goldPrice')}</span><input id="gdP" type="number" inputmode="decimal" step="any"></label><span></span>
      <label class="f"><span>&nbsp;</span><select id="gdU"><option value="g">${t('perGram')}</option><option value="oz">${t('perOz')}</option></select></label></div>
      <div id="out" class="out"></div>`,
    bind() {
      const calc = () => {
        const w = num('gdW'), k = +$('#gdK').value, p = num('gdP');
        if (isNaN(w) || w < 0) { $('#out').innerHTML = ''; return; }
        let h = row(t('pureGold'), nf(w * k / 24, 3));
        if (!isNaN(p)) {
          const pg = $('#gdU').value === 'oz' ? p / 31.1034768 : p;
          h = row(t('goldValue'), money(w * k / 24 * pg), 'big') + h;
        }
        $('#out').innerHTML = h;
      };
      $('#main').oninput = calc;
    }
  };

  /* ---- Hijri converter ---- */
  let _hf;
  const hijriFmt = () => _hf || (_hf = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' }));
  function toHijri(d) {
    const p = hijriFmt().formatToParts(d);
    const g = (k) => parseInt(p.find(x => x.type === k).value, 10);
    return { y: g('year'), m: g('month'), d: g('day') };
  }
  function fromHijri(y, m, d) {
    const guess = Date.UTC(622, 6, 19) + ((y - 1) * 354.36707 + (m - 1) * 29.530588 + (d - 1)) * 864e5;
    const base = new Date(guess);
    const noon = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 12);
    for (let i = 0; i <= 45; i++) {
      for (const s of (i === 0 ? [0] : [i, -i])) {
        const dt = new Date(noon + s * 864e5);
        const h = toHijri(dt);
        if (h.y === y && h.m === m && h.d === d) return dt;
      }
    }
    return null;
  }
  SCR.hij = {
    html: () => {
      const n = new Date();
      const iso = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
      return `${segHTML('hjMode', [['g', t('g2h')], ['h', t('h2g')]])}
        <div id="hjG"><label class="f"><span>${t('gregDate')}</span><input id="hjDate" type="date" value="${iso}"></label></div>
        <div id="hjH" hidden><div class="grid2">${field('hjD', t('day'), 'value="1" min="1" max="30" step="1"')}<label class="f"><span>${t('month')}</span><select id="hjM"></select></label></div>${field('hjY', t('year'), 'step="1"')}</div>
        <div id="out" class="out"></div>
        <p class="note">${t('hijNote')}</p>`;
    },
    bind() {
      let mode = 'g';
      const cal = loc() + '-u-ca-islamic-umalqura';
      const fHij = new Intl.DateTimeFormat(cal, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
      const fGre = new Intl.DateTimeFormat(loc(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
      const fMon = new Intl.DateTimeFormat(cal, { month: 'long', timeZone: 'UTC' });
      const cy = toHijri(new Date()).y;
      $('#hjY').value = cy;
      $('#hjM').innerHTML = Array.from({ length: 12 }, (_, i) => {
        const dt = fromHijri(cy, i + 1, 1);
        return `<option value="${i + 1}">${i + 1} · ${dt ? fMon.format(dt) : ''}</option>`;
      }).join('');
      const calc = () => {
        if (mode === 'g') {
          const v = $('#hjDate').value;
          if (!v) { $('#out').innerHTML = ''; return; }
          const [y, m, d] = v.split('-').map(Number);
          const dt = new Date(Date.UTC(y, m - 1, d, 12));
          const h = toHijri(dt);
          $('#out').innerHTML = row(t('hijDate'), fHij.format(dt), 'big') + row('AH', h.d + ' / ' + h.m + ' / ' + h.y);
        } else {
          const d = Math.round(num('hjD')), m = +$('#hjM').value, y = Math.round(num('hjY'));
          if (isNaN(d) || isNaN(y)) { $('#out').innerHTML = ''; return; }
          const dt = y >= 1300 && y <= 1600 && d >= 1 && d <= 30 ? fromHijri(y, m, d) : null;
          $('#out').innerHTML = dt ? row(t('gregDate'), fGre.format(dt), 'big') + row('', dt.getUTCDate() + ' / ' + (dt.getUTCMonth() + 1) + ' / ' + dt.getUTCFullYear()) : errRow();
        }
      };
      segBind('hjMode', (m) => { mode = m; $('#hjG').hidden = m !== 'g'; $('#hjH').hidden = m !== 'h'; calc(); });
      $('#main').oninput = calc;
      $('#main').onchange = calc;
      calc();
    }
  };

  /* ---- Zakat ---- */
  SCR.zakat = {
    html: () => `${field('zkW', t('zWealth'))}${field('zkD', t('zDebts'), 'value="0" min="0"')}${field('zkG', t('zGoldG'))}<div id="out" class="out"></div><p class="note">${t('zNote')}</p>`,
    bind() {
      const calc = () => {
        const w = num('zkW'), d = num('zkD') || 0, g = num('zkG');
        if (isNaN(w) || isNaN(g) || g <= 0) { $('#out').innerHTML = ''; return; }
        const net = w - d, nisab = 85 * g;
        let h = row(t('zNisab'), money(nisab));
        h += net >= nisab ? row(t('zDue'), money(net * 0.025), 'big') : `<div class="pill good">${t('zBelow')}</div>`;
        $('#out').innerHTML = h;
      };
      $('#main').oninput = calc;
    }
  };

  SCR.calc = { html: calcHTML, bind: calcBind };

  /* ============================ SHELL ============================ */
  const NAV = ['calc', 'cur', 'tools'];
  const TOOLS = ['tva', 'disc', 'split', 'pct', 'marg', 'cmp', 'trip', 'comp', 'loan', 'unit', 'date', 'hij', 'hrs', 'bmi', 'gold', 'zakat', 'prog'];
  const ICON = { calc: '🧮', cur: '💱', tools: '🧰', tva: '🧾', disc: '🏷️', split: '🍽️', pct: '📊', marg: '💹', cmp: '🛒', trip: '⛽', comp: '📈', loan: '🏦', unit: '📏', date: '📅', hij: '🌙', hrs: '⏱️', bmi: '⚖️', gold: '🪙', zakat: '🤲', prog: '💻' };

  function go(id) { S.screen = id; store.set('screen', id); render(); }

  SCR.tools = {
    html: () => `<label class="f srch"><input id="toolQ" type="search" autocomplete="off" placeholder="${t('search')}…"></label>
      <div class="rows" id="toolRows">${TOOLS.map(id => `<button class="row" data-s="${id}" data-n="${t(id).toLowerCase()}"><i class="ico">${ICON[id]}</i><span>${t(id)}</span><em>›</em></button>`).join('')}</div>
      <p class="empty" id="toolNone" hidden>—</p>`,
    bind() {
      $('#main').onclick = (e) => { const b = e.target.closest('[data-s]'); if (b) go(b.dataset.s); };
      $('#main').oninput = (e) => {
        if (e.target.id !== 'toolQ') return;
        const q = e.target.value.trim().toLowerCase();
        let n = 0;
        $('#toolRows').querySelectorAll('.row').forEach(r => { const m = !q || r.dataset.n.includes(q); r.hidden = !m; if (m) n++; });
        $('#toolNone').hidden = n > 0;
      };
    }
  };

  const ACCENTS = [['#6366f1', '#a855f7'], ['#3b82f6', '#22d3ee'], ['#a855f7', '#ec4899'], ['#10b981', '#84cc16'], ['#ef4444', '#f97316'], ['#f97316', '#f59e0b'], ['#0d9488', '#38bdf8'], ['#f43f5e', '#a855f7'], ['#d946ef', '#fb923c'], ['#2563eb', '#7c3aed']];
  function applyTheme() {
    const d = document.documentElement;
    const ac = ACCENTS[S.accent] || ACCENTS[0];
    d.style.setProperty('--acc', ac[0]);
    d.style.setProperty('--acc2', ac[1]);
    d.style.setProperty('--grad', 'linear-gradient(135deg,' + ac[0] + ',' + ac[1] + ')');
    if (S.theme === 'auto') d.removeAttribute('data-theme'); else d.setAttribute('data-theme', S.theme);
    const dark = S.theme === 'dark' || (S.theme === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', dark ? '#090a10' : '#f3f4fb');
  }

  const SVG = {
    calc: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
    tools: '<path d="M12 3l4 7H8z"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5"/><circle cx="17.2" cy="17.2" r="3.3"/>',
    cur: '<circle cx="9" cy="9" r="5.5"/><circle cx="15" cy="15" r="5.5"/>',
    hist: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    sett: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
  };
  const NAV5 = ['calc', 'tools', 'cur', 'hist', 'sett'];
  function renderNav() {
    const active = NAV.includes(S.screen) ? S.screen : 'tools';
    $('#nav').innerHTML = NAV5.map(id => `<button data-s="${id}" class="${id === active ? 'on' : ''}"><svg viewBox="0 0 24 24" aria-hidden="true">${SVG[id]}</svg><span>${t(id)}</span></button>`).join('');
  }

  function render() {
    document.documentElement.lang = S.lang;
    document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
    applyTheme();
    if (!SCR[S.screen]) S.screen = 'calc';
    const main = $('#main');
    main.onclick = null; main.oninput = null; main.onchange = null;
    if (S.screen === 'calc') $('#title').innerHTML = 'Calc<b>Plus</b>'; else $('#title').textContent = t(S.screen);
    const bb = $('#backBtn');
    bb.hidden = !TOOLS.includes(S.screen);
    bb.textContent = S.lang === 'ar' ? '→' : '←';
    bb.setAttribute('aria-label', t('back'));
    main.innerHTML = SCR[S.screen].html();
    main.scrollTop = 0;
    SCR[S.screen].bind();
    const outEl = $('#out');
    if (outEl) {
      outEl.insertAdjacentHTML('afterend', `<button id="shOut" class="btn sec">⤴ ${t('share')}</button>`);
      $('#shOut').onclick = () => shareText(outText() && outText() + '\n— CalcPlus');
    }
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
      <div class="f"><span>${t('accent')}</span><div class="swatches" id="stAcc">${ACCENTS.map((c, i) => `<button type="button" data-i="${i}" class="${i === S.accent ? 'on' : ''}" style="background:linear-gradient(135deg,${c[0]},${c[1]})" aria-label="${c[0]}"></button>`).join('')}</div></div>
      <label class="chk"><input id="stVib" type="checkbox" ${S.vib ? 'checked' : ''}><span>${t('vib')}</span></label>
      <p class="note"><a href="privacy.html" target="_blank" rel="noopener">${t('privacy')}</a></p>`;
    openModal(t('sett'), body, () => {
      $('#stLang').onchange = (e) => { S.lang = e.target.value; store.set('lang', S.lang); render(); openSettings(); };
      $('#stTheme').onchange = (e) => { S.theme = e.target.value; store.set('theme', S.theme); applyTheme(); };
      $('#stAcc').onclick = (e) => {
        const b = e.target.closest('[data-i]'); if (!b) return;
        S.accent = +b.dataset.i; store.set('accent', S.accent); applyTheme();
        [...$('#stAcc').children].forEach(x => x.classList.toggle('on', x === b));
      };
      $('#stVib').onchange = (e) => { S.vib = e.target.checked; store.set('vib', S.vib); vibrate(); };
    });
  }

  /* ---- Android app only: AdMob banner (does nothing on the website) ----
     IDs below are Google's public TEST ids. Replace with your own AdMob banner id
     (and set testing: false) before publishing. */
  const ADMOB = { banner: 'ca-app-pub-3940256099942544/6300978111', testing: true };
  async function initAds() {
    const C = window.Capacitor;
    if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
    const A = C.Plugins && C.Plugins.AdMob;
    if (!A) return;
    try {
      try {
        const ci = await A.requestConsentInfo();
        if (ci && ci.isConsentFormAvailable && ci.status === 'REQUIRED') await A.showConsentForm();
      } catch (e) { /* consent not required or unavailable */ }
      await A.initialize({ initializeForTesting: ADMOB.testing });
      A.addListener('bannerAdSizeChanged', (sz) => { document.documentElement.style.setProperty('--adh', Math.round(sz.height) + 'px'); });
      document.body.classList.add('ads');
      await A.showBanner({ adId: ADMOB.banner, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: $('#nav').offsetHeight, isTesting: ADMOB.testing });
    } catch (e) { document.body.classList.remove('ads'); }
  }

  function init() {
    $('#nav').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; if (b.dataset.s === 'hist') return openHistory(); if (b.dataset.s === 'sett') return openSettings(); S.screen = b.dataset.s; store.set('screen', S.screen); render(); };
    $('#backBtn').onclick = () => go('tools');
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
    initAds();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.Capacitor) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* ignore */ });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
