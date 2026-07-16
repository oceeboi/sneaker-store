import { countryCurrencyMapping } from '@/constants/countries';
import type { CountryName, CurrencyCode, LocaleCode } from '@/types/country';

/**
 * Base currency formatter with configurable global defaults.
 *
 * IMPORTANT: all `amount`/`value` inputs across this module are expected in
 * the currency's smallest unit (kobo for NGN, cents for USD, pence for GBP)
 * — matching how amounts are stored everywhere else in the system (Product
 * pricing, Order totals, Transaction amounts). This class converts down to
 * the major unit only at the point of display, never before.
 */
class CurrencyFormatterBase {
  private static _defaultCountry: CountryName = 'United States';
  private static _defaultCurrency: CurrencyCode = 'USD';
  private static _defaultLocale: LocaleCode = 'en-US';

  /** Set a global default country (updates currency/locale from mapping if found). */
  static setDefaultCountry(country: CountryName) {
    this._defaultCountry = country;
    const mapping = countryCurrencyMapping.find((c) => c.country === country);
    if (mapping) {
      this._defaultCurrency = mapping.currency;
      this._defaultLocale = mapping.locale;
    }
  }

  /** Explicitly set global default currency and locale. */
  static setDefaults({ currency, locale }: { currency?: CurrencyCode; locale?: LocaleCode }) {
    if (currency) this._defaultCurrency = currency;
    if (locale) this._defaultLocale = locale;
  }

  /** Get current global defaults. */
  static get defaults() {
    return {
      country: this._defaultCountry,
      currency: this._defaultCurrency,
      locale: this._defaultLocale,
    };
  }

  /** Resolve currency/locale for a given country with fallback to global defaults. */
  static resolveForCountry(country?: CountryName) {
    if (!country) {
      return { currency: this._defaultCurrency, locale: this._defaultLocale };
    }
    const mapping = countryCurrencyMapping.find((c) => c.country === country);
    return {
      currency: mapping?.currency || this._defaultCurrency,
      locale: mapping?.locale || this._defaultLocale,
    };
  }

  /**
   * How many decimal places this currency's major unit uses — 2 for
   * NGN/USD/GBP (kobo, cents, pence), 0 for JPY/KRW/VND (no subdivision).
   * Asking Intl directly instead of hardcoding /100 keeps this correct for
   * every currency, not just the ones we've tested against.
   */
  private static minorUnitDigits(currency: CurrencyCode): number {
    const resolved = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions();
    return resolved.maximumFractionDigits ?? 2;
  }

  /**
   * Converts a smallest-unit integer (kobo, cents, pence) into the major
   * unit float Intl.NumberFormat expects (naira, dollars, pounds).
   */
  private static toMajorUnit(amountInSmallestUnit: number, currency: CurrencyCode): number {
    const digits = this.minorUnitDigits(currency);
    return amountInSmallestUnit / Math.pow(10, digits);
  }

  /**
   * Format an amount given in the currency's smallest unit (kobo, cents,
   * etc.) using either the provided country or global defaults.
   */
  static format(amountInSmallestUnit: number, country?: CountryName) {
    const { currency, locale } = this.resolveForCountry(country);
    const majorUnitAmount = this.toMajorUnit(amountInSmallestUnit, currency);
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(majorUnitAmount);
  }
}

/**
 * Formats a given amount (in the currency's smallest unit — kobo, cents,
 * etc.) into a currency string based on the specified country.
 */
function formatCurrency(amountInSmallestUnit: number, country: string): string {
  const mapping = countryCurrencyMapping.find((item) => item.country === country);

  if (!mapping) {
    // Fall back to global defaults instead of throwing, to allow wider usage
    return CurrencyFormatterBase.format(amountInSmallestUnit);
  }

  return CurrencyFormatterBase.format(amountInSmallestUnit, country as CountryName);
}

// Convenience wrapper matching the provided snippet name
function formatCurrencyNumber(amountInSmallestUnit: number, country?: CountryName) {
  return CurrencyFormatterBase.format(amountInSmallestUnit, country);
}

export { formatCurrency, formatCurrencyNumber, CurrencyFormatterBase };

// Example usage:
// CurrencyFormatterBase.setDefaultCountry('United Kingdom');
// CurrencyFormatterBase.setDefaults({ currency: 'GBP', locale: 'en-GB' });
// CurrencyFormatterBase.format(123456);              // 123456 kobo/pence → "£1,234.56"
// CurrencyFormatterBase.format(123456, 'Japan');     // 123456 yen (JPY has no minor unit) → "¥123,456"
// formatCurrency(500000, 'Nigeria');                 // 500000 kobo → "₦5,000.00"
// formatCurrency(1234.56, 'Unknown Country');         // Falls back to defaults
