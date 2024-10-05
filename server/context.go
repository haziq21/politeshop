package main

import (
	"context"
	"politeshop/politemall"
	"politeshop/services"
)

type ctxKey int

const (
	PmCtxKey ctxKey = iota
	ScCtxKey
)

func pmFromCtx(ctx context.Context) *politemall.PolitemallClient {
	return ctx.Value(PmCtxKey).(*politemall.PolitemallClient)
}

func ctxWithPm(ctx context.Context, pm *politemall.PolitemallClient) context.Context {
	return context.WithValue(ctx, PmCtxKey, pm)
}

func scFromCtx(ctx context.Context) *services.ServiceClient {
	return ctx.Value(ctxKey(ScCtxKey)).(*services.ServiceClient)
}
