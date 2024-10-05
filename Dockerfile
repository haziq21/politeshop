FROM golang:alpine AS build
WORKDIR /app
COPY server .
RUN go build -o /bin/app ./main.go

FROM scratch
COPY --from=build /bin/app /bin/app
CMD ["/bin/app"]