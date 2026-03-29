package app

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type contextKey string

const userContextKey contextKey = "user"

type AuthUser struct {
	ID        int64  `json:"id"`
	Username  string `json:"username"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	CreatedAt string `json:"createdAt"`
}

type authClaims struct {
	UserID int64 `json:"userId"`
	jwt.RegisteredClaims
}

func hashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

func comparePassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func (a *App) createToken(userID int64) (string, error) {
	claims := authClaims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(a.cfg.JWTSecret))
}

func (a *App) authenticate(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			fail(w, http.StatusUnauthorized, "未提供有效的认证令牌", nil)
			return
		}

		tokenString := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
		claims := &authClaims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return []byte(a.cfg.JWTSecret), nil
		})
		if err != nil || !token.Valid {
			fail(w, http.StatusUnauthorized, "认证失败", errString(err))
			return
		}

		user, err := a.getUserByID(r.Context(), claims.UserID)
		if err != nil {
			fail(w, http.StatusUnauthorized, "用户不存在或登录已失效", nil)
			return
		}

		ctx := context.WithValue(r.Context(), userContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

func requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := currentUser(r.Context())
		if !ok || user.Role != "admin" {
			fail(w, http.StatusForbidden, "该操作需要管理员权限", nil)
			return
		}
		next.ServeHTTP(w, r)
	}
}

func requireApplicant(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, ok := currentUser(r.Context())
		if !ok || user.Role != "applicant" {
			fail(w, http.StatusForbidden, "该操作需要项目申请者权限", nil)
			return
		}
		next.ServeHTTP(w, r)
	}
}

func currentUser(ctx context.Context) (AuthUser, bool) {
	user, ok := ctx.Value(userContextKey).(AuthUser)
	return user, ok
}

func decodeJSON(r *http.Request, dst interface{}) error {
	defer r.Body.Close()
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(dst)
}

func errString(err error) interface{} {
	if err == nil {
		return nil
	}
	if errors.Is(err, context.Canceled) {
		return "request canceled"
	}
	return err.Error()
}
