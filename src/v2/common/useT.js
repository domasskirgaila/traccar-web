import { useMemo } from 'react';
import { useLocalization, useTranslation } from '../../common/components/LocalizationProvider';
import en from '../l10n/en';
import lt from '../l10n/lt';

const dictionaries = { en, lt };

// New UI strings first, then the shared Traccar translations, then the key itself.
const useT = () => {
  const { language } = useLocalization();
  const shared = useTranslation();
  return useMemo(() => {
    const dictionary = dictionaries[language] || {};
    return (key) => dictionary[key] ?? en[key] ?? shared(key) ?? key;
  }, [language, shared]);
};

export default useT;
