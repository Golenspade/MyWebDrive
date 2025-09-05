module github.com/mywebdrive/api-gateway

go 1.21

require (
	github.com/golang-jwt/jwt/v5 v5.2.0
	github.com/labstack/echo/v4 v4.11.4
	github.com/mattn/go-sqlite3 v1.14.32
	go.uber.org/zap v1.26.0
	mywebdrive.local/pkg/config v0.0.0-00010101000000-000000000000
	mywebdrive.local/pkg/database v0.0.0-00010101000000-000000000000
	mywebdrive.local/pkg/metrics v0.0.0-00010101000000-000000000000
	mywebdrive/common v0.0.0-00010101000000-000000000000
)

require (
	github.com/golang-jwt/jwt v3.2.2+incompatible // indirect
	github.com/google/uuid v1.3.0 // indirect
	github.com/labstack/gommon v0.4.2 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/valyala/bytebufferpool v1.0.0 // indirect
	github.com/valyala/fasttemplate v1.2.2 // indirect
	go.uber.org/multierr v1.10.0 // indirect
	golang.org/x/crypto v0.18.0 // indirect
	golang.org/x/net v0.19.0 // indirect
	golang.org/x/sys v0.16.0 // indirect
	golang.org/x/text v0.14.0 // indirect
	golang.org/x/time v0.5.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

replace mywebdrive.local/pkg/config => ../pkg/config

replace mywebdrive.local/pkg/database => ../pkg/database

replace mywebdrive.local/pkg/metrics => ../pkg/metrics

replace mywebdrive/common => ../common
