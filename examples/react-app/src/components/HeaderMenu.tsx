// Single header control:
//  - When the wallet is disconnected: shows a "Connect Wallet" pill plus
//    the burger menu (theme + language).
//  - When connected: shows ONLY the wallet pill — clicking it opens the
//    account menu with copy address, disconnect, theme and language.
//
// Built on Radix's `DropdownMenu` for positioning + focus management.
// Language picker uses a separate Dialog so its long list (10 locales)
// doesn't try to fly out as a sub-menu and clip on mobile.

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@toncast/sdk";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { Check, Copy, Languages, LogOut, Menu, Moon, Receipt, Sun } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { shortAddr } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useT } from "@/lib/i18n/useT";
import { useTheme } from "@/lib/theme";

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  ru: "Русский",
  hi: "हिन्दी",
  es: "Español",
  zh: "中文",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  fa: "فارسی",
  ar: "العربية",
};

export function HeaderMenu() {
  const userAddress = useTonAddress();
  const [tc] = useTonConnectUI();
  const connected = Boolean(userAddress);
  const [langOpen, setLangOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      {!connected ? <ConnectPill onClick={() => void tc.openModal()} /> : null}
      <Menu_
        connected={connected}
        userAddress={userAddress}
        onDisconnect={() => void tc.disconnect()}
        onOpenLanguage={() => setLangOpen(true)}
      />
      <LanguageDialog open={langOpen} onOpenChange={setLangOpen} />
    </div>
  );
}

function ConnectPill({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-full bg-linear-to-b from-[#0098EA] to-[#0087D4] pl-3 pr-4 text-white shadow-[0_8px_24px_-8px_rgba(0,152,234,0.55)] transition-all duration-200 ease-out hover:brightness-110 active:scale-[0.98]"
    >
      <TonDiamond />
      <span className="text-[15px] leading-[18px]" style={{ fontWeight: 590 }}>
        {t("wallet.connect")}
      </span>
    </button>
  );
}

function Menu_({
  connected,
  userAddress,
  onDisconnect,
  onOpenLanguage,
}: {
  connected: boolean;
  /** `useTonAddress()` returns "" when no wallet — keep the broader type. */
  userAddress: string;
  onDisconnect: () => void;
  onOpenLanguage: () => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const { theme, toggle: toggleTheme } = useTheme();
  const { lang } = useI18n();

  const onCopyAddress = async () => {
    if (!userAddress) return;
    try {
      await navigator.clipboard.writeText(userAddress);
      toast.success(t("toast.copied"));
    } catch {
      toast.error(t("toast.copyFailed"));
    }
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="glass-subtle inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-all duration-200 ease-out hover:bg-[rgb(var(--glass-bg)/calc(var(--glass-bg-alpha)*0.85))] active:scale-95"
          aria-label={connected ? "Open account menu" : "Open menu"}
        >
          <Menu className="size-5" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          collisionPadding={8}
          className="glass z-50 min-w-[240px] rounded-xl border border-border/40 p-1 shadow-2xl outline-none animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
        >
          {connected && (
            <>
              {/* Address row — full address (truncated) with a tiny copy button. */}
              <div className="flex items-center gap-2 px-3 py-2">
                <TonDiamondMono />
                <span className="flex-1 truncate font-mono text-xs text-foreground">
                  {shortAddr(userAddress, 8, 6)}
                </span>
                <button
                  type="button"
                  onClick={onCopyAddress}
                  aria-label={t("menu.copyAddress")}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[rgb(var(--glass-bg)/calc(var(--glass-bg-alpha)*0.85))] hover:text-foreground"
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
              <DropdownMenu.Separator className="my-1 h-px bg-border/50" />
              <Item onSelect={() => navigate("/bets")}>
                <Receipt className="size-4" />
                <span className="flex-1">{t("menu.myBets")}</span>
              </Item>
              <Item onSelect={onDisconnect}>
                <LogOut className="size-4 text-destructive" />
                <span className="flex-1">{t("menu.disconnect")}</span>
              </Item>
              <DropdownMenu.Separator className="my-1 h-px bg-border/50" />
            </>
          )}

          <Item onSelect={toggleTheme}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            <span className="flex-1">
              {theme === "dark" ? t("menu.theme.light") : t("menu.theme.dark")}
            </span>
          </Item>

          <Item onSelect={onOpenLanguage}>
            <Languages className="size-4" />
            <span className="flex-1">{t("menu.language")}</span>
            <span className="text-xs text-muted-foreground">{LANGUAGE_LABELS[lang]}</span>
          </Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function TonDiamondMono() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      role="img"
      aria-label="TON"
      className="text-primary"
    >
      <title>TON</title>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14.1839 17.7069C13.6405 18.6507 13.3688 19.1226 13.0591 19.348C12.4278 19.8074 11.5723 19.8074 10.941 19.348C10.6312 19.1226 10.3595 18.6507 9.81613 17.7069L5.52066 10.2464C4.76864 8.94024 4.39263 8.28717 4.33762 7.75894C4.2255 6.68236 4.81894 5.65591 5.80788 5.21589C6.29309 5 7.04667 5 8.55383 5H15.4462C16.9534 5 17.7069 5 18.1922 5.21589C19.1811 5.65591 19.7745 6.68236 19.6624 7.75894C19.6074 8.28717 19.2314 8.94024 18.4794 10.2464L14.1839 17.7069ZM11.1 16.3412L6.56139 8.48002C6.31995 8.06185 6.19924 7.85276 6.18146 7.68365C6.14523 7.33896 6.33507 7.01015 6.65169 6.86919C6.80703 6.80002 7.04847 6.80002 7.53133 6.80002H7.53134L11.1 6.80002V16.3412ZM12.9 16.3412L17.4387 8.48002C17.6801 8.06185 17.8008 7.85276 17.8186 7.68365C17.8548 7.33896 17.665 7.01015 17.3484 6.86919C17.193 6.80002 16.9516 6.80002 16.4687 6.80002L12.9 6.80002V16.3412Z"
      />
    </svg>
  );
}

function LanguageDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const { lang: current, setLang } = useI18n();

  const pick = (l: SupportedLanguage) => {
    setLang(l);
    toast.success(t("toast.languageSet", { label: LANGUAGE_LABELS[l] }));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-4">
        <DialogTitle className="text-base font-semibold tracking-tight">
          {t("menu.language")}
        </DialogTitle>
        <div className="grid grid-cols-2 gap-1 pt-2">
          {SUPPORTED_LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => pick(l)}
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors hover:bg-[rgb(var(--glass-bg)/calc(var(--glass-bg-alpha)*0.85))] focus:bg-[rgb(var(--glass-bg)/calc(var(--glass-bg-alpha)*0.85))]"
            >
              <span>{LANGUAGE_LABELS[l]}</span>
              {current === l ? <Check className="size-4 text-primary" /> : null}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Item({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors hover:bg-[rgb(var(--glass-bg)/calc(var(--glass-bg-alpha)*0.85))] focus:bg-[rgb(var(--glass-bg)/calc(var(--glass-bg-alpha)*0.85))]"
    >
      {children}
    </DropdownMenu.Item>
  );
}

function TonDiamond() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" role="img" aria-label="TON">
      <title>TON</title>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14.1839 17.7069C13.6405 18.6507 13.3688 19.1226 13.0591 19.348C12.4278 19.8074 11.5723 19.8074 10.941 19.348C10.6312 19.1226 10.3595 18.6507 9.81613 17.7069L5.52066 10.2464C4.76864 8.94024 4.39263 8.28717 4.33762 7.75894C4.2255 6.68236 4.81894 5.65591 5.80788 5.21589C6.29309 5 7.04667 5 8.55383 5H15.4462C16.9534 5 17.7069 5 18.1922 5.21589C19.1811 5.65591 19.7745 6.68236 19.6624 7.75894C19.6074 8.28717 19.2314 8.94024 18.4794 10.2464L14.1839 17.7069ZM11.1 16.3412L6.56139 8.48002C6.31995 8.06185 6.19924 7.85276 6.18146 7.68365C6.14523 7.33896 6.33507 7.01015 6.65169 6.86919C6.80703 6.80002 7.04847 6.80002 7.53133 6.80002H7.53134L11.1 6.80002V16.3412ZM12.9 16.3412L17.4387 8.48002C17.6801 8.06185 17.8008 7.85276 17.8186 7.68365C17.8548 7.33896 17.665 7.01015 17.3484 6.86919C17.193 6.80002 16.9516 6.80002 16.4687 6.80002L12.9 6.80002V16.3412Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}
