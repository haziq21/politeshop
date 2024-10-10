package main

import (
	"context"
	"politeshop/politemall"
	"politeshop/services"
)

type contextKey int

const (
	// PolitemallClientContextKey is the context key for a [*politemall.Client].
	PolitemallClientContextKey contextKey = iota
	// ServiceClientContextKey is the context key for a [*services.ServiceClient].
	ServiceClientContextKey
)

func pmFromCtx(ctx context.Context) *politemall.Client {
	return ctx.Value(PolitemallClientContextKey).(*politemall.Client)
}

func ctxWithPm(ctx context.Context, pm *politemall.Client) context.Context {
	return context.WithValue(ctx, PolitemallClientContextKey, pm)
}

func scFromCtx(ctx context.Context) *services.ServiceClient {
	return ctx.Value(ServiceClientContextKey).(*services.ServiceClient)
}
