import React, { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { IntlProvider } from 'react-intl';
import { DEFAULT_LOCALE, messages, type SupportedLocale } from './messages';

type LocaleContextValue = {
    locale: SupportedLocale;
    setLocale: React.Dispatch<React.SetStateAction<SupportedLocale>>;
};

const LocaleContext = createContext<LocaleContextValue>({
    locale: DEFAULT_LOCALE,
    setLocale: () => null
});

export const LocaleProvider = ({ children }: PropsWithChildren) => {
    const [locale, setLocale] = useState<SupportedLocale>(DEFAULT_LOCALE);
    const localeMessages = useMemo(() => messages[locale], [locale]);

    return (
        <LocaleContext.Provider value={{ locale, setLocale }}>
            <IntlProvider locale={locale} messages={localeMessages} defaultLocale={DEFAULT_LOCALE}>
                {children}
            </IntlProvider>
        </LocaleContext.Provider>
    );
};

export const useLocale = () => useContext(LocaleContext);
