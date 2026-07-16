import { CurrencyFormatterBase } from '@/packages/format-currency';

function format_currency(amount: number): string {
  CurrencyFormatterBase.setDefaultCountry('Nigeria');
  return CurrencyFormatterBase.format(amount);
}
export { format_currency };
