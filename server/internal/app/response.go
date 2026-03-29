package app

import (
	"encoding/json"
	"net/http"
)

type apiEnvelope struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func success(w http.ResponseWriter, data interface{}, message string) {
	if message == "" {
		message = "ok"
	}
	writeJSON(w, http.StatusOK, apiEnvelope{
		Code:    0,
		Message: message,
		Data:    data,
	})
}

func fail(w http.ResponseWriter, status int, message string, details interface{}) {
	writeJSON(w, status, apiEnvelope{
		Code:    status,
		Message: message,
		Data:    details,
	})
}
