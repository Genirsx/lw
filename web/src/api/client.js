const API_BASE = "";

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("charity-token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const payload = await response.json();
  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.message || "请求失败");
  }

  return payload.data;
}

export function formatMoney(cents) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY"
  }).format((Number(cents) || 0) / 100);
}

export function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

export function truncateHash(value, size = 12) {
  if (!value) {
    return "-";
  }

  if (value.length <= size * 2) {
    return value;
  }

  return `${value.slice(0, size)}...${value.slice(-6)}`;
}
