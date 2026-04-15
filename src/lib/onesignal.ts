declare global {
  interface Window {
    OneSignal?: {
      login?: (externalId: string) => Promise<void> | void;
    };
  }
}

export const attachOneSignalIdentity = async (externalId: string) => {
  if (!window.OneSignal?.login) return;
  try {
    await window.OneSignal.login(externalId);
  } catch {
    // Ignore OneSignal setup issues in demo mode.
  }
};
