package auth

import (
    "time"

    "github.com/golang-jwt/jwt/v5"
)

// JWTClaims JWT声明
type JWTClaims struct {
    UserID string `json:"user_id"`
    Type   string `json:"type"` // "access" or "refresh"
    jwt.RegisteredClaims
}

// JWTManager JWT管理器
type JWTManager struct {
    secretKey string
}

// NewJWTManager 创建JWT管理器
func NewJWTManager(secretKey string) *JWTManager {
    return &JWTManager{
        secretKey: secretKey,
    }
}

// GenerateAccessToken 生成访问令牌
func (j *JWTManager) GenerateAccessToken(userID string) (string, error) {
    claims := JWTClaims{
        UserID: userID,
        Type:   "access",
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
            NotBefore: jwt.NewNumericDate(time.Now()),
        },
    }

    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString([]byte(j.secretKey))
}

// GenerateRefreshToken 生成刷新令牌
func (j *JWTManager) GenerateRefreshToken(userID string) (string, error) {
    claims := JWTClaims{
        UserID: userID,
        Type:   "refresh",
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
            NotBefore: jwt.NewNumericDate(time.Now()),
        },
    }

    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString([]byte(j.secretKey))
}

// ValidateToken 验证令牌
func (j *JWTManager) ValidateToken(tokenString string) (*JWTClaims, error) {
    token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
        return []byte(j.secretKey), nil
    })

    if err != nil {
        return nil, err
    }

    if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
        return claims, nil
    }

    return nil, jwt.ErrInvalidKey
}

// ExtractUserID 从令牌中提取用户ID
func (j *JWTManager) ExtractUserID(tokenString string) (string, error) {
    claims, err := j.ValidateToken(tokenString)
    if err != nil {
        return "", err
    }
    return claims.UserID, nil
}
