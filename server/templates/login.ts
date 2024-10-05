window.addEventListener("message", (messageEvent) => {
  globalThis.politeshopHeaders = messageEvent.data;

  document.body.addEventListener("htmx:configRequest", ((
    configRequestEvent: CustomEvent<{ headers: Record<string, string> }>
  ) => {
    configRequestEvent.detail.headers = {
      "X-D2l-Session-Val": messageEvent.data.d2lSessionVal,
      "X-D2l-Secure-Session-Val": messageEvent.data.d2lSecureSessionVal,
      "X-Brightspace-Token": messageEvent.data.brightspaceToken,
      "X-Polite-Domain": messageEvent.data.politeDomain,
      ...configRequestEvent.detail.headers,
    };
  }) as EventListener);

  document.getElementById("redirect")!.click();
});
