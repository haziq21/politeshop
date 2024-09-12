export type PolitemallAuth = {
    d2lSessionVal: string;
    d2lSecureSessionVal: string;
};

export type FullAuth = PolitemallAuth & {
    brightspaceToken: string;
};
