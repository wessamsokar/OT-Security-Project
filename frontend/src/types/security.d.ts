export {};

declare global {
  interface Window {
    __CSP_NONCE__?: string;
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: {
      inject?: unknown;
      onCommitFiberRoot?: unknown;
      onCommitFiberUnmount?: unknown;
      renderers?: unknown;
      supportsFiber?: unknown;
    };
  }
}
