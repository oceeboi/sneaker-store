import type { I18nConfig } from 'next-i18next';
import { readFile } from 'fs/promises';
import path from 'path';

const load_locale_from_disk: I18nConfig['resourceLoader'] = async (language, namespace) => {
  const locale_file_path = path.resolve(
    process.cwd(),
    `i18n/locales/${language}/${namespace}.json`
  );

  try {
    const locale_file_content = await readFile(locale_file_path, 'utf-8');
    return JSON.parse(locale_file_content);
  } catch (error: unknown) {
    const is_missing_file_error =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT';

    if (is_missing_file_error) {
      // Missing locale files should not crash builds; return empty messages.
      return {};
    }

    throw error;
  }
};

const i18nConfig: I18nConfig = {
  supportedLngs: ['en', 'de', 'it'],
  fallbackLng: 'en',
  defaultNS: 'translation',
  ns: ['translation', 'footer', 'client-page', 'second-page', 'second-client-page'],
  resourceLoader: load_locale_from_disk,
  reloadOnPrerender: process.env.NODE_ENV === 'development',
};

export default i18nConfig;
