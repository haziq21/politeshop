/** Change the hostname of internal links. */
export function overrideInternalLinks(
  container: HTMLElement,
  hostname: string,
) {
  const links = container.querySelectorAll<HTMLAnchorElement>(
    "a[href]:not([data-preserve-url])",
  );
  links.forEach((link) => {
    if (link.host !== location.host) return;
    link.hostname = hostname;
    link.port = "";
  });
}

/**
 * Return a `MutationObserver`, running the given callback
 * every time an `<a>` tag is created or its `href` updated.
 */
export function createLinkObserver(
  callback: (el: HTMLAnchorElement) => void,
): MutationObserver {
  return new MutationObserver((mutations) => {
    for (const node of mutations.flatMap((m) => Array.from(m.addedNodes))) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as HTMLElement;

      // Run the callback if an <a> was created
      if (
        el.tagName === "A" &&
        el.hasAttribute("href") &&
        !el.dataset.preserveUrl
      ) {
        callback(el as HTMLAnchorElement);
      }

      // Run the callback if something containing an <a> was created
      if (el.querySelector("a[href]:not([data-preserve-url])")) {
        callback(el as HTMLAnchorElement);
      }
    }

    for (const mut of mutations) {
      if (
        mut.type !== "attributes" ||
        mut.target.nodeType === Node.ELEMENT_NODE
      ) {
        continue;
      }
      const el = mut.target as HTMLElement;

      // Run the callback if a href was modified
      if (
        el.tagName === "A" &&
        el.hasAttribute("href") &&
        !el.dataset.preserveUrl
      ) {
        callback(el as HTMLAnchorElement);
      }
    }
  });
}
