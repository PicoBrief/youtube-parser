let _proxyUrls: string[] = [];

/**
 * Configure the youtube-parser library.
 * Call once at application startup before using any handler classes.
 */
export function configure(opts: { proxyUrls?: string[] }): void {
    if (opts.proxyUrls !== undefined) _proxyUrls = opts.proxyUrls;
}

export function getProxyUrls(): string[] {
    return _proxyUrls;
}
