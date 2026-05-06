// Custom Connect/Disconnect button styled to match @tonconnect/ui-react's
// official `<TonConnectButton>` (brand TON blue, white TON-diamond glyph).
//
// Why we maintain a copy:
//  - The upstream component is a web-component shell that re-renders into its
//    own root via DOM mutations. Inside a Radix Dialog portal it lays out at
//    zero width and effectively disappears.
//  - One stylistic source of truth means header and dialog buttons stay in
//    perfect sync; if Toncast UI rebrands, we change ONE component.
//
// Behaviour:
//  - Disconnected: opens the wallet picker via `tc.openModal()`
//  - Connected:    shows the truncated address; click opens the account menu
//                  (we just use `disconnect()` here to keep things minimal —
//                  swap for a popover if you want copy-address / network UI).

import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { useT } from "@/lib/i18n/useT";
import { shortAddr } from "@/lib/format";

export function ConnectButton() {
  const t = useT();
  const [tc] = useTonConnectUI();
  const userAddress = useTonAddress();
  const connected = Boolean(userAddress);

  return (
    <button
      type="button"
      onClick={() => {
        if (connected) {
          void tc.disconnect();
        } else {
          void tc.openModal();
        }
      }}
      className="inline-flex h-10 items-center gap-2 rounded-full bg-gradient-to-b from-[#0098EA] to-[#0087D4] pl-3 pr-4 text-white shadow-[0_8px_24px_-8px_rgba(0,152,234,0.55)] transition-all duration-200 ease-out hover:brightness-110 active:scale-[0.98]"
    >
      <TonDiamond />
      <span className="text-[15px] leading-[18px]" style={{ fontWeight: 590 }}>
        {connected ? shortAddr(userAddress) : t("wallet.connect")}
      </span>
    </button>
  );
}

/** TON glyph — 1:1 copy of the SVG shipped by `<TonConnectButton>`. */
function TonDiamond() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" role="img" aria-label="TON">
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
