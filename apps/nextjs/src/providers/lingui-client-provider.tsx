"use client";

import { useMemo } from "react";
import { setupI18n } from "@lingui/core";
import { compileMessage } from "@lingui/message-utils/compileMessage";
import { I18nProvider } from "@lingui/react";

export function LinguiClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const i18n = useMemo(() => {
    const instance = setupI18n({
      locale: "en",
      messages: { en: {} },
    });

    instance.setMessagesCompiler(compileMessage);

    return instance;
  }, []);

  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}
