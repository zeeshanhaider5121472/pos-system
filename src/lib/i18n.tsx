"use client";
import { createContext, useContext, useEffect, useState } from "react";

import { getSetting, setSetting } from "./db";
import { en } from "./i18n/en";
import { ur } from "./i18n/ur";

const dicts = { en, ur } as const;
type Lang = keyof typeof dicts;
const Ctx = createContext<{
  lang: Lang;
  t: (k: string) => string;
  setLang: (l: Lang) => void;
}>({ lang: "en", t: (k) => k, setLang: () => {} });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    getSetting("lang").then((l) => {
      if (l === "ur" || l === "en") apply(l);
    });
  }, []);
  const apply = (l: Lang) => {
    setLangState(l);
    document.documentElement.lang = l;
    document.documentElement.dir = l === "ur" ? "rtl" : "ltr";
  };
  const setLang = (l: Lang) => {
    apply(l);
    setSetting("lang", l);
  };
  const t = (k: string) => dicts[lang][k] ?? en[k] ?? k;
  return <Ctx.Provider value={{ lang, t, setLang }}>{children}</Ctx.Provider>;
}
export const useT = () => useContext(Ctx);
